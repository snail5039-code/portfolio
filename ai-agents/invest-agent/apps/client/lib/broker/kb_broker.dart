// KB증권 Open API 어댑터 (docs/plan/12-todo-by-stage.md 1-7). 실전 계좌다: 주문은 실전 모드를 직접 켰을 때만 나간다 (AGENTS.md 1·4장)
// 명세: KB Open API 포털 https://openapi.kbsec.com/apidoc_b2c (공개, 2026-10-10 확인), 공식 예제 https://github.com/kbsecurities/kb-openapi
//   토큰   POST /oauth2/token  {dataHeader, dataBody: {appKey, appSecret, grantType}} → access_token, expires_in(초)
//   호출   POST /api/v1/{tr}   헤더 appKey, Authorization: bearer <토큰>, 본문 {dataHeader: {ipAddr, macAddr}, dataBody}
//          응답 dataHeader.resultCode 200·processFlag A면 성공, 아니면 processMessage가 실패 이유 (주문은 들어가지 않음)
//   현재가 IVU10140 {excg_clsf: 1(KRX), shrt_cd} → now_prc
//   잔고   SSQM2952 체결기준 잔고현황 {excg_mktpr_ccd: K} → nxt2_dy_tfnd(D+2 예수금), Record1[{is_cd, is_nm, hld_q, byng_avr_prc, now_prc}]
//   주문가능 SSQM1802 {is_no: ""} → ordr_psbl_csh
//   주문내역 SSQM2341 체결미체결 {ccls_clsf: 0, ordr_dt: yyyyMMdd} → Record1[{ordr_no, stnd_is_no, hngl_shrt_nm, ordr_q, tl_ccls_q, ordr_uprc, ccls_uprc, ordr_tm, trd_dl_ccd_nm}]
//   주문   SSAM1802 매수 / SSAM1801 매도 {mkt_tm_clsf: 1(정규장), is_cd, ordr_q, ordr_uprc, ordr_ccd: 00(지정가), sor_ordr_ccd: K(KRX)} → ordr_no
//   정정   SSAM1805 {…, crct_clsf: 1 일부 / 2 전부, orgn_ordr_no}   취소 SSAM1806 {is_cd, ordr_q, crct_clsf, orgn_ordr_no}
// 미확인 (실제 키로 아직 불러 보지 않음): Record1이 목록인지, 종목코드에 'A'가 붙는지, 전부 정정 때 ordr_q를 비워도 되는지,
//   호출 한도. 계좌는 요청에 넣지 않는다 (API 사용 신청 때 연결한 계좌로 간다). 모의투자 서버는 없다

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../secure/key_store.dart';
import 'broker.dart';

const kbBaseUrl = 'https://developer.kbsec.com:32484';
const _timeout = Duration(seconds: 10);
const _dataHeader = {'ipAddr': '', 'macAddr': ''}; // 폰에서 부를 때는 비워 보내도 된다 (예제 설명)

class KbBroker implements Broker {
  KbBroker(this.keys, {http.Client? client, SecureBox? box})
      : _http = client ?? http.Client(),
        _box = box ?? secureBox;

  final BrokerKeys keys;
  final http.Client _http;
  final SecureBox _box;
  String? _token;
  DateTime? _tokenExpires;

  @override
  final lastPrices = <String, int>{};

  @override
  String get name => 'KB증권';
  @override
  bool get isFake => false;
  @override
  bool get isReal => true;
  /// 주문 명세를 포털에서 확인해 order·revise를 만들었다 (2026-10-10). 그래도 실전 모드는 사용자가 조건을 확인하고 직접 켜야 한다
  @override
  bool get realOrdersReady => true;

  Future<String> _accessToken() async {
    final now = DateTime.now();
    if (_token == null) {
      _token = await _box.read('kb_token');
      final expires = await _box.read('kb_token_expires');
      _tokenExpires = expires == null ? null : DateTime.parse(expires);
    }
    if (_token != null && _tokenExpires != null && now.isBefore(_tokenExpires!)) return _token!;

    final body = await _post('/oauth2/token', {'Content-Type': 'application/json'},
        {'appKey': keys.appKey, 'appSecret': keys.appSecret, 'grantType': 'client_credentials'});
    final token = body['access_token'] ?? body['accessToken'];
    if (token is! String || token.isEmpty) throw BrokerError('KB 접속 토큰을 받지 못했어요. 앱키·시크리트를 확인해 주세요');
    final seconds = int.tryParse('${body['expires_in'] ?? ''}') ?? 12 * 3600;
    _token = token;
    _tokenExpires = now.add(Duration(seconds: seconds)).subtract(const Duration(minutes: 5));
    await _box.write('kb_token', token);
    await _box.write('kb_token_expires', _tokenExpires!.toIso8601String());
    return token;
  }

  /// 요청을 보내고 dataBody를 돌려준다. KB는 업무 실패도 HTTP 200으로 줄 수 있어 부르는 쪽이 값이 있는지 본다
  Future<Map<String, dynamic>> _post(String path, Map<String, String> headers, Map<String, String> dataBody) async {
    final request = http.Request('POST', Uri.parse('$kbBaseUrl$path'))
      ..headers.addAll(headers)
      ..body = jsonEncode({'dataHeader': _dataHeader, 'dataBody': dataBody});
    final response = await http.Response.fromStream(await _http.send(request).timeout(_timeout)).timeout(_timeout);
    final Object? data;
    try {
      data = jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      throw BrokerError('KB 응답을 읽지 못했어요 (${response.statusCode})');
    }
    if (data is! Map<String, dynamic>) throw BrokerError('KB 응답 형식이 달라요');
    final body = data['dataBody'] is Map<String, dynamic> ? data['dataBody'] as Map<String, dynamic> : data;
    if (response.statusCode != 200) throw BrokerError('KB 오류: ${_message(data, body) ?? response.statusCode}');
    // 업무 실패(잔액 부족, 장 종료 등)도 HTTP 200으로 온다. 헤더의 결과 코드로 거절을 알아본다
    final header = data['dataHeader'];
    if (header is Map && ('${header['resultCode'] ?? '200'}' != '200' || header['processFlag'] == 'B')) {
      throw BrokerError('KB 거절: ${_message(data, body) ?? header['processCode'] ?? header['resultCode']}');
    }
    return body;
  }

  static String? _message(Map<String, dynamic> data, Map<String, dynamic> body) {
    final header = data['dataHeader'];
    final text = (header is Map ? header['processMessage'] : null) ?? body['msg'] ?? body['o_msg'] ??
        (header is Map ? header['resultMessage'] ?? header['msg'] : null) ?? data['message'];
    return text is String && text.trim().isNotEmpty ? text.trim() : null;
  }

  Future<Map<String, dynamic>> _tr(String tr, Map<String, String> dataBody) async {
    final token = await _accessToken();
    return _post('/api/v1/$tr',
        {'Content-Type': 'application/json', 'appKey': keys.appKey, 'Authorization': 'bearer $token'}, dataBody);
  }

  @override
  Future<int> price(String stockCode) async {
    final body = await _tr('ivu10140', {'excg_clsf': '1', 'shrt_cd': stockCode});
    final price = int.tryParse('${body['now_prc'] ?? ''}'.trim());
    if (price == null || price <= 0) {
      throw BrokerError('KB 현재가를 받지 못했어요${body['msg'] is String ? ' (${(body['msg'] as String).trim()})' : ''}');
    }
    return price;
  }

  @override
  Future<Map<String, dynamic>?> intraday(String stockCode) async => null; // KB 분봉 TR(IVU10080 등)은 키를 붙일 때 확인

  @override
  Future<List<Map<String, dynamic>>?> market() async => null; // KB 지수 TR은 키를 붙일 때 확인

  @override
  Future<List<String>> movers() async => []; // KB 순위 TR은 키를 붙일 때 확인

  @override
  Future<Map<String, dynamic>> balance() async {
    // ponytail: 첫 페이지만 읽는다 (다음키 없음). 보유 종목이 많아지면 이어 읽기를 붙인다
    final body = await _tr('ssqm2952', {'excg_mktpr_ccd': 'K'});
    final rows = _records(body).where((r) => brokerInt(r['hld_q']) > 0).toList();
    for (final r in rows) {
      lastPrices[_code(r['is_cd'])] = brokerInt(r['now_prc']);
    }
    return {
      // KIS와 같이 결제가 끝난 뒤(D+2) 예수금을 쓴다. 결제 전 금액과 주식 평가액을 더하면 산 금액을 두 번 센다
      'cash_krw': brokerInt(body['nxt2_dy_tfnd']),
      'holdings': [
        for (final r in rows)
          {'stock_code': _code(r['is_cd']), 'stock_name': '${r['is_nm'] ?? ''}'.trim(), 'qty': brokerInt(r['hld_q']),
           'avg_price': brokerInt(r['byng_avr_prc'])},
      ],
      'fetched_at': nowIso(),
    };
  }

  @override
  Future<int> buyingPower() async => brokerInt((await _tr('ssqm1802', {'is_no': ''}))['ordr_psbl_csh']);

  @override
  Future<List<BrokerOrder>> todayOrders(String stockCode) async {
    final day = kstYmd(DateTime.now());
    final body = await _tr('ssqm2341', {'ccls_clsf': '0', 'ordr_dt': day, 'nxt_key': ''});
    return [
      for (final r in _records(body))
        if (stockCode.isEmpty || _code(r['stnd_is_no']) == stockCode)
          (
            orderNo: '${r['ordr_no'] ?? ''}'.trim(),
            stockCode: _code(r['stnd_is_no']),
            stockName: '${r['hngl_shrt_nm'] ?? ''}'.trim(),
            side: '${r['trd_dl_ccd_nm'] ?? ''}'.contains('매도') ? 'sell' : 'buy',
            qty: brokerInt(r['ordr_q']),
            price: brokerInt(r['ordr_uprc']),
            filledQty: brokerInt(r['tl_ccls_q']),
            filledPrice: brokerInt(r['ccls_uprc']) > 0 ? brokerInt(r['ccls_uprc']) : null,
            time: '${r['ordr_tm'] ?? ''}'.trim().padRight(6, '0').substring(0, 6),
          ),
    ];
  }

  @override
  Future<({String orderNo, int filledQty, int? filledPrice})> order(String side, String stockCode, int qty, int price) async {
    final body = await _tr(side == 'buy' ? 'ssam1802' : 'ssam1801', {
      'mkt_tm_clsf': '1', 'is_cd': stockCode, 'ordr_q': '$qty', 'ordr_uprc': '$price',
      'ordr_ccd': '00', // 지정가
      'sor_ordr_ccd': 'K', // KRX
    });
    final orderNo = '${body['ordr_no'] ?? ''}'.trim();
    if (orderNo.isEmpty) throw BrokerError('KB가 주문번호를 주지 않았어요');
    return (orderNo: orderNo, filledQty: 0, filledPrice: null); // 체결 여부는 주문 내역에서 본다
  }

  @override
  Future<String> revise(String orderNo, String stockCode, int? price, {int? qty}) async {
    final common = {'is_cd': stockCode, 'ordr_q': qty?.toString() ?? '', 'crct_clsf': qty == null ? '2' : '1', 'orgn_ordr_no': orderNo};
    final body = price == null
        ? await _tr('ssam1806', common)
        : await _tr('ssam1805', {...common, 'mkt_tm_clsf': '1', 'ordr_uprc': '$price', 'ordr_ccd': '00', 'sor_ordr_ccd': 'K'});
    final newNo = '${body['ordr_no'] ?? ''}'.trim();
    if (newNo.isEmpty) throw BrokerError('KB가 ${price == null ? '취소' : '정정'} 주문번호를 주지 않았어요');
    return newNo;
  }

  /// 목록 칸(Record1). 하나뿐이면 객체로 올 수도 있어 둘 다 받는다
  static List<Map<String, dynamic>> _records(Map<String, dynamic> body) {
    final rows = body['Record1'] ?? body['record1'];
    if (rows is List) return rows.whereType<Map<String, dynamic>>().toList();
    if (rows is Map<String, dynamic>) return [rows];
    return [];
  }

  /// 'A005930', 표준코드 'KR7005930003' → '005930'
  static String _code(Object? raw) {
    final s = '${raw ?? ''}'.trim();
    if (s.length == 12 && s.startsWith('KR')) return s.substring(3, 9);
    if (s.length == 7 && s.startsWith('A')) return s.substring(1);
    return s;
  }

}
