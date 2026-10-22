// 아침 브리핑 (docs/plan/12-todo-by-stage.md 1-1): 오늘의 매수 제안 · 보유 종목 소식 · 오늘 한도.
// 매수 제안은 투자 AI → 검증 AI를 거친 것이다. "주문하기"는 평소 주문 흐름(처리안 → 승인 → 폰 실행)을 시작한다.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../common/common.dart';
import '../history/history_page.dart';

const briefingColor = Color(0xFFFFB020);

/// 대화방 목록에 쓰는 한 줄 요약
String briefingPreview(Map<String, dynamic> briefing, {required bool today}) {
  final content = briefing['content'] as Map<String, dynamic>;
  final picks = content['picks'] as List;
  final news = content['news'] as List;
  if (!today) return '${_dateLabel(briefing['brief_date'] as String)} 브리핑';
  if (picks.isNotEmpty) return '오늘의 매수 제안 ${picks.length}개가 왔어요';
  if (news.isNotEmpty) return '보유 종목 공시 ${news.length}건이 있어요';
  return '오늘 아침 브리핑이 왔어요';
}

String _dateLabel(String ymd) {
  final d = DateTime.parse(ymd);
  return '${d.month}월 ${d.day}일';
}

class BriefingPage extends StatelessWidget {
  const BriefingPage(this.briefing, {super.key, required this.onAsk});
  final Map<String, dynamic> briefing;
  final void Function(String text) onAsk;

  @override
  Widget build(BuildContext context) {
    final content = briefing['content'] as Map<String, dynamic>;
    final picks = (content['picks'] as List).cast<Map<String, dynamic>>();
    final news = (content['news'] as List).cast<Map<String, dynamic>>();
    final checked = (content['checked'] as List).cast<Map<String, dynamic>>();
    final limits = content['limits'] as Map<String, dynamic>;
    final custom = content['mode'] == 'custom';

    return Scaffold(
      backgroundColor: const Color(0xFFFFFAF0),
      appBar: topBar('아침 브리핑',
          avatar: const RoomAvatar(icon: Icons.wb_sunny_outlined, color: briefingColor, size: 36),
          subtitle: '${_dateLabel(briefing['brief_date'] as String)} · ${hhmm(briefing['created_at'] as String)} 작성'),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        _title('오늘의 매수 제안'),
        if (!custom)
          _note('일반 모드라 매수 제안은 하지 않아요. 성향 퀴즈를 하면 맞춤 제안을 받을 수 있어요.')
        else if (picks.isEmpty)
          _note(checked.isEmpty
              ? '최근 공시가 있는 후보 종목이 없어 오늘은 제안이 없어요.'
              : '${checked.map((c) => c['stock_name']).join(', ')}을(를) 분석했지만 검증을 통과한 매수 제안이 없어요.')
        else
          for (final pick in picks) _pickCard(context, pick),
        const SizedBox(height: 20),
        _title('보유·관심 종목 소식'),
        if (news.isEmpty) _note('최근 3일 동안 보유·관심 종목의 새 공시가 없어요.'),
        if (news.isNotEmpty) ...[
          const SourceText('DART 공시 · 누르면 원문을 열어요'),
          const SizedBox(height: 6),
          Card(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Column(children: [for (final n in news) NewsRow(n, showDate: true)]),
            ),
          ),
        ],
        const SizedBox(height: 20),
        _title('오늘 한도'),
        Card(
          color: Colors.white,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('1일 주문 한도 ${won(limits['daily_limit_krw'] as int)}', style: const TextStyle(fontWeight: FontWeight.bold)),
              Text('규칙에 걸린 요청 없이 ${limits['clean_days']}일째', style: const TextStyle(color: Color(0xFF137A33))),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        const SourceText('투자 판단과 책임은 본인에게 있어요. 제안은 참고용이며 손실이 날 수 있어요. 시세는 하루 늦은 종가 기준이에요.'),
      ]),
    );
  }

  Widget _title(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: const TextStyle(fontFamily: displayFont, fontSize: 20)),
      );

  Widget _note(String text) => Card(
        color: Colors.white,
        child: Padding(padding: const EdgeInsets.all(16), child: Text(text, style: const TextStyle(color: mutedText))),
      );

  Widget _pickCard(BuildContext context, Map<String, dynamic> pick) {
    final approved = pick['verdict'] == 'approve';
    final name = pick['stock_name'] as String;
    return Card(
      color: Colors.white,
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('$name 매수 검토', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900))),
              Tag(approved ? '검증 승인' : '검증 조건부', approved ? const Color(0xFF137A33) : const Color(0xFF8A5A00)),
            ]),
            if (pick['last_close'] != null)
              Text('${pick['close_date']} 종가 ${won(pick['last_close'] as int)} · 10% 하락 시 −${won(pick['worst_case_loss'] as int)}',
                  style: const TextStyle(fontSize: 13, color: mutedText)),
            VerdictSummary('검증 AI: ${pick['summary']}'),
            for (final claim in (pick['claims'] as List).cast<Map<String, dynamic>>()) ClaimLine(claim, maxLines: 2),
            NoteBox.risks((pick['risks'] as List).cast<String>(), maxLines: 2),
            NoteBox.conditions((pick['conditions'] as List).cast<String>(), maxLines: 3),
          ]),
        ),
        const Divider(height: 1),
        Row(children: [
          Expanded(
            child: TextButton(
              onPressed: () => Navigator.of(context).push(pageRoute(HistoryDetailPage(pick['proposal_id'] as String, name))),
              child: const Text('근거 자세히'),
            ),
          ),
          const SizedBox(height: 44, child: VerticalDivider(width: 1)),
          Expanded(
            child: TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                onAsk('$name 1주 사줘'); // 처리안 → 승인 → 폰 실행. 수량은 처리안에서 "2주만"처럼 바꾼다
              },
              child: const Text('주문하기', style: TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
        ]),
      ]),
    );
  }

}

/// 공시 한 줄: [보유] 종목 제목 (두 줄까지) · 날짜. 누르면 DART 원문을 브라우저로 연다 (2026-10-20: 긴 주소를 그대로 보여 줬다)
class NewsRow extends StatelessWidget {
  const NewsRow(this.news, {super.key, this.showDate = false});
  final Map<String, dynamic> news;
  final bool showDate; // 아침 브리핑은 최근 3일 공시라 날짜를 붙인다

  Future<void> _open(BuildContext context) async {
    final url = Uri.tryParse('${news['url']}');
    final opened = url != null && url.scheme == 'https' && await launchUrl(url, mode: LaunchMode.externalApplication);
    if (!opened) {
      await Clipboard.setData(ClipboardData(text: '${news['url']}'));
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('원문을 열 수 없어 주소를 복사했어요')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final filed = '${news['filed_at'] ?? ''}';
    return InkWell(
      onTap: () => _open(context),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Tag('${news['why'] ?? '보유'}', news['why'] == '관심' ? const Color(0xFFB07800) : brandBlue),
          const SizedBox(width: 8),
          Expanded(
            child: Text.rich(TextSpan(children: [
              TextSpan(text: '${news['stock_name']} ', style: const TextStyle(fontWeight: FontWeight.bold)),
              TextSpan(text: '${news['title']}'),
              if (showDate && filed.length >= 10) TextSpan(text: '  ${filed.substring(5, 10).replaceAll('-', '/')}',
                  style: const TextStyle(fontSize: 12, color: mutedText)),
            ]), maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
          const Icon(Icons.open_in_new, size: 16, color: mutedText),
        ]),
      ),
    );
  }
}

// ---------- 장 마감 요약 (12-todo-by-stage.md 2-4): 서버 기록만 정리한 것 (LLM 없음) ----------

const closeColor = Color(0xFF4C5BD4);

String closePreview(Map<String, dynamic> summary, {required bool today}) {
  final content = summary['content'] as Map<String, dynamic>;
  final orders = (content['orders'] as List).cast<Map<String, dynamic>>();
  if (!today) return '${_dateLabel(summary['brief_date'] as String)} 장 마감 요약';
  if (content['review'] != null) return 'AI 회고와 내일 볼 것이 왔어요';
  if (orders.isEmpty) return '오늘은 주문이 없었어요';
  final filled = orders.where((o) => (o['filled_qty'] as int? ?? 0) > 0).length;
  return '오늘 주문 ${orders.length}건 · 체결 $filled건';
}

class CloseSummaryPage extends StatelessWidget {
  const CloseSummaryPage(this.summary, {super.key});
  final Map<String, dynamic> summary;

  @override
  Widget build(BuildContext context) {
    final content = summary['content'] as Map<String, dynamic>;
    final orders = (content['orders'] as List).cast<Map<String, dynamic>>();
    final blocked = (content['blocked'] as List).cast<Map<String, dynamic>>();
    final news = (content['news'] as List).cast<Map<String, dynamic>>();
    final limits = content['limits'] as Map<String, dynamic>;
    final review = content['review'] as Map<String, dynamic>?;
    Widget title(String text) => Padding(
          padding: const EdgeInsets.only(top: 20, bottom: 8),
          child: Text(text, style: const TextStyle(fontFamily: displayFont, fontSize: 20)),
        );
    Widget card(List<Widget> children) => Card(
          color: Colors.white,
          child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children)),
        );

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4FD),
      appBar: topBar('장 마감 요약',
          avatar: const RoomAvatar(icon: Icons.nights_stay_outlined, color: closeColor, size: 36),
          subtitle: '${_dateLabel(summary['brief_date'] as String)} · ${hhmm(summary['created_at'] as String)} 작성'),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        card([
          Text('오늘 산 금액 ${won(content['bought_krw'] as int)} · 판 금액 ${won(content['sold_krw'] as int)}',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          Text('1일 한도 ${won(limits['daily_used_krw'] as int)} / ${won(limits['daily_limit_krw'] as int)} 사용'),
          Text('분석·제안 ${content['analyses']}번 · 규칙에 걸린 요청 없이 ${limits['clean_days']}일째',
              style: const TextStyle(color: Color(0xFF137A33))),
        ]),
        title('오늘 주문'),
        if (orders.isEmpty) card([const Text('오늘은 주문이 없었어요', style: TextStyle(color: mutedText))]),
        // 2026-10-20 사용자 요청: 주문 한 건 = 한 줄 (시각 · 종목 · 매수/매도 · 수량 × 체결가)
        if (orders.isNotEmpty) card([for (final o in orders) _orderRow(o)]),
        if (blocked.isNotEmpty) ...[
          title('규칙에 걸린 요청'),
          for (final b in blocked)
            card([
              Text('${b['stock_name']}', style: const TextStyle(fontWeight: FontWeight.bold)),
              Text('걸린 규칙: ${(b['rules'] as List).join(', ')}', style: const TextStyle(color: coachOrange)),
            ]),
        ],
        title('오늘 공시 (보유·관심)'),
        const SourceText('DART 공시 · 누르면 원문을 열어요'),
        const SizedBox(height: 6),
        if (news.isEmpty) card([const Text('오늘 나온 공시가 없어요', style: TextStyle(color: mutedText))]),
        if (news.isNotEmpty) card([for (final n in news) NewsRow(n)]),
        if (content['scorecard'] != null) ..._scorecard(content['scorecard'] as Map<String, dynamic>, title, card),
        const SizedBox(height: 16),
        const SourceText('서버에 남은 주문·검사 기록으로 만든 요약이에요. 평가손익은 장 마감 시세가 서버에 없어 자산 탭에서 확인해 주세요.'),
        if (review != null) ..._review(review, title, card),
      ]),
    );
  }

  /// 전 거래일 판단 점수 (서버 scorecard.latest): 관찰한 종목의 그날 등락, 판 종목의 판 가격 대비 종가. 2026-10-20
  static List<Widget> _scorecard(Map<String, dynamic> s, Widget Function(String) title, Widget Function(List<Widget>) card) {
    final sells = (s['sells'] as List).cast<Map<String, dynamic>>();
    final deferrals = ((s['deferrals'] as List?) ?? []).cast<Map<String, dynamic>>(); // 시장 탓이라 미룬 매도 (10/20부터)
    final day = '${s['day']}'.substring(5).replaceAll('-', '/');
    String pct(num? v) => v == null ? '미확인' : '${v > 0 ? '+' : ''}${v.toStringAsFixed(2)}%';
    return [
      title('$day 판단 점수'),
      card([
        if ((s['watched'] as int) > 0)
          Text('관찰 ${s['watched']}종목 평균 ${pct(s['watch_avg'] as num?)}'
              ' · 놓친 기회 ${(s['missed'] as List).length} · 피한 손실 ${(s['avoided'] as List).length}',
              style: const TextStyle(fontWeight: FontWeight.bold)),
        if (sells.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text('판 ${s['sell_known']}건 중 ${s['sell_higher']}건이 판 뒤 더 올랐어요'
              '${s['sell_missed_krw'] == null ? '' : ' (들고 있었으면 ${(s['sell_missed_krw'] as int) > 0 ? '+' : ''}${won(s['sell_missed_krw'] as int)})'}',
              style: const TextStyle(fontWeight: FontWeight.bold)),
          for (final r in sells)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(children: [
                SizedBox(width: 48, child: Text('${r['at']}', style: const TextStyle(color: mutedText))),
                Expanded(child: Text('${r['stock_name']}', maxLines: 1, overflow: TextOverflow.ellipsis)),
                Text('${comma(r['price'] as int)} → ${r['close'] == null ? '미확인' : comma(r['close'] as int)}  '),
                Text(pct(r['after_pct'] as num?), style: TextStyle(fontWeight: FontWeight.bold,
                    color: r['after_pct'] == null ? mutedText : changeColor(r['after_pct'] as num))),
              ]),
            ),
        ],
        if (deferrals.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text('미룬 매도 ${s['deferral_known']}건 중 ${s['deferral_right']}건은 미룬 게 맞았어요 (종가가 더 높음)',
              style: const TextStyle(fontWeight: FontWeight.bold)),
          for (final r in deferrals)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(children: [
                SizedBox(width: 48, child: Text('${r['at']}', style: const TextStyle(color: mutedText))),
                Expanded(child: Text('${r['stock_name']}', maxLines: 1, overflow: TextOverflow.ellipsis)),
                Text('${comma(r['price'] as int)} → ${r['close'] == null ? '미확인' : comma(r['close'] as int)}  '),
                Text(pct(r['after_pct'] as num?), style: TextStyle(fontWeight: FontWeight.bold,
                    color: r['after_pct'] == null ? mutedText : changeColor(r['after_pct'] as num))),
              ]),
            ),
        ],
        const SizedBox(height: 4),
        const SourceText('금융위원회 종가 기준 (다음 날 14시 수집) · 세금·수수료 전'),
      ]),
    ];
  }

  static Widget _orderRow(Map<String, dynamic> o) {
    final filled = (o['filled_qty'] as int? ?? 0) > 0;
    final qty = filled ? o['filled_qty'] as int : o['qty'] as int;
    final price = filled ? o['filled_price'] as int : o['price'] as int;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        SizedBox(width: 48, child: Text(hhmm(o['created_at'] as String), style: const TextStyle(color: mutedText))),
        Expanded(child: Text('${o['stock_name']}', maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.bold))),
        Tag(sideLabels[o['side']] ?? '${o['side']}', o['side'] == 'buy' ? upRed : downBlue),
        const SizedBox(width: 8),
        Text('${comma(qty)}주 × ${comma(price)}'),
        if (!filled) Text(' ${orderLabels[o['status']] ?? o['status']}', style: const TextStyle(color: coachOrange)),
      ]),
    );
  }

  /// AI 회고 · 내일 계획 (2-4b): 투자 AI가 쓰고 검증 AI가 원문을 다시 확인한 것. 주문은 만들지 않는다
  List<Widget> _review(Map<String, dynamic> review, Widget Function(String) title, Widget Function(List<Widget>) card) {
    final verdict = review['verdict'] as String;
    final passed = verdict == 'approve' || verdict == 'conditional';
    Widget claim(Map<String, dynamic> c) => ClaimLine(c);
    return [
      title('AI 회고 · 내일 계획'),
      card([
        Row(children: [
          const Expanded(child: Text('오늘 회고', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16))),
          Tag('검증 ${review['verdict_label']}', passed ? const Color(0xFF137A33) : coachOrange),
        ]),
        const SizedBox(height: 8),
        for (final c in (review['retrospective'] as List).cast<Map<String, dynamic>>()) claim(c),
        NoteBox.risks((review['risks'] as List).cast<String>()),
      ]),
      if (review['general'] == true)
        card([const Text('일반 모드라 사라·팔라 판단은 하지 않고 볼 것만 정리했어요. 성향 퀴즈를 하면 맞춤 계획을 받을 수 있어요.',
            style: TextStyle(color: mutedText))]),
      for (final t in (review['tomorrow'] as List).cast<Map<String, dynamic>>())
        card([
          Text('내일 ${t['stock_name']} · ${t['action']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          const SizedBox(height: 6),
          for (final c in (t['reasons'] as List).cast<Map<String, dynamic>>()) claim(c),
          NoteBox('이러면 판단이 틀린 것', (t['invalid_if'] as List).cast<String>(), color: const Color(0xFF8A5A00), icon: Icons.flag_outlined),
        ]),
      card([
        VerdictSummary('검증 AI: ${review['summary']}'),
        NoteBox.conditions((review['conditions'] as List).cast<String>()),
        NoteBox('의견 차이', (review['disagreements'] as List).cast<String>(), color: mutedText, icon: Icons.forum_outlined),
        if (!passed) const Text('검증을 통과하지 못했어요. 참고만 하고 직접 판단해 주세요.', style: TextStyle(color: coachOrange)),
      ]),
      for (final src in (review['sources'] as List).cast<Map<String, dynamic>>())
        SourceText('출처: ${src['title']}${src['as_of'] == null ? '' : ' · ${src['as_of']}'}${src['url'] == null ? '' : ' · ${src['url']}'}'),
      const SizedBox(height: 8),
      const SourceText('주문은 만들지 않아요. 사려면 채팅에서 직접 말해 주세요 (처리안 → 승인을 거쳐요). '
          '투자 판단과 책임은 본인에게 있고, 손실이 날 수 있어요.'),
    ];
  }
}
