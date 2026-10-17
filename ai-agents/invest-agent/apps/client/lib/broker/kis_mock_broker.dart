// 한국투자증권(KIS) 모의투자 어댑터 (FR-06c). 주문 흐름 개발·검증용이다.
// 모의투자 서버 주소와 모의 거래 코드(V로 시작)만 쓴다. 실전 주소·실전 거래 코드는 이 파일에 넣지 않는다 (AGENTS.md 4장).
// API: https://apiportal.koreainvestment.com, 예시 코드 https://github.com/koreainvestment/open-trading-api

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../secure/key_store.dart';
import 'broker.dart';

const kisMockBaseUrl = 'https://openapivts.koreainvestment.com:29443';
const _timeout = Duration(seconds: 30); // 모의투자 잔고 조회가 10초를 넘길 때가 있었다 (2026-10-08 장중)
// 모의투자는 초당 호출 수가 적다 ("초당 거래건수를 초과" 오류). 호출 시작 사이를 이만큼 띄운다.
// 550ms로는 채팅 목록 읽기와 대화 조회가 겹칠 때 걸렸다 (2026-10-07). tools/kis_mock_check.py도 1.1초 간격
const _minGap = Duration(milliseconds: 1000);
const _rateLimitRetries = 3;

class KisMockBroker implements Broker {
  KisMockBroker(this.keys, {http.Client? client, SecureBox? box})
      : _http = client ?? http.Client(),
        _box = box ?? secureBox;

  final BrokerKeys keys;
  final http.Client _http;
  final SecureBox _box;
  String? _token;
  DateTime? _tokenExpires;
  Future<void> _lastCall = Future.value();

  /// 마지막 잔고 조회에서 받은 현재가 (홈 화면 평가금액용)
  @override
  final lastPrices = <String, int>{};

  /// 현재가 조회에서 받은 오늘 시가·고가 (장중 흐름에 붙여 서버로 보낸다: 고가에서 이익을 얼마나 돌려줬는지, 2026-10-16)
  final _dayOpens = <String, int>{};
  final _dayHighs = <String, int>{};

  /// 오늘 본 현재가 [시각 "HHmm", 가격] (잔고 조회 5분마다·현재가 조회 때). 1분봉은 최근 30분뿐이라 하루 모양을 보려고 쌓는다.
  /// ponytail: 메모리에만 둔다. 앱을 다시 켜면 그때부터 다시 쌓인다
  final _dayFlow = <String, List<List<Object>>>{};
  String _flowDate = '';

  void _see(String code, int price) {
    final now = DateTime.now();
    if (_flowDate != kstYmd(now)) {
      _flowDate = kstYmd(now);
      _dayFlow.clear();
    }
    final hhmm = kstHhmmss(now).substring(0, 4);
    final flow = _dayFlow.putIfAbsent(code, () => []);
    if (flow.isNotEmpty && flow.last[0] == hhmm) flow.removeLast(); // 같은 분은 마지막 값만
    flow.add([hhmm, price]);
  }

  @override
  String get name => 'KIS 모의투자';
  @override
  bool get isFake => false;
  @override
  bool get isReal => false;
  @override
  bool get realOrdersReady => false;

  // ---------- 접속 토큰 ----------
  // 토큰은 하루 동안 쓸 수 있고 발급은 1분에 한 번만 된다. 그래서 폰 보안 저장소에 두고 다시 쓴다

  Future<String> _accessToken() async {
    final now = DateTime.now();
    if (_token == null) {
      _token = await _box.read('kis_token');
      final expires = await _box.read('kis_token_expires');
      _tokenExpires = expires == null ? null : DateTime.parse(expires);
    }
    if (_token != null && _tokenExpires != null && now.isBefore(_tokenExpires!)) return _token!;

    final data = await _send(http.Request('POST', Uri.parse('$kisMockBaseUrl/oauth2/tokenP'))
      ..headers['content-type'] = 'application/json; charset=utf-8'
      ..body = jsonEncode({'grant_type': 'client_credentials', 'appkey': keys.appKey, 'appsecret': keys.appSecret}));
    final token = data['access_token'];
    if (token is! String) throw BrokerError('KIS 접속 토큰을 받지 못했어요. 앱키·시크리트를 확인해 주세요');
    // 만료 시각은 한국 시각 "2026-10-07 10:32:05". 5분 일찍 새로 받는다
    final expiresKst = DateTime.tryParse('${data['access_token_token_expired']}'.replaceFirst(' ', 'T'));
    _token = token;
    _tokenExpires = expiresKst == null
        ? now.add(const Duration(hours: 23))
        : DateTime.utc(expiresKst.year, expiresKst.month, expiresKst.day, expiresKst.hour - 9, expiresKst.minute)
            .subtract(const Duration(minutes: 5));
    await _box.write('kis_token', token);
    await _box.write('kis_token_expires', _tokenExpires!.toIso8601String());
    return token;
  }

  // ---------- 요청 ----------

  Future<Map<String, dynamic>> _send(http.Request request) async {
    final response = await http.Response.fromStream(await _http.send(request).timeout(_timeout)).timeout(_timeout);
    final Object? data;
    try {
      data = jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      throw BrokerError('KIS 응답을 읽지 못했어요 (${response.statusCode})');
    }
    if (data is! Map<String, dynamic>) throw BrokerError('KIS 응답 형식이 달라요');
    if (response.statusCode != 200) {
      throw BrokerError('KIS 오류: ${data['msg1'] ?? data['error_description'] ?? response.statusCode}');
    }
    // 거래 API는 HTTP 200이어도 rt_cd가 "0"이 아니면 실패다
    if (data.containsKey('rt_cd') && data['rt_cd'] != '0') {
      throw BrokerError('KIS: ${data['msg1'] ?? data['msg_cd']}'.trim());
    }
    return data;
  }

  Future<Map<String, dynamic>> _call(String method, String path, String trId,
      {Map<String, String>? query, Map<String, String>? body}) async {
    final token = await _accessToken();
    for (var attempt = 1;; attempt++) {
      // 앞 호출이 끝난 뒤 _minGap만큼 기다렸다 보낸다 (동시에 불려도 차례로)
      final previous = _lastCall;
      final turn = Completer<void>();
      _lastCall = turn.future;
      await previous;
      Future.delayed(_minGap, turn.complete);
      final request = http.Request(method, Uri.parse('$kisMockBaseUrl$path').replace(queryParameters: query))
        ..headers.addAll({
          'content-type': 'application/json; charset=utf-8',
          'authorization': 'Bearer $token',
          'appkey': keys.appKey,
          'appsecret': keys.appSecret,
          'tr_id': trId,
          'custtype': 'P',
        });
      if (body != null) request.body = jsonEncode(body);
      try {
        return await _send(request);
      } on BrokerError catch (error) {
        // 초당 호출 제한은 KIS가 요청을 처리하지 않고 돌려보낸 것이라 잠시 뒤 다시 보내도 안전하다 (주문 포함, 2026-10-08)
        if (attempt >= _rateLimitRetries || !error.message.contains('초당 거래건수')) rethrow;
        await Future.delayed(_minGap * 2);
      }
    }
  }

  static int _int(Object? value) => double.tryParse('${value ?? ''}')?.round() ?? 0;

  // ---------- 조회 ----------

  @override
  Future<Map<String, dynamic>> balance() async {
    // ponytail: 첫 페이지(모의 최대 50종목)만 읽는다. 보유 종목이 더 많아지면 CTX_AREA_NK100으로 이어 읽는다
    final data = await _call('GET', '/uapi/domestic-stock/v1/trading/inquire-balance', 'VTTC8434R', query: {
      'CANO': keys.cano, 'ACNT_PRDT_CD': keys.productCode, 'AFHR_FLPR_YN': 'N', 'OFL_YN': '', 'INQR_DVSN': '02',
      'UNPR_DVSN': '01', 'FUND_STTL_ICLD_YN': 'N', 'FNCG_AMT_AUTO_RDPT_YN': 'N', 'PRCS_DVSN': '00',
      'CTX_AREA_FK100': '', 'CTX_AREA_NK100': '',
    });
    final rows = (data['output1'] as List? ?? []).cast<Map<String, dynamic>>().where((r) => _int(r['hldg_qty']) > 0);
    final summary = (data['output2'] as List? ?? [{}]).cast<Map<String, dynamic>>().firstOrNull ?? {};
    for (final r in rows) {
      lastPrices['${r['pdno']}'] = _int(r['prpr']);
      if (_int(r['prpr']) > 0) _see('${r['pdno']}', _int(r['prpr']));
    }
    return {
      // 결제가 끝난 뒤(D+2)의 예수금. 예수금 총액(dnca_tot_amt)은 결제 전 매수 대금이 아직 빠지지 않아
      // 주식 평가액과 더하면 산 금액을 두 번 센다 (2026-10-08 총자산이 1,250만 원으로 보인 버그)
      'cash_krw': _int(summary['prvs_rcdl_excc_amt']),
      'holdings': [
        for (final r in rows)
          {'stock_code': '${r['pdno']}', 'stock_name': '${r['prdt_name']}', 'qty': _int(r['hldg_qty']),
           'avg_price': _int(r['pchs_avg_pric'])},
      ],
      'fetched_at': nowIso(),
    };
  }

  @override
  Future<int> price(String stockCode) async {
    final data = await _call('GET', '/uapi/domestic-stock/v1/quotations/inquire-price', 'FHKST01010100',
        query: {'FID_COND_MRKT_DIV_CODE': 'J', 'FID_INPUT_ISCD': stockCode});
    final price = _int((data['output'] as Map?)?['stck_prpr']);
    if (price <= 0) throw BrokerError('현재가를 받지 못했어요 ($stockCode)');
    final high = _int((data['output'] as Map?)?['stck_hgpr']);
    if (high > 0) _dayHighs[stockCode] = high;
    final open = _int((data['output'] as Map?)?['stck_oprc']);
    if (open > 0) _dayOpens[stockCode] = open;
    _see(stockCode, price);
    return price;
  }

  /// 주식당일분봉조회 (FHKST03010200, 실전·모의 같은 거래 코드). 지금 시각부터 1분봉 30개, 당일만
  @override
  Future<Map<String, dynamic>?> intraday(String stockCode) async {
    final data = await _call('GET', '/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice', 'FHKST03010200', query: {
      'FID_ETC_CLS_CODE': '', 'FID_COND_MRKT_DIV_CODE': 'J', 'FID_INPUT_ISCD': stockCode,
      'FID_INPUT_HOUR_1': kstHhmmss(DateTime.now()), 'FID_PW_DATA_INCU_YN': 'N',
    });
    final bars = [
      for (final b in ((data['output2'] as List?) ?? []).cast<Map<String, dynamic>>())
        if (_int(b['stck_prpr']) > 0) ['${b['stck_cntg_hour']}', _int(b['stck_prpr'])],
    ].reversed.toList(); // KIS는 최신부터 준다
    if (bars.isEmpty) return null; // 장 시작 전
    final o = (data['output1'] as Map?) ?? {};
    final volume = _int(o['acml_vol']);
    return {
      'change_pct': double.tryParse('${o['prdy_ctrt']}'), 'bars': bars,
      if (_dayHighs[stockCode] != null) 'high': _dayHighs[stockCode],
      if (_dayOpens[stockCode] != null) 'open': _dayOpens[stockCode],
      if ((_dayFlow[stockCode]?.length ?? 0) >= 2) 'day_flow': _dayFlow[stockCode],
      // 오늘 거래량 가중 평균가 = 누적 거래대금 ÷ 누적 거래량 (2026-10-14 모의 응답에서 두 값 확인)
      if (volume > 0 && _int(o['acml_tr_pbmn']) > 0) 'vwap': _int(o['acml_tr_pbmn']) ~/ volume,
    };
  }

  /// 시장 지수: 국내업종 현재지수(FHPUP02100000)와 일자별지수(FHPUP02120000). 코스피 0001, 코스닥 1001.
  /// 2026-10-12 모의투자에서 둘 다 받는 것을 확인. 지금 지수는 1분, 일별 종가는 하루 동안 다시 쓴다 (초당 호출 제한)
  @override
  Future<List<Map<String, dynamic>>?> market() async {
    final now = DateTime.now();
    if (_market != null && now.difference(_marketAt!) < const Duration(minutes: 1)) return _market;
    final today = kstYmd(now);
    final result = <Map<String, dynamic>>[];
    for (final (index, code) in const [('KOSPI', '0001'), ('KOSDAQ', '1001')]) {
      final o = (await _call('GET', '/uapi/domestic-stock/v1/quotations/inquire-index-price', 'FHPUP02100000',
          query: {'FID_COND_MRKT_DIV_CODE': 'U', 'FID_INPUT_ISCD': code}))['output'] as Map? ?? {};
      final value = double.tryParse('${o['bstp_nmix_prpr']}') ?? 0;
      if (value <= 0) continue;
      if (_dailyDate != today || !_daily.containsKey(index)) {
        final rows = ((await _call('GET', '/uapi/domestic-stock/v1/quotations/inquire-index-daily-price', 'FHPUP02120000',
            query: {'FID_PERIOD_DIV_CODE': 'D', 'FID_COND_MRKT_DIV_CODE': 'U', 'FID_INPUT_ISCD': code, 'FID_INPUT_DATE_1': today}))
            ['output2'] as List?) ?? [];
        _daily[index] = [
          for (final r in rows.cast<Map<String, dynamic>>().take(25))
            if ((double.tryParse('${r['bstp_nmix_prpr']}') ?? 0) > 0) ['${r['stck_bsop_date']}', double.parse('${r['bstp_nmix_prpr']}')],
        ];
        _dailyDate = today;
      }
      double? num(String key) => double.tryParse('${o[key]}');
      int? count(String key) => int.tryParse('${o[key]}');
      result.add({
        'index': index, 'value': value, 'change_pct': num('bstp_nmix_prdy_ctrt'),
        'open': num('bstp_nmix_oprc'), 'high': num('bstp_nmix_hgpr'), 'low': num('bstp_nmix_lwpr'),
        'up': count('ascn_issu_cnt'), 'down': count('down_issu_cnt'), 'flat': count('stnr_issu_cnt'),
        'daily': _daily[index], 'as_of': nowIso(),
      });
    }
    _market = result.isEmpty ? null : result;
    _marketAt = now;
    return _market;
  }

  /// 거래대금 상위(FHPST01710000)와 상승률 상위(FHPST01700000). 2026-10-13 모의투자에서 받는 것을 확인.
  /// 이미 크게 오른 종목(chasing)은 뺀다
  @override
  Future<List<String>> movers() async {
    final volume = await _call('GET', '/uapi/domestic-stock/v1/quotations/volume-rank', 'FHPST01710000', query: {
      'FID_COND_MRKT_DIV_CODE': 'J', 'FID_COND_SCR_DIV_CODE': '20171', 'FID_INPUT_ISCD': '0000', 'FID_DIV_CLS_CODE': '0',
      'FID_BLNG_CLS_CODE': '3', 'FID_TRGT_CLS_CODE': '111111111', 'FID_TRGT_EXLS_CLS_CODE': '0000000000',
      'FID_INPUT_PRICE_1': '', 'FID_INPUT_PRICE_2': '', 'FID_VOL_CNT': '', 'FID_INPUT_DATE_1': '',
    });
    final rise = await _call('GET', '/uapi/domestic-stock/v1/ranking/fluctuation', 'FHPST01700000', query: {
      'fid_cond_mrkt_div_code': 'J', 'fid_cond_scr_div_code': '20170', 'fid_input_iscd': '0000', 'fid_rank_sort_cls_code': '0',
      'fid_input_cnt_1': '0', 'fid_prc_cls_code': '0', 'fid_input_price_1': '', 'fid_input_price_2': '', 'fid_vol_cnt': '',
      'fid_trgt_cls_code': '0', 'fid_trgt_exls_cls_code': '0', 'fid_div_cls_code': '0', 'fid_rsfl_rate1': '', 'fid_rsfl_rate2': '',
    });
    List<String> codes(Map<String, dynamic> data, String key) => [
          for (final o in ((data['output'] as List?) ?? []).cast<Map<String, dynamic>>())
            if (!chasing(o['prdy_ctrt'])) '${o[key] ?? ''}',
        ];
    return {...codes(volume, 'mksc_shrn_iscd'), ...codes(rise, 'stck_shrn_iscd')}.where((c) => RegExp(r'^\d{6}$').hasMatch(c)).take(30).toList();
  }

  List<Map<String, dynamic>>? _market;
  DateTime? _marketAt;
  String? _dailyDate;
  final _daily = <String, List<List<Object>>>{};

  // ---------- 주문 ----------

  @override
  Future<({String orderNo, int filledQty, int? filledPrice})> order(String side, String stockCode, int qty, int price) async {
    final data = await _call('POST', '/uapi/domestic-stock/v1/trading/order-cash',
        side == 'buy' ? 'VTTC0012U' : 'VTTC0011U', // 모의 매수 / 모의 매도
        body: {
          'CANO': keys.cano, 'ACNT_PRDT_CD': keys.productCode, 'PDNO': stockCode,
          'ORD_DVSN': '00', // 지정가
          'ORD_QTY': '$qty', 'ORD_UNPR': '$price', 'EXCG_ID_DVSN_CD': 'KRX',
          'SLL_TYPE': side == 'sell' ? '01' : '', 'CNDT_PRIC': '',
        });
    final orderNo = (data['output'] as Map?)?['ODNO'];
    if (orderNo == null) throw BrokerError('KIS가 주문번호를 주지 않았어요');
    // 접수 응답에는 체결 정보가 없다. 체결 여부는 주문 내역에서 본다
    return (orderNo: '$orderNo', filledQty: 0, filledPrice: null);
  }

  /// 주식주문(정정취소) VTTC0013U. 원래 주문의 주문조직번호가 필요해서 오늘 주문 내역에서 먼저 찾는다.
  /// 남은 수량 전부(QTY_ALL_ORD_YN=Y) 또는 일부(N, ORD_QTY)를 취소(02)하거나 지정가로 정정(01)한다
  @override
  Future<String> revise(String orderNo, String stockCode, int? price, {int? qty}) async {
    final branch = await _orderBranch(orderNo, stockCode);
    final data = await _call('POST', '/uapi/domestic-stock/v1/trading/order-rvsecncl', 'VTTC0013U', body: {
      'CANO': keys.cano, 'ACNT_PRDT_CD': keys.productCode, 'KRX_FWDG_ORD_ORGNO': branch, 'ORGN_ODNO': orderNo,
      'ORD_DVSN': '00', 'RVSE_CNCL_DVSN_CD': price == null ? '02' : '01', 'ORD_QTY': '${qty ?? 0}',
      'ORD_UNPR': '${price ?? 0}', 'QTY_ALL_ORD_YN': qty == null ? 'Y' : 'N', 'EXCG_ID_DVSN_CD': 'KRX',
    });
    final newNo = (data['output'] as Map?)?['ODNO'];
    if (newNo == null) throw BrokerError('KIS가 정정·취소 주문번호를 주지 않았어요');
    return '$newNo';
  }

  Future<String> _orderBranch(String orderNo, String stockCode) async {
    final data = await _dailyOrders(stockCode);
    final row = (data['output1'] as List? ?? []).cast<Map<String, dynamic>>().where((r) => '${r['odno']}' == orderNo).firstOrNull;
    if (row == null) throw BrokerError('오늘 주문 내역에서 주문번호 $orderNo를 찾지 못했어요');
    return '${row['ord_gno_brno']}';
  }

  @override
  Future<int> buyingPower() async {
    // 매수가능조회는 종목을 받지만 주문가능현금(ord_psbl_cash)은 종목과 상관없다. 시장가(01) 기준으로 묻는다
    final data = await _call('GET', '/uapi/domestic-stock/v1/trading/inquire-psbl-order', 'VTTC8908R', query: {
      'CANO': keys.cano, 'ACNT_PRDT_CD': keys.productCode, 'PDNO': '005930', 'ORD_UNPR': '', 'ORD_DVSN': '01',
      'CMA_EVLU_AMT_ICLD_YN': 'N', 'OVRS_ICLD_YN': 'N',
    });
    return _int((data['output'] as Map?)?['ord_psbl_cash']);
  }

  /// 주식일별주문체결조회 VTTC0081R, 오늘 것만. 모의는 한 번에 15건이라 종목으로 거른다
  Future<Map<String, dynamic>> _dailyOrders(String stockCode) {
    final today = kstYmd(DateTime.now());
    return _call('GET', '/uapi/domestic-stock/v1/trading/inquire-daily-ccld', 'VTTC0081R', query: {
      'CANO': keys.cano, 'ACNT_PRDT_CD': keys.productCode, 'INQR_STRT_DT': today, 'INQR_END_DT': today,
      'SLL_BUY_DVSN_CD': '00', 'PDNO': stockCode, 'CCLD_DVSN': '00', 'INQR_DVSN': '00', 'INQR_DVSN_1': '',
      'INQR_DVSN_3': '00', 'ORD_GNO_BRNO': '', 'ODNO': '', 'EXCG_ID_DVSN_CD': 'KRX',
      'CTX_AREA_FK100': '', 'CTX_AREA_NK100': '',
    });
  }

  @override
  Future<List<BrokerOrder>> todayOrders(String stockCode) async {
    final data = await _dailyOrders(stockCode);
    return [
      for (final r in (data['output1'] as List? ?? []).cast<Map<String, dynamic>>())
        (
          orderNo: '${r['odno']}',
          stockCode: '${r['pdno']}',
          stockName: '${r['prdt_name']}',
          side: r['sll_buy_dvsn_cd'] == '01' ? 'sell' : 'buy',
          qty: _int(r['ord_qty']),
          price: _int(r['ord_unpr']),
          filledQty: _int(r['tot_ccld_qty']),
          filledPrice: _int(r['avg_prvs']) > 0 ? _int(r['avg_prvs']) : null,
          time: '${r['ord_tmd']}',
        ),
    ];
  }
}
