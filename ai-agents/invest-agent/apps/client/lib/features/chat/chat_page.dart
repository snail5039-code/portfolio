// S-06 대화 (디자인 H안의 투자 비서 방): 메신저 말풍선, 진행 단계, 질문 선택 버튼, 처리안 카드

import 'package:flutter/material.dart';

import '../../common/common.dart';
import '../approvals/approval_detail_page.dart';
import 'conversation.dart';
import 'news_page.dart';

class ChatPage extends StatefulWidget {
  const ChatPage(this.conversation, {super.key});
  final Conversation conversation;

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  Map<String, dynamic>? _panel; // 넓은 화면에서 오른쪽에 펼친 처리안 (멈춤 interrupt)

  Conversation get _c => widget.conversation;

  void _submit() {
    final text = _input.text.trim();
    if (text.isEmpty || _c.busy) return;
    _input.clear();
    _c.submit(text);
  }

  void _newChat() => setState(() {
        _panel = null;
        _c.threadId = null;
        _c.waiting = null;
        _c.items.clear();
      });

  static const _background = Color(0xFFEAF3FA);

  static String _short(String name) => name.length <= 2 ? name : name.substring(0, 2);

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: _background,
        appBar: topBar(_c.stockName ?? '투자 비서',
            avatar: _c.stockName == null
                ? const RoomAvatar(text: 'AI', color: brandBlue, size: 36)
                : RoomAvatar(text: _short(_c.stockName!), color: const Color(0xFFFFF5F4), foreground: const Color(0xFFA3241B), size: 36),
            subtitle: _c.stockName == null ? '검증 AI와 함께 확인해요' : '이 방에서는 종목 이름을 빼고 말해도 돼요',
            actions: [
          if (_c.stockCode != null)
            IconButton(
                tooltip: '뉴스·공시',
                icon: const Icon(Icons.newspaper_outlined),
                onPressed: () => Navigator.of(context).push(pageRoute(NewsPage(_c.stockCode!, _c.stockName!)))),
          IconButton(tooltip: '새 대화', icon: const Icon(Icons.add_comment_outlined), onPressed: _newChat),
        ]),
        body: ListenableBuilder(
          listenable: _c,
          builder: (context, _) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
            });
            final chat = Column(children: [
              Expanded(
                child: _c.items.isEmpty
                    ? _suggestions()
                    : ListView(controller: _scroll, padding: const EdgeInsets.all(12), children: [
                        for (final item in _c.items) _bubble(item),
                        if (_c.progress != null) _progress(_c.progress!),
                      ]),
              ),
              _inputBar(),
            ]);
            final panel = _panel;
            if (!isWide(context) || panel == null) return chat;
            // 넓은 화면: 대화 + 오른쪽 처리안 상세 (03-screens.md 3장 웹 레이아웃)
            return Row(children: [
              Expanded(child: chat),
              const VerticalDivider(width: 1),
              SizedBox(
                width: 440,
                child: ApprovalDetailPage(
                  key: ValueKey(panel['interrupt_id']),
                  card: panel['card'] as Map<String, dynamic>,
                  conversation: _c.isWaiting(panel) ? _c : null,
                  interrupt: panel,
                  onClose: () => setState(() => _panel = null),
                ),
              ),
            ]);
          },
        ),
      );

  Widget _suggestions() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const RoomAvatar(text: 'AI', color: brandBlue, size: 64),
            const SizedBox(height: 12),
            const Text('말로 물어보면 분석하고, 주문은 승인해야만 나가요',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 15, color: mutedText)),
            const SizedBox(height: 16),
            Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
              for (final text in _c.stockName == null
                  ? ['잔고 보여줘', '삼성전자 사도 돼?', '기아 2주 사줘', '아까 주문 체결됐어?', 'PER이 뭐야?']
                  : ['지금 사도 돼?', '현재가 알려줘', '1주 사줘', '주문 체결됐어?'])
                ActionChip(backgroundColor: Colors.white, label: Text(text), onPressed: () => _c.send(text)),
            ]),
          ]),
        ),
      );

  /// 가운데 작은 알림 줄 (진행 단계, 증권사 확인 중 등)
  Widget _notice(String text, {bool spinning = false}) => Center(
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 6),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: const Color(0xFFD7E6F2), borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (spinning) ...[
              const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: brandBlue)),
              const SizedBox(width: 8),
            ],
            Flexible(child: Text(text, style: const TextStyle(fontSize: 12, color: Color(0xFF4F5B66)))),
          ]),
        ),
      );

  Widget _progress(String label) => _notice('$label…', spinning: true);

  Widget _bubble(ChatItem item) {
    if (item.role == 'info') return _notice(item.text);
    final mine = item.role == 'user';
    final interrupt = item.interrupt;
    final isCard = interrupt?['kind'] == 'approval';
    final color = switch (item.role) {
      'user' => brandBlue,
      'error' => const Color(0xFFFFE4E0),
      _ => Colors.white,
    };
    const r = Radius.circular(18);
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: isCard ? EdgeInsets.zero : const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: isCard ? 340 : 480),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: color,
          borderRadius: isCard
              ? BorderRadius.circular(20)
              : BorderRadius.only(topLeft: r, topRight: r, bottomLeft: mine ? r : const Radius.circular(4),
                  bottomRight: mine ? const Radius.circular(4) : r),
        ),
        child: isCard
            ? _approvalCard(interrupt!)
            : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(item.text, style: TextStyle(fontSize: 15, height: 1.45, color: mine ? Colors.white : ink)),
                if (interrupt?['choices'] != null)
                  Wrap(spacing: 8, children: [
                    for (final choice in (interrupt!['choices'] as List).cast<Map<String, dynamic>>())
                      OutlinedButton(
                        onPressed: _c.isWaiting(interrupt)
                            ? () => _c.answer({'choice_id': choice['id']}, shown: choice['label'] as String)
                            : null,
                        child: Text(choice['label'] as String),
                      ),
                  ]),
              ]),
      ),
    );
  }

  /// 처리안 카드: 종목, 매수/매도, 수량, 금액, 검증 판정 + [자세히] [거절] [승인]
  Widget _approvalCard(Map<String, dynamic> interrupt) {
    final card = interrupt['card'] as Map<String, dynamic>;
    final open = _c.isWaiting(interrupt);
    final needsConfirm = (interrupt['confirm_required'] as List).isNotEmpty;
    void detail() => isWide(context)
        ? setState(() => _panel = interrupt)
        : Navigator.of(context).push(pageRoute(ApprovalDetailPage(card: card, conversation: open ? _c : null, interrupt: interrupt)));

    final verdict = card['verdict'] as String;
    final ok = verdict == 'approve' && !needsConfirm; // 확인할 위험이 있으면 노란 띠
    final expires = open ? ' · ${hhmm(interrupt['expires_at'] as String)}까지' : '';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('주문 처리안$expires', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: brandBlue)),
          const SizedBox(height: 2),
          Text('${card['stock_name']} ${comma(card['qty'] as int)}주 ${sideLabels[card['side']]}'
              '${card['order_change'] == null ? '' : ' 주문 ${orderChangeLabels[card['order_change']]}'}',
              style: const TextStyle(fontFamily: displayFont, fontSize: 22)),
          Text(switch (card['order_change']) {
                'cancel' => '미체결 주문 취소 · 지정가 ${won(card['limit_price'] as int)} · 주문번호 ${card['original_order_no']}',
                'modify' => '지정가 ${won(card['original_price'] as int)} → ${won(card['limit_price'] as int)} · 예상 ${won(card['amount'] as int)}',
                _ => '지정가 ${won(card['limit_price'] as int)} · 예상 ${won(card['amount'] as int)}',
              },
              style: const TextStyle(fontSize: 14, color: mutedText)),
          if (card['worst_case_loss'] != null)
            Text('10% 내리면 −${won(card['worst_case_loss'] as int)}', style: const TextStyle(fontSize: 14, color: downBlue)),
          if (open) const Text('바꾸려면 "2주만"처럼 입력하세요', style: TextStyle(fontSize: 12, color: mutedText)),
        ]),
      ),
      Container(
        color: ok ? const Color(0xFFE6F6EC) : const Color(0xFFFFF8E6),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(children: [
          Icon(ok ? Icons.verified_outlined : Icons.info_outline, size: 16,
              color: ok ? const Color(0xFF137A33) : const Color(0xFF8A5A00)),
          const SizedBox(width: 8),
          Expanded(
            child: Text('검증 AI ${verdictLabels[verdict] ?? verdict}${needsConfirm ? ' · 확인이 필요한 위험이 있어요' : ''}',
                style: TextStyle(fontSize: 13, color: ok ? const Color(0xFF0E5A27) : const Color(0xFF6B4600))),
          ),
        ]),
      ),
      Row(children: [
        if (open) ...[
          Expanded(child: _cardButton('거절', mutedText, () => _c.answer({'decision': 'reject'}, shown: '거절'))),
          const SizedBox(height: 48, child: VerticalDivider(width: 1)),
        ],
        Expanded(child: _cardButton('자세히', open ? mutedText : brandBlue, detail)),
        if (open) ...[
          const SizedBox(height: 48, child: VerticalDivider(width: 1)),
          // 확인이 필요한 위험이 있으면 상세 화면에서 내용을 보고 확인해야 승인할 수 있다
          Expanded(child: _cardButton('승인', brandBlue, needsConfirm ? detail : () => _c.answer({'decision': 'approve'}, shown: '승인'))),
        ],
      ]),
    ]);
  }

  Widget _cardButton(String label, Color color, VoidCallback onTap) => InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 48,
          child: Center(child: Text(label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: color))),
        ),
      );

  Widget _inputBar() {
    final kind = _c.waiting?['kind'];
    final hint = kind == 'question' ? '답을 입력하세요' : kind == 'approval' ? '수정할 내용 (예: 2주만)' : '무엇이든 물어보세요';
    return Container(
      color: Colors.white,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 8, 10),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _input,
                decoration: InputDecoration(
                  hintText: hint,
                  filled: true,
                  fillColor: softGray,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                ),
                onSubmitted: (_) => _submit(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              tooltip: '보내기',
              style: IconButton.styleFrom(backgroundColor: brandBlue, minimumSize: const Size(46, 46)),
              icon: const Icon(Icons.arrow_upward, color: Colors.white),
              onPressed: _c.busy ? null : _submit,
            ),
          ]),
        ),
      ),
    );
  }
}
