// 증권사 공통 틀과 폰의 주문 실행 과정 (docs/plan/06-api-spec.md 4장, FR-26 ~ FR-29, NFR-04).
// 서버의 fetch·execute 멈춤에 답하는 일은 모두 여기를 거친다. 서버에는 키·계좌번호를 보내지 않는다.

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:local_auth/local_auth.dart';

import '../secure/key_store.dart';

/// 증권사가 분명하게 거절한 경우 (잘못된 키, 잔고 부족, 장 종료 등). 주문이 들어가지 않은 것이 확실하다
class BrokerError implements Exception {
  BrokerError(this.message);
  final String message;

  @override
  String toString() => message;
}

/// 증권사 주문 내역 한 줄 (time은 한국 시각 "HHmmss")
typedef BrokerOrder = ({
  String orderNo, String stockCode, String stockName, String side, int qty, int price, int filledQty, int? filledPrice,
  String time,
});

abstract class Broker {
  String get name;
  bool get isFake; // 가짜 증권사는 폰 잠금 확인을 하지 않는다 (개발용)

  /// 실제 돈 계좌에 연결된 증권사 (KB증권). 실전 모드에서만 주문하고, 모의 모드에서는 주문하지 않는다 (4-1)
  bool get isReal;

  /// 이 증권사로 실전 주문을 낼 준비가 됐는지 (주문 명세 확인·구현). 아니면 실전 모드를 켤 수 없다
  bool get realOrdersReady;

  /// 서버로 보내는 잔고 형식 (계좌번호 없음)
  Future<Map<String, dynamic>> balance();
  Future<int> price(String stockCode);

  /// 오늘 장중 흐름: {change_pct: 전일 대비 %, bars: [[체결시각 "HHmmss", 가격], ...] 오래된 것부터 최근 30분}.
  /// 분석 근거로 서버에 보낸다 (출처 intraday:{종목}). 못 받으면 null (현재가만으로 분석한다)
  Future<Map<String, dynamic>?> intraday(String stockCode);

  /// 시장 지수 (코스피·코스닥): [{index: KOSPI|KOSDAQ, value, change_pct, open, high, low, up, down, flat,
  /// daily: [[날짜 "YYYYMMDD", 종가], ...] 최신부터, as_of}]. 분석 근거로 서버에 보낸다 (출처 market:{index}).
  /// 자동매매가 시장 급락을 볼 때도 쓴다. 못 받으면 null
  Future<List<Map<String, dynamic>>?> market();

  /// 장중 많이 움직이는 종목 코드: 거래대금 상위와 상승률 상위 (매수 후보 다시 찾기에 쓴다). 못 받으면 빈 목록
  Future<List<String>> movers();

  /// 마지막 잔고 조회 때 알게 된 현재가 (홈 평가금액용, 없으면 평균 매입가로 본다)
  Map<String, int> get lastPrices;

  /// 지정가 주문. 접수되면 주문번호. 거절이면 BrokerError, 그 밖의 예외(시간 초과 등)는 "접수됐는지 모름"
  Future<({String orderNo, int filledQty, int? filledPrice})> order(String side, String stockCode, int qty, int price);

  /// 미체결 주문 정정·취소 (3-1). price가 null이면 취소, 있으면 그 지정가로 정정. qty가 null이면 남은 수량 전부, 있으면 그만큼만.
  /// 접수되면 증권사가 준 새 주문번호. 거절이면 BrokerError, 그 밖의 예외는 "접수됐는지 모름"
  Future<String> revise(String orderNo, String stockCode, int? price, {int? qty});

  /// 오늘 이 종목 주문 내역 (응답이 불확실할 때 다시 주문하지 않고 먼저 확인한다, FR-28). 빈 문자열이면 전체 종목
  Future<List<BrokerOrder>> todayOrders(String stockCode);

  /// 지금 주문에 쓸 수 있는 현금 (예수금은 결제 전 금액이라 다르다). 자산 화면용
  Future<int> buyingPower();
}

/// 지금 고른 증권사. 웹이나 연결 전이면 null
final currentBroker = ValueNotifier<Broker?>(null);

/// 4-1 실전 모드 (실제 돈). 사용자가 설정 > 실전 모드에서 조건을 확인하고 직접 켠다. 켜져 있는 동안 모든 화면에 빨간 "실전투자"
final realMode = ValueNotifier<bool>(false);

/// 주문 전 폰 잠금 확인 (생체인증 또는 PIN, NFR-04). 잠금이 설정되지 않은 폰이면 false
Future<bool> phoneUnlock() async {
  try {
    final auth = LocalAuthentication();
    if (!await auth.isDeviceSupported()) return false;
    return await auth.authenticate(localizedReason: '주문을 실행하려면 폰 잠금을 확인해 주세요', persistAcrossBackgrounding: true);
  } on Exception {
    return false;
  }
}

String nowIso() => DateTime.now().toUtc().toIso8601String();

/// 급등 후보에서 뺄 전일 대비 상승률 (%). 한국 개별 종목은 급등 뒤 되돌림이 우세하다는 연구가 많아
/// 이미 이만큼 오른 종목은 따라 사지 않는다 (2026-10-14 점검)
const moverMaxRisePct = 10.0;
bool chasing(Object? changePct) => (double.tryParse('$changePct') ?? 0) >= moverMaxRisePct;

/// 한국 시각 (기기 시간대와 상관없이 장 시간·날짜를 KST로 본다)
DateTime toKst(DateTime t) => t.toUtc().add(const Duration(hours: 9));

/// 한국 날짜 "YYYYMMDD" (증권사 조회 날짜)
/// 증권사 응답의 숫자 칸("1,234", "184100.5000", null)을 정수로. 못 읽으면 0. KIS·KB 모두 쓴다 (소수는 반올림)
int brokerInt(Object? raw) => num.tryParse('${raw ?? ''}'.trim().replaceAll(',', ''))?.round() ?? 0;

String kstYmd(DateTime t) {
  final k = toKst(t);
  return '${k.year}${k.month.toString().padLeft(2, '0')}${k.day.toString().padLeft(2, '0')}';
}

/// 한국 시각 "HHmmss" (증권사 주문 시각과 비교용)
String kstHhmmss(DateTime t) {
  final k = toKst(t);
  return [k.hour, k.minute, k.second].map((v) => v.toString().padLeft(2, '0')).join();
}

/// fetch 멈춤의 답. 실패하면 가짜 값 없이 실패 사유만 보낸다 (NFR-08)
Future<Map<String, dynamic>> answerFetch(Broker? broker, List<dynamic> needs) async {
  if (broker == null) return {'error': '증권사가 연결되지 않았어요. 설정에서 연결해 주세요'};
  final answer = <String, dynamic>{};
  try {
    for (final need in needs.cast<Map<String, dynamic>>()) {
      if (need['type'] == 'balance') answer['balance'] = await broker.balance();
      if (need['type'] == 'market') {
        try {
          final market = await broker.market();
          if (market != null && market.isNotEmpty) answer['market'] = market;
        } catch (_) {
          // 시장 지수도 덤이다. 못 받아도 분석한다
        }
      }
      if (need['type'] == 'price') {
        final code = need['stock_code'] as String;
        final price = await broker.price(code); // 먼저: KIS는 여기서 받은 오늘 고가를 장중 흐름에 붙인다
        Map<String, dynamic>? flow;
        try {
          flow = await broker.intraday(code);
        } catch (_) {
          flow = null; // 장중 흐름은 덤이다. 못 받아도 현재가로 분석한다
        }
        (answer['prices'] ??= <Map<String, dynamic>>[])
            .add({'stock_code': code, 'price': price, 'as_of': nowIso(), 'intraday': ?flow});
      }
    }
  } catch (error) {
    return {'error': '${broker.name} 조회 실패: ${error is BrokerError ? error.message : '연결할 수 없어요'}'};
  }
  return answer;
}

/// 실행한 주문 기록. 같은 주문(idempotency_key)을 두 번 내지 않게 한다.
/// 주문을 보내기 직전에 "보냄"을 적어 두므로, 앱이 그 사이에 꺼졌다 켜져도 다시 주문하지 않고 내역부터 확인한다.
class OrderJournal {
  OrderJournal(this._box);
  final SecureBox _box;

  Future<Map<String, dynamic>?> result(String key) async {
    final saved = await _box.read('order_result:$key');
    return saved == null ? null : jsonDecode(saved) as Map<String, dynamic>;
  }

  Future<String?> startedAt(String key) => _box.read('order_started:$key');
  Future<void> start(String key, String hhmmss) => _box.write('order_started:$key', hhmmss);
  Future<void> finish(String key, Map<String, dynamic> result) => _box.write('order_result:$key', jsonEncode(result));
}

final orderJournal = OrderJournal(secureBox);

/// 처리안 모드와 증권사·실전 모드가 맞지 않으면 이유, 맞으면 null
String? modeMismatch(Broker? broker, String mode, bool realOn) {
  if (broker == null) return null; // 아래에서 "증권사가 연결되지 않아"로 실패한다
  if (mode == 'real') {
    if (!realOn) return '실전 모드가 꺼져 있어 실전 처리안을 실행하지 않았어요';
    if (!broker.isReal || !broker.realOrdersReady) return '실전 주문을 낼 수 있는 증권사가 연결되지 않아 실행하지 않았어요';
  } else if (broker.isReal) {
    return '실전 계좌가 연결돼 있어 모의투자 처리안을 실행하지 않았어요';
  }
  return null;
}

/// execute 멈춤의 답: 가격 재확인 → 폰 잠금 확인 → 주문 → (불확실하면) 주문 내역 확인
Future<Map<String, dynamic>> executeOrder(
  Broker? broker,
  Map<String, dynamic> request, {
  required Future<bool> Function() unlock,
  required OrderJournal journal,
  DateTime Function() now = DateTime.now,
}) async {
  final key = request['idempotency_key'] as String;
  // 4-1: 처리안의 모드와 지금 증권사·실전 모드가 맞을 때만 주문한다 (실전 키로 모의 처리안을, 모의 키로 실전 처리안을 실행하지 않게)
  final mismatch = modeMismatch(broker, request['mode'] as String? ?? 'mock', realMode.value);
  if (mismatch != null) return {'idempotency_key': key, 'status': 'failed', 'message': mismatch};
  if (request['order_change'] != null) return _revise(broker, request, unlock: unlock, journal: journal);
  final code = request['stock_code'] as String;
  final side = request['side'] as String;
  final qty = request['qty'] as int;
  final limitPrice = request['limit_price'] as int;
  Map<String, dynamic> result(String status, [Map<String, dynamic> more = const {}]) =>
      {'idempotency_key': key, 'status': status, ...more};

  // 1. 이미 실행한 주문이면 그 결과를 그대로 (중복 주문 방지)
  final done = await journal.result(key);
  if (done != null) return done;
  if (broker == null) return result('failed', {'message': '증권사가 연결되지 않아 주문하지 않았어요'});
  final started = await journal.startedAt(key);
  if (started != null) return _finish(journal, key, await _checkUncertain(broker, request, started));

  // 2. 가격 재확인 (FR-26)
  final int current;
  try {
    current = await broker.price(code);
  } catch (error) {
    return result('failed', {'message': '현재가를 확인하지 못해 주문하지 않았어요 ($error)'});
  }
  final approved = request['approved_price'] as int;
  if ((current - approved).abs() * 100 / approved > (request['max_price_drift_pct'] as num)) {
    return result('price_changed', {'current_price': current});
  }

  // 3. 폰 잠금 확인 (NFR-04). 가짜 증권사는 개발용이라 건너뛴다
  if (!broker.isFake && !await unlock()) {
    return result('failed', {'message': '폰 잠금 확인을 하지 않아 주문하지 않았어요'});
  }

  // 4. 주문. 보내기 직전에 기록해 둔다
  final startedAt = kstHhmmss(now().subtract(const Duration(minutes: 1))); // 폰·증권사 시계 차이 여유
  await journal.start(key, startedAt);
  try {
    final ack = await broker.order(side, code, qty, limitPrice);
    final filled = ack.filledQty >= qty ? 'filled' : ack.filledQty > 0 ? 'partially_filled' : 'accepted';
    return await _finish(journal, key, result(filled, {
      'broker_order_no': ack.orderNo,
      'filled_qty': ack.filledQty,
      if (ack.filledPrice != null) 'filled_price': ack.filledPrice,
      'message': broker.isFake ? '가짜 체결 (테스트용, 실제 주문 아님)' : '${broker.name}에 접수됐어요',
    }));
  } on BrokerError catch (error) {
    return _finish(journal, key, result('failed', {'message': error.message}));
  } catch (_) {
    // 시간 초과·연결 끊김: 접수됐을 수도 있으니 다시 주문하지 않고 내역부터 확인한다 (FR-28)
    return _finish(journal, key, await _checkUncertain(broker, request, startedAt));
  }
}

/// 정정·취소 실행 (3-1): 폰 잠금 확인 → 증권사에 정정·취소. 가격 재확인은 하지 않는다 (취소는 가격과 상관없고, 정정 가격은 사용자가 정했다)
Future<Map<String, dynamic>> _revise(
  Broker? broker,
  Map<String, dynamic> request, {
  required Future<bool> Function() unlock,
  required OrderJournal journal,
}) async {
  final key = request['idempotency_key'] as String;
  final cancel = request['order_change'] == 'cancel';
  final label = cancel ? '취소' : '정정';
  Map<String, dynamic> result(String status, String message, [String? orderNo]) =>
      {'idempotency_key': key, 'status': status, 'message': message, 'broker_order_no': ?orderNo};

  final done = await journal.result(key);
  if (done != null) return done; // 이미 보낸 정정·취소면 그 결과 (두 번 보내지 않는다)
  if (broker == null) return result('failed', '증권사가 연결되지 않아 $label하지 않았어요');
  if (await journal.startedAt(key) != null) {
    // 보낸 뒤 앱이 꺼졌다. 다시 보내지 않고 사람에게 확인을 맡긴다
    return _finish(journal, key, result('unknown_checked', '$label 요청을 보냈는지 확인하지 못했어요. ${broker.name} 앱에서 주문 내역을 확인해 주세요'));
  }
  if (!broker.isFake && !await unlock()) return result('failed', '폰 잠금 확인을 하지 않아 $label하지 않았어요');
  await journal.start(key, kstHhmmss(DateTime.now()));
  try {
    final orderNo = await broker.revise(request['original_order_no'] as String, request['stock_code'] as String,
        cancel ? null : request['limit_price'] as int, qty: request['all_qty'] == false ? request['qty'] as int : null);
    return await _finish(journal, key, result('accepted', '${broker.name}에 $label 요청이 접수됐어요', orderNo));
  } on BrokerError catch (error) {
    return _finish(journal, key, result('failed', error.message));
  } catch (_) {
    return _finish(journal, key, result('unknown_checked', '응답이 없어 $label됐는지 모르겠어요. ${broker.name} 앱에서 주문 내역을 확인해 주세요'));
  }
}

Future<Map<String, dynamic>> _finish(OrderJournal journal, String key, Map<String, dynamic> result) async {
  await journal.finish(key, result);
  return result;
}

Future<Map<String, dynamic>> _checkUncertain(Broker broker, Map<String, dynamic> request, String startedAt) async {
  final key = request['idempotency_key'] as String;
  try {
    final orders = await broker.todayOrders(request['stock_code'] as String);
    final match = orders.where((o) => o.side == request['side'] && o.qty == request['qty'] &&
        o.price == request['limit_price'] && o.time.compareTo(startedAt) >= 0).firstOrNull;
    if (match == null) {
      return {'idempotency_key': key, 'status': 'failed', 'message': '응답이 없어 주문 내역을 확인했는데, 주문이 들어가지 않았어요'};
    }
    return {
      'idempotency_key': key, 'status': 'unknown_checked', 'broker_order_no': match.orderNo,
      'filled_qty': match.filledQty, if (match.filledPrice != null && match.filledQty > 0) 'filled_price': match.filledPrice,
      'message': '응답이 없어 주문 내역을 확인했어요. 주문이 접수돼 있어요',
    };
  } catch (_) {
    return {
      'idempotency_key': key, 'status': 'unknown_checked',
      'message': '주문이 들어갔는지 확인하지 못했어요. 다시 주문하기 전에 ${broker.name} 앱에서 주문 내역을 확인해 주세요',
    };
  }
}

/// 체결 갱신 (routers/orders.py). 서버에 "접수"로 남은 오늘 주문을 증권사 주문 내역에서 다시 보고 체결 수량·평균가를 올린다.
/// 폰이 열릴 때(홈)와 대화를 보낼 때 부른다. 보조 기능이라 실패해도 화면은 그대로 둔다
Future<void> syncFills(
  Broker? broker, {
  required Future<dynamic> Function(String path) get,
  required Future<dynamic> Function(String path, Object body) post,
}) async {
  if (broker == null || broker.isFake) return; // 가짜 증권사는 주문하자마자 체결이다
  try {
    final open = (await get('/api/orders/open') as List).cast<Map<String, dynamic>>();
    final byCode = <String, List<BrokerOrder>>{};
    final fills = <Map<String, dynamic>>[];
    for (final o in open) {
      final code = o['stock_code'] as String;
      final orders = byCode[code] ??= await broker.todayOrders(code);
      final match = orders.where((b) => b.orderNo == o['broker_order_no']).firstOrNull;
      if (match == null || match.filledQty <= (o['filled_qty'] as int) || match.filledPrice == null) continue;
      fills.add({'idempotency_key': o['idempotency_key'], 'filled_qty': match.filledQty, 'filled_price': match.filledPrice});
    }
    if (fills.isNotEmpty) await post('/api/orders/fills', {'fills': fills});
  } catch (error) {
    debugPrint('체결 갱신 실패: $error');
  }
}
