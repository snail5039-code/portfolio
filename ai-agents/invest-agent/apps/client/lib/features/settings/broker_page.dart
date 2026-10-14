// S-04 증권사 연결 (앱만, FR-05 ~ FR-06a). 키·계좌번호는 이 폰의 보안 저장소에만 저장한다.

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../broker/broker.dart';
import '../../broker/fake_broker.dart';
import '../../broker/kb_broker.dart';
import '../../broker/kis_mock_broker.dart';
import '../../common/common.dart';
import '../../secure/key_store.dart';
import 'safety_page.dart';

/// 저장된 선택으로 증권사를 정한다 (앱을 켤 때). 디버그 빌드는 아무것도 연결 안 했으면 가짜 증권사를 쓴다
Future<void> loadBroker() async {
  if (kIsWeb) return;
  await _saveDevKeys();
  final choice = await secureBox.read('broker_choice') ?? (kDebugMode ? 'fake' : null);
  final keys = await BrokerKeys.load(secureBox);
  final kbKeys = await BrokerKeys.load(secureBox, prefix: 'kb');
  currentBroker.value = switch (choice) {
    'kis_mock' when keys != null => KisMockBroker(keys),
    'kb' when kbKeys != null => KbBroker(kbKeys), // 실전 계좌. 주문은 실전 모드를 직접 켰을 때만 나간다
    'fake' when kDebugMode => FakeBroker(),
    _ => null,
  };
  await loadRealMode(); // 실전 주문 준비가 안 된 증권사면 실전 모드를 끈다
}

// 개발용 모의 키: apps/client/dev_keys.env (git 제외, 예시는 dev_keys.example.env)을 --dart-define-from-file로 넘기면 디버그 빌드에서만 쓴다.
// 저장된 키가 없을 때 한 번 폰 보안 저장소에 넣고 KIS 모의투자로 연결한다. 서버로는 보내지 않는다
const _devAppKey = String.fromEnvironment('KIS_APP_KEY');
const _devAppSecret = String.fromEnvironment('KIS_APP_SECRET');
const _devAccount = String.fromEnvironment('KIS_ACCOUNT');
// KB 키(실전 계좌)도 같은 파일에 넣을 수 있다. 저장만 하고 연결은 사용자가 증권사 연결 화면에서 KB를 골라야 바뀐다
const _devKbKey = String.fromEnvironment('KB_APP_KEY');
const _devKbSecret = String.fromEnvironment('KB_APP_SECRET');

Future<void> _saveDevKeys() async {
  if (kDebugMode && _devKbKey.isNotEmpty && _devKbSecret.isNotEmpty) {
    final kb = await BrokerKeys.load(secureBox, prefix: 'kb');
    if (kb?.appKey != _devKbKey || kb?.appSecret != _devKbSecret) {
      await BrokerKeys.delete(secureBox, prefix: 'kb');
      await BrokerKeys(appKey: _devKbKey, appSecret: _devKbSecret, needsAccount: false).save(secureBox, prefix: 'kb');
    }
  }
  if (!kDebugMode || _devAppKey.isEmpty || _devAppSecret.isEmpty) return;
  final saved = await BrokerKeys.load(secureBox);
  if (saved != null && saved.appKey == _devAppKey && saved.appSecret == _devAppSecret && saved.account == _devAccount) return;
  // 파일 값을 고쳤으면 새 값으로 바꾼다. 다른 키의 접속 토큰도 버린다
  await BrokerKeys.delete(secureBox);
  await BrokerKeys(appKey: _devAppKey, appSecret: _devAppSecret, account: _devAccount).save(secureBox);
  await secureBox.write('broker_choice', 'kis_mock');
}

class BrokerPage extends StatefulWidget {
  const BrokerPage({super.key});

  @override
  State<BrokerPage> createState() => _BrokerPageState();
}

class _BrokerPageState extends State<BrokerPage> {
  final _appKey = TextEditingController();
  final _appSecret = TextEditingController();
  final _account = TextEditingController();
  String _choice = 'kis_mock';
  bool _hasSavedKeys = false;
  bool _busy = false;
  String? _status; // 연결 테스트 결과
  bool _testOk = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String get _prefix => _choice == 'kb' ? 'kb' : 'kis';

  Future<void> _load() async {
    final choice = await secureBox.read('broker_choice');
    _choice = choice ?? (currentBroker.value is FakeBroker ? 'fake' : 'kis_mock');
    await _loadKeys();
  }

  /// 고른 증권사의 저장된 키를 입력칸에 채운다 (시크리트는 보여주지 않는다)
  Future<void> _loadKeys() async {
    final keys = await BrokerKeys.load(secureBox, prefix: _prefix);
    setState(() {
      _hasSavedKeys = keys != null;
      _appKey.text = keys?.appKey ?? '';
      _appSecret.clear();
      _account.text = keys?.account ?? '';
    });
  }

  /// 입력한 값으로 만든 키. 시크리트를 비워 두면 저장된 값을 그대로 쓴다
  Future<BrokerKeys> _keys() async {
    final saved = await BrokerKeys.load(secureBox, prefix: _prefix);
    final secret = _appSecret.text.trim().isEmpty ? saved?.appSecret ?? '' : _appSecret.text.trim();
    if (_appKey.text.trim().isEmpty || secret.isEmpty) throw const FormatException('앱키와 시크리트를 입력해 주세요');
    return BrokerKeys(appKey: _appKey.text.trim(), appSecret: secret, account: _account.text.trim(), needsAccount: _choice == 'kis_mock');
  }

  /// 연결 테스트: 잔고와 주문 가능 금액을 조회한다 (FR-06). 주문은 내지 않는다
  Future<void> _test() async {
    setState(() => _busy = true);
    try {
      final Broker broker = switch (_choice) {
        'fake' => FakeBroker(),
        'kb' => KbBroker(await _keys()),
        _ => KisMockBroker(await _keys()),
      };
      final balance = await broker.balance();
      final power = await broker.buyingPower();
      setState(() {
        _testOk = true;
        _status = '연결됨 · 예수금 ${won(balance['cash_krw'] as int)} · 주문 가능 ${won(power)} · 보유 ${(balance['holdings'] as List).length}종목';
      });
    } catch (error) {
      setState(() {
        _testOk = false;
        _status = '연결 실패: ${error is FormatException ? error.message : error}';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    try {
      if (_choice != 'fake') {
        final keys = await _keys();
        final saved = await BrokerKeys.load(secureBox, prefix: _prefix);
        if (saved?.appKey != keys.appKey) await BrokerKeys.delete(secureBox, prefix: _prefix); // 다른 키면 예전 토큰도 버린다
        await keys.save(secureBox, prefix: _prefix);
      }
      await secureBox.write('broker_choice', _choice);
      await loadBroker();
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) showError(context, error is FormatException ? error.message : error);
    }
  }

  Future<void> _delete() async {
    await BrokerKeys.delete(secureBox, prefix: _prefix);
    await secureBox.delete('broker_choice');
    await loadBroker();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: topBar('증권사 연결'),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          const Card(
            child: ListTile(
              leading: Icon(Icons.lock_outline),
              title: Text('키와 계좌번호는 이 폰에만 저장되고 서버로 보내지 않아요'),
              subtitle: Text('주문도 이 폰에서 증권사로 직접 나가요. KB증권은 실전 계좌라 실전 모드를 직접 켜야만 주문해요.'),
            ),
          ),
          RadioGroup<String>(
            groupValue: _choice,
            onChanged: (value) {
              setState(() {
                _choice = value!;
                _status = null;
              });
              _loadKeys();
            },
            child: Column(children: [
              const RadioListTile(value: 'kis_mock', title: Text('KIS 모의투자'), subtitle: Text('한국투자증권 모의계좌 (주문 개발·검증용)')),
              const RadioListTile(value: 'kb', title: Text('KB증권 (실전 계좌)'),
                  subtitle: Text('연결 테스트는 조회만 해요. 주문은 설정 > 실전 모드를 켰을 때만 나가요')),
              if (kDebugMode)
                const RadioListTile(value: 'fake', title: Text('가짜 증권사 (개발용)'), subtitle: Text('키 없이 화면 흐름만 확인')),
            ]),
          ),
          if (_choice != 'fake') ...[
            TextField(controller: _appKey, decoration: InputDecoration(labelText: _choice == 'kb' ? 'appKey (KB증권)' : '앱키 (모의투자용)')),
            TextField(
              controller: _appSecret,
              obscureText: true,
              decoration: InputDecoration(
                labelText: '앱 시크리트',
                helperText: _hasSavedKeys ? '저장돼 있어요. 바꿀 때만 입력하세요' : null,
              ),
            ),
            if (_choice == 'kis_mock')
              TextField(
                controller: _account,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: '모의계좌번호', hintText: '12345678-01'),
              ),
          ],
          const SizedBox(height: 16),
          if (_status != null)
            Text(_status!, style: TextStyle(color: _testOk ? Colors.green : Colors.red)),
          const SizedBox(height: 8),
          Row(children: [
            OutlinedButton(onPressed: _busy ? null : _test, child: const Text('연결 테스트')),
            const Spacer(),
            FilledButton(onPressed: _busy ? null : _save, child: const Text('저장')),
          ]),
          if (_hasSavedKeys)
            TextButton(onPressed: _delete, child: const Text('저장된 키 삭제', style: TextStyle(color: Colors.red))),
        ]),
      );
}
