// 증권사 키·계좌번호 저장 (FR-05, NFR-02). 폰 보안 저장소(Android Keystore)에만 두고 서버로 보내지 않는다.
// 웹 빌드에는 키 입력 화면이 없으므로 여기 값도 쓰지 않는다.

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// 보안 저장소. 테스트에서는 memory()로 기기 없이 쓴다
class SecureBox {
  SecureBox() : _memory = null;
  SecureBox.memory() : _memory = {};

  static const _storage = FlutterSecureStorage();
  final Map<String, String>? _memory;

  Future<String?> read(String key) async => _memory != null ? _memory[key] : await _storage.read(key: key);

  Future<void> write(String key, String value) async {
    if (_memory != null) {
      _memory[key] = value;
    } else {
      await _storage.write(key: key, value: value);
    }
  }

  Future<void> delete(String key) async {
    if (_memory != null) {
      _memory.remove(key);
    } else {
      await _storage.delete(key: key);
    }
  }
}

final secureBox = SecureBox();

/// KIS 계좌번호는 "앞 8자리-뒤 2자리"(종합계좌번호-상품코드). 8자리만 넣으면 주식 계좌 상품코드 01로 본다
final accountPattern = RegExp(r'^(\d{8})(?:-?(\d{2}))?$');

/// 증권사 키. KIS 모의(prefix kis)와 KB(prefix kb)는 따로 저장해서, 하나를 바꿔도 다른 쪽 키가 지워지지 않는다.
/// KB는 요청에 계좌번호를 넣지 않아(API 사용 신청 때 연결한 계좌로 간다) 계좌번호 없이 저장한다
class BrokerKeys {
  BrokerKeys({required this.appKey, required this.appSecret, this.account = '', bool needsAccount = true}) {
    if (needsAccount && !accountPattern.hasMatch(account)) throw const FormatException('계좌번호는 12345678-01 (또는 앞 8자리) 형식이에요');
  }

  final String appKey;
  final String appSecret;
  final String account;

  String get cano => accountPattern.firstMatch(account)!.group(1)!;
  String get productCode => accountPattern.firstMatch(account)!.group(2) ?? '01';

  static Future<BrokerKeys?> load(SecureBox box, {String prefix = 'kis'}) async {
    final appKey = await box.read('${prefix}_app_key');
    final appSecret = await box.read('${prefix}_app_secret');
    final account = await box.read('${prefix}_account');
    if (appKey == null || appSecret == null || (prefix == 'kis' && account == null)) return null;
    return BrokerKeys(appKey: appKey, appSecret: appSecret, account: account ?? '', needsAccount: prefix == 'kis');
  }

  Future<void> save(SecureBox box, {String prefix = 'kis'}) async {
    await box.write('${prefix}_app_key', appKey);
    await box.write('${prefix}_app_secret', appSecret);
    await box.write('${prefix}_account', account);
  }

  static Future<void> delete(SecureBox box, {String prefix = 'kis'}) async {
    for (final key in ['app_key', 'app_secret', 'account', 'token', 'token_expires']) {
      await box.delete('${prefix}_$key');
    }
  }
}
