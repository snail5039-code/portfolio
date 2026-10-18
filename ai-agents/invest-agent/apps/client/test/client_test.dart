import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:invest_client/api/api.dart';
import 'package:invest_client/broker/broker.dart';
import 'package:invest_client/broker/fake_broker.dart';
import 'package:invest_client/broker/kb_broker.dart';
import 'package:invest_client/broker/kis_mock_broker.dart';
import 'package:invest_client/common/common.dart';
import 'package:invest_client/features/auto/auto_trader.dart';
import 'package:invest_client/features/auto/reservations.dart';
import 'package:invest_client/features/history/history_page.dart';
import 'package:invest_client/features/home/briefing_page.dart';
import 'package:invest_client/secure/key_store.dart';

Map<String, dynamic> order(String side, int qty, int price, {String key = 'k1', int? approved}) => {
      'approval_id': key, 'stock_code': '000270', 'side': side, 'qty': qty, 'limit_price': price,
      'approved_price': approved ?? price, 'max_price_drift_pct': 1, 'idempotency_key': key,
    };

http.Response jsonResponse(Object body) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), 200, headers: {'content-type': 'application/json'});

void main() {
  test('금액 표시: 천 단위 콤마, 음수, 반올림', () {
    expect(won(1250000), '1,250,000원');
    expect(comma(999), '999');
    expect(comma(-1000), '-1,000');
    expect(comma(0), '0');
    expect(comma(1234.6), '1,235');
  });

  test('시각은 기기 시간대와 상관없이 한국 시각으로 보여준다', () {
    expect(hhmm('2026-10-06T02:40:00Z'), '11:40');
    expect(hhmm('2026-10-06T11:40:05+09:00'), '11:40');
  });

  test('기록: 최종 결과와 검증 항목 이름', () {
    expect(finalResult({'order_status': 'filled', 'approval_status': 'approved'}), '체결');
    expect(finalResult({'approval_status': 'rejected'}), '거절');
    expect(finalResult({'policy_ok': false}), '정책 차단');
    expect(finalResult({'policy_ok': null}), '분석');
    expect(checkTarget('claim:0'), '근거 1');
    expect(checkTarget('freshness'), '자료 시점');
  });

  test('이벤트 스트림: 빈 줄로 이벤트를 나누고 한글을 그대로 읽는다', () async {
    final lines = Stream.fromIterable([
      'event: progress', 'data: {"step": "understand", "label": "요청 이해 중"}', '',
      'event: done', 'data: {"thread_id": "t1"}', '',
    ]);
    final events = await parseSse(lines).toList();
    expect(events.map((e) => e.event), ['progress', 'done']);
    expect(events.first.data['label'], '요청 이해 중');
  });

  group('주문 실행 (가짜 증권사)', () {
    late FakeBroker b;
    late OrderJournal journal;
    var unlocked = 0;
    Future<bool> unlock() async {
      unlocked++;
      return true;
    }

    Future<Map<String, dynamic>> run(Map<String, dynamic> request) =>
        executeOrder(b, request, unlock: unlock, journal: journal);

    setUp(() {
      b = FakeBroker();
      journal = OrderJournal(SecureBox.memory());
      unlocked = 0;
    });

    test('매수하면 현금이 줄고 평균 단가가 합쳐진다', () async {
      b.holdings['000270'] = (qty: 2, avgPrice: 100000);
      final result = await run(order('buy', 2, 113300));
      expect(result['status'], 'filled');
      expect(b.cash, 1500000 - 226600);
      expect(b.holdings['000270'], (qty: 4, avgPrice: 106650));
      expect(unlocked, 0); // 가짜 증권사는 폰 잠금 확인을 건너뛴다
    });

    test('같은 idempotency_key는 한 번만 주문한다', () async {
      final first = await run(order('buy', 1, 113300));
      final second = await run(order('buy', 1, 113300));
      expect(second, first);
      expect(b.cash, 1500000 - 113300);
    });

    test('승인 가격에서 1% 넘게 바뀌면 주문하지 않고 지금 가격을 알린다', () async {
      final result = await run(order('buy', 1, 110000)); // 지금 113,300 (3% 차이)
      expect(result['status'], 'price_changed');
      expect(result['current_price'], 113300);
      expect(b.cash, 1500000);
      // 같은 처리안으로 다시 승인하면 같은 key로 다시 실행할 수 있어야 한다
      expect((await run(order('buy', 1, 113300)))['status'], 'filled');
    });

    test('현금·보유 수량이 부족하면 실패하고 아무것도 바꾸지 않는다', () async {
      expect((await run(order('buy', 20, 113300, key: 'a')))['status'], 'failed');
      expect((await run(order('sell', 1, 113300, key: 'b')))['status'], 'failed');
      expect(b.cash, 1500000);
      expect(b.holdings.containsKey('000270'), isFalse);
    });

    test('주문을 보낸 뒤 앱이 꺼졌으면 다시 주문하지 않고 주문 내역으로 확인한다', () async {
      await journal.start('k1', '000000');
      await b.order('buy', '000270', 1, 113300); // 지난번에 실제로 들어간 주문
      final result = await run(order('buy', 1, 113300));
      expect(result['status'], 'unknown_checked');
      expect(result['broker_order_no'], startsWith('FAKE-'));
      expect(b.holdings['000270']!.qty, 1); // 두 번 사지 않았다
    });

    test('증권사가 없으면 주문하지 않는다', () async {
      final result = await executeOrder(null, order('buy', 1, 113300), unlock: unlock, journal: journal);
      expect(result['status'], 'failed');
    });

    test('조회: 없는 종목이면 가짜 값 없이 실패로 답한다', () async {
      expect((await answerFetch(b, [{'type': 'price', 'stock_code': '999999'}])).keys, ['error']);
      expect((await answerFetch(null, [{'type': 'balance'}])).keys, ['error']);
      final ok = await answerFetch(b, [{'type': 'balance'}, {'type': 'price', 'stock_code': '005930'}]);
      expect((ok['balance'] as Map)['cash_krw'], 1500000);
      expect((ok['prices'] as List).single['price'], 276000);
      expect(((ok['balance'] as Map)['fetched_at'] as String).endsWith('Z'), isTrue); // 서버는 시간대 있는 시각만 받는다
    });
  });

  group('KIS 모의투자 (가짜 응답)', () {
    final keys = BrokerKeys(appKey: 'test-app-key', appSecret: 'test-secret', account: '12345678-01');
    late List<http.Request> sent;

    KisMockBroker kis(Future<http.Response> Function(http.Request) handler) {
      sent = [];
      return KisMockBroker(keys, box: SecureBox.memory(), client: MockClient((request) {
        sent.add(request);
        if (request.url.path == '/oauth2/tokenP') {
          return Future.value(jsonResponse({'access_token': 'tok', 'access_token_token_expired': '2099-01-01 00:00:00'}));
        }
        return handler(request);
      }));
    }

    test('장중 흐름: 1분봉을 오래된 것부터, 전일 대비 등락률과 함께', () async {
      final b = kis((_) async => jsonResponse({'rt_cd': '0', 'output1': {'prdy_ctrt': '-1.25'}, 'output2': [
        {'stck_cntg_hour': '094000', 'stck_prpr': '111000'}, {'stck_cntg_hour': '093900', 'stck_prpr': '111500'}]}));
      expect(await b.intraday('000270'), {'change_pct': -1.25, 'bars': [['093900', 111500], ['094000', 111000]]});
      expect((sent.last.url.path, sent.last.headers['tr_id']), ('/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice', 'FHKST03010200'));
      final empty = kis((_) async => jsonResponse({'rt_cd': '0', 'output1': {}, 'output2': []}));
      expect(await empty.intraday('000270'), isNull); // 장 시작 전
    });

    test('장중 흐름에 VWAP(누적 거래대금 ÷ 누적 거래량), 급등 후보는 +10% 넘게 오른 종목을 뺀다', () async {
      final b = kis((_) async => jsonResponse({'rt_cd': '0', 'output1': {'prdy_ctrt': '1.00', 'acml_vol': '1000', 'acml_tr_pbmn': '111250000'},
        'output2': [{'stck_cntg_hour': '094000', 'stck_prpr': '111000'}]}));
      expect((await b.intraday('000270'))!['vwap'], 111250);
      // 현재가 조회에서 받은 오늘 고가를 장중 흐름에 붙인다 (2026-10-16 고가에서 이익을 돌려준 폭)
      final quote = kis((request) async => request.url.path.endsWith('inquire-price')
          ? jsonResponse({'rt_cd': '0', 'output': {'stck_prpr': '41700', 'stck_hgpr': '42500'}})
          : jsonResponse({'rt_cd': '0', 'output1': {'prdy_ctrt': '1.00'}, 'output2': [{'stck_cntg_hour': '150000', 'stck_prpr': '41700'}]}));
      expect(await quote.price('028300'), 41700);
      expect((await quote.intraday('028300'))!['high'], 42500);
      // 오늘 시가. 하루 동안 본 현재가는 두 번 이상 봤을 때만 보낸다
      final day = kis((request) async => request.url.path.endsWith('inquire-price')
          ? jsonResponse({'rt_cd': '0', 'output': {'stck_prpr': '41700', 'stck_hgpr': '42500', 'stck_oprc': '41000'}})
          : jsonResponse({'rt_cd': '0', 'output1': {}, 'output2': [{'stck_cntg_hour': '150000', 'stck_prpr': '41700'}]}));
      await day.price('028300');
      final once = (await day.intraday('028300'))!;
      expect((once['open'], once.containsKey('day_flow')), (41000, false));

      final ranks = kis((request) async => jsonResponse({'rt_cd': '0', 'output': [
        {'mksc_shrn_iscd': '000270', 'stck_shrn_iscd': '000270', 'prdy_ctrt': '3.20'},
        {'mksc_shrn_iscd': '111111', 'stck_shrn_iscd': '111111', 'prdy_ctrt': '10.00'},
        {'mksc_shrn_iscd': '222222', 'stck_shrn_iscd': '222222', 'prdy_ctrt': '29.90'},
      ]}));
      expect(await ranks.movers(), ['000270']);
      expect((chasing('9.99'), chasing(null)), (false, false));
    });

    test('모의투자 서버와 모의 거래 코드만 쓰고, 주문 형식이 맞다', () async {
      final b = kis((_) async => jsonResponse({'rt_cd': '0', 'msg1': '주문 전송 완료', 'output': {'ODNO': '0000117057'}}));
      final ack = await b.order('buy', '000270', 2, 113300);
      expect(ack.orderNo, '0000117057');
      final body = jsonDecode(sent.last.body) as Map<String, dynamic>;
      expect(sent.last.headers['tr_id'], 'VTTC0012U');
      expect(sent.last.headers['authorization'], 'Bearer tok');
      expect(body, containsPair('CANO', '12345678'));
      expect(body, containsPair('ACNT_PRDT_CD', '01'));
      expect(body, containsPair('ORD_DVSN', '00')); // 지정가
      expect(body, containsPair('ORD_UNPR', '113300'));
      await b.order('sell', '000270', 1, 113300);
      expect(sent.last.headers['tr_id'], 'VTTC0011U');
      for (final r in sent) {
        expect(r.url.host, 'openapivts.koreainvestment.com');
        expect(r.headers['tr_id'] ?? 'V', isNot(startsWith('T'))); // 실전 거래 코드(T…)는 없다
      }
      expect(sent.where((r) => r.url.path == '/oauth2/tokenP').length, 1); // 토큰은 한 번만 받는다
    });

    test('rt_cd가 0이 아니면 거절(BrokerError)이다', () async {
      final b = kis((_) async => jsonResponse({'rt_cd': '1', 'msg1': '모의투자 주문가능금액을 초과 했습니다'}));
      await expectLater(b.order('buy', '000270', 999, 113300), throwsA(isA<BrokerError>()));
    });

    test('잔고: 계좌번호 없이 서버 형식으로 바꾼다', () async {
      final b = kis((_) async => jsonResponse({
            'rt_cd': '0',
            'output1': [
              {'pdno': '005930', 'prdt_name': '삼성전자', 'hldg_qty': '3', 'pchs_avg_pric': '240000.0000', 'prpr': '276000'},
              {'pdno': '000270', 'prdt_name': '기아', 'hldg_qty': '0', 'pchs_avg_pric': '0', 'prpr': '113300'},
            ],
            'output2': [{'dnca_tot_amt': '9999000', 'prvs_rcdl_excc_amt': '9172000'}], // 결제 후 예수금을 쓴다
          }));
      final balance = await b.balance();
      expect(balance['cash_krw'], 9172000);
      expect(balance['holdings'], [{'stock_code': '005930', 'stock_name': '삼성전자', 'qty': 3, 'avg_price': 240000}]);
      expect(b.lastPrices['005930'], 276000);
      expect(sent.last.headers['tr_id'], 'VTTC8434R');
      expect(jsonEncode(balance), isNot(contains('12345678'))); // 서버로 가는 값에 계좌번호가 없다
    });

    test('주문 응답이 없으면 다시 주문하지 않고 주문 내역에서 찾는다', () async {
      var orders = 0;
      final b = kis((request) async {
        if (request.url.path.endsWith('order-cash')) {
          orders++;
          throw TimeoutException('응답 없음');
        }
        if (request.url.path.endsWith('inquire-price')) {
          return jsonResponse({'rt_cd': '0', 'output': {'stck_prpr': '113300'}});
        }
        return jsonResponse({'rt_cd': '0', 'output1': [
          {'odno': '0000117057', 'sll_buy_dvsn_cd': '02', 'ord_qty': '2', 'ord_unpr': '113300',
           'tot_ccld_qty': '2', 'avg_prvs': '113300', 'ord_tmd': '235959'},
        ]});
      });
      final journal = OrderJournal(SecureBox.memory());
      var unlocked = false;
      final result = await executeOrder(b, order('buy', 2, 113300), journal: journal, unlock: () async => unlocked = true);
      expect(unlocked, isTrue); // 실제 증권사는 폰 잠금 확인을 한다
      expect(orders, 1);
      expect(result['status'], 'unknown_checked');
      expect(result['broker_order_no'], '0000117057');
      expect(sent.last.headers['tr_id'], 'VTTC0081R');
      // 같은 주문을 다시 실행해도 증권사에 다시 보내지 않는다
      expect(await executeOrder(b, order('buy', 2, 113300), journal: journal, unlock: () async => true), result);
      expect(orders, 1);
    });

    test('폰 잠금 확인을 안 하면 주문하지 않는다', () async {
      final b = kis((request) async => jsonResponse({'rt_cd': '0', 'output': {'stck_prpr': '113300'}}));
      final result = await executeOrder(b, order('buy', 1, 113300),
          journal: OrderJournal(SecureBox.memory()), unlock: () async => false);
      expect(result['status'], 'failed');
      expect(sent.where((r) => r.url.path.endsWith('order-cash')), isEmpty);
    });

    test('정정·취소: 주문조직번호를 찾아 남은 수량 전부를 취소하고, 다시 실행해도 두 번 보내지 않는다', () async {
      final b = kis((request) async {
        if (request.url.path.endsWith('order-rvsecncl')) return jsonResponse({'rt_cd': '0', 'output': {'ODNO': '0000020001'}});
        return jsonResponse({'rt_cd': '0', 'output1': [
          {'odno': '0000010734', 'ord_gno_brno': '06010', 'sll_buy_dvsn_cd': '02', 'ord_qty': '4', 'ord_unpr': '106800',
           'tot_ccld_qty': '0', 'avg_prvs': '0', 'ord_tmd': '092600'},
        ]});
      });
      final journal = OrderJournal(SecureBox.memory());
      final request = {'idempotency_key': 'c1', 'stock_code': '000720', 'side': 'buy', 'qty': 4, 'limit_price': 106800,
                       'order_change': 'cancel', 'original_order_no': '0000010734'};
      final result = await executeOrder(b, request, journal: journal, unlock: () async => true);
      expect(result['status'], 'accepted');
      expect(result['broker_order_no'], '0000020001');
      final revise = sent.singleWhere((r) => r.url.path.endsWith('order-rvsecncl'));
      expect(revise.headers['tr_id'], 'VTTC0013U');
      final body = jsonDecode(revise.body) as Map<String, dynamic>;
      expect([body['KRX_FWDG_ORD_ORGNO'], body['ORGN_ODNO'], body['RVSE_CNCL_DVSN_CD'], body['QTY_ALL_ORD_YN']],
          ['06010', '0000010734', '02', 'Y']);
      expect(await executeOrder(b, request, journal: journal, unlock: () async => true), result);
      expect(sent.where((r) => r.url.path.endsWith('order-rvsecncl')).length, 1);

      // 일부만: 2주만 취소하면 QTY_ALL_ORD_YN=N, ORD_QTY=2
      await executeOrder(b, {...request, 'idempotency_key': 'c2', 'qty': 2, 'all_qty': false},
          journal: journal, unlock: () async => true);
      final part = jsonDecode(sent.lastWhere((r) => r.url.path.endsWith('order-rvsecncl')).body) as Map<String, dynamic>;
      expect([part['QTY_ALL_ORD_YN'], part['ORD_QTY']], ['N', '2']);
    });

    test('체결 갱신: 접수된 주문의 체결 수량·평균가를 서버에 올린다', () async {
      final b = kis((_) async => jsonResponse({'rt_cd': '0', 'output1': [
            {'odno': '0000010734', 'sll_buy_dvsn_cd': '02', 'ord_qty': '2', 'ord_unpr': '111400',
             'tot_ccld_qty': '2', 'avg_prvs': '111200', 'ord_tmd': '101500'},
            {'odno': '0000010735', 'sll_buy_dvsn_cd': '02', 'ord_qty': '1', 'ord_unpr': '111400',
             'tot_ccld_qty': '0', 'avg_prvs': '0', 'ord_tmd': '101600'},
          ]}));
      final posted = <Object>[];
      await syncFills(b,
          get: (_) async => [
                {'idempotency_key': 'a', 'stock_code': '000270', 'broker_order_no': '0000010734', 'filled_qty': 0},
                {'idempotency_key': 'b', 'stock_code': '000270', 'broker_order_no': '0000010735', 'filled_qty': 0},
              ],
          post: (path, body) async => posted.add(body));
      expect(posted, [
        {'fills': [{'idempotency_key': 'a', 'filled_qty': 2, 'filled_price': 111200}]}, // 아직 체결 안 된 b는 안 보낸다
      ]);
      expect(sent.where((r) => r.headers['tr_id'] == 'VTTC0081R').length, 1); // 같은 종목은 한 번만 조회
    });

    test('자산: 주문 가능 금액과 전체 종목 오늘 주문', () async {
      final b = kis((request) async => request.url.path.endsWith('inquire-psbl-order')
          ? jsonResponse({'rt_cd': '0', 'output': {'ord_psbl_cash': '9777600'}})
          : jsonResponse({'rt_cd': '0', 'output1': [
              {'odno': '0000010734', 'pdno': '000270', 'prdt_name': '기아', 'sll_buy_dvsn_cd': '02', 'ord_qty': '2',
               'ord_unpr': '111400', 'tot_ccld_qty': '2', 'avg_prvs': '111200', 'ord_tmd': '093514'},
            ]}));
      expect(await b.buyingPower(), 9777600);
      expect(sent.last.headers['tr_id'], 'VTTC8908R');
      final [order] = await b.todayOrders('');
      expect((order.stockName, order.stockCode, order.filledQty, order.filledPrice), ('기아', '000270', 2, 111200));
      expect(sent.last.url.queryParameters['PDNO'], ''); // 전체 종목
    });

    test('계좌번호 형식이 틀리면 저장하지 않는다', () {
      expect(() => BrokerKeys(appKey: 'a', appSecret: 'b', account: '1234'), throwsFormatException);
      expect(BrokerKeys(appKey: 'a', appSecret: 'b', account: '50123456').productCode, '01'); // 8자리만 넣으면 01
    });
  });

  testWidgets('아침 브리핑: 매수 제안 카드와 주문하기', (tester) async {
    String? asked;
    final briefing = {
      'brief_date': '2026-10-07', 'created_at': '2026-10-06T23:30:00Z',
      'content': {
        'mode': 'custom', 'news': [], 'checked': [],
        'limits': {'daily_limit_krw': 500000, 'clean_days': 2},
        'picks': [
          {'stock_code': '066570', 'stock_name': 'LG전자', 'proposal_id': 'p1', 'verdict': 'approve', 'summary': '원문과 맞아요',
           'conditions': [], 'risks': ['환율 변동'], 'last_close': 211500, 'close_date': '2026-10-06', 'worst_case_loss': 21150,
           'claims': [{'type': '사실', 'text': '영업이익이 늘었다', 'sources': ['반기보고서']}]},
        ],
      },
    };
    expect(briefingPreview(briefing, today: true), '오늘의 매수 제안 1개가 왔어요');
    await tester.pumpWidget(MaterialApp(home: Builder(builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BriefingPage(briefing, onAsk: (t) => asked = t))),
            child: const Text('열기'),
          ),
        ))));
    await tester.tap(find.text('열기'));
    await tester.pumpAndSettle();
    expect(find.text('LG전자 매수 검토'), findsOneWidget);
    expect(find.textContaining('10% 하락 시 −21,150원'), findsOneWidget);
    expect(find.textContaining('일반 모드라'), findsNothing); // 맞춤 모드 안내 문구가 없다
    await tester.tap(find.text('주문하기'));
    await tester.pumpAndSettle();
    expect(asked, 'LG전자 1주 사줘'); // 평소 주문 흐름으로 (처리안 → 승인 → 폰 실행)
  });

  testWidgets('장 마감 요약: AI 회고 · 내일 계획', (tester) async {
    final summary = {
      'brief_date': '2026-10-07', 'created_at': '2026-10-07T06:40:00Z',
      'content': {
        'orders': [], 'blocked': [], 'news': [], 'bought_krw': 0, 'sold_krw': 0, 'analyses': 0,
        'limits': {'daily_used_krw': 0, 'daily_limit_krw': 500000, 'clean_days': 2},
        'review': {
          'verdict': 'user_judgement', 'verdict_label': '사용자 판단 필요', 'summary': '자료가 부족해요', 'conditions': [],
          'disagreements': ['비중 판단이 다름'], 'rounds': 3, 'general': false, 'risks': ['손실 가능'],
          'retrospective': [{'type': '사실', 'text': '오늘 매매가 없었다', 'sources': ['장 마감 요약']}],
          'tomorrow': [{'stock_code': '000270', 'stock_name': '기아', 'action': '매도 검토', 'invalid_if': ['실적 개선'],
                        'reasons': [{'type': '계산', 'text': '비중 40%', 'sources': ['내 계좌 비중']}]}],
          'sources': [{'title': '장 마감 요약', 'url': null, 'as_of': '10-07 15:40 기준'}],
        },
      },
    };
    expect(closePreview(summary, today: true), 'AI 회고와 내일 볼 것이 왔어요');
    await tester.pumpWidget(MaterialApp(home: CloseSummaryPage(summary)));
    await tester.scrollUntilVisible(find.textContaining('검증을 통과하지 못했어요'), 200);
    expect(find.text('내일 기아 · 매도 검토'), findsOneWidget);
    expect(find.text('검증 사용자 판단 필요'), findsOneWidget);
    expect(find.text('이러면 판단이 틀린 것'), findsOneWidget);
    expect(find.textContaining('실적 개선'), findsWidgets);
  });

  test('KB증권: 토큰 → 현재가(IVU10140), 토큰은 다시 받지 않는다', () async {
    final sent = <http.Request>[];
    final broker = KbBroker(BrokerKeys(appKey: 'ak', appSecret: 'as', account: '12345678-01'), box: SecureBox.memory(),
        client: MockClient((request) async {
      sent.add(request);
      if (request.url.path == '/oauth2/token') return jsonResponse({'dataBody': {'access_token': 'tok', 'expires_in': 86400}});
      final code = (jsonDecode(request.body)['dataBody'] as Map)['shrt_cd'];
      return jsonResponse({'dataHeader': {}, 'dataBody': code == '005930' ? {'is_nm': '삼성전자', 'now_prc': 276000} : {'msg': '종목 없음 '}});
    }));
    expect(await broker.price('005930'), 276000);
    expect(await broker.price('005930'), 276000); // 토큰은 다시 받지 않는다
    expect(sent.where((r) => r.url.path == '/oauth2/token').length, 1);
    final token = jsonDecode(sent.first.body) as Map;
    expect(token['dataBody'], {'appKey': 'ak', 'appSecret': 'as', 'grantType': 'client_credentials'});
    final quote = sent[1];
    expect((quote.url.toString(), quote.headers['Authorization'], quote.headers['appKey']),
        ('$kbBaseUrl/api/v1/ivu10140', 'bearer tok', 'ak'));
    expect(jsonDecode(quote.body)['dataBody'], {'excg_clsf': '1', 'shrt_cd': '005930'});
    await expectLater(broker.price('999999'), throwsA(isA<BrokerError>().having((e) => e.message, 'message', contains('종목 없음'))));
  });

  test('KIS 모의 키와 KB 키는 따로 저장한다 (하나를 지워도 다른 쪽은 남는다)', () async {
    final box = SecureBox.memory();
    await BrokerKeys(appKey: 'kis', appSecret: 's1', account: '12345678-01').save(box);
    await BrokerKeys(appKey: 'kb', appSecret: 's2', needsAccount: false).save(box, prefix: 'kb');
    await BrokerKeys.delete(box, prefix: 'kb');
    expect((await BrokerKeys.load(box))?.appKey, 'kis');
    expect(await BrokerKeys.load(box, prefix: 'kb'), isNull);
    expect(() => BrokerKeys(appKey: 'a', appSecret: 'b', account: ''), throwsFormatException); // KIS는 계좌번호가 있어야 한다
  });

  test('KB증권: 잔고(SSQM2952)·주문 내역(SSQM2341)·주문(SSAM1802)과 업무 거절', () async {
    final sent = <String, Map>{};
    final broker = KbBroker(BrokerKeys(appKey: 'ak', appSecret: 'as', account: '12345678-01'), box: SecureBox.memory(),
        client: MockClient((request) async {
      if (request.url.path == '/oauth2/token') return jsonResponse({'dataBody': {'access_token': 'tok', 'expires_in': 86400}});
      final tr = request.url.pathSegments.last;
      sent[tr] = jsonDecode(request.body)['dataBody'] as Map;
      return jsonResponse(switch (tr) {
        'ssqm2952' => {'dataHeader': {'resultCode': '200', 'processFlag': 'A'}, 'dataBody': {
            'nxt2_dy_tfnd': '0000000150000', 'Record1': [
              {'is_cd': 'A005930', 'is_nm': '삼성전자 ', 'hld_q': '3', 'byng_avr_prc': '70000.00', 'now_prc': '72000'},
              {'is_cd': 'A000660', 'is_nm': 'SK하이닉스', 'hld_q': '0', 'byng_avr_prc': '0', 'now_prc': '200000'}]}},
        'ssqm2341' => {'dataHeader': {'resultCode': '200'}, 'dataBody': {'Record1': {
            'ordr_no': '0000012', 'stnd_is_no': 'KR7005930003', 'hngl_shrt_nm': '삼성전자', 'trd_dl_ccd_nm': '현금매도',
            'ordr_q': '1', 'tl_ccls_q': '1', 'ordr_uprc': '72000', 'ccls_uprc': '72000', 'ordr_tm': '093015'}}},
        // 돈이 없으면 KB는 HTTP 200에 거절 코드를 준다
        _ => {'dataHeader': {'resultCode': '200', 'processFlag': 'B', 'processCode': '1234', 'processMessage': '주문가능금액이 부족합니다'},
            'dataBody': {}},
      });
    }));
    expect(await broker.balance(), allOf(containsPair('cash_krw', 150000), containsPair('holdings', [
      {'stock_code': '005930', 'stock_name': '삼성전자', 'qty': 3, 'avg_price': 70000}])));
    expect(broker.lastPrices['005930'], 72000);
    final [o] = await broker.todayOrders('005930');
    expect((o.orderNo, o.side, o.qty, o.filledQty, o.filledPrice, o.time), ('0000012', 'sell', 1, 1, 72000, '093015'));
    expect(await broker.todayOrders('000660'), isEmpty);
    await expectLater(broker.order('buy', '005930', 1, 1000),
        throwsA(isA<BrokerError>().having((e) => e.message, 'message', contains('주문가능금액이 부족'))));
    expect(sent['ssam1802'], {'mkt_tm_clsf': '1', 'is_cd': '005930', 'ordr_q': '1', 'ordr_uprc': '1000', 'ordr_ccd': '00', 'sor_ordr_ccd': 'K'});
    await expectLater(broker.revise('0000012', '005930', null), throwsA(isA<BrokerError>()));
    expect(sent['ssam1806'], {'is_cd': '005930', 'ordr_q': '', 'crct_clsf': '2', 'orgn_ordr_no': '0000012'}); // 남은 수량 전부 취소
  });

  test('자동매매는 모의투자(가짜·KIS 모의)에서만 켤 수 있다', () {
    final keys = BrokerKeys(appKey: 'a', appSecret: 'b', account: '12345678');
    expect(AutoTrader.allowed(FakeBroker()), isTrue);
    expect(AutoTrader.allowed(KisMockBroker(keys, box: SecureBox.memory())), isTrue);
    expect(AutoTrader.allowed(KbBroker(keys, box: SecureBox.memory())), isFalse); // 실전 증권사
    expect(AutoTrader.allowed(null), isFalse);
  });

  test('장중 급락: 분석 답이 검증 승인 + 매도 검토일 때만 판다', () {
    expect(aiSaysSell('현대건설(000720) 분석 · 검증: 승인\n제안: 매도 검토\n\n근거'), isTrue);
    expect(aiSaysSell('현대건설(000720) 분석 · 검증: 조건부 승인\n제안: 매도 검토'), isTrue);
    expect(aiSaysSell('현대건설(000720) 분석 · 검증: 반려\n제안: 매도 검토'), isFalse);
    expect(aiSaysSell('현대건설(000720) 분석 · 검증: 승인\n제안: 보유'), isFalse);
    expect(aiSaysSell('오늘 분석 횟수를 다 썼어요'), isFalse);
    // AI가 매도 수량을 정한다 (전부 / 절반)
    expect(aiSaysSell('현대건설(000720) 분석 · 검증: 승인\n제안: 매도 검토 (절반)'), isTrue);
    expect(aiSaysSell('현대건설(000720) 분석 · 검증: 승인\n제안: 매도 검토 (전부)'), isTrue);
    expect(sellQty('… 검증: 승인\n제안: 매도 검토 (절반)', 22), 11);
    expect(sellQty('… 검증: 승인\n제안: 매도 검토 (절반)', 93), 46);
    expect(sellQty('… 검증: 승인\n제안: 매도 검토 (절반)', 1), 1); // 1주는 나눌 수 없어 전부
    expect(sellQty('… 검증: 승인\n제안: 매도 검토 (전부)', 22), 22);
    expect(sellQty('… 검증: 승인\n제안: 매도 검토', 22), 22);
  });

  test('예약 조건: 분할은 시각, 가격은 방향대로', () {
    final now = DateTime.utc(2026, 10, 12, 1, 0);
    expect(reservationDue({'kind': 'split', 'due_at': '2026-10-12T09:59:00+09:00'}, now, null), isTrue);
    expect(reservationDue({'kind': 'split', 'due_at': '2026-10-12T10:30:00+09:00'}, now, null), isFalse);
    final below = {'kind': 'price', 'trigger_price': 100000, 'direction': 'below'};
    expect(reservationDue(below, now, 99900), isTrue);
    expect(reservationDue(below, now, 100100), isFalse);
    expect(reservationDue(below, now, null), isFalse); // 현재가를 못 받으면 주문하지 않는다
    expect(reservationDue({...below, 'direction': 'above'}, now, 100100), isTrue);
  });

  test('실전 모드: 처리안 모드와 증권사가 맞을 때만 실행한다', () async {
    final keys = BrokerKeys(appKey: 'a', appSecret: 'b', account: '12345678');
    final kb = KbBroker(keys, box: SecureBox.memory());
    final mock = KisMockBroker(keys, box: SecureBox.memory());
    expect(kb.isReal && kb.realOrdersReady, isTrue);
    expect(modeMismatch(mock, 'mock', false), isNull);
    expect(modeMismatch(mock, 'real', true), contains('실전 주문을 낼 수 있는 증권사'));
    expect(modeMismatch(kb, 'real', false), contains('실전 모드가 꺼져'));
    expect(modeMismatch(kb, 'mock', false), contains('실전 계좌가 연결돼'));
    final result = await executeOrder(kb, {...order('buy', 1, 113300), 'mode': 'real'},
        unlock: () async => true, journal: OrderJournal(SecureBox.memory()));
    expect(result['status'], 'failed'); // 실전 모드가 꺼져 있으면 실전 처리안을 실행하지 않는다
    expect(AutoTrader.allowed(kb), isFalse);
    realMode.value = true;
    expect(AutoTrader.budgets, autoRealBudgets);
    expect(modeMismatch(kb, 'real', true), isNull);
    expect(AutoTrader.allowed(kb), isTrue); // 실전 모드를 직접 켰을 때만, 실전 소액 한도로
    realMode.value = false;
  });

  test('보유 종목 매도 판단: 손절선·급락·급등은 바로, 그 밖에는 30분마다 AI에게, 하루 횟수 제한', () {
    final now = DateTime.utc(2026, 10, 12, 1, 0);
    String ago(int minutes) => now.subtract(Duration(minutes: minutes)).toIso8601String();
    expect(sellReason(-7.5, {}, now), 'stop');
    expect(sellReason(-7.5, {'stopped': true}, now), 'drop'); // 손절은 한 번만, 그다음은 AI 판단
    // 강제 손절 (2026-10-15): −10%면 절반, −15%면 남은 것 전부. 한 번씩만
    expect([hardStop(-9.9, {}), hardStop(-10, {}), hardStop(-12, {'hard_half': true}), hardStop(-15.5, {'hard_half': true}),
        hardStop(-16, {'hard_half': true, 'hard_all': true})], [null, 'hard_half', null, 'hard_all', null]);
    // 하락장: 코스피가 지난 20거래일 평균 아래면 true. 오늘 날짜 값은 빼고, 20일이 안 되면 false
    final daily = [['20261015', 1.0], for (var d = 1; d <= 20; d++) ['202609${d.toString().padLeft(2, '0')}', 100.0]];
    expect(bearMarket({'value': 99.0, 'daily': daily}, '20261015'), true);
    expect(bearMarket({'value': 101.0, 'daily': daily}, '20261015'), false);
    expect(bearMarket({'value': 99.0, 'daily': daily.take(10).toList()}, '20261015'), false);
    expect(sellReason(-3.2, {'at': ago(15)}, now), 'drop'); // 급락이면 30분을 기다리지 않는다
    expect(sellReason(-3.2, {'at': ago(5)}, now), isNull); // 그래도 10분 안에 또 묻지는 않는다
    expect(sellReason(-3.5, {'at': ago(15), 'pct': -3.2}, now), isNull); // 급락이 이어지기만 하면 30분 점검까지 기다린다
    expect(sellReason(-4.3, {'at': ago(15), 'pct': -3.2}, now), 'drop'); // 1%p 더 빠지면 바로
    expect(sellReason(2.0, {}, now), 'check'); // 오른 종목도 AI가 앞을 보고 판단
    expect(sellReason(2.0, {'at': ago(20)}, now), isNull);
    expect(sellReason(2.0, {'at': ago(31)}, now), 'check');
    expect(sellReason(-3.2, {'n': 20}, now), isNull); // 하루 20번까지
    expect(sellReason(-7.5, {'n': 20}, now), 'stop'); // 손절선 질문은 횟수 제한과 상관없다 (팔지는 AI가 판단)
    // 급등도 바로 AI에게 (팔지 말지는 AI가 판단), 지난번보다 1%p 더 올랐을 때만 다시
    expect(sellReason(3.5, {'at': ago(15), 'pct': 1.0}, now), 'rise');
    expect(sellReason(3.5, {'at': ago(15), 'pct': 3.2}, now), isNull);
    expect(sellReason(4.4, {'at': ago(15), 'pct': 3.2}, now), 'rise');
    expect(sellQuestion('셀트리온', 184000, '-7.2', reason: 'stop'), contains('손절선에 닿았어'));
    expect(sellQuestion('셀트리온', 184000, '+3.5', reason: 'rise'), contains('이익을 지키고'));
    expect(sellQuestion('셀트리온', 184000, '+2.1'), contains('떨어질 가능성이 크면 지금 미리 팔'));
    expect(sellQuestion('셀트리온', 184000, '+2.1'), contains('시장 전체 흐름'));
    // 시장 급락: 30분을 기다리지 않고 묻는다. 그래도 10분 안에는 다시 안 묻는다
    expect(sellReason(-1.0, {'at': ago(15)}, now, marketDrop: true), 'market');
    expect(sellReason(-1.0, {'at': ago(5)}, now, marketDrop: true), isNull);
    expect(sellReason(-1.0, {'n': 20}, now, marketDrop: true), isNull);
  });

  test('장 시작 30분은 손절선만 묻는다 (시초가 공포성 매도 방지)', () {
    final open = DateTime.utc(2026, 10, 14, 0, 10); // 09:10 KST
    expect(sellReason(-4.0, {}, open), isNull);
    expect(sellReason(5.0, {}, open), isNull);
    expect(sellReason(-1.0, {}, open, marketDrop: true), isNull);
    expect(sellReason(-9.0, {}, open), 'stop');
    expect(sellReason(-4.0, {}, DateTime.utc(2026, 10, 14, 0, 31)), 'drop'); // 09:31부터는 평소대로
    expect(sellQuestion('셀트리온', 184000, '-4.0'), contains('저점에서 회복 중인지'));
    // 2026-10-16: +2~3%까지 갔다가 내려온 종목에 아무 질문이 없었다 (오늘 최고에서 이익 돌려줌)
    final pm = DateTime.utc(2026, 10, 16, 5, 0); // 14:00
    String pmAgo(int minutes) => pm.subtract(Duration(minutes: minutes)).toIso8601String();
    expect(sellReason(1.3, {'at': pmAgo(15), 'peak': 3.3}, pm), 'giveback');
    expect(sellReason(2.3, {'at': pmAgo(15), 'peak': 3.3}, pm), isNull); // 1%p만 내려왔으면 30분 점검까지
    expect(sellReason(0.4, {'at': pmAgo(15), 'peak': 1.8}, pm), isNull); // 최고가 +2% 안 됐으면 이익 돌려줌이 아니다
    expect(sellReason(1.0, {'at': pmAgo(15), 'peak': 3.3, 'gave': 3.3}, pm), isNull); // 같은 최고로는 한 번만
    expect(sellReason(1.0, {'at': pmAgo(15), 'peak': 3.8, 'gave': 3.3}, pm), 'giveback'); // 새 최고가 나온 뒤 다시 내려오면 또
    expect(sellReason(1.3, {'at': pmAgo(5), 'peak': 3.3}, pm), isNull); // 10분 안에는 또 묻지 않는다
    final close = DateTime.utc(2026, 10, 16, 5, 31); // 14:31
    expect(sellReason(0.5, {'at': close.subtract(const Duration(minutes: 15)).toIso8601String()}, close), 'close');
    expect(sellReason(0.5, {'at': close.subtract(const Duration(minutes: 15)).toIso8601String(), 'closed': true}, close), isNull);
    expect(sellReason(0.5, {'at': pmAgo(15)}, pm), isNull); // 14:00은 아직 마감 전 점검이 아니다
    expect(sellQuestion('HLB', 41150, '+1.3', reason: 'giveback', peak: 3.28), contains('+3.3%까지 갔다가 내려왔어'));
    expect(sellQuestion('HLB', 41150, '+1.3', reason: 'close'), contains('들고 내일로 넘어갈지'));
  });

  test('자동 승인: 매수는 승인만, 매도는 조건부 승인까지', () {
    expect(autoApproves('buy', 'approve'), isTrue);
    expect(autoApproves('buy', 'conditional'), isFalse); // 10/12 셀트리온: 숫자를 고치라는 조건부 승인으로 샀다
    expect(autoApproves('sell', 'conditional'), isTrue);
    expect(autoApproves('sell', 'reject'), isFalse);
    expect(autoApproves('buy', 'user_judgement'), isFalse);
  });

  test('시장 급락 알림: 코스피 −1.5% 아래, 지난 알림보다 1%p 더 빠질 때만', () {
    expect(marketDropped(-3.65, null), isTrue); // 10/12 종가
    expect(marketDropped(-1.2, null), isFalse);
    expect(marketDropped(null, null), isFalse); // 지수를 못 받으면 종목별 판단만
    expect(marketDropped(-2.0, -1.6), isFalse);
    expect(marketDropped(-2.7, -1.6), isTrue);
  });

  test('출처 제목 줄이기: 언론사는 괄호 속, 공시·재무는 앞부분', () {
    expect(shortSource("셀트리온 3분기 영업익 5천100억원…69.2%↑ '역대 최대'(종합) (연합뉴스)"), '연합뉴스');
    expect(shortSource('OpenDART 주요 재무 (2026년 반기보고서, 연결)'), 'OpenDART 주요 재무');
    expect(shortSource('반기보고서 (2026.06) · II. 사업의 내용'), '반기보고서');
    expect(shortSource('2026-10-07 종가 (금융위원회_주식시세정보)'), '금융위원회_주식시세정보');
  });

  test('자동 매수 금액: 종목당 총액의 35%, 하루 합계는 총액 안 (종목 수 제한 없음)', () {
    expect(buyRoom(budget: 5000000, spentToday: 0, spentOnStock: 0), 1750000);
    expect(buyRoom(budget: 5000000, spentToday: 1840000, spentOnStock: 1840000), 0); // 이 종목 몫(175만)을 다 씀
    expect(buyRoom(budget: 5000000, spentToday: 4000000, spentOnStock: 0), 1000000); // 하루 남은 총액이 더 작다
    expect([dipBuy(-3.5), dipBuy(-2.9), dipBuy(null)], [true, false, false]); // 오늘 −3% 넘게 빠진 종목은 절반만
    expect(buyRoom(budget: 5000000, spentToday: 0, spentOnStock: 0, half: true), 875000); // 절반 매수: 종목 몫의 절반만 먼저
    expect(buyRoom(budget: 5000000, spentToday: 875000, spentOnStock: 875000), 875000); // 다음에 '전부'가 나오면 나머지
    expect(buyRoom(budget: 5000000, spentToday: 5200000, spentOnStock: 0), 0);
    expect(buyRoom(budget: 0, spentToday: 0, spentOnStock: 0), 0);
    // 변동성 기준 수량 (2026-10-18): 총자산 1,000만, 하루 변동폭 4% → 1,000만 × 2% ÷ 8% = 250만. 종목당 몫(175만)보다 크면 175만
    expect(buyRoom(budget: 5000000, spentToday: 0, spentOnStock: 0, equity: 10000000, dailyVolPct: 4), 1750000);
    // 하루 변동폭 8% → 125만 (종목당 몫보다 작다), 절반 매수면 62.5만
    expect(buyRoom(budget: 5000000, spentToday: 0, spentOnStock: 0, equity: 10000000, dailyVolPct: 8), 1250000);
    expect(buyRoom(budget: 5000000, spentToday: 0, spentOnStock: 0, half: true, equity: 10000000, dailyVolPct: 8), 625000);
    // 전체 주식 비중 70%: 이미 600만 들고 있으면 100만까지만, 700만이면 0
    expect(buyRoom(budget: 5000000, spentToday: 0, spentOnStock: 0, equity: 10000000, invested: 6000000), 1000000);
    expect(buyRoom(budget: 5000000, spentToday: 0, spentOnStock: 0, equity: 10000000, invested: 7000000), 0);
    // 증권사 숫자 칸 읽기 (KIS·KB 공통): 쉼표, 소수(반올림), 빈 값
    expect([brokerInt('1,234'), brokerInt('184100.5000'), brokerInt(' 41150 '), brokerInt(null), brokerInt('')], [1234, 184101, 41150, 0, 0]);
    // 변동폭을 모르면 종목당 몫만 (예전과 같음)
    expect(buyRoom(budget: 5000000, spentToday: 0, spentOnStock: 0, equity: 10000000), 1750000);
  });

  test('자동 매도는 1회 한도 안으로 나눈다', () {
    expect(splitQty(22, 106800, 1940000), [18, 4]); // 18주 = 1,922,400원
    expect(splitQty(93, 24800, 1940000), [78, 15]);
    expect(splitQty(5, 24800, 1940000), [5]);
    expect(splitQty(3, 2500000, 1940000), isEmpty); // 1주가 한도보다 비싸다
  });

  test('자동매매는 오늘 계획을 승인해야 시작하고, 예전 기록의 보유분을 옮긴다', () async {
    final box = SecureBox.memory();
    await box.write('auto_on', 'true');
    await box.write('auto_bought:2026-10-08', jsonEncode({'000720': {'name': '현대건설', 'qty': 22}}));
    final trader = AutoTrader(box: box, now: () => DateTime.utc(2026, 10, 12, 0, 30)); // 월 09:30 KST
    await trader.load();
    expect(trader.needsPlan, isTrue);
    expect(trader.positions['000720'], {'name': '현대건설', 'qty': 22});
    await trader.approvePlan(0);
    expect(trader.needsPlan, isFalse);
    expect(jsonDecode((await box.read('auto_plan:2026-10-12'))!), {'budget': 0, 'ai_sell': true});
    await trader.cancelPlan();
    expect(trader.needsPlan, isTrue);
  });
}
