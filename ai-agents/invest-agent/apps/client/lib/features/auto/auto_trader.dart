// 모의투자 자동매매 (docs/plan/12-todo-by-stage.md 3-4). 모의투자(KIS 모의·가짜 증권사)에서만 켤 수 있다 (AGENTS.md 1장).
//
// 매일 사용자 승인이 먼저다: 그날 "오늘 계획"(살 총액, AI 매도 허용)을 사용자가 승인해야 사고판다. 승인이 없으면 아무것도 안 한다.
// 사는 것: 오늘 아침 브리핑에서 투자 AI가 매수 검토로 쓰고 검증 AI가 승인·조건부 승인한 종목만, 승인한 총액 안에서.
//   장중 autoRescanSlots에 브리핑을 다시 만들어 새 후보도 산다. 몇 종목을 살지는 AI 판단에 맡기고(개수 제한 없음), 종목당 총액의 autoMaxStockPct%까지, 하루 합계는 승인한 총액 안
// 파는 것 (AI 매도를 허용했을 때, 2026-10-12 사용자 결정: 팔 종목·시점을 사람이 정하지 않고 AI가 앞을 보고 판단): 자동매매로 산 종목을
//   autoReviewGap마다(장중 급락 −autoDropPct%면 바로) 투자 AI에게 "앞으로 떨어질 가능성이 크면 미리 팔지"를 분석시키고(sellQuestion),
//   제안이 '매도 검토'이고 검증 AI가 승인·조건부 승인일 때만 판다. 매입가 대비 −autoStopLossPct% 이하면 AI에게 묻지 않고 판다(손절)
// 사고파는 방법: 사람이 채팅에 "○○ N주 사줘/팔아줘"라고 한 것과 똑같은 주문 흐름을 앱이 대신 돌린다
//   → 주문 때 다시 투자 AI → 검증 AI → 정책 검사(1회 한도, 비중, 장 시간) → 처리안
//   → 처리안이 검증 승인·조건부 승인이고 따로 확인받을 것(성향 초과, 검증 반려, 급등 재확인)이 없을 때만 자동 승인
//   → 폰이 가격 재확인 후 주문. 폰 잠금 확인은 사용자가 자동매매를 켜고 오늘 계획을 승인한 것으로 대신한다 (모의투자라서)
//   손절도 같은 주문 흐름(투자 AI → 검증 AI → 정책 검사)을 지나고, 검증이 반려하면 자동으로 팔지 않고 사람에게 넘긴다.
//   AI에게 묻는 것은 종목마다 30분에 한 번, 하루 autoMaxReviews번까지 (Gemini 비용)
// 1회 한도를 넘는 금액은 사든 팔든 여러 번에 나눠 주문한다. 끄면 다음 단계부터 바로 멈춘다. 한 일은 모두 오늘 기록(log)에 남는다.

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../api/api.dart';
import '../../broker/broker.dart';
import '../../broker/kis_mock_broker.dart';
import '../../secure/key_store.dart';
import '../chat/conversation.dart';
import '../../common/common.dart';

// 한 종목에 쓰는 최대 몫 (살 총액의 %). 서버의 한 종목 비중 40% 규칙에 막히지 않게 그 아래로.
// 2026-10-13 사용자 결정: 하루 3종목 제한을 없애고 몇 종목을 살지는 AI가 판단한다
const autoMaxStockPct = 35;
// 0 = 오늘은 사지 않음, autoAllCash = 주문 가능 금액 전부 (판 돈도 바로 다시 산다. 모의투자, 2026-10-13 사용자 결정)
const autoAllCash = -1;
const autoBudgets = [0, 1000000, 3000000, 5000000, autoAllCash];

String budgetLabel(int v) => v == 0 ? '사지 않음' : v == autoAllCash ? '주문 가능 금액 전부 (판 돈 포함)' : won(v);
// 4-3 실전 자동매매 (사용자 결정: 앱이 켜져 있을 때만 소액). 하루 총액과 1건 금액을 모의보다 작게 (서버 REAL_AUTO_MAX와 같은 30만 원)
const autoRealBudgets = [0, 100000, 300000, 500000];
const autoRealMaxOrder = 300000;
const autoDropPct = 3; // 매입가보다 이만큼(%) 넘게 내리면 AI에게 매도 판단을 묻는다
// 매입가보다 이만큼(%) 내리면 손절선이라 바로 AI에게 묻는다. 파는 것도 AI 판단·검증을 거친다 (2026-10-13 사용자 결정, 전에는 AI 없이 팔았다)
const autoStopLossPct = 7;
const autoOpeningWaitMin = 30; // 장 시작 뒤 이 분까지는 손절선 말고는 매도 판단을 묻지 않는다
const autoRisePct = 3; // 매입가보다 이만큼(%) 넘게 오르면 바로 AI에게 "지금 팔아 이익을 지킬지" 묻는다 (2026-10-13 사용자 요청)
// 오늘 매입가 대비 최고 +autoGivebackFromPct% 넘게 갔다가 거기서 autoGivebackPct%p 넘게 내려오면 바로 묻는다.
// 2026-10-16: 4종목이 +2~3%까지 갔다가 내려왔는데, 매입가 기준 ±3%만 봐서 아무 질문도 없었다
const autoGivebackFromPct = 2.0;
const autoGivebackPct = 1.5;
const autoCloseCheckMin = 14 * 60 + 30; // 이 시각에 보유 종목마다 한 번 "들고 넘어갈지" 마감 전 점검 (장 마감 15:30)
// 코스피가 전일보다 이만큼(%) 넘게 빠지면 보유 종목 전부를 30분 기다리지 않고 AI에게 묻는다 (10/8 −2.62%, 10/12 −3.65% 날 손실)
const autoMarketDropPct = 1.5;
// 이 시각이 지나면 브리핑을 다시 만들어 새 매수 후보를 찾는다 (서버는 1시간에 한 번까지). 2026-10-13: 두 번뿐이라 오후 내내 살 후보가 없었다
const autoRescanSlots = [10 * 60, 11 * 60, 12 * 60, 13 * 60, 14 * 60, 14 * 60 + 35];
const autoBuyRetryGap = Duration(minutes: 30); // AI가 '관찰'이라 안 산 종목도 이만큼 지나면 새 판단으로 다시 묻는다
const autoReviewGap = Duration(minutes: 30);
const autoMaxReviews = 20; // 종목마다 하루에 묻는 횟수 (30분마다 + 급락 재질문, 서버 하루 분석 한도 100 안)
const _watchGap = Duration(minutes: 5); // 잔고 조회가 느려서(모의 12초) 5분마다만 본다

/// 자동으로 승인해도 되는 검증 판정. 매수는 '승인'만, 매도(위험을 줄이는 쪽)는 '조건부 승인'까지.
/// 2026-10-12 셀트리온: "숫자를 원문에 맞게 고쳐라"는 조건부 승인을 자동매매가 승인처럼 보고 샀다 (조건을 아무도 확인하지 않음)
bool autoApproves(String side, Object? verdict) => verdict == 'approve' || (side == 'sell' && verdict == 'conditional');

/// 분석 답의 첫 두 줄("… 분석 · 검증: 승인", "제안: 매도 검토")로 AI가 지금 팔자고 했는지 본다
/// ponytail: 서버 답 문장(analysis.format_analysis)에 기댄다. 문장이 바뀌면 여기와 테스트가 같이 깨진다
bool aiSaysSell(String analysis) {
  final lines = analysis.split('\n');
  if (lines.length < 2) return false;
  final verified = lines[0].endsWith('검증: 승인') || lines[0].endsWith('검증: 조건부 승인');
  return verified && (lines[1].trim() == '제안: 매도 검토' || lines[1].trim().startsWith('제안: 매도 검토 ('));
}

/// AI가 정한 매도 수량: "제안: 매도 검토 (절반)"이면 절반(1주면 1주), 아니면 전부 (2026-10-12 사용자: 나눠 팔아도 된다)
int sellQty(String analysis, int qty) {
  final lines = analysis.split('\n');
  final half = lines.length > 1 && lines[1].trim() == '제안: 매도 검토 (절반)';
  return half && qty > 1 ? qty ~/ 2 : qty;
}

/// 시장 급락 알림: 코스피가 −autoMarketDropPct% 아래이고, 지난번 알림보다 1%p 더 빠졌을 때만 (계속 빠진 채면 다시 안 묻는다)
bool marketDropped(double? kospiPct, double? lastAlertPct) =>
    kospiPct != null && kospiPct <= -autoMarketDropPct && (lastAlertPct == null || kospiPct <= lastAlertPct - 1);

/// 보유 종목 하나를 지금 어떻게 볼지. 모두 AI에게 묻고, AI가 팔자고 하고 검증 AI가 승인할 때만 판다.
/// 'stop'(손절선, 한 번은 횟수 제한 없이 바로), 'drop'(급락, 바로), 'rise'(급등, 바로), 'market'(시장 급락, 바로),
/// 'giveback'(오늘 최고에서 이익을 돌려줌, 바로), 'close'(14:30 마감 전 점검, 하루 한 번),
/// 'check'(정기 점검, autoReviewGap마다), null(아직 물을 때가 아님).
/// seen: 오늘 이 종목에 한 일 {n: AI에게 물은 횟수, at: 마지막으로 물은 시각, pct: 그때 매입가 대비 %, stopped: 손절 시도함,
///   peak: 오늘 본 매입가 대비 최고 %, gave: 이익 돌려줌으로 물었을 때의 peak, closed: 마감 전 점검 함}
/// 급락이 계속되는 종목을 10분마다 묻지 않게, 지난번보다 1%p 더 빠졌을 때만 30분 전에 다시 묻는다 (하루 횟수가 금방 바닥나서)
String? sellReason(double dropPct, Map<String, dynamic> seen, DateTime now, {bool marketDrop = false}) {
  if (dropPct <= -autoStopLossPct && seen['stopped'] != true) return 'stop';
  if ((seen['n'] as int? ?? 0) >= autoMaxReviews) return null;
  // 장 시작 30분(09:00~09:30)은 손절선만 묻는다. 10/13 시초가 급락 때 판 종목이 모두 종가가 더 높았다 (공포성 매도)
  final kst = toKst(now);
  if (kst.hour == 9 && kst.minute < autoOpeningWaitMin) return null;
  final last = DateTime.tryParse(seen['at'] as String? ?? '');
  final lastPct = (seen['pct'] as num?)?.toDouble();
  final waited = last == null || now.difference(last) >= const Duration(minutes: 10);
  if (dropPct <= -autoDropPct && (lastPct == null || dropPct <= lastPct - 1) && waited) return 'drop';
  if (dropPct >= autoRisePct && (lastPct == null || dropPct >= lastPct + 1) && waited) return 'rise';
  final peak = (seen['peak'] as num?)?.toDouble();
  final gave = (seen['gave'] as num?)?.toDouble(); // 지난번 이익 돌려줌 질문 때의 최고. 새 최고가 나와야 다시 묻는다
  if (peak != null && peak >= autoGivebackFromPct && peak - dropPct >= autoGivebackPct && (gave == null || peak > gave) && waited) {
    return 'giveback';
  }
  if (marketDrop && waited) return 'market';
  if (kst.hour * 60 + kst.minute >= autoCloseCheckMin && seen['closed'] != true && waited) return 'close';
  return last == null || now.difference(last) >= autoReviewGap ? 'check' : null;
}

/// AI에게 보내는 매도 판단 질문. 정해진 숫자가 아니라 앞으로의 흐름을 보고 판단하게 한다 (2026-10-12 사용자 요청)
String sellQuestion(String name, int avg, String pct, {String reason = 'check', double? peak}) =>
    '$name 보유 중이야 (매입가 ${won(avg)}, 지금 $pct%). '
    '${reason == 'giveback' && peak != null ? '오늘 매입가 대비 +${peak.toStringAsFixed(1)}%까지 갔다가 내려왔어. ' : ''}${_why[reason] ?? ''}앞으로 몇 시간~며칠 안에 떨어질 가능성이 크면 지금 미리 팔아서 '
    '이익을 지키거나 손실을 막아야 하고, 더 오를 근거가 크면 계속 들고 있어야 해. 지금 팔아 확정하는 것과 들고 가는 것을 '
    '똑같이 비교해서 더 나은 쪽을 골라 줘 (보유가 기본값이 아니야). 장중 흐름(고점에서 밀리는지, 하락이 이어지는지), '
    '시장 전체 흐름(코스피·코스닥 지수, 며칠 연속 하락인지, 오른·내린 종목 수), 뉴스, 공시를 근거로 지금 팔아야 할까? '
    '급락 직후라면 지금 가격이 오늘 저점 근처인지, 저점에서 회복 중인지도 봐 줘. 공포에 저점에서 파는 건 피해야 해. '
    '판다면 전부 팔지 절반만 덜지도 정해 줘';

const _why = {
  'stop': '매입가 대비 −$autoStopLossPct% 손절선에 닿았어. 손실을 더 키우지 않게 팔지, 반등 근거가 확실해서 들고 갈지 판단해 줘. ',
  'rise': '짧은 시간에 많이 올랐어. 지금이 고점이라 곧 밀릴 것 같으면 미리 팔아 이익을 지키고, 더 오를 근거가 크면 들고 있어. ',
  'drop': '매입가보다 크게 내렸어. ',
  'market': '시장 전체가 급하게 빠지고 있어. ',
  'giveback': '오른 이익을 지킬지, 다시 오를 근거가 있어 들고 있을지 판단해 줘. ',
  'close': '곧 장이 끝나. 오늘 흐름을 보고 이대로 들고 내일로 넘어갈지 판단해 줘. ',
};

// 변동성 기준 수량과 전체 주식 비중 상한 (2026-10-18 사용자 결정, 1년 백테스트: 최대 낙폭 −51% → −33%, 6개 조건 모두 이익)
const autoRiskPct = 2; // 평소 하루 변동의 2배만큼 빠지면 계좌(총자산)의 이만큼(%)만 잃게 산다
const autoMaxExposurePct = 70; // 주식 평가액이 총자산의 이만큼(%)을 넘게 사지 않는다

/// 이 종목에 지금 더 쓸 수 있는 금액: 종목당 몫에서 이미 산 만큼 빼고, 하루 남은 총액과 전체 주식 비중 상한을 넘지 않게.
/// 종목당 몫 = 총액의 autoMaxStockPct%와 변동성 몫(총자산 × autoRiskPct% ÷ (2 × 하루 변동폭 %)) 중 작은 것.
/// half: 투자 AI가 절반 매수를 골랐다 (추세는 좋지만 위험도 클 때 나눠 사기, 2026-10-14). 다음 판단이 '전부'면 나머지를 산다.
/// equity(총자산)·invested(지금 주식 평가액)·dailyVolPct(최근 20일 하루 변동폭 %)를 모르면 그 제한은 건너뛴다
int buyRoom({required int budget, required int spentToday, required int spentOnStock, bool half = false,
    int? equity, int invested = 0, double? dailyVolPct}) {
  var stockCap = budget * autoMaxStockPct ~/ 100;
  if (equity != null && dailyVolPct != null && dailyVolPct > 0) {
    final volCap = (equity * autoRiskPct / (2 * dailyVolPct)).floor();
    if (volCap < stockCap) stockCap = volCap;
  }
  final perStock = (half ? stockCap ~/ 2 : stockCap) - spentOnStock;
  var room = perStock < budget - spentToday ? perStock : budget - spentToday;
  if (equity != null) {
    final exposureLeft = equity * autoMaxExposurePct ~/ 100 - invested;
    if (exposureLeft < room) room = exposureLeft;
  }
  return room > 0 ? room : 0;
}

/// 오늘 이만큼(%) 넘게 빠진 종목을 사면 절반만 (급락일 반등 매수, 2026-10-15 사용자 요청). 다시 빠질 수 있어서 수량을 줄인다
const autoDipPct = 3;
bool dipBuy(double? todayPct) => todayPct != null && todayPct <= -autoDipPct;

/// 하락장: 코스피가 지난 20거래일 종가 평균 아래면 종목당 사는 몫을 절반으로 (2026-10-15 사용자 결정, Faber 추세 필터).
/// daily는 [YYYYMMDD, 종가] 최신부터. 오늘 것은 빼고 본다 (KIS 모의 일별 지수가 늦게 와도 지난 값만 쓴다)
bool bearMarket(Map<String, dynamic>? kospi, String todayYmd) {
  final value = (kospi?['value'] as num?)?.toDouble();
  final past = [for (final d in (kospi?['daily'] as List? ?? [])) if ('${d[0]}'.compareTo(todayYmd) < 0) (d[1] as num).toDouble()];
  if (value == null || past.length < 20) return false;
  return value < past.take(20).reduce((a, b) => a + b) / 20;
}

/// 강제 손절 (2026-10-15 사용자 결정): 매입가 대비 −autoHardStopPct%면 AI에게 팔지 묻지 않고 절반, −autoHardStopAllPct%면 남은 것 전부.
/// 10/15 NH투자증권 −9.16%에서 AI가 매번 "공포 매도 피하기"로 보유해 −7% 손절선이 걸리지 않았다. 주문은 그래도 검증 AI를 거친다
const autoHardStopPct = 10;
const autoHardStopAllPct = 15;
String? hardStop(double dropPct, Map<String, dynamic> seen) {
  if (dropPct <= -autoHardStopAllPct && seen['hard_all'] != true) return 'hard_all';
  if (dropPct <= -autoHardStopPct && seen['hard_half'] != true) return 'hard_half';
  return null;
}

/// qty주를 1회 한도(maxOrder원) 안으로 나눈 주문 수량들. 1주 값이 한도보다 비싸면 빈 목록
List<int> splitQty(int qty, int price, int maxOrder) {
  final chunk = price > 0 ? maxOrder ~/ price : 0;
  if (chunk < 1) return [];
  return [for (var left = qty; left > 0; left -= chunk) left < chunk ? left : chunk];
}

class AutoTrader extends ChangeNotifier {
  AutoTrader({SecureBox? box, DateTime Function()? now}) : _box = box ?? secureBox, _now = now ?? DateTime.now;

  final SecureBox _box;
  final DateTime Function() _now;
  bool on = false;
  int budgetKrw = 1000000; // 오늘 계획을 고를 때 처음 보여 줄 총액 (지난번 승인한 값)
  List<String> log = [];
  Map<String, dynamic>? plan; // 오늘 승인한 계획 {budget: 원, ai_sell: AI 매도 허용}. null이면 아직 승인 안 함
  Map<String, dynamic> positions = {}; // 자동매매로 사서 아직 안 판 것 {종목코드: {name, qty}} (날짜를 넘겨 남는다)
  bool _busy = false;
  Timer? _timer;
  DateTime? _lastWatch;

  /// 모의투자이거나, 실전 모드를 켰고 실전 주문 준비가 된 증권사일 때 켤 수 있다 (4-3)
  static bool allowed(Broker? broker) =>
      broker != null && (broker.isFake || broker is KisMockBroker || (realMode.value && broker.isReal && broker.realOrdersReady));

  static List<int> get budgets => realMode.value ? autoRealBudgets : autoBudgets;

  DateTime get _kst => toKst(_now());
  String get _today => _kst.toIso8601String().substring(0, 10);

  /// 켜져 있고 평일인데 오늘 계획을 아직 승인하지 않았다 (화면이 사용자에게 묻는다)
  bool get needsPlan => on && plan == null && _kst.weekday <= 5;

  Future<void> load() async {
    on = await _box.read('auto_on') == 'true';
    budgetKrw = int.tryParse(await _box.read('auto_budget_krw') ?? '') ?? budgetKrw;
    log = ((jsonDecode(await _box.read('auto_log:$_today') ?? '[]') as List)).cast<String>();
    final saved = await _box.read('auto_plan:$_today');
    plan = saved == null ? null : jsonDecode(saved) as Map<String, dynamic>;
    final held = await _box.read('auto_positions');
    positions = held != null ? jsonDecode(held) as Map<String, dynamic> : await _legacyPositions();
    notifyListeners();
  }

  /// 예전 형식(그날 산 것만 auto_bought:날짜에 적던 때)에서 최근 2주치를 옮긴다
  Future<Map<String, dynamic>> _legacyPositions() async {
    final merged = <String, dynamic>{};
    for (var d = 0; d < 14; d++) {
      final day = _kst.subtract(Duration(days: d)).toIso8601String().substring(0, 10);
      final bought = jsonDecode(await _box.read('auto_bought:$day') ?? '{}') as Map<String, dynamic>;
      for (final e in bought.entries) {
        final qty = ((merged[e.key] as Map?)?['qty'] as int? ?? 0) + ((e.value as Map)['qty'] as int);
        merged[e.key] = {'name': (e.value as Map)['name'], 'qty': qty};
      }
    }
    if (merged.isNotEmpty) await _box.write('auto_positions', jsonEncode(merged));
    return merged;
  }

  Future<void> setOn(bool value) async {
    on = value;
    await _box.write('auto_on', '$value');
    await _note(value ? '자동매매를 켰어요. 오늘 계획을 승인하면 시작해요' : '자동매매를 껐어요');
    if (value) unawaited(tick());
  }

  /// 사용자가 오늘 계획을 승인했다: 살 총액(0이면 안 삼), AI 판단 매도·손절 허용
  Future<void> approvePlan(int budget, {bool aiSell = true}) async {
    plan = {'budget': budget, 'ai_sell': aiSell};
    if (budget != 0) budgetKrw = budget;
    await _box.write('auto_plan:$_today', jsonEncode(plan));
    await _box.write('auto_budget_krw', '$budgetKrw');
    await _note('오늘 계획 승인: ${budget == 0 ? '매수 안 함' : '${budgetLabel(budget)}까지 매수'}'
        '${aiSell ? ', 보유 종목은 AI가 매도 판단 (−$autoStopLossPct% 손절선 포함)' : ', 매도 안 함'}');
    unawaited(tick());
  }

  /// 오늘 계획을 거둔다. 이미 낸 주문은 그대로고 다음 단계부터 멈춘다
  Future<void> cancelPlan() async {
    plan = null;
    await _box.delete('auto_plan:$_today');
    await _note('오늘 계획을 취소했어요');
  }

  /// 앱이 켜져 있는 동안 1분마다 확인한다
  void start() {
    _timer ??= Timer.periodic(const Duration(minutes: 1), (_) => tick());
    unawaited(tick());
  }

  /// 장중(09:05~15:28, 평일)이고 오늘 계획을 승인했으면: 정규장 연속 매매가 끝나는 15:20 전까지 사고, AI 매도를 허용했으면 보유 종목을 점검한다
/// (2026-10-13 사용자 결정: 15:00에 멈추지 않고 장 끝까지 사고판다. 15:20~15:30 동시호가에는 사지 않는다)
  Future<void> tick() async {
    if (!on || _busy || kIsWeb || !allowed(currentBroker.value)) return;
    final k = _kst;
    final minutes = k.hour * 60 + k.minute;
    if (k.weekday > 5 || minutes < 9 * 60 + 5 || minutes > 15 * 60 + 28) return; // 휴장일은 서버 정책 검사가 막는다
    if (plan == null) return; // 사용자가 오늘 계획을 승인하기 전에는 아무것도 하지 않는다
    _busy = true;
    try {
      if (minutes < 15 * 60 + 20) {
        await _rescan(minutes);
        await _buy(plan!['budget'] as int);
      }
      if (plan?['ai_sell'] == true) await _review();
    } catch (error) {
      await _note('자동매매 중 오류: $error');
    } finally {
      _busy = false;
    }
  }

  /// 1회 한도보다 조금 작게 (전날 종가로 수량을 정하므로 오늘 값이 오르면 한도를 넘을 수 있어서)
  Future<int> _maxOrder() async {
    final policy = ((await api.get('/api/policy') as Map)['max_order_krw'] as int) * 97 ~/ 100;
    return realMode.value && policy > autoRealMaxOrder ? autoRealMaxOrder : policy; // 실전 자동 주문은 1건 30만 원까지
  }

  /// 긴급 중단: 자동매매를 끄고 오늘 계획을 거둔다 (서버의 예약·승인 대기는 safety_page가 함께 정리)
  Future<void> stopAll() async {
    if (plan != null) await cancelPlan();
    if (on) await setOn(false);
  }

  /// 장중 매수 후보 다시 찾기: 정해진 시각이 지나면 한 번씩 서버에 브리핑을 다시 만들게 한다 (실패해도 아침 후보로 계속)
  Future<void> _rescan(int minutes) async {
    if ((plan!['budget'] as int) == 0) return;
    final done = ((jsonDecode(await _box.read('auto_rescan:$_today') ?? '[]') as List)).cast<int>();
    final slot = autoRescanSlots.lastWhere((s) => minutes >= s, orElse: () => -1);
    if (slot < 0 || done.contains(slot)) return;
    await _box.write('auto_rescan:$_today', jsonEncode([...done, slot])); // 먼저 적어 둔다 (실패해도 같은 시각에 다시 부르지 않게)
    await _note('장중 매수 후보를 다시 찾아요 (투자 AI → 검증 AI)');
    try {
      // 지금 많이 움직이는 종목(거래대금·상승률 상위)도 후보로 보낸다. 서버가 분석 대상 안에서만 고른다
      var movers = <String>[];
      try {
        movers = await currentBroker.value!.movers();
      } catch (_) {
        movers = []; // 순위를 못 받아도 원래 후보로 다시 찾는다
      }
      final briefing = await api.post('/api/briefings/refresh', {'candidates': movers}) as Map<String, dynamic>;
      // 아침에 '관찰'이라 오늘 끝낸 종목도 새 판단으로 다시 시도한다 (2026-10-13: 12:01에 매수 검토가 나왔는데 09:10 기록 때문에 안 샀다)
      await _box.write('auto_settled2:$_today', '{}');
      final content = briefing['content'] as Map;
      final picks = (content['picks'] as List).cast<Map<String, dynamic>>();
      final rechecks = (content['rechecks'] as List? ?? []).cast<Map<String, dynamic>>();
      await _note(picks.isEmpty ? '새로 검증을 통과한 매수 후보가 없어요' : '새 매수 후보: ${picks.map((p) => p['stock_name']).join(', ')}');
      if (rechecks.isNotEmpty) await _note('상승 추세라 실시간으로 다시 볼 종목: ${rechecks.map((p) => p['stock_name']).join(', ')}');
    } on ApiError catch (error) {
      await _note('매수 후보 다시 찾기 실패: $error');
    }
  }

  Future<void> _buy(int budget) async {
    if (budget == 0) return;
    final Map<String, dynamic> briefing;
    try {
      briefing = await api.get('/api/briefings/latest') as Map<String, dynamic>;
    } on ApiError {
      return; // 아직 브리핑이 없다
    }
    if (briefing['brief_date'] != _today) return;
    // 오늘 판단을 끝낸 종목과 그 시각. autoBuyRetryGap이 지나면 다시 묻는다 (사는 판단도 주기적으로)
    final done = (jsonDecode(await _box.read('auto_settled2:$_today') ?? '{}') as Map).cast<String, dynamic>();
    bool settled(String code) => (DateTime.tryParse(done[code] as String? ?? '') ?? DateTime(2000))
        .isAfter(_now().subtract(autoBuyRetryGap));
    final bought = (jsonDecode(await _box.read('auto_bought:$_today') ?? '{}') as Map).cast<String, dynamic>();
    // rechecks: 서버가 상승 추세인데 관찰로 본 종목. 실시간 시세로 다시 판단하면 반등을 볼 수 있다 (2026-10-15, 사면 절반)
    final content = briefing['content'] as Map;
    final picks = [...(content['picks'] as List), ...(content['rechecks'] as List? ?? [])].cast<Map<String, dynamic>>()
        // 브리핑(서버만, 실시간 시세 없음)의 조건부 승인은 후보까지. 실제 주문 때 실시간 시세·지수로 다시 검증해 '승인'일 때만 산다
        .where((p) => const {'approve', 'conditional'}.contains(p['verdict'])).toList();
    bool skip(Map<String, dynamic> p) => settled(p['stock_code'] as String);
    if (picks.every(skip)) return;
    // 오늘 쓴 금액 (예전 기록에 없으면 산 수량 × 브리핑 종가로 처음 한 번 계산)
    var spent = int.tryParse(await _box.read('auto_spent:$_today') ?? '') ??
        bought.entries.fold<int>(0, (sum, e) => sum + ((e.value as Map)['qty'] as int) *
            (picks.where((p) => p['stock_code'] == e.key).firstOrNull?['last_close'] as int? ?? 0));
    // 주문 가능 금액 전부: 오늘 쓴 돈 + 지금 쓸 수 있는 현금 (AI가 판 돈도 들어온다)
    if (budget == autoAllCash) budget = spent + await currentBroker.value!.buyingPower();
    final maxOrder = await _maxOrder();
    // 총자산과 지금 주식 평가액 (변동성 몫·비중 상한용). 잔고를 못 받으면 예전처럼 종목당 몫만 본다
    int? equity;
    var invested = 0;
    try {
      final broker = currentBroker.value!;
      final balance = await broker.balance();
      for (final h in (balance['holdings'] as List).cast<Map<String, dynamic>>()) {
        invested += (h['qty'] as int) * (broker.lastPrices[h['stock_code']] ?? h['avg_price'] as int);
      }
      equity = (balance['cash_krw'] as int) + invested;
    } catch (_) {
      equity = null;
    }
    var bear = false;
    try {
      bear = bearMarket((await currentBroker.value!.market())?.where((m) => m['index'] == 'KOSPI').firstOrNull, kstYmd(_now()));
    } catch (_) {
      bear = false; // 지수를 못 받으면 평소대로
    }
    for (final pick in picks.where((p) => !skip(p))) {
      if (!on || plan == null) break;
      final code = pick['stock_code'] as String, name = pick['stock_name'] as String;
      final close = pick['last_close'] as int? ?? 0;
      // 오늘 크게 빠진 종목(반등 매수)은 절반만 산다. 시세를 못 받으면 브리핑 판단대로
      double? todayPct;
      try {
        todayPct = ((await currentBroker.value!.intraday(code))?['change_pct'] as num?)?.toDouble();
      } catch (_) {
        todayPct = null;
      }
      // 종목당 몫에서 오늘 이미 산 만큼 빼고, 하루 남은 총액을 넘지 않게 (다시 시도할 때 두 번 사지 않게)
      var left = buyRoom(budget: budget, spentToday: spent, spentOnStock: ((bought[code] as Map?)?['qty'] as int? ?? 0) * close,
          half: pick['portion'] == 'half' || dipBuy(todayPct) || bear,
          equity: equity, invested: invested, dailyVolPct: (pick['daily_vol_pct'] as num?)?.toDouble());
      if (left == 0 && equity != null && invested >= equity * autoMaxExposurePct ~/ 100 &&
          await _box.read('auto_exposure_note:$_today') == null) {
        await _box.write('auto_exposure_note:$_today', '1'); // 하루 한 번만 알린다
        await _note('주식 비중이 총자산의 $autoMaxExposurePct%에 닿아 더 사지 않아요 (팔아서 비중이 내려가면 다시 삼)');
      }
      if (bear && pick == picks.firstWhere((p) => !skip(p))) await _note('코스피가 20일 평균 아래(하락장)라 종목당 몫의 절반만 사요');
      while (on && plan != null) {
        final qty = close > 0 ? (left < maxOrder ? left : maxOrder) ~/ close : 0;
        if (qty < 1) break;
        final result = await _order(name, qty, 'buy');
        if (result != true) break;
        bought[code] = {'name': name, 'qty': ((bought[code] as Map?)?['qty'] as int? ?? 0) + qty};
        await _box.write('auto_bought:$_today', jsonEncode(bought));
        spent += qty * close;
        invested += qty * close;
        await _box.write('auto_spent:$_today', '$spent');
        await _addPosition(code, name, qty);
        left -= qty * close;
      }
      // 판단을 끝냈든 오류(AI 사용량 제한 등)로 멈췄든 autoBuyRetryGap 뒤에 남은 금액만큼 다시 묻는다
      // (2026-10-13: 오류도 하루 3번 횟수에 들어가 14:06 이후 다시 시도하지 않았다)
      if (on && plan != null) {
        done[code] = _now().toIso8601String();
        await _box.write('auto_settled2:$_today', jsonEncode(done));
      }
    }
  }

  Future<void> _addPosition(String code, String name, int qty) async {
    final left = ((positions[code] as Map?)?['qty'] as int? ?? 0) + qty;
    if (left > 0) {
      positions[code] = {'name': name, 'qty': left};
    } else {
      positions.remove(code);
    }
    await _box.write('auto_positions', jsonEncode(positions));
    notifyListeners();
  }

  /// 보유 종목 점검: 손절선 아래면 팔고, 급락했거나 점검 시각이면 AI에게 매도 판단을 묻고 팔자고 하면 판다
  Future<void> _review() async {
    if (positions.isEmpty || (_lastWatch != null && _now().difference(_lastWatch!) < _watchGap)) return;
    _lastWatch = _now();
    final broker = currentBroker.value!;
    final holdings = ((await broker.balance())['holdings'] as List).cast<Map<String, dynamic>>();
    final reviews = (jsonDecode(await _box.read('auto_reviews:$_today') ?? '{}') as Map).cast<String, dynamic>();
    // 시장 급락이면 보유 종목을 모두 바로 묻는다. 지수를 못 받으면 종목별 판단만 한다
    double? kospi;
    try {
      kospi = ((await broker.market())?.where((m) => m['index'] == 'KOSPI').firstOrNull?['change_pct'] as num?)?.toDouble();
    } catch (_) {
      kospi = null;
    }
    final marketDrop = marketDropped(kospi, ((reviews['_market'] as Map?)?['pct'] as num?)?.toDouble());
    if (marketDrop) {
      reviews['_market'] = {'pct': kospi, 'at': _now().toIso8601String()};
      await _box.write('auto_reviews:$_today', jsonEncode(reviews));
      await _note('코스피 ${kospi!.toStringAsFixed(2)}%: 시장 급락이라 보유 종목을 모두 투자 AI·검증 AI에게 다시 물어요');
    }
    for (final code in positions.keys.toList()) {
      if (!on || plan == null) break;
      final held = holdings.where((h) => h['stock_code'] == code).firstOrNull;
      final avg = held?['avg_price'] as int? ?? 0;
      final price = broker.lastPrices[code] ?? 0;
      if (held == null || avg <= 0 || price <= 0) continue;
      final drop = (price - avg) * 100 / avg;
      var seen = (reviews[code] as Map?)?.cast<String, dynamic>() ?? {};
      // 오늘 본 매입가 대비 최고. ponytail: 5분마다 본 값이라 그 사이 고점은 놓친다 (서버 장중 흐름에는 증권사 오늘 고가가 간다)
      if (drop > ((seen['peak'] as num?)?.toDouble() ?? double.negativeInfinity)) {
        seen = {...seen, 'peak': drop};
        reviews[code] = seen;
        await _box.write('auto_reviews:$_today', jsonEncode(reviews));
      }
      final hard = hardStop(drop, seen);
      if (hard != null) {
        final name = (positions[code] as Map)['name'] as String;
        reviews[code] = {...seen, hard: true, 'at': _now().toIso8601String(), 'pct': drop};
        await _box.write('auto_reviews:$_today', jsonEncode(reviews));
        final mine = (positions[code] as Map)['qty'] as int;
        final owned = (held['qty'] as int) < mine ? held['qty'] as int : mine;
        final qty = hard == 'hard_all' || owned < 2 ? owned : owned ~/ 2;
        await _note('$name 매입가 대비 ${drop.toStringAsFixed(1)}%: 강제 손절선(−${hard == 'hard_all' ? autoHardStopAllPct : autoHardStopPct}%)이라 '
            'AI에게 묻지 않고 ${hard == 'hard_all' ? '전부' : '절반'}($qty주) 팔아요 (주문은 검증 AI를 거쳐요)');
        for (final part in splitQty(qty, price, await _maxOrder())) {
          if (!on || plan == null || await _order(name, part, 'sell', why: '강제 손절') != true) break;
          await _addPosition(code, name, -part);
        }
        continue;
      }
      final reason = sellReason(drop, seen, _now(), marketDrop: marketDrop);
      if (reason == null) continue;
      final name = (positions[code] as Map)['name'] as String;
      final pct = drop.toStringAsFixed(1);
      // 먼저 적어 둔다 (실패해도 같은 이유로 곧바로 다시 하지 않게)
      reviews[code] = {...seen, 'n': (seen['n'] as int? ?? 0) + 1, 'at': _now().toIso8601String(), 'pct': drop,
          if (reason == 'stop') 'stopped': true, if (reason == 'giveback') 'gave': seen['peak'], if (reason == 'close') 'closed': true};
      await _box.write('auto_reviews:$_today', jsonEncode(reviews));
      await _note('$name 매입가 대비 $pct%: ${const {'stop': '손절선이라', 'drop': '급락이라', 'rise': '급등이라', 'market': '시장 급락이라', 'giveback': '오른 이익을 돌려줘서', 'close': '마감 전 점검으로'}[reason] ?? '정기 점검으로'} 투자 AI·검증 AI에게 매도 판단을 물어요');
      final conversation = Conversation(unlock: () async => false); // 분석만 한다. 주문은 아래에서 따로
      await conversation.send(sellQuestion(name, avg, pct, reason: reason, peak: (seen['peak'] as num?)?.toDouble()));
      final answer = conversation.items.lastWhere((i) => i.role != 'user', orElse: () => ChatItem('info', '')).text;
      if (answer.contains('번까지 할 수 있어요')) { // 서버 하루 분석 한도: AI 판단이 아니다. 묻은 횟수에서 뺀다
        reviews[code] = {...seen, 'at': _now().toIso8601String()};
        await _box.write('auto_reviews:$_today', jsonEncode(reviews));
        await _note('$name: 오늘 AI 분석 한도를 다 써서 판단을 못 받았어요. 팔지 않고 다음 점검 때 다시 물어요');
        continue;
      }
      if (!aiSaysSell(answer)) {
        await _note('$name: AI 판단은 매도가 아니에요 (${answer.split('\n').take(2).join(' / ')}). 들고 있어요');
        continue;
      }
      await _note('$name: AI가 ${sellQty(answer, 2) == 1 ? '절반 ' : ''}매도를 제안했고 검증 AI가 승인했어요');
      final mine = (positions[code] as Map)['qty'] as int;
      final owned = (held['qty'] as int) < mine ? held['qty'] as int : mine;
      final qty = sellQty(answer, owned); // AI가 정한 만큼 (전부 / 절반)
      final parts = splitQty(qty, price, await _maxOrder());
      if (parts.isEmpty) await _note('$name: 1주 값이 1회 한도보다 커서 팔 수 없어요. 직접 판단해 주세요');
      for (final part in parts) {
        if (!on || plan == null || await _order(name, part, 'sell', why: reason == 'stop' ? 'AI 손절' : 'AI 매도') != true) break;
        await _addPosition(code, name, -part);
      }
    }
  }

  /// 예약 주문(reservations.dart)도 같은 흐름·같은 자동 승인 규칙으로 주문한다. why는 기록에 붙는 말
  Future<bool?> runOrder(String name, int qty, String side, {String why = ''}) => _order(name, qty, side, why: why);

  /// 한 번 주문 (사람이 채팅에 말한 것과 같은 흐름). 자동 승인해서 실행까지 갔으면 true,
  /// 처리안이 나왔지만 자동 승인하지 않았으면 false, 처리안까지 못 갔거나 실행이 실패했으면(오류) null
  Future<bool?> _order(String name, int qty, String side, {String why = ''}) async {
    final tag = why.isEmpty ? '' : '[$why] ';
    final conversation = Conversation(unlock: () async => on && plan != null, auto: true); // 끄거나 계획을 거두면 실행 직전에도 멈춘다
    await conversation.send(side == 'buy' ? '$name $qty주 사줘' : '$name $qty주 팔아줘');
    final waiting = conversation.waiting;
    if (waiting?['kind'] != 'approval') {
      await _note('$tag$name $qty주: ${_last(conversation)}');
      return null;
    }
    // 승인 뒤 실행 직전 가격이 1% 넘게 바뀌면 서버가 고친 처리안으로 다시 승인을 묻는다 (최대 2번 더 본다).
    // 2026-10-16 피에스케이홀딩스: 다시 온 처리안을 체결로 보고 "7주 매수"로 기록했는데 주문은 나가지 않았다
    for (var round = 0; round < 3; round++) {
      final card = conversation.waiting!['card'] as Map<String, dynamic>;
      final confirm = (card['confirm_required'] as List).cast<String>();
      if (!on || plan == null || confirm.isNotEmpty || !autoApproves(side, card['verdict'])) {
        final reason = !on || plan == null ? '자동매매가 꺼져 있거나 오늘 계획을 승인하지 않았어요'
            : confirm.isNotEmpty ? confirm.join(' ') : '검증 ${card['verdict']}';
        await _note('$tag$name $qty주: 자동으로 승인하지 않았어요 ($reason). 처리안 모아보기에서 직접 판단해 주세요');
        return false;
      }
      await conversation.answer({'decision': 'approve'});
      if (conversation.waiting?['kind'] != 'approval') break;
      await _note('$tag$name $qty주: 가격이 바뀌어 처리안을 다시 확인해요');
    }
    if (conversation.waiting?['kind'] == 'approval') {
      await _note('$tag$name $qty주: 가격이 계속 바뀌어 주문하지 않았어요. 다음 판단 때 다시 해요');
      return false;
    }
    final result = _last(conversation);
    await _note('$tag$name $qty주 자동 ${side == 'buy' ? '매수' : '매도'}: $result');
    // 실행 실패는 처리안을 다 쓴 것이라 다시 시도해도 중복 주문이 남지 않는다
    return result.contains('실패') ? null : !result.contains('않았어요');
  }

  String _last(Conversation c) =>
      c.items.lastWhere((i) => i.role != 'user', orElse: () => ChatItem('info', '응답 없음')).text.split('\n').first;

  Future<void> _note(String text) async {
    log = [...log, '${hhmm(_now().toIso8601String())} $text'];
    await _box.write('auto_log:$_today', jsonEncode(log));
    notifyListeners();
  }
}

final autoTrader = AutoTrader();
