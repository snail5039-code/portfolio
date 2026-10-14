import 'broker.dart';

// 개발용 가짜 증권사. 키 없이 앱 흐름을 확인할 때 쓴다 (디버그 빌드에서만 고를 수 있다).
// 화면에는 항상 "가짜 데이터"로 표시한다. 가격 재확인·중복 방지는 broker.dart의 executeOrder가 한다.
// 가격은 2026-10-01 실제 종가(금융위원회_주식시세정보)를 고정값으로 쓴다. 실시간 가격이 아니다.

const fakeBrokerName = '가짜 증권사';

const _prices = <String, (String, int)>{
  '000270': ('기아', 113300),
  '000660': ('SK하이닉스', 1833000),
  '000810': ('삼성화재', 626000),
  '005380': ('현대차', 349000),
  '005490': ('POSCO홀딩스', 306500),
  '005930': ('삼성전자', 276000),
  '006400': ('삼성SDI', 517000),
  '009150': ('삼성전기', 1561000),
  '010120': ('LS ELECTRIC', 206000),
  '012330': ('현대모비스', 382000),
  '012450': ('한화에어로스페이스', 1034000),
  '028260': ('삼성물산', 347000),
  '032830': ('삼성생명', 284000),
  '034020': ('두산에너빌리티', 82100),
  '034730': ('SK', 587000),
  '035420': ('NAVER', 191200),
  '042660': ('한화오션', 78500),
  '042700': ('한미반도체', 268500),
  '055550': ('신한지주', 103800),
  '066570': ('LG전자', 211500),
  '068270': ('셀트리온', 183600),
  '086790': ('하나금융지주', 128300),
  '105560': ('KB금융', 166000),
  '207940': ('삼성바이오로직스', 1429000),
  '267260': ('HD현대일렉트릭', 673000),
  '298040': ('효성중공업', 2822000),
  '316140': ('우리금융지주', 33250),
  '329180': ('HD현대중공업', 431500),
  '373220': ('LG에너지솔루션', 360500),
  '402340': ('SK스퀘어', 1155000),
};

class FakeBroker implements Broker {
  int cash = 1500000;
  // 종목코드 → 수량·평균 매입가. 앱을 다시 켜면 처음 값으로 돌아간다
  final holdings = <String, ({int qty, int avgPrice})>{'005930': (qty: 3, avgPrice: 240000)};
  final _orders = <BrokerOrder>[];

  @override
  String get name => fakeBrokerName;
  @override
  bool get isFake => true;
  @override
  bool get isReal => false;
  @override
  bool get realOrdersReady => false;

  String nameOf(String code) => _prices[code]?.$1 ?? code;
  int? priceOf(String code) => _prices[code]?.$2;

  @override
  Map<String, int> get lastPrices => {for (final code in holdings.keys) code: priceOf(code) ?? 0};

  @override
  Future<Map<String, dynamic>> balance() async => {
        'cash_krw': cash,
        'holdings': [
          for (final e in holdings.entries)
            {'stock_code': e.key, 'stock_name': nameOf(e.key), 'qty': e.value.qty, 'avg_price': e.value.avgPrice},
        ],
        'fetched_at': nowIso(),
      };

  @override
  Future<Map<String, dynamic>?> intraday(String stockCode) async => null; // 가짜 증권사는 장중 흐름이 없다

  @override
  Future<List<Map<String, dynamic>>?> market() async => null; // 가짜 증권사는 시장 지수가 없다

  @override
  Future<List<String>> movers() async => []; // 가짜 증권사는 순위가 없다

  @override
  Future<int> price(String stockCode) async =>
      priceOf(stockCode) ?? (throw BrokerError('$fakeBrokerName에 없는 종목이에요 ($stockCode)'));

  @override
  Future<({String orderNo, int filledQty, int? filledPrice})> order(String side, String stockCode, int qty, int price) async {
    final amount = qty * price;
    final held = holdings[stockCode];
    if (side == 'buy') {
      if (amount > cash) throw BrokerError('현금이 부족해요');
      cash -= amount;
      final oldQty = held?.qty ?? 0;
      holdings[stockCode] = (qty: oldQty + qty, avgPrice: (oldQty * (held?.avgPrice ?? 0) + amount) ~/ (oldQty + qty));
    } else {
      if (held == null || held.qty < qty) throw BrokerError('보유 수량이 부족해요');
      cash += amount;
      if (held.qty == qty) {
        holdings.remove(stockCode);
      } else {
        holdings[stockCode] = (qty: held.qty - qty, avgPrice: held.avgPrice);
      }
    }
    final orderNo = 'FAKE-${DateTime.now().millisecondsSinceEpoch}';
    _orders.add((orderNo: orderNo, stockCode: stockCode, stockName: nameOf(stockCode), side: side, qty: qty, price: price,
        filledQty: qty, filledPrice: price,
        time: kstHhmmss(DateTime.now())));
    return (orderNo: orderNo, filledQty: qty, filledPrice: price);
  }

  /// 가짜 증권사는 주문하자마자 체결이라 정정·취소할 주문이 없다
  @override
  Future<String> revise(String orderNo, String stockCode, int? price, {int? qty}) async =>
      throw BrokerError('$fakeBrokerName 주문은 바로 체결돼서 정정·취소할 수 없어요');

  @override
  Future<List<BrokerOrder>> todayOrders(String stockCode) async =>
      [for (final o in _orders) if (stockCode.isEmpty || o.stockCode == stockCode) o];

  @override
  Future<int> buyingPower() async => cash; // 가짜 증권사는 바로 결제된다
}
