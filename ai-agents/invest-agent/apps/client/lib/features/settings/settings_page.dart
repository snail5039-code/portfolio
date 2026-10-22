// S-12 설정: 투자성향(모드), 투자 정책(한도), 계정. 증권사 연결은 7단계

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../common/common.dart';
import '../approvals/approvals_page.dart';
import '../auto/auto_page.dart';
import '../auto/auto_trader.dart';
import '../auto/reservations.dart';
import '../auth/login_page.dart';
import '../auth/quiz_page.dart';
import 'behavior_page.dart';
import 'broker_page.dart';
import 'notifications_page.dart';
import 'safety_page.dart';
import '../../broker/broker.dart';
import 'package:flutter/foundation.dart';

/// 더보기 한 줄 요약: "맞춤 · 적극투자형 4단계" / "일반 모드"
String profileSummary(Map<String, dynamic> profile) => profile['mode'] == 'custom'
    ? '맞춤 · ${profile['label']} ${profile['risk_level']}단계'
    : profile['expired'] == true ? '일반 모드 · 퀴즈 기간 지남' : '일반 모드';

/// 더보기 한 줄 요약: "1회 200만원 · 하루 500만원 · 한 종목 40%"
String policySummary(Map<String, dynamic> policy) {
  String man(num v) => v % 10000 == 0 ? '${comma(v ~/ 10000)}만원' : won(v);
  return '1회 ${man(policy['max_order_krw'] as num)} · 하루 ${man(policy['max_daily_krw'] as num)}'
      ' · 한 종목 ${(policy['max_weight_pct'] as num).toStringAsFixed(0)}%';
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late Future<(Map<String, dynamic>, Map<String, dynamic>)> _data = _load();
  final _maxOrder = TextEditingController();
  final _maxDaily = TextEditingController();
  final _maxWeight = TextEditingController();
  final _feeRate = TextEditingController();
  List<String> _warnings = [];

  Future<(Map<String, dynamic>, Map<String, dynamic>)> _load() async {
    final profile = await api.get('/api/profile') as Map<String, dynamic>;
    final policy = await api.get('/api/policy') as Map<String, dynamic>;
    profileMode.value = profile['mode'] as String;
    _fill(policy);
    return (profile, policy);
  }

  void _fill(Map<String, dynamic> policy) {
    _maxOrder.text = '${policy['max_order_krw']}';
    _maxDaily.text = '${policy['max_daily_krw']}';
    _maxWeight.text = '${policy['max_weight_pct']}';
    _feeRate.text = policy['fee_rate_pct'] == null ? '' : '${policy['fee_rate_pct']}';
    _warnings = (policy['warnings'] as List).cast<String>();
  }

  void _reload() => setState(() { _data = _load(); });

  Future<void> _savePolicy(StateSetter refresh) async {
    try {
      final policy = await api.put('/api/policy', {
        'max_order_krw': int.tryParse(_maxOrder.text.replaceAll(',', '')),
        'max_daily_krw': int.tryParse(_maxDaily.text.replaceAll(',', '')),
        'max_weight_pct': num.tryParse(_maxWeight.text),
        'fee_rate_pct': _feeRate.text.trim().isEmpty ? null : num.tryParse(_feeRate.text),
      }) as Map<String, dynamic>;
      _fill(policy);
      refresh(() {});
      if (mounted) showError(context, '저장했어요');
    } on ApiError catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<bool> _confirm(String title, String body) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(title: Text(title), content: Text(body), actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('확인')),
        ]),
      ) ??
      false;

  Future<void> _toGeneral() async {
    if (!await _confirm('일반 모드로 돌아갈까요?', '퀴즈 결과를 지우고, 한도는 안정형 기본값보다 높은 것만 내려요.')) return;
    try {
      await api.delete('/api/profile');
      if (mounted) Navigator.of(context).pop(); // 더보기로 돌아가면 다시 읽는다
    } on ApiError catch (error) {
      if (mounted) showError(context, error);
    }
  }

  void _toLogin() =>
      Navigator.of(context).pushAndRemoveUntil(pageRoute(const LoginPage()), (_) => false);

  Future<void> _logout() async {
    await api.logout();
    if (mounted) _toLogin();
  }

  Future<void> _deleteAccount() async {
    final password = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('탈퇴'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('모든 기록이 지워지고 되돌릴 수 없어요. 비밀번호를 다시 입력해 주세요.'),
          TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: '비밀번호')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('탈퇴')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await api.delete('/api/me', {'password': password.text});
      await api.logout();
      if (mounted) _toLogin();
    } on ApiError catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<void> _open(Widget page) async {
    await Navigator.of(context).push(pageRoute(page));
    _reload();
  }

  /// 투자성향·한도는 한 단계 아래 화면에서 바꾼다 (2026-10-20: 더보기를 한 화면 안에)
  Widget _subPage(String title, Widget Function(StateSetter refresh) body) => Scaffold(
        appBar: topBar(title),
        body: StatefulBuilder(builder: (context, refresh) => ListView(padding: const EdgeInsets.all(16), children: [body(refresh)])),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: topBar('더보기'),
        body: FutureBuilder(
          future: _data,
          builder: (context, snapshot) {
            if (snapshot.hasError) return ErrorRetry(snapshot.error!, _reload);
            if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
            final (profile, policy) = snapshot.data!;
            return ListView(padding: const EdgeInsets.all(16), children: [
              if (!kIsWeb) ...[const EmergencyStopButton(), const SizedBox(height: 12)],
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.05,
                children: [
                  if (!kIsWeb)
                    ValueListenableBuilder(
                      valueListenable: realMode,
                      builder: (_, real, _) => _tile(Icons.account_balance_outlined, '실전 모드', real ? '켜짐' : '꺼짐',
                          const Color(0xFFC62828), () => _open(const RealModePage()), alert: real),
                    ),
                  _tile(Icons.fact_check_outlined, '처리안', null, brandBlue, () => _open(const ApprovalsPage(active: true))),
                  if (!kIsWeb)
                    ListenableBuilder(
                      listenable: autoTrader,
                      builder: (_, _) => _tile(Icons.smart_toy_outlined, '자동매매',
                          !autoTrader.on ? '꺼짐' : autoTrader.needsPlan ? '승인 필요' : '켜짐', brandBlue,
                          () => _open(const AutoTradePage()), alert: autoTrader.on && autoTrader.needsPlan),
                    ),
                  _tile(Icons.schedule_outlined, '예약 주문', null, brandBlue, () => _open(const ReservationsPage())),
                  _tile(Icons.notifications_outlined, '알림', null, brandBlue, () => _open(const NotificationsPage())),
                  _tile(Icons.insights_outlined, '투자 습관', null, coachOrange, () => _open(const BehaviorPage())),
                ],
              ),
              const SizedBox(height: 16),
              Card(
                color: softGray,
                elevation: 0,
                clipBehavior: Clip.antiAlias,
                child: Column(children: [
                  _row(Icons.person_outline, '투자성향', profileSummary(profile),
                      () => _open(_subPage('투자성향', (_) => _profileSection(profile)))),
                  const Divider(height: 1, indent: 56),
                  _row(Icons.tune, '한도', policySummary(policy),
                      () => _open(_subPage('투자 한도', (refresh) => _policySection(policy, refresh)))),
                  if (!kIsWeb) ...[
                    const Divider(height: 1, indent: 56),
                    ValueListenableBuilder(
                      valueListenable: currentBroker,
                      builder: (context, broker, _) => _row(Icons.link, '증권사 연결',
                          broker == null ? '연결 안 됨' : '${broker.name}${broker.isFake ? ' (가짜 데이터)' : ''}',
                          () => _open(const BrokerPage())),
                    ),
                  ],
                ]),
              ),
              const SizedBox(height: 24),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                TextButton(onPressed: _logout, child: const Text('로그아웃', style: TextStyle(color: mutedText))),
                const Text('·', style: TextStyle(color: mutedText)),
                TextButton(onPressed: _deleteAccount, child: const Text('탈퇴', style: TextStyle(color: Colors.red))),
              ]),
            ]);
          },
        ),
      );

  /// 아이콘 칸: 아이콘 · 이름 · (상태). alert면 상태를 주황으로
  Widget _tile(IconData icon, String label, String? status, Color color, VoidCallback onTap, {bool alert = false}) => Material(
        color: softGray,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, color: color, size: 30),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
            const SizedBox(height: 4),
            // 상태가 없는 칸도 같은 높이로 (아이콘 줄이 맞게)
            Visibility(visible: status != null, maintainSize: true, maintainAnimation: true, maintainState: true,
                child: Tag(status ?? '-', alert ? coachOrange : mutedText)),
          ]),
        ),
      );

  Widget _row(IconData icon, String title, String value, VoidCallback onTap) => ListTile(
        leading: Icon(icon, color: mutedText),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      );

  Widget _profileSection(Map<String, dynamic> profile) {
    final custom = profile['mode'] == 'custom';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('투자성향', style: TextStyle(fontWeight: FontWeight.bold)),
      const SizedBox(height: 4),
      if (custom) ...[
        Text('맞춤 모드 · ${profile['label']} (${profile['risk_level']}단계)'),
        SourceText('유효기간 ${(profile['expires_at'] as String).substring(0, 10)}까지'),
      ] else ...[
        const Text('일반 모드 · 정보와 분석만, 안정형 한도'),
        if (profile['expired'] == true) const Text('퀴즈 결과가 24개월이 지났어요. 다시 해 주세요.', style: TextStyle(color: Colors.orange)),
      ],
      const SizedBox(height: 8),
      Wrap(spacing: 8, children: [
        FilledButton.tonal(
          onPressed: () async {
            await Navigator.of(context).push(pageRoute(const QuizPage()));
            if (mounted) Navigator.of(context).pop(); // 더보기로 돌아가면 다시 읽는다
          },
          child: Text(custom ? '퀴즈 다시 하기' : '퀴즈 하기'),
        ),
        if (custom) OutlinedButton(onPressed: _toGeneral, child: const Text('일반 모드로 돌아가기')),
      ]),
      const SourceText('퀴즈는 하루 3번까지 할 수 있어요.'),
    ]);
  }

  Widget _policySection(Map<String, dynamic> policy, StateSetter refresh) {
    final defaults = policy['default_policy'] as Map<String, dynamic>;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('투자 정책 (한도)', style: TextStyle(fontWeight: FontWeight.bold)),
      if (policy['mode'] == 'general')
        const Text('한도를 올리려면 성향 퀴즈를 해 주세요.', style: TextStyle(color: Colors.grey)),
      _field(_maxOrder, '1회 주문 한도 (원)', '기본 ${won(defaults['max_order_krw'] as num)}'),
      _field(_maxDaily, '1일 주문 한도 (원)', '기본 ${won(defaults['max_daily_krw'] as num)}'),
      _field(_maxWeight, '한 종목 최대 비중 (%)', '기본 ${defaults['max_weight_pct']}%'),
      _field(_feeRate, '수수료율 (%)', '예: 0.015 · 비우면 미입력'),
      for (final warning in _warnings) Text(warning, style: const TextStyle(color: Colors.orange)),
      const SizedBox(height: 8),
      FilledButton(onPressed: () => _savePolicy(refresh), child: const Text('한도 저장')),
    ]);
  }

  Widget _field(TextEditingController controller, String label, String helper) => TextField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: label, helperText: helper),
      );
}
