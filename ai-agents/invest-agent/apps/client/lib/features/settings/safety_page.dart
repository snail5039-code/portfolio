// 4단계 실전 전환 (docs/plan/12-todo-by-stage.md 4-1, 4-2, docs/plan/13-legal-check.md)
// - 실전 모드: 조건(성향 퀴즈, 모의투자 기록, 실전 주문 준비된 증권사)을 모두 채우고, 경고를 읽고 "실전 시작"을 직접 입력해야 켜진다.
//   켜져 있는 동안 모든 화면에 빨간 "실전투자"가 보인다. 언제든 바로 끌 수 있다. AI는 실계좌 주문을 테스트하지 않는다 (AGENTS.md 4장)
// - 긴급 중단: 자동매매를 끄고, 기다리는 예약을 취소하고, 승인 대기 처리안을 거절한다. 이미 낸 미체결 주문은 채팅에서 취소한다

import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../broker/broker.dart';
import '../../common/common.dart';
import '../../secure/key_store.dart';
import '../auto/auto_trader.dart';

const realConfirmWord = '실전 시작';

/// 앱을 켤 때: 저장된 실전 모드를 불러오되, 지금 증권사가 실전 주문 준비가 안 됐으면 끈다
Future<void> loadRealMode() async {
  final broker = currentBroker.value;
  realMode.value = await secureBox.read('real_mode') == 'true' && broker != null && broker.isReal && broker.realOrdersReady;
}

Future<void> setRealMode(bool on) async {
  realMode.value = on;
  await secureBox.write('real_mode', '$on');
  if (on && autoTrader.on) await autoTrader.stopAll(); // 실전으로 바꾸면 모의 기준 자동매매 계획은 거두고 다시 정한다
}

/// 긴급 중단 (4-2). 결과 문장을 돌려준다
Future<String> emergencyStop() async {
  await autoTrader.stopAll();
  final result = await api.post('/api/emergency-stop', {}) as Map<String, dynamic>;
  return '자동매매를 껐고, 예약 ${result['cancelled_reservations']}건을 취소하고, 승인 대기 처리안 ${result['rejected_approvals']}건을 거절했어요. '
      '이미 증권사에 들어간 미체결 주문은 채팅에서 "○○ 주문 취소해줘"로 취소해 주세요.';
}

class EmergencyStopButton extends StatelessWidget {
  const EmergencyStopButton({super.key});

  Future<void> _press(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('긴급 중단할까요?'),
        content: const Text('자동매매를 끄고, 기다리는 예약을 모두 취소하고, 승인 대기 처리안을 모두 거절해요.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('아니요')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFC62828)),
            onPressed: () => Navigator.of(c).pop(true),
            child: const Text('긴급 중단'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      final message = await emergencyStop();
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), duration: const Duration(seconds: 8)));
    } on ApiError catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) => FilledButton.icon(
        style: FilledButton.styleFrom(backgroundColor: const Color(0xFFC62828), minimumSize: const Size.fromHeight(48)),
        icon: const Icon(Icons.pan_tool_outlined),
        label: const Text('긴급 중단 (자동매매·예약·승인 대기 모두 멈춤)'),
        onPressed: () => _press(context),
      );
}

class RealModePage extends StatefulWidget {
  const RealModePage({super.key});

  @override
  State<RealModePage> createState() => _RealModePageState();
}

class _RealModePageState extends State<RealModePage> {
  Map<String, dynamic>? _ready;
  Object? _error;
  final _word = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final ready = await api.get('/api/real-readiness') as Map<String, dynamic>;
      setState(() { _ready = ready; _error = null; });
    } on ApiError catch (error) {
      setState(() { _error = error; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ready = _ready;
    final broker = currentBroker.value;
    final brokerOk = broker != null && broker.isReal && broker.realOrdersReady;
    return Scaffold(
      appBar: topBar('실전 모드'),
      body: _error != null
          ? ErrorRetry(_error!, _load)
          : ready == null
              ? const Center(child: CircularProgressIndicator())
              : ValueListenableBuilder(
                  valueListenable: realMode,
                  builder: (context, real, _) {
                    final checks = [
                      ...(ready['checks'] as List).cast<Map<String, dynamic>>(),
                      {'label': '실전 주문이 준비된 증권사(KB증권) 연결', 'ok': brokerOk},
                    ];
                    final canTurnOn = checks.every((c) => c['ok'] == true);
                    return ListView(padding: const EdgeInsets.all(16), children: [
                      Card(
                        color: real ? const Color(0xFFFFEBEE) : Colors.white,
                        child: SwitchListTile(
                          title: Text(real ? '실전 모드 켜짐 (실제 돈)' : '실전 모드 꺼짐 (모의투자)',
                              style: const TextStyle(fontWeight: FontWeight.w900)),
                          subtitle: const Text('끄면 바로 모의투자로 돌아가요'),
                          value: real,
                          // 켜기는 아래 확인을 거쳐야 하고, 끄기는 언제든 된다
                          onChanged: real ? (_) => setRealMode(false) : null,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text('켜기 전 조건', style: TextStyle(fontFamily: displayFont, fontSize: 18)),
                      for (final c in checks)
                        ListTile(
                          dense: true,
                          leading: Icon(c['ok'] == true ? Icons.check_circle : Icons.radio_button_unchecked,
                              color: c['ok'] == true ? const Color(0xFF2E7D32) : mutedText),
                          title: Text(c['label'] as String),
                        ),
                      if (!brokerOk)
                        const SourceText('KB증권 실전 주문은 공개된 주문 명세를 확인한 뒤 만들어요 (2026-10-09 미확인). 그 전에는 실전 모드를 켤 수 없어요.'),
                      const SizedBox(height: 12),
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Text(
                            '실전 모드에서는 실제 돈으로 주문해요.\n'
                            '· 원금 손실이 날 수 있고, 손실은 본인이 부담해요. 이 앱은 정식 금융투자업자가 아니에요.\n'
                            '· 투자 AI·검증 AI의 제안은 AI가 생성한 참고 정보예요. 수익을 보장하지 않아요.\n'
                            '· 모든 실전 주문은 처리안에서 "실전 주문" 확인을 받아요. 100만 원 이상은 고액 확인을 한 번 더 받아요.\n'
                            '· 실전 자동매매는 앱이 켜져 있을 때만, 하루 50만 원·1건 30만 원까지예요.\n'
                            '· 언제든 긴급 중단 버튼으로 자동매매·예약·승인 대기를 멈출 수 있어요.',
                          ),
                        ),
                      ),
                      if (!real) ...[
                        TextField(
                          controller: _word,
                          enabled: canTurnOn,
                          decoration: const InputDecoration(labelText: '켜려면 "$realConfirmWord"를 입력하세요'),
                          onChanged: (_) => setState(() {}),
                        ),
                        const SizedBox(height: 8),
                        FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFC62828)),
                          onPressed: canTurnOn && _word.text.trim() == realConfirmWord ? () => setRealMode(true) : null,
                          child: const Text('실전 모드 켜기'),
                        ),
                      ],
                      const SizedBox(height: 24),
                      const EmergencyStopButton(),
                    ]);
                  },
                ),
    );
  }
}
