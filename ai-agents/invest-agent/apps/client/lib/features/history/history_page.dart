// S-10 기록, S-11 기록 상세 (FR-35, FR-36). 한 건 = 제안서 하나의 전체 과정.

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../broker/broker.dart';
import '../../common/common.dart';
import '../approvals/approval_detail_page.dart';

const approvalLabels = {'pending': '승인 대기', 'approved': '승인 · 실행 전', 'rejected': '거절', 'expired': '만료'};

/// 한 건의 최종 결과: 주문 결과 > 승인 상태 > 정책 차단 > 분석만
String finalResult(Map<String, dynamic> item) {
  if (item['order_status'] != null) return orderLabels[item['order_status']] ?? '${item['order_status']}';
  if (item['approval_status'] != null) return approvalLabels[item['approval_status']] ?? '${item['approval_status']}';
  if (item['policy_ok'] == false) return '정책 차단';
  return '분석';
}

/// 보유·관찰 판단만 하고 끝난 건 (처리안·주문·차단 없음). 30분마다 쌓여서 기록 탭에서는 날짜별로 접는다 (2026-10-20)
bool quietItem(Map<String, dynamic> i) =>
    (i['action'] == 'hold' || i['action'] == 'watch') && i['approval_status'] == null && i['order_status'] == null && i['policy_ok'] != false;

/// 최신순 기록 → 날짜별 ("10/19 (월)", 보일 것, 접을 것). 날짜는 한국 시각
List<(String, List<Map<String, dynamic>>, List<Map<String, dynamic>>)> groupByDay(List<Map<String, dynamic>> items) {
  const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
  final days = <String, (List<Map<String, dynamic>>, List<Map<String, dynamic>>)>{};
  for (final item in items) {
    final t = toKst(DateTime.parse(item['created_at'] as String));
    final (shown, quiet) = days.putIfAbsent('${t.month}/${t.day} (${weekdays[t.weekday - 1]})', () => ([], []));
    (quietItem(item) ? quiet : shown).add(item);
  }
  return [for (final MapEntry(:key, :value) in days.entries) (key, value.$1, value.$2)];
}

const filters = <(String, bool Function(Map<String, dynamic>))>[
  ('매수·매도', _trade), // 처음 보이는 필터: 실제로 사고판 제안만 (보유 판단에 묻히지 않게)
  ('전체', _all),
  ('매수', _buy),
  ('매도', _sell),
  ('체결', _filled),
  ('거절', _rejected),
  ('반려', _verifierRejected),
  ('만료', _expired),
];
bool _all(Map<String, dynamic> i) => true;
bool _trade(Map<String, dynamic> i) => i['action'] == 'buy' || i['action'] == 'sell';
bool _buy(Map<String, dynamic> i) => i['action'] == 'buy';
bool _sell(Map<String, dynamic> i) => i['action'] == 'sell';

/// 필터 이름 → 기록 요청 조건. 매수·매도만 서버가 거른다
/// day: 달력에서 고른 날 "2026-10-19" (서버가 그날 것만 300건까지 보낸다)
String historyQuery(String filter, {String? day}) {
  final action = switch (filter) { '매수·매도' => 'trade', '매수' => 'buy', '매도' => 'sell', _ => null };
  final params = [if (action != null) 'action=$action', if (day != null) 'day=$day'];
  return params.isEmpty ? '' : '?${params.join('&')}';
}

/// 날짜 머리글 요약 "매수 2 · 매도 1 · 판단 72"
String daySummary(List<Map<String, dynamic>> items) {
  int count(bool Function(Map<String, dynamic>) test) => items.where(test).length;
  final buys = count((i) => i['action'] == 'buy'), sells = count((i) => i['action'] == 'sell');
  final checks = count((i) => i['action'] == 'hold' || i['action'] == 'watch');
  return [if (buys > 0) '매수 $buys', if (sells > 0) '매도 $sells', if (checks > 0) '판단 $checks'].join(' · ');
}

/// 매수는 빨강, 매도는 파랑 (국내 증권사 관례). 보유·관찰은 회색
Color actionColor(String? action) => switch (action) { 'buy' => upRed, 'sell' => downBlue, _ => mutedText };
bool _filled(Map<String, dynamic> i) => i['order_status'] == 'filled' || i['order_status'] == 'partially_filled';
bool _rejected(Map<String, dynamic> i) => i['approval_status'] == 'rejected';
bool _verifierRejected(Map<String, dynamic> i) => i['verdict'] == 'reject';
bool _expired(Map<String, dynamic> i) => i['approval_status'] == 'expired';

const checkTargets = {
  'metrics': '지표', 'counter_arguments': '반대 근거', 'risks': '위험', 'freshness': '자료 시점', 'risk_fit': '성향 적합',
};

/// 검증 항목 이름: "claim:0" → "근거 1"
String checkTarget(String target) {
  final claim = RegExp(r'^claim:(\d+)$').firstMatch(target);
  if (claim != null) return '근거 ${int.parse(claim.group(1)!) + 1}';
  return checkTargets[target] ?? target;
}

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key, required this.active});
  final bool active;

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  late Future<List<dynamic>> _items = _load();
  int _filter = 0;
  DateTime? _day; // 달력에서 고른 날 (한국 날짜). null이면 최근
  final _toggled = <String>{}; // 기본(맨 위 날짜만 펼침)과 다르게 연 날·접은 날

  String? get _dayParam => _day?.toIso8601String().substring(0, 10);

  /// 매수·매도·날짜는 서버에서 거른다 (서버는 최근 100건만 보내서, 하루 분석이 많으면 앞의 매수·매도가 잘린다)
  Future<List<dynamic>> _load() async =>
      await api.get('/api/history${historyQuery(filters[_filter].$1, day: _dayParam)}') as List;

  Future<void> _pickDay() async {
    final today = toKst(DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: _day ?? DateTime(today.year, today.month, today.day),
      firstDate: DateTime(2026, 10, 1),
      lastDate: DateTime(today.year, today.month, today.day),
      helpText: '기록 볼 날짜',
    );
    if (picked != null) setState(() { _day = picked; _toggled.clear(); _items = _load(); });
  }

  Widget _dayChip() {
    const icon = Icon(Icons.calendar_month, size: 18);
    final day = _day;
    if (day == null) return ActionChip(avatar: icon, label: const Text('날짜'), onPressed: _pickDay);
    const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
    return InputChip(
      avatar: icon,
      selected: true,
      label: Text('${day.month}/${day.day} (${weekdays[day.weekday - 1]})'),
      onPressed: _pickDay,
      onDeleted: () => setState(() { _day = null; _items = _load(); }),
    );
  }

  bool _open(int index, String day) => (index == 0) != _toggled.contains(day);

  void _toggle(String day) => setState(() { if (!_toggled.remove(day)) _toggled.add(day); });

  @override
  void didUpdateWidget(HistoryPage old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) setState(() { _items = _load(); });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: topBar('기록'),
        body: Column(children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(children: [
              Padding(padding: const EdgeInsets.only(right: 8), child: _dayChip()),
              for (var i = 0; i < filters.length; i++)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(filters[i].$1),
                    selected: _filter == i,
                    onSelected: (_) => setState(() {
                      _filter = i;
                      _items = _load();
                    }),
                  ),
                ),
            ]),
          ),
          Expanded(
            child: FutureBuilder(
              future: _items,
              builder: (context, snapshot) {
                if (snapshot.hasError) return ErrorRetry(snapshot.error!, () => setState(() { _items = _load(); }));
                if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
                final items = snapshot.data!.cast<Map<String, dynamic>>().where(filters[_filter].$2).toList();
                return RefreshIndicator(
                  onRefresh: () async => setState(() { _items = _load(); }),
                  child: items.isEmpty
                      ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('기록이 없어요')))])
                      : ListView(children: [
                          for (final (i, (day, shown, quiet)) in groupByDay(items).indexed) ...[
                            // 날짜 머리글을 누르면 그날을 접고 편다. 처음엔 맨 위 날짜만 펼친다 (2026-10-20 사용자 요청)
                            InkWell(
                              onTap: () => _toggle(day),
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(12, 12, 16, 8),
                                child: Row(children: [
                                  Icon(_open(i, day) ? Icons.expand_more : Icons.chevron_right, color: mutedText),
                                  const SizedBox(width: 4),
                                  Text(day, style: const TextStyle(fontWeight: FontWeight.w900)),
                                  const Spacer(),
                                  Text(daySummary([...shown, ...quiet]), style: const TextStyle(fontSize: 12, color: mutedText)),
                                ]),
                              ),
                            ),
                            if (_open(i, day)) for (final item in shown) _tile(item),
                            if (_open(i, day) && quiet.isNotEmpty)
                              ExpansionTile(
                                shape: const Border(),
                                leading: const Icon(Icons.unfold_more, color: mutedText),
                                title: Text('보유·관찰 판단 ${quiet.length}건',
                                    style: const TextStyle(fontSize: 14, color: mutedText)),
                                subtitle: Text('${{for (final q in quiet) q['stock_name']}.length}종목 · 주문 없이 끝난 점검',
                                    style: const TextStyle(fontSize: 12)),
                                children: [for (final item in quiet) _tile(item)],
                              ),
                            const Divider(height: 1),
                          ],
                        ]),
                );
              },
            ),
          ),
        ]),
      );

  Widget _tile(Map<String, dynamic> item) {
    final qty = item['qty'] == null ? '' : ' ${comma(item['qty'] as int)}주';
    final action = item['action'] as String?;
    final color = actionColor(action);
    final result = finalResult(item);
    return ListTile(
      dense: true,
      leading: Container(
        width: 44,
        padding: const EdgeInsets.symmetric(vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
        child: Text(actionLabels[action] ?? '$action', textAlign: TextAlign.center,
            style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13)),
      ),
      title: Text('${item['stock_name']}$qty', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
      subtitle: Row(children: [
        if (item['verdict'] != null) VerdictTag(item['verdict'] as String),
        const SizedBox(width: 8),
        Text(hhmm(item['created_at'] as String), style: const TextStyle(fontSize: 12)),
      ]),
      trailing: result == '분석' ? null : Text(result, style: const TextStyle(fontWeight: FontWeight.bold)),
      onTap: () => Navigator.of(context).push(pageRoute(HistoryDetailPage(item['proposal_id'] as String, item['stock_name'] as String))),
    );
  }
}

class HistoryDetailPage extends StatelessWidget {
  const HistoryDetailPage(this.proposalId, this.stockName, {super.key, this.initialTab = 0});
  final String proposalId;
  final String stockName;
  final int initialTab; // 1: 투자 AI, 2: 검증 AI (각 AI 방에서 열 때)

  static const stepLabels = {
    'proposal': '투자 AI 제안',
    'verification': '검증 AI',
    'policy_check': '정책 검사',
    'approval_requested': '처리안 · 승인 요청',
    'approval_approved': '승인',
    'approval_rejected': '거절',
    'approval_expired': '만료',
    'order_result': '주문 결과',
  };

  /// 탭: 전체 과정 / 투자 AI(제안서) / 검증 AI(회차별 판정)
  static const tabs = [('전체 과정', null), ('투자 AI', 'proposal'), ('검증 AI', 'verification')];

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: tabs.length,
        initialIndex: initialTab,
        child: Scaffold(
          appBar: AppBar(
            title: Text('$stockName 기록'),
            actions: topBar('').actions,
            bottom: TabBar(tabs: [for (final (label, _) in tabs) Tab(text: label)]),
          ),
          body: FutureBuilder(
            future: api.get('/api/history/$proposalId'),
            builder: (context, snapshot) {
              if (snapshot.hasError) return Center(child: Text('${snapshot.error}'));
              if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
              final timeline = (snapshot.data['timeline'] as List).cast<Map<String, dynamic>>();
              return TabBarView(children: [
                for (final (_, only) in tabs)
                  ListView(padding: const EdgeInsets.all(12), children: [
                    for (final step in timeline.where((s) => only == null || s['step'] == only))
                      Card(
                        child: ExpansionTile(
                          initiallyExpanded: only != null, // AI 탭은 펼쳐서 바로 읽게
                          leading: Text(hhmm(step['at'] as String)),
                          title: Text(_title(step)),
                          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                          expandedCrossAxisAlignment: CrossAxisAlignment.start,
                          children: _details(step),
                        ),
                      ),
                  ]),
              ]);
            },
          ),
        ),
      );

  String _title(Map<String, dynamic> step) {
    final label = stepLabels[step['step']] ?? '${step['step']}';
    final data = step['data'] as Map<String, dynamic>;
    return switch (step['step']) {
      'proposal' => '$label · ${actionLabels[data['action']] ?? data['action']}${data['user_directed'] == true ? ' (직접 지시)' : ''}',
      'verification' => '$label ${(data['round'] as int) + 1}차 · ${verdictLabels[data['verdict']] ?? data['verdict']}',
      'policy_check' => '$label · ${data['ok'] == true ? '통과' : '차단'}',
      'approval_approved' || 'approval_rejected' =>
        '$label${data['channel'] != null ? ' (${data['channel'] == 'app' ? '앱' : '웹'})' : ''}',
      'order_result' => '$label · ${orderLabels[data['status']] ?? data['status']}',
      _ => label,
    };
  }

  Widget _line(String text) => Padding(padding: const EdgeInsets.only(top: 4), child: Text(text));

  List<Widget> _details(Map<String, dynamic> step) {
    final data = step['data'] as Map<String, dynamic>;
    List<String> texts(Object? list) => (list as List? ?? []).map((e) => '$e').toList();
    switch (step['step']) {
      case 'proposal':
        return [
          if (data['qty'] != null) _line('${comma(data['qty'] as int)}주 · 지정가 ${won(data['limit_price'] as int)}'),
          const SizedBox(height: 4),
          for (final claim in (data['claims'] as List).cast<Map<String, dynamic>>()) ClaimLine(claim),
          NoteBox.counters(texts(data['counter_arguments'])),
          NoteBox.risks(texts(data['risks'])),
          NoteBox('이러면 틀린 판단', texts(data['invalid_if']), color: const Color(0xFF8A5A00), icon: Icons.flag_outlined),
          if ((data['sources'] as List).isNotEmpty) _line('출처'),
          for (final source in (data['sources'] as List).cast<Map<String, dynamic>>())
            SourceText('${source['source_id']} · ${source['title']} · 기준 ${source['as_of'] ?? '미확인'}'
                '${source['url'] != null ? '\n${source['url']}' : ''}'),
        ];
      case 'verification':
        return [
          _line('${data['summary']}'),
          for (final check in (data['checks'] as List).cast<Map<String, dynamic>>())
            _line('${switch (check['result']) { 'pass' => '✅', 'warn' => '⚠️', _ => '❌' }} ${checkTarget('${check['target']}')}: ${check['detail']}'),
          NoteBox('반박', texts(data['challenges']), color: upRed, icon: Icons.reply),
          NoteBox.conditions(texts(data['conditions'])),
          NoteBox('의견 차이', texts(data['disagreements']), color: mutedText, icon: Icons.forum_outlined),
        ];
      case 'policy_check':
        return [
          for (final rule in (data['rules'] as List).cast<Map<String, dynamic>>())
            _line('${rule['ok'] == true ? '✅' : '❌'} ${rule['label']}: 한도 ${rule['limit']} / 이번 ${rule['actual']}'),
        ];
      case 'approval_requested':
        final card = data['card'] as Map<String, dynamic>?;
        return [
          if (card != null) _line('${card['stock_name']} ${comma(card['qty'] as int)}주 ${sideLabels[card['side']]}'
              ' · 예상 ${won(card['amount'] as int)}'),
          _line('만료 ${hhmm(data['expires_at'] as String)}'),
        ];
      case 'order_result':
        return [
          if (data['broker_order_no'] != null) _line('주문번호 ${data['broker_order_no']}'),
          _line('${comma(data['qty'] as int)}주 × ${won(data['price'] as int)} (${data['mode'] == 'mock' ? '모의투자' : data['mode']})'),
          if ((data['filled_qty'] as int? ?? 0) > 0) _line('체결 ${comma(data['filled_qty'] as int)}주 × ${won(data['filled_price'] as int)}'),
          if (data['message'] != null) _line('${data['message']}'),
        ];
      default:
        return const [];
    }
  }
}
