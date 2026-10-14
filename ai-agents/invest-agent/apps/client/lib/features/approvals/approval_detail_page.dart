// S-07 처리안 상세 (승인). card 형식: apps/api/app/agents/order.py policy_node

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../common/common.dart';
import '../chat/conversation.dart';


class VerdictTag extends StatelessWidget {
  const VerdictTag(this.verdict, {super.key});
  final String verdict;

  @override
  Widget build(BuildContext context) =>
      Tag('검증 ${verdictLabels[verdict] ?? verdict}', verdictColors[verdict] ?? Colors.grey);
}

class ApprovalDetailPage extends StatefulWidget {
  /// conversation이 있으면 승인·거절·수정을 할 수 있고, 없으면 보기만 한다 (지난 처리안)
  const ApprovalDetailPage({super.key, required this.card, this.conversation, this.interrupt, this.onClose});
  final Map<String, dynamic> card;
  final VoidCallback? onClose; // 넓은 화면의 오른쪽 패널이면 화면을 닫는 대신 이것을 부른다
  final Conversation? conversation;
  final Map<String, dynamic>? interrupt;

  @override
  State<ApprovalDetailPage> createState() => _ApprovalDetailPageState();
}

class _ApprovalDetailPageState extends State<ApprovalDetailPage> {
  bool _confirmed = false;
  Timer? _timer;

  Map<String, dynamic> get card => widget.card;
  List<String> get _confirmRequired => (widget.interrupt?['confirm_required'] as List? ?? []).cast<String>();

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => setState(() {})); // 남은 시간 갱신
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _answer(Map<String, dynamic> payload, String shown) {
    widget.conversation!.answer(payload, shown: shown);
    _close();
  }

  void _close() {
    if (widget.onClose != null) {
      widget.onClose!();
    } else {
      Navigator.of(context).pop();
    }
  }

  Future<void> _edit() async {
    final controller = TextEditingController();
    final text = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('수정'),
        content: TextField(controller: controller, decoration: const InputDecoration(hintText: '예: 2주만, 11만 원에')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('취소')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('수정')),
        ],
      ),
    );
    if (text != null && text.isNotEmpty) _answer({'decision': 'edit', 'text': text}, text);
  }

  @override
  Widget build(BuildContext context) {
    final side = sideLabels[card['side']];
    final expires = DateTime.parse(card['expires_at'] as String);
    final minutesLeft = expires.difference(DateTime.now()).inMinutes;
    final open = widget.conversation != null && expires.isAfter(DateTime.now());

    return Scaffold(
      appBar: widget.onClose == null
          ? topBar('처리안 상세')
          : AppBar(
              title: const Text('처리안 상세'),
              automaticallyImplyLeading: false,
              actions: [IconButton(tooltip: '닫기', icon: const Icon(Icons.close), onPressed: widget.onClose)],
            ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // 1. 주문 요약
        Text('${card['stock_name']} (${card['stock_code']})', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        Text('${comma(card['qty'] as int)}주 $side · 지정가 ${won(card['limit_price'] as int)}'
            '${card['order_change'] == null ? '' : ' · 주문 ${orderChangeLabels[card['order_change']]}'}'
            '${card['order_change'] == 'modify' ? ' (원래 ${won(card['original_price'] as int)})' : ''}',
            style: const TextStyle(fontSize: 16)),
        _row('예상 금액', won(card['amount'] as int)),
        _row('수수료 추정', card['fee'] == null ? '수수료율 미입력' : won(card['fee'] as int)),
        if (card['side'] == 'sell') _row('세금 (0.20%)', won(card['tax'] as int)),
        if (card['weight_after'] != null) _row('주문 후 이 종목 비중', '${card['weight_after']}%'),
        // 2. 검증 판정
        const SizedBox(height: 12),
        Align(alignment: Alignment.centerLeft, child: VerdictTag(card['verdict'] as String)),
        if (card['user_directed'] == true) const SourceText('직접 지시한 주문이에요. 검증 AI가 한 번 더 확인했어요.'),
        // 3. 투자 AI 제안
        VerdictSummary('검증 AI: ${card['summary']}'),
        _section('투자 AI 제안', [
          for (final claim in (card['claims'] as List).cast<Map<String, dynamic>>()) ClaimLine(claim),
          NoteBox.counters((card['counter_arguments'] as List).cast<String>()),
          NoteBox.risks((card['risks'] as List).cast<String>()),
        ]),
        // 4. 검증 AI 의견
        _section('검증 AI 의견', [
          NoteBox.conditions((card['conditions'] as List).cast<String>()),
          NoteBox('두 AI 의견 차이', (card['disagreements'] as List).cast<String>(), color: mutedText, icon: Icons.forum_outlined),
        ]),
        // 5. 최악의 경우
        if (card['worst_case_loss'] != null)
          _section('최악의 경우', [
            Text('10% 하락하면 −${won(card['worst_case_loss'] as int)}', style: const TextStyle(color: Colors.blue)),
          ]),
        // 6. 정책 검사
        _section('정책 검사', [
          for (final rule in (card['policy'] as List).cast<Map<String, dynamic>>())
            Row(children: [
              Icon(rule['ok'] == true ? Icons.check_circle : Icons.cancel, size: 18,
                  color: rule['ok'] == true ? Colors.green : Colors.red),
              const SizedBox(width: 6),
              Expanded(child: Text('${rule['label']}: 한도 ${_value(rule['limit'])} / 이번 ${_value(rule['actual'])}')),
            ]),
        ]),
        // 7. 주의·확인 필요
        if ((card['warnings'] as List).isNotEmpty)
          _section('주의', [for (final text in (card['warnings'] as List).cast<String>()) _bullet(text)]),
        if (_confirmRequired.isNotEmpty && open)
          Card(
            color: Colors.orange.withValues(alpha: 0.12),
            child: Column(children: [
              for (final text in _confirmRequired) ListTile(leading: const Icon(Icons.warning_amber), title: Text(text)),
              CheckboxListTile(
                value: _confirmed,
                onChanged: (value) => setState(() => _confirmed = value ?? false),
                title: const Text('위 내용을 확인했고, 내 판단으로 진행해요'),
              ),
            ]),
          ),
        // 8. 남은 시간
        const SizedBox(height: 12),
        Text(open ? '$minutesLeft분 후 만료 (${hhmm(card['expires_at'] as String)})' : '승인할 수 없는 처리안이에요 (만료·처리됨)',
            style: const TextStyle(color: Colors.grey)),
        // 9. 버튼
        if (open) ...[
          const SizedBox(height: 12),
          Row(children: [
            OutlinedButton(onPressed: () => _answer({'decision': 'reject'}, '거절'), child: const Text('거절')),
            const SizedBox(width: 8),
            OutlinedButton(onPressed: _edit, child: const Text('수정')),
            const Spacer(),
            FilledButton(
              onPressed: _confirmRequired.isNotEmpty && !_confirmed
                  ? null
                  : () => _answer({'decision': 'approve', if (_confirmRequired.isNotEmpty) 'confirm_risk': true}, '승인'),
              child: Text(kIsWeb ? '승인' : '승인하고 실행'),
            ),
          ]),
          if (kIsWeb) const SourceText('웹에서는 승인만 해요. 주문 실행은 폰 앱에서 해 주세요.'),
        ],
      ]),
    );
  }

  String _value(Object? value) => value is int ? won(value) : '$value';

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(children: [Text(label, style: const TextStyle(color: Colors.grey)), const Spacer(), Text(value)]),
      );

  Widget _section(String title, List<Widget> children) => Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          ...children,
        ]),
      );

  Widget _bullet(String text) => Padding(padding: const EdgeInsets.only(top: 2), child: Text('· $text'));
}
