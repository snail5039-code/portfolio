// 자산 탭 (docs/plan/12-todo-by-stage.md 1-2): 잔액·보유·오늘 주문을 한 화면에.
// 앱은 증권사에서 직접 읽는다 (주문 가능 금액·오늘 주문 내역 포함). 웹은 폰이 올린 스냅샷과 서버 기록을 본다.

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../broker/broker.dart';
import '../../common/common.dart';
import '../history/history_page.dart';
import '../settings/broker_page.dart';
import 'overview.dart';
import 'portfolio_page.dart';

/// 증권사에서만 알 수 있는 것 (앱). 실패하면 그 칸만 실패로 보여준다
typedef BrokerExtras = ({int? buyingPower, List<BrokerOrder>? orders, String? error});

Future<BrokerExtras?> loadBrokerExtras() async {
  final broker = currentBroker.value;
  if (kIsWeb || broker == null) return null;
  try {
    final power = await broker.buyingPower();
    final orders = await broker.todayOrders(''); // 전체 종목
    return (buyingPower: power, orders: orders, error: null);
  } catch (error) {
    return (buyingPower: null, orders: null, error: '${broker.name} 조회 실패: ${error is BrokerError ? error.message : '연결할 수 없어요'}');
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.onAsk, required this.active});
  final void Function(String text) onAsk;
  final bool active; // 탭으로 돌아올 때마다 새로 읽는다

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late Future<(Overview, BrokerExtras?)> _data = _load();

  // 증권사 호출은 차례로 (KIS 모의는 초당 호출 수가 적다)
  Future<(Overview, BrokerExtras?)> _load() async {
    final overview = await loadOverview();
    return (overview, await loadBrokerExtras());
  }

  void _reload() => setState(() { _data = _load(); });

  @override
  void didUpdateWidget(HomePage old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _reload();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: topBar('자산'),
        body: FutureBuilder(
          future: _data,
          builder: (context, snapshot) {
            if (snapshot.hasError) return ErrorRetry(snapshot.error!, _reload);
            if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
            final (overview, extras) = snapshot.data!;
            return RefreshIndicator(onRefresh: () async => _reload(), child: _body(overview, extras));
          },
        ),
      );

  Widget _body(Overview o, BrokerExtras? extras) {
    final balance = o.balance;
    if (balance == null) {
      return ListView(padding: const EdgeInsets.all(16), children: [
        RingsCard(overview: o, big: true),
        Card(
          child: ListTile(
            title: Text(kIsWeb ? '폰 앱을 열면 잔고가 여기에 보여요' : '증권사를 연결하면 잔고를 볼 수 있어요'),
            trailing: kIsWeb ? null : const Icon(Icons.chevron_right),
            onTap: kIsWeb
                ? null
                : () async {
                    await Navigator.of(context).push(pageRoute(const BrokerPage()));
                    _reload();
                  },
          ),
        ),
      ]);
    }
    final t = totals(balance);
    final gain = t.value - t.cost;
    final limit = o.today['daily_limit_krw'] as int;
    final used = o.today['daily_used_krw'] as int;

    return ListView(padding: const EdgeInsets.all(16), children: [
      // 1. 총자산
      Card(
        color: const Color(0xFFE3F1FC),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('총 자산', style: TextStyle(color: mutedText)),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(won(t.total), style: const TextStyle(fontFamily: displayFont, fontSize: 34)),
            ),
            Text('평가손익 ${signedWon(gain)} (${rateText(gain, t.cost)})',
                style: TextStyle(fontWeight: FontWeight.bold, color: changeColor(gain))),
            const SizedBox(height: 4),
            SourceText(sourceOf(balance)),
          ]),
        ),
      ),
      // 2. 돈
      Row(children: [
        Expanded(child: _stat('주문 가능 금액',
            extras?.buyingPower != null ? won(extras!.buyingPower!) : kIsWeb ? '폰 앱에서 확인' : '조회 실패',
            hint: '지금 주문에 쓸 수 있는 돈')),
        const SizedBox(width: 10),
        Expanded(child: _stat('예수금 (결제 후)', won(balance['cash_krw'] as int), hint: '사고판 대금이 결제된 뒤(D+2) 남는 현금')),
      ]),
      Row(children: [
        Expanded(child: _stat('주식 평가금', won(t.value), hint: '매입 ${won(t.cost)}')),
        const SizedBox(width: 10),
        Expanded(child: _stat('오늘 주문 / 1일 한도', '${won(used)} / ${won(limit)}',
            hint: '남은 한도 ${won((limit - used).clamp(0, limit))}')),
      ]),
      if (extras?.error != null) Text(extras!.error!, style: const TextStyle(color: Colors.orange)),
      const SizedBox(height: 8),
      RingsCard(overview: o, showTotal: false), // 총자산은 위에 있다
      const SizedBox(height: 8),
      Card(
        child: ListTile(
          leading: const Icon(Icons.pie_chart_outline, color: brandBlue),
          title: const Text('포트폴리오 점검', style: TextStyle(fontWeight: FontWeight.bold)),
          subtitle: const Text('비중 · 쏠림 · 현금 비율과 조정 제안'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.of(context).push(pageRoute(const PortfolioPage())),
        ),
      ),
      // 3. 보유 종목
      const SizedBox(height: 16),
      Row(children: [
        const Text('보유 종목', style: TextStyle(fontFamily: displayFont, fontSize: 20)),
        const Spacer(),
        Text('${holdingsOf(balance).length}종목', style: const TextStyle(color: mutedText)),
      ]),
      if (holdingsOf(balance).isEmpty) const Padding(padding: EdgeInsets.all(8), child: Text('보유 종목이 없어요')),
      for (final h in holdingsOf(balance)) _holding(h, t.total),
      if (kIsWeb) const SourceText('웹은 현재가 대신 평균 매입가로 계산해요 (실시간 시세는 폰에서)'),
      // 4. 오늘 주문
      const SizedBox(height: 16),
      const Text('오늘 주문', style: TextStyle(fontFamily: displayFont, fontSize: 20)),
      ..._todayOrders(o, extras),
      const SizedBox(height: 16),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final text in ['잔고 보여줘', '삼성전자 사도 돼?', '아까 주문 체결됐어?'])
          ActionChip(label: Text(text), onPressed: () => widget.onAsk(text)),
      ]),
    ]);
  }

  Widget _stat(String label, String value, {String? hint}) => Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 12, color: mutedText)),
            FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900))),
            if (hint != null) Text(hint, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: mutedText)),
          ]),
        ),
      );

  Widget _holding(Map<String, dynamic> h, int total) {
    final avg = h['avg_price'] as int;
    final qty = h['qty'] as int;
    final price = priceOf(h);
    final value = price * qty;
    final gain = (price - avg) * qty;
    final weight = total == 0 ? 0.0 : value * 100 / total;
    final name = h['stock_name'] as String;
    return Card(
      child: InkWell(
        onTap: () => widget.onAsk('$name 더 사도 돼?'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(children: [
            Row(children: [
              RoomAvatar(text: name.length <= 2 ? name : name.substring(0, 2), color: Colors.white, foreground: ink, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name, style: const TextStyle(fontWeight: FontWeight.w900)),
                  Text('${comma(qty)}주 · 평균 ${won(avg)} · 현재 ${won(price)}', style: const TextStyle(fontSize: 12, color: mutedText)),
                ]),
              ),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(won(value), style: const TextStyle(fontWeight: FontWeight.bold)),
                Text('${gain > 0 ? '+' : ''}${comma(gain)}원 (${rateText(gain, avg * qty)})',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: changeColor(gain))),
              ]),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(value: weight / 100, minHeight: 6, color: brandBlue,
                      backgroundColor: const Color(0xFFDDE3EA)),
                ),
              ),
              const SizedBox(width: 8),
              Text('비중 ${weight.toStringAsFixed(1)}%', style: const TextStyle(fontSize: 12, color: mutedText)),
            ]),
          ]),
        ),
      ),
    );
  }

  /// 앱: 증권사 오늘 주문 내역 (체결·미체결). 웹: 서버 기록 (폰이 보낸 주문 결과)
  List<Widget> _todayOrders(Overview o, BrokerExtras? extras) {
    final orders = extras?.orders;
    if (orders != null) {
      if (orders.isEmpty) return [const Padding(padding: EdgeInsets.all(8), child: Text('오늘 주문이 없어요'))];
      return [
        for (final order in orders.reversed)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(order.filledQty >= order.qty ? Icons.check_circle : Icons.schedule,
                color: order.filledQty >= order.qty ? calmGreen : coachOrange),
            title: Text('${order.stockName} ${comma(order.qty)}주 ${sideLabels[order.side]} · ${won(order.price)}',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text(order.filledQty >= order.qty
                ? '체결 ${comma(order.filledQty)}주 × ${won(order.filledPrice ?? order.price)} · 주문번호 ${order.orderNo}'
                : '미체결 (체결 ${comma(order.filledQty)} / ${comma(order.qty)}주) · 주문번호 ${order.orderNo}'),
            trailing: Text(_hhmmOf(order.time), style: const TextStyle(color: mutedText)),
          ),
        SourceText('${currentBroker.value?.name ?? '증권사'} 주문 내역 · 지금 조회'),
      ];
    }
    final today = kstToday();
    final records = o.history.where((i) => i['order_status'] != null && toKstDate(i['created_at'] as String) == today).toList();
    if (records.isEmpty) return [const Padding(padding: EdgeInsets.all(8), child: Text('오늘 주문 기록이 없어요'))];
    return [
      for (final item in records)
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('${item['stock_name']} ${item['qty'] == null ? '' : '${comma(item['qty'] as int)}주 '}'
              '${actionLabels[item['action']] ?? item['action']}', style: const TextStyle(fontWeight: FontWeight.bold)),
          subtitle: Text(finalResult(item)),
          trailing: Text(hhmm(item['created_at'] as String), style: const TextStyle(color: mutedText)),
        ),
      const SourceText('서버 기록 (폰이 보낸 주문 결과) 기준'),
    ];
  }

  static String _hhmmOf(String hhmmss) => hhmmss.length >= 4 ? '${hhmmss.substring(0, 2)}:${hhmmss.substring(2, 4)}' : hhmmss;
}
