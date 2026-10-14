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

  Future<void> _savePolicy() async {
    try {
      final policy = await api.put('/api/policy', {
        'max_order_krw': int.tryParse(_maxOrder.text.replaceAll(',', '')),
        'max_daily_krw': int.tryParse(_maxDaily.text.replaceAll(',', '')),
        'max_weight_pct': num.tryParse(_maxWeight.text),
        'fee_rate_pct': _feeRate.text.trim().isEmpty ? null : num.tryParse(_feeRate.text),
      }) as Map<String, dynamic>;
      setState(() => _fill(policy));
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
      _reload();
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
              if (!kIsWeb) ...[
                const EmergencyStopButton(),
                const SizedBox(height: 8),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.account_balance_outlined, color: Color(0xFFC62828)),
                    title: const Text('실전 모드', style: TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: ValueListenableBuilder(valueListenable: realMode, builder: (_, real, _) => Text(real ? '켜짐 (실제 돈)' : '꺼짐 (모의투자)')),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(pageRoute(const RealModePage())),
                  ),
                ),
              ],
              Card(
                child: ListTile(
                  leading: const Icon(Icons.fact_check_outlined, color: brandBlue),
                  title: const Text('처리안 모아보기', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('승인 필요 · 실행 필요 · 만료·거절'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(pageRoute(const ApprovalsPage(active: true))),
                ),
              ),
              if (!kIsWeb)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.smart_toy_outlined, color: brandBlue),
                    title: const Text('모의 자동매매', style: TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: ListenableBuilder(listenable: autoTrader, builder: (_, _) => Text(!autoTrader.on ? '꺼짐' : autoTrader.needsPlan ? '켜짐 · 오늘 계획 승인 필요' : '켜짐')),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(pageRoute(const AutoTradePage())),
                  ),
                ),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.schedule_outlined, color: brandBlue),
                  title: const Text('예약 주문', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('가격 조건 · 분할 주문'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(pageRoute(const ReservationsPage())),
                ),
              ),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.notifications_outlined, color: brandBlue),
                  title: const Text('알림', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('브리핑 · 체결 · 폰에서 실행할 주문'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(pageRoute(const NotificationsPage())),
                ),
              ),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.insights_outlined, color: coachOrange),
                  title: const Text('내 투자 습관', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('최근 30일 매매 기록으로 본 습관'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(pageRoute(const BehaviorPage())),
                ),
              ),
              const SizedBox(height: 16),
              _profileSection(profile),
              const Divider(height: 32),
              _policySection(policy),
              const Divider(height: 32),
              if (!kIsWeb)
                ValueListenableBuilder(
                  valueListenable: currentBroker,
                  builder: (context, broker, _) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('증권사 연결', style: TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text(broker == null ? '연결 안 됨' : '${broker.name}${broker.isFake ? ' (가짜 데이터)' : ''}'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(pageRoute(const BrokerPage())),
                  ),
                ),
              const Text('투자 모드는 위의 "실전 모드"에서 바꿔요 (기본은 모의투자)'),
              const Divider(height: 32),
              OutlinedButton(onPressed: _logout, child: const Text('로그아웃')),
              TextButton(onPressed: _deleteAccount, child: const Text('탈퇴', style: TextStyle(color: Colors.red))),
            ]);
          },
        ),
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
            _reload();
          },
          child: Text(custom ? '퀴즈 다시 하기' : '퀴즈 하기'),
        ),
        if (custom) OutlinedButton(onPressed: _toGeneral, child: const Text('일반 모드로 돌아가기')),
      ]),
      const SourceText('퀴즈는 하루 3번까지 할 수 있어요.'),
    ]);
  }

  Widget _policySection(Map<String, dynamic> policy) {
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
      FilledButton(onPressed: _savePolicy, child: const Text('한도 저장')),
    ]);
  }

  Widget _field(TextEditingController controller, String label, String helper) => TextField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: label, helperText: helper),
      );
}
