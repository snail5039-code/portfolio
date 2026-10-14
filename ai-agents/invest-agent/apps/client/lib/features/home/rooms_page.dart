// 채팅 탭 (디자인 H안): 링 요약 → 보유 종목 동그라미 → 대화방 목록.
// 대화방: 투자 비서(대화) · 처리안(승인·실행 대기) · 코치(규칙에 걸린 요청) · 종목별 최근 기록.
// 넓은 화면(웹)에서는 왼쪽 목록 + 오른쪽 투자 비서 대화.

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';
import '../approvals/approvals_page.dart';
import '../chat/chat_page.dart';
import '../chat/conversation.dart';
import '../history/history_page.dart';
import '../settings/broker_page.dart';
import 'agents_page.dart';
import 'briefing_page.dart';
import 'overview.dart';
import 'watchlist_page.dart';

class RoomsPage extends StatefulWidget {
  const RoomsPage({super.key, required this.conversation, required this.active, required this.onOpenChat,
      required this.onOpenToday, required this.onAsk});
  final Conversation conversation;
  final bool active; // 탭으로 돌아올 때마다 새로 읽는다
  final VoidCallback onOpenChat;
  final VoidCallback onOpenToday;
  final void Function(String text) onAsk; // 브리핑의 "주문하기" → 투자 비서 대화로

  @override
  State<RoomsPage> createState() => _RoomsPageState();
}

class _RoomsPageState extends State<RoomsPage> {
  late Future<Overview> _data = loadOverview();
  bool _wasBusy = false;

  void _reload() => setState(() { _data = loadOverview(); });

  /// 대화가 끝나면(처리안이 새로 왔을 수 있다) 목록을 다시 읽는다
  void _onConversation() {
    final busy = widget.conversation.busy;
    if (_wasBusy && !busy && mounted) _reload();
    _wasBusy = busy;
  }

  @override
  void initState() {
    super.initState();
    widget.conversation.addListener(_onConversation);
  }

  @override
  void dispose() {
    widget.conversation.removeListener(_onConversation);
    super.dispose();
  }

  @override
  void didUpdateWidget(RoomsPage old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _reload();
  }

  Future<void> _push(Widget page) async {
    await Navigator.of(context).push(pageRoute(page));
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    final list = Scaffold(
      appBar: topBar('채팅'),
      body: FutureBuilder(
        future: _data,
        builder: (context, snapshot) {
          if (snapshot.hasError) return ErrorRetry(snapshot.error!, _reload);
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          return RefreshIndicator(onRefresh: () async => _reload(), child: _body(snapshot.data!));
        },
      ),
    );
    if (!isWide(context)) return list;
    return Row(children: [
      SizedBox(width: 400, child: list),
      const VerticalDivider(width: 1),
      Expanded(child: ChatPage(widget.conversation)),
    ]);
  }

  Widget _body(Overview o) {
    final balance = o.balance;
    // 지금 대화에서 기다리는 처리안은 투자 비서 방에 보이므로 처리안 방에서는 뺀다
    final current = widget.conversation.waiting?['approval_id'];
    final approvals = o.approvals.where((a) => a['approval_id'] != current).toList();
    final waiting = approvals.length + o.executions.length;
    final blocked = o.history.where((i) => i['policy_ok'] == false).firstOrNull;
    // 종목별 최근 한 건 (기록은 최신순)
    final byStock = <String, Map<String, dynamic>>{};
    for (final item in o.history) {
      if (item['policy_ok'] != false) byStock.putIfAbsent(item['stock_name'] as String, () => item);
    }

    return ListView(padding: const EdgeInsets.symmetric(vertical: 4), children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: RingsCard(overview: o, onTap: widget.onOpenToday),
      ),
      _bubbles(o),
      if (balance == null) _connectHint(),
      const Divider(height: 1),
      if (o.briefing != null)
        () {
          final today = o.briefing!['brief_date'] == kstToday();
          final picks = ((o.briefing!['content'] as Map)['picks'] as List).length;
          return _room(
            avatar: const RoomAvatar(icon: Icons.wb_sunny_outlined, color: briefingColor),
            title: '아침 브리핑',
            preview: briefingPreview(o.briefing!, today: today),
            time: hhmm(o.briefing!['created_at'] as String),
            badge: today ? picks : 0,
            onTap: () => _push(BriefingPage(o.briefing!, onAsk: widget.onAsk)),
          );
        }(),
      if (o.close != null)
        _room(
          avatar: const RoomAvatar(icon: Icons.nights_stay_outlined, color: closeColor),
          title: '장 마감 요약',
          preview: closePreview(o.close!, today: o.close!['brief_date'] == kstToday()),
          time: hhmm(o.close!['created_at'] as String),
          onTap: () => _push(CloseSummaryPage(o.close!)),
        ),
      ListenableBuilder(
        listenable: widget.conversation,
        builder: (context, _) {
          final last = widget.conversation.items.lastOrNull;
          final waiting = widget.conversation.waiting;
          final proposal = waiting?['kind'] == 'approval' ? waiting!['card'] as Map<String, dynamic> : null;
          return _room(
            avatar: const RoomAvatar(text: 'AI', color: brandBlue),
            title: '투자 비서',
            preview: proposal != null
                ? '${_proposalText(proposal)} 제안이 왔어요'
                : last == null ? '무엇이든 물어보세요. 예: 기아 2주 사줘' : last.text.split('\n').first,
            badge: proposal != null ? 1 : 0,
            highlight: true,
            onTap: widget.onOpenChat,
          );
        },
      ),
      if (waiting > 0)
        _room(
          avatar: const RoomAvatar(icon: Icons.fact_check_outlined, color: Color(0xFFE3F1FC), foreground: brandBlue),
          title: '처리안',
          preview: approvals.isNotEmpty
              ? '${_cardText(approvals.first)} 제안이 왔어요 · 승인을 기다려요'
              : '${_cardText(o.executions.first)} · ${kIsWeb ? '폰 앱에서 실행해 주세요' : '실행을 기다려요'}',
          badge: waiting,
          onTap: () => _push(const ApprovalsPage(active: true)),
        ),
      // 두 AI가 한 일을 따로 보는 방 (마지막 기록을 미리보기로)
      _room(
        avatar: const RoomAvatar(icon: Icons.lightbulb_outline, color: investAiColor),
        title: '투자 AI',
        preview: o.history.isEmpty
            ? '아직 쓴 제안서가 없어요'
            : '${o.history.first['stock_name']} · ${actionLabels[o.history.first['action']] ?? o.history.first['action']} 제안서',
        time: o.history.isEmpty ? null : ymdHm(o.history.first['created_at'] as String),
        onTap: () => _push(const AgentFeedPage(verifier: false)),
      ),
      () {
        final checked = o.history.where((i) => i['verdict'] != null).firstOrNull;
        return _room(
          avatar: const RoomAvatar(icon: Icons.verified_user_outlined, color: verifyAiColor),
          title: '검증 AI',
          preview: checked == null
              ? '아직 검증한 제안이 없어요'
              : '${checked['stock_name']} · ${verdictLabels[checked['verdict']] ?? checked['verdict']}',
          time: checked == null ? null : ymdHm(checked['created_at'] as String),
          onTap: () => _push(const AgentFeedPage(verifier: true)),
        );
      }(),
      _room(
        avatar: const RoomAvatar(icon: Icons.track_changes, color: coachOrange),
        title: '코치',
        preview: blocked == null
            ? '규칙 안에서 투자하고 있어요'
            : '${blocked['stock_name']} 요청이 내 규칙에 걸려서 주문하지 않았어요',
        time: blocked == null ? null : ymdHm(blocked['created_at'] as String),
        onTap: blocked == null ? null : () => _push(HistoryDetailPage(blocked['proposal_id'] as String, blocked['stock_name'] as String)),
      ),
      for (final item in byStock.values.take(10))
        _room(
          avatar: RoomAvatar(text: _short(item['stock_name'] as String), color: const Color(0xFFFFF5F4), foreground: const Color(0xFFA3241B)),
          title: item['stock_name'] as String,
          preview: '${actionLabels[item['action']] ?? item['action']}'
              '${item['qty'] == null ? '' : ' ${comma(item['qty'] as int)}주'} · ${finalResult(item)}',
          time: ymdHm(item['created_at'] as String),
          onTap: () => _openStockRoom(item['stock_code'] as String, item['stock_name'] as String),
        ),
    ]);
  }

  /// 종목 대화방: 그 종목의 최근 대화를 불러와 이어서 한다
  Future<void> _openStockRoom(String code, String name) async {
    final room = Conversation(stockCode: code, stockName: name);
    try {
      await room.loadRoom();
    } on ApiError catch (error) {
      if (mounted) showError(context, error);
      return;
    }
    if (mounted) await _push(ChatPage(room));
  }

  static String _short(String name) => name.length <= 2 ? name : name.substring(0, 2);

  static String _cardText(Map<String, dynamic> approval) => _proposalText(approval['card'] as Map<String, dynamic>);

  static String _proposalText(Map<String, dynamic> card) {
    return '${card['stock_name']} ${comma(card['qty'] as int)}주 ${sideLabels[card['side']]}';
  }

  /// 동그라미 줄: 보유 종목(손익 색 테두리) · 현금 · 관심 종목(노란 별 테두리) · 관심 종목 추가. 누르면 종목 대화방
  Widget _bubbles(Overview o) {
    final balance = o.balance;
    final held = balance == null ? <Map<String, dynamic>>[] : holdingsOf(balance);
    final heldCodes = {for (final h in held) h['stock_code']};
    Widget bubble(String label, String sub, Color ring, {Color? subColor, VoidCallback? onTap, bool dashed = false}) => InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            width: 66,
            child: Column(children: [
              Container(
                width: 56, height: 56,
                alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, color: dashed ? softGray : null,
                    border: Border.all(color: ring, width: dashed ? 1 : 3)),
                child: dashed
                    ? const Icon(Icons.add, color: mutedText)
                    : Text(label, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
              ),
              const SizedBox(height: 4),
              Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: subColor ?? mutedText)),
            ]),
          ),
        );
    return SizedBox(
      height: 104,
      child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.fromLTRB(14, 12, 14, 0), children: [
        for (final h in held)
          () {
            final cost = (h['avg_price'] as int) * (h['qty'] as int);
            final gain = priceOf(h) * (h['qty'] as int) - cost;
            return bubble(_short(h['stock_name'] as String), rateText(gain, cost), changeColor(gain) ?? const Color(0xFFD5DADF),
                subColor: changeColor(gain), onTap: () => _openStockRoom(h['stock_code'] as String, h['stock_name'] as String));
          }(),
        if (balance != null) bubble('현금', '${comma((balance['cash_krw'] as int) ~/ 10000)}만', const Color(0xFFD5DADF)),
        for (final w in o.watchlist.where((w) => !heldCodes.contains(w['stock_code'])))
          bubble(_short(w['stock_name'] as String), '관심', const Color(0xFFFFB020), subColor: const Color(0xFF8A5A00),
              onTap: () => _openStockRoom(w['stock_code'] as String, w['stock_name'] as String)),
        bubble('', '관심 종목', const Color(0xFFB9C0C7), dashed: true, onTap: () => _push(const WatchlistPage())),
      ]),
    );
  }

  Widget _connectHint() => ListTile(
        leading: const Icon(Icons.link),
        title: Text(kIsWeb ? '폰 앱을 열면 잔고가 여기에 보여요' : '증권사를 연결하면 잔고를 볼 수 있어요'),
        trailing: kIsWeb ? null : const Icon(Icons.chevron_right),
        onTap: kIsWeb ? null : () => _push(const BrokerPage()),
      );

  Widget _room({
    required Widget avatar,
    required String title,
    required String preview,
    String? time,
    int badge = 0,
    bool highlight = false,
    VoidCallback? onTap,
  }) =>
      Material(
        color: highlight ? const Color(0xFFF2F9FF) : Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            child: Row(children: [
              avatar,
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900))),
                    if (time != null) Text(time, style: const TextStyle(fontSize: 12, color: mutedText)),
                  ]),
                  const SizedBox(height: 2),
                  Row(children: [
                    Expanded(
                      child: Text(preview, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14, color: Color(0xFF3A4148))),
                    ),
                    if (badge > 0) ...[const SizedBox(width: 8), CountBadge(badge)],
                  ]),
                ]),
              ),
            ]),
          ),
        ),
      );
}
