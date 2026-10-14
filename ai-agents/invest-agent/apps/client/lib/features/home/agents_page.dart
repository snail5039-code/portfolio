// 투자 AI 방 · 검증 AI 방 (docs/plan/12-todo-by-stage.md 1-3): 두 AI가 각각 한 일을 따로 본다.
//   투자 AI: 제안서 (행동, 근거, 위험)          검증 AI: 회차마다 판정 (반박, 조건, 코드 검사에서 틀린 수)
// 누르면 기록 상세의 그 AI 탭으로 간다.

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';
import '../history/history_page.dart';

const investAiColor = Color(0xFF7B5CFF);
const verifyAiColor = Color(0xFF137A33);

class AgentFeedPage extends StatelessWidget {
  const AgentFeedPage({super.key, required this.verifier});
  final bool verifier; // false: 투자 AI, true: 검증 AI

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: topBar(verifier ? '검증 AI' : '투자 AI',
            avatar: RoomAvatar(icon: verifier ? Icons.verified_user_outlined : Icons.lightbulb_outline,
                color: verifier ? verifyAiColor : investAiColor, size: 36),
            subtitle: verifier ? '제안의 근거를 원문으로 다시 확인해요' : '자료를 보고 제안서를 써요'),
        body: FutureBuilder(
          future: api.get(verifier ? '/api/agents/verifications' : '/api/agents/proposals'),
          builder: (context, snapshot) {
            if (snapshot.hasError) return Center(child: Text('${snapshot.error}'));
            if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
            final items = (snapshot.data as List).cast<Map<String, dynamic>>();
            if (items.isEmpty) {
              return const Center(child: Text('아직 기록이 없어요. 투자 비서에게 "삼성전자 사도 돼?"처럼 물어보세요.'));
            }
            return ListView(padding: const EdgeInsets.all(12), children: [
              for (final item in items) verifier ? _verification(context, item) : _proposal(context, item),
            ]);
          },
        ),
      );

  void _open(BuildContext context, Map<String, dynamic> item) => Navigator.of(context).push(pageRoute(
      HistoryDetailPage(item['proposal_id'] as String, item['stock_name'] as String, initialTab: verifier ? 2 : 1)));

  Widget _card(BuildContext context, Map<String, dynamic> item, List<Widget> children) => Card(
        child: InkWell(
          onTap: () => _open(context, item),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
          ),
        ),
      );

  Widget _head(String title, String time, Widget tag) => Row(children: [
        Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900))),
        tag,
        const SizedBox(width: 8),
        Text(time, style: const TextStyle(fontSize: 12, color: mutedText)),
      ]);

  Widget _proposal(BuildContext context, Map<String, dynamic> p) {
    final claims = (p['claims'] as List).cast<Map<String, dynamic>>();
    final risks = (p['risks'] as List).cast<String>();
    final verdict = p['verdict'] as String?;
    return _card(context, p, [
      _head('${p['stock_name']} · ${actionLabels[p['action']] ?? p['action']}${p['user_directed'] == true ? ' (직접 지시)' : ''}',
          ymdHm(p['created_at'] as String),
          verdict == null ? const SizedBox() : Tag('검증 ${verdictLabels[verdict] ?? verdict}', verdictColors[verdict] ?? Colors.grey)),
      const SizedBox(height: 6),
      for (final claim in claims.take(3)) ClaimLine(claim, maxLines: 2),
      NoteBox.risks(risks.take(1).toList(), maxLines: 2),
    ]);
  }

  Widget _verification(BuildContext context, Map<String, dynamic> v) {
    final verdict = v['verdict'] as String;
    final challenges = (v['challenges'] as List).cast<String>();
    final conditions = (v['conditions'] as List).cast<String>();
    final failed = v['failed_checks'] as int;
    return _card(context, v, [
      _head('${v['stock_name']} · ${(v['round'] as int) + 1}차 검증', ymdHm(v['created_at'] as String),
          Tag(verdictLabels[verdict] ?? verdict, verdictColors[verdict] ?? Colors.grey)),
      const SizedBox(height: 6),
      VerdictSummary('${v['summary']}'),
      if (failed > 0) Text('· 코드 검사에서 틀린 항목 $failed개', style: const TextStyle(color: upRed)),
      NoteBox('반박', challenges.take(2).toList(), color: upRed, icon: Icons.reply, maxLines: 2),
      NoteBox.conditions(conditions.take(2).toList(), maxLines: 2),
    ]);
  }
}
