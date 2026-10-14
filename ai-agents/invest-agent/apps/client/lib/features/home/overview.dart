// 채팅 탭(대화방 목록)과 오늘 탭이 같이 쓰는 것: 계좌·오늘 한도·처리안·기록 읽기, 링 카드.
// 앱은 증권사에서 직접 읽고 서버에 스냅샷(계좌번호 없음)을 올린다. 웹은 서버 스냅샷을 본다.

import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../api/api.dart';
import '../../broker/broker.dart';
import '../../common/common.dart';

/// 분산 링의 목표 종목 수, 연속 기록 링의 목표 일수 (링이 꽉 차는 값)
const diversifyGoal = 5;
const cleanDaysGoal = 7;

typedef Overview = ({
  Map<String, dynamic>? balance, // 증권사 연결 전(앱)이면 null
  Map<String, dynamic> today, // daily_used_krw, daily_limit_krw, clean_days
  List<Map<String, dynamic>> approvals, // 승인 필요
  List<Map<String, dynamic>> executions, // 승인했지만 폰에서 실행 전
  List<Map<String, dynamic>> history,
  Map<String, dynamic>? briefing, // 가장 최근 아침 브리핑, 없으면 null
  List<Map<String, dynamic>> watchlist, // 관심 종목
  Map<String, dynamic>? close, // 가장 최근 장 마감 요약, 없으면 null
});

Future<Overview> loadOverview() async {
  Map<String, dynamic>? balance;
  final broker = currentBroker.value;
  if (kIsWeb) {
    try {
      balance = await api.get('/api/snapshot') as Map<String, dynamic>;
    } on ApiError catch (error) {
      if (error.status != 404) rethrow; // 404: 아직 폰에서 동기화한 적 없음
    }
  } else if (broker != null) {
    try {
      balance = await broker.balance();
    } catch (error) {
      throw ApiError(0, '지금 ${broker.name}에 연결할 수 없어요 ($error)');
    }
    await api.post('/api/snapshot', balance); // 웹에서 볼 수 있게 계좌번호 없이 올린다
    await syncFills(broker, get: api.get, post: api.post);
  }
  final results = await Future.wait([
    api.get('/api/orders/today'),
    api.get('/api/approvals?status=needs_approval'),
    api.get('/api/approvals?status=needs_execution'),
    api.get('/api/history'),
    api.get('/api/briefings/latest').then<Object?>((value) => value, onError: (Object error) {
      if (error is ApiError && error.status == 404) return null; // 아직 브리핑이 없음
      throw error;
    }),
    api.get('/api/watchlist'),
    api.get('/api/briefings/latest?kind=close').then<Object?>((value) => value, onError: (Object error) {
      if (error is ApiError && error.status == 404) return null;
      throw error;
    }),
  ]);
  List<Map<String, dynamic>> rows(Object? value) => (value as List).cast<Map<String, dynamic>>();
  return (
    balance: balance,
    today: results[0] as Map<String, dynamic>,
    approvals: rows(results[1]),
    executions: rows(results[2]),
    history: rows(results[3]),
    briefing: results[4] as Map<String, dynamic>?,
    watchlist: rows(results[5]),
    close: results[6] as Map<String, dynamic>?,
  );
}

/// 한국 날짜 "2026-10-07" (브리핑이 오늘 것인지 볼 때)
String kstToday() => toKst(DateTime.now()).toIso8601String().substring(0, 10);

/// 서버 시각(ISO) → 한국 날짜 "2026-10-07"
String toKstDate(String iso) => toKst(DateTime.parse(iso)).toIso8601String().substring(0, 10);

List<Map<String, dynamic>> holdingsOf(Map<String, dynamic> balance) => (balance['holdings'] as List).cast<Map<String, dynamic>>();

/// 현재가: 마지막 잔고 조회에서 받은 값, 없으면(웹) 평균 매입가로 본다
int priceOf(Map<String, dynamic> holding) =>
    currentBroker.value?.lastPrices[holding['stock_code']] ?? holding['avg_price'] as int;

({int total, int cost, int value}) totals(Map<String, dynamic> balance) {
  var cost = 0, value = 0;
  for (final h in holdingsOf(balance)) {
    cost += (h['avg_price'] as int) * (h['qty'] as int);
    value += priceOf(h) * (h['qty'] as int);
  }
  return (total: (balance['cash_krw'] as int) + value, cost: cost, value: value);
}

String signedWon(int value) => '${value > 0 ? '▲ ' : value < 0 ? '▼ ' : ''}${won(value.abs())}';
String rateText(int gain, int cost) =>
    cost == 0 ? '0.00%' : '${gain > 0 ? '+' : ''}${(gain * 100 / cost).toStringAsFixed(2)}%';

String sourceOf(Map<String, dynamic> balance) {
  final at = hhmm(balance['fetched_at'] as String);
  if (kIsWeb) return '폰 동기화 $at 기준';
  final broker = currentBroker.value!;
  return '${broker.name}${broker.isFake ? '(가짜 데이터)' : ''} · $at 기준';
}

/// 링 3개: 오늘 한도 사용(주황), 규칙에 걸린 요청 없는 날(초록), 분산(파랑)
class RingsCard extends StatelessWidget {
  const RingsCard({super.key, required this.overview, this.onTap, this.big = false, this.showTotal = true});
  final Overview overview;
  final VoidCallback? onTap;
  final bool big;
  final bool showTotal;

  @override
  Widget build(BuildContext context) {
    final today = overview.today;
    final limit = today['daily_limit_krw'] as int;
    final usedPct = limit == 0 ? 0 : (today['daily_used_krw'] as int) * 100 ~/ limit;
    final clean = today['clean_days'] as int;
    final balance = overview.balance;
    final stocks = balance == null ? 0 : holdingsOf(balance).length;
    final t = balance == null ? null : totals(balance);
    final gain = t == null ? 0 : t.value - t.cost;

    final legend = Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      _legend(coachOrange, '오늘 한도 $usedPct% (${won(today['daily_used_krw'] as int)} / ${won(limit)})'),
      _legend(calmGreen, '규칙에 걸린 요청 없이 $clean일째'),
      _legend(brandBlue, '분산 $stocks / $diversifyGoal종목'),
    ]);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            SizedBox.square(
              dimension: big ? 132 : 104,
              child: CustomPaint(painter: _Rings([usedPct / 100, clean / cleanDaysGoal, stocks / diversifyGoal])),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (t != null && showTotal) ...[
                  const Text('총 자산', style: TextStyle(fontSize: 12, color: mutedText)),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(won(t.total), style: const TextStyle(fontFamily: displayFont, fontSize: 26)),
                  ),
                  Text('${signedWon(gain)} (${rateText(gain, t.cost)})',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: changeColor(gain))),
                  const SizedBox(height: 6),
                ],
                legend,
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _legend(Color color, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 2),
        child: Row(children: [
          Icon(Icons.circle, size: 8, color: color),
          const SizedBox(width: 6),
          Flexible(child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color.lerp(color, ink, 0.35)))),
        ]),
      );
}

class _Rings extends CustomPainter {
  _Rings(this.fractions);
  final List<double> fractions;
  static const colors = [coachOrange, calmGreen, brandBlue];

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.11;
    final center = size.center(Offset.zero);
    for (var i = 0; i < 3; i++) {
      final radius = size.width / 2 - stroke / 2 - i * (stroke + 2);
      final rect = Rect.fromCircle(center: center, radius: radius);
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round;
      canvas.drawArc(rect, 0, 2 * pi, false, paint..color = colors[i].withValues(alpha: 0.18));
      final f = fractions[i].clamp(0.0, 1.0);
      if (f > 0) canvas.drawArc(rect, -pi / 2, 2 * pi * f, false, paint..color = colors[i]);
    }
  }

  @override
  bool shouldRepaint(_Rings old) => old.fractions.toString() != fractions.toString();
}
