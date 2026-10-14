// S-08 승인 대기: 승인 필요 / 실행 필요(웹에서 승인, 폰에서 실행 대기) / 만료·거절

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';
import '../chat/conversation.dart';
import 'approval_detail_page.dart';

const tabs = [('needs_approval', '승인 필요'), ('needs_execution', '실행 필요'), ('closed', '만료·거절')];
const statusLabels = {'rejected': '거절', 'expired': '만료', 'approved': '승인'};

class ApprovalsPage extends StatelessWidget {
  const ApprovalsPage({super.key, required this.active});
  final bool active;

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: tabs.length,
        child: Scaffold(
          appBar: AppBar(
            title: topBar('처리안').title,
            actions: topBar('').actions,
            bottom: TabBar(tabs: [for (final (_, label) in tabs) Tab(text: label)]),
          ),
          body: TabBarView(children: [for (final (status, _) in tabs) _ApprovalList(status, active: active)]),
        ),
      );
}

class _ApprovalList extends StatefulWidget {
  const _ApprovalList(this.status, {required this.active});
  final String status;
  final bool active;

  @override
  State<_ApprovalList> createState() => _ApprovalListState();
}

class _ApprovalListState extends State<_ApprovalList> {
  late Future<List<dynamic>> _items = _load();

  Future<List<dynamic>> _load() async => await api.get('/api/approvals?status=${widget.status}') as List;

  void _reload() => setState(() { _items = _load(); });

  @override
  void didUpdateWidget(_ApprovalList old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _reload();
  }

  /// 승인 대기 중인 대화의 멈춤을 찾아 그 대화로 이어서 답한다
  Future<Conversation?> _resume(Map<String, dynamic> item, String kind) async {
    final pending = (await api.get('/api/chat/pending') as List).cast<Map<String, dynamic>>();
    final waiting = pending.where((p) => p['kind'] == kind &&
        (p['approval_id'] ?? (p['request'] as Map?)?['approval_id']) == item['approval_id']).firstOrNull;
    if (waiting == null) return null;
    final conversation = Conversation(threadId: item['thread_id'] as String, waiting: waiting);
    // 답한 뒤 서버의 마지막 말(주문 결과 등)을 알려주고 목록을 새로 읽는다
    conversation.addListener(() {
      if (conversation.busy || conversation.items.isEmpty || !mounted) return;
      final last = conversation.items.last;
      if (last.role != 'user') ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(last.text)));
      _reload();
    });
    return conversation;
  }

  Future<void> _open(Map<String, dynamic> item) async {
    final card = {...item['card'] as Map<String, dynamic>, 'expires_at': item['expires_at']};
    try {
      if (widget.status == 'needs_approval') {
        final conversation = await _resume(item, 'approval');
        if (!mounted) return;
        await Navigator.of(context).push(pageRoute(ApprovalDetailPage(card: card, conversation: conversation, interrupt: conversation?.waiting)));
      } else if (widget.status == 'needs_execution' && !kIsWeb) {
        final conversation = await _resume(item, 'execute');
        if (conversation == null) throw ApiError(409, '실행할 주문을 찾지 못했어요');
        await conversation.executeWaiting();
      } else {
        await Navigator.of(context).push(pageRoute(ApprovalDetailPage(card: card)));
      }
    } on ApiError catch (error) {
      if (mounted) showError(context, error);
    }
    _reload();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder(
        future: _items,
        builder: (context, snapshot) {
          if (snapshot.hasError) return ErrorRetry(snapshot.error!, _reload);
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final items = snapshot.data!.cast<Map<String, dynamic>>();
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: items.isEmpty
                ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('없어요')))])
                : ListView(children: [for (final item in items) _tile(item)]),
          );
        },
      );

  Widget _tile(Map<String, dynamic> item) {
    final card = item['card'] as Map<String, dynamic>;
    final order = item['order_result'] as Map<String, dynamic>?;
    final String trailing;
    if (widget.status == 'needs_approval') {
      trailing = '${DateTime.parse(item['expires_at'] as String).difference(DateTime.now()).inMinutes}분 남음';
    } else if (widget.status == 'needs_execution') {
      trailing = kIsWeb ? '폰 앱에서 실행' : '눌러서 실행';
    } else {
      trailing = order != null ? '주문 ${orderLabels[order['status']] ?? order['status']}' : statusLabels[item['status']] ?? '${item['status']}';
    }
    return ListTile(
      title: Text('${card['stock_name']} ${comma(card['qty'] as int)}주 ${sideLabels[card['side']]}'),
      subtitle: Row(children: [VerdictTag(card['verdict'] as String), const SizedBox(width: 8), Text(won(card['amount'] as int))]),
      trailing: Text(trailing),
      onTap: () => _open(item),
    );
  }
}
