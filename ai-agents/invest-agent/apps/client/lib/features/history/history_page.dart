// S-10 기록, S-11 기록 상세 (FR-35, FR-36). 한 건 = 제안서 하나의 전체 과정.

import 'package:flutter/material.dart';

import '../../api/api.dart';
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

const filters = <(String, bool Function(Map<String, dynamic>))>[
  ('전체', _all),
  ('체결', _filled),
  ('거절', _rejected),
  ('반려', _verifierRejected),
  ('만료', _expired),
];
bool _all(Map<String, dynamic> i) => true;
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

  Future<List<dynamic>> _load() async => await api.get('/api/history') as List;

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
              for (var i = 0; i < filters.length; i++)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(filters[i].$1),
                    selected: _filter == i,
                    onSelected: (_) => setState(() => _filter = i),
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
                      : ListView(children: [for (final item in items) _tile(item)]),
                );
              },
            ),
          ),
        ]),
      );

  Widget _tile(Map<String, dynamic> item) {
    final qty = item['qty'] == null ? '' : ' ${comma(item['qty'] as int)}주';
    return ListTile(
      title: Text('${item['stock_name']}$qty ${actionLabels[item['action']] ?? item['action']}'),
      subtitle: Row(children: [
        if (item['verdict'] != null) VerdictTag(item['verdict'] as String),
        const SizedBox(width: 8),
        Text(ymdHm(item['created_at'] as String), style: const TextStyle(fontSize: 12)),
      ]),
      trailing: Text(finalResult(item)),
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
