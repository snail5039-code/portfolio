"""주문 금액 계산, 정책 검사, 행동 코치 (FR-22, FR-23, docs/plan/09-investor-profile.md 5장).

AI 없이 코드로만 계산한다. 공시·뉴스에 이상한 문장이 섞여 있어도 이 검사는 속지 않는다.
금액은 원 단위 정수. 수수료·세금은 원 단위 아래를 버린 추정값이다 (실제 청구액은 증권사 기준).
"""

from datetime import date, datetime, time
from decimal import ROUND_DOWN, Decimal

from app.functions import metrics

# 매도 세금 (2026-01-01부터): 코스피 증권거래세 0.05% + 농어촌특별세 0.15% = 0.20%, 코스닥 0.20%
# 출처: 김앤장 "2026년 세법 및 시행령 개정사항의 주요 내용"
SELL_TAX_PCT = {"KOSPI": Decimal("0.20"), "KOSDAQ": Decimal("0.20")}
WORST_CASE_DROP_PCT = 10          # 처리안의 "최악의 경우": 10% 하락 시 손실
MARKET_OPEN, MARKET_CLOSE = time(9, 0), time(15, 30)  # 정규장 (공휴일 휴장은 아직 거르지 않음)
APPROVAL_MINUTES = 10             # 승인 요청 만료 (FR-25)
MAX_PRICE_DRIFT_PCT = 1           # 실행 직전 가격이 이만큼 넘게 바뀌면 다시 승인 (FR-26)
MAX_QTY = 1_000_000

# 행동 코치 기준
FREQUENT_TRADE_DAYS, FREQUENT_TRADE_COUNT = 7, 2    # 7일 안에 같은 종목을 이미 2번 거래했으면 (이번이 3번째)
HOT_RANK = 0.9                                     # 최근 5거래일 상승률이 분석 대상 중 상위 10%이고
HOT_MIN_RETURN = Decimal("10")                     # 실제로 이만큼(%) 넘게 올랐을 때만 "급등" (2026-10-19: 코스피 5일 −12.6% 하락장에서
                                                   # 5일 +0.2%도 상위 10%라 급등으로 잡혀, 자동매매 매수가 하루 10건 넘게 승인 대기로 막혔다)
CONCENTRATION_SHARE = Decimal("0.8")               # 주문 후 비중이 한도의 80%를 넘으면 분산 안내

# 3-5 계좌 크기 비례 한도: 매수 1회 금액은 정해 둔 한도와 별도로 계좌 평가액의 이 비율(%)을 넘지 못한다 (성향 단계별).
# 계좌가 작으면 고정 한도(예: 200만 원)가 계좌의 너무 큰 몫이 되는 것을 막는다. 일반 모드(퀴즈 안 함)는 1단계로 본다
ACCOUNT_ORDER_PCT = {1: 10, 2: 15, 3: 20, 4: 25, 5: 30}

# 4-2 실전 안전장치: 실전에서 이 금액 이상이면 "고액 실전 주문" 확인을 따로 받는다 (자동 승인 안 됨)
REAL_HIGH_AMOUNT = 1_000_000
# 4-3 실전 자동매매(사용자 결정: 앱이 켜져 있을 때만 소액): 자동·예약 주문 1건이 이 금액을 넘으면 자동 승인하지 않는다
REAL_AUTO_MAX = 300_000


# 오늘 매수한 금액 (docs/plan/07-database.md 4장). 1일 한도 검사와 홈의 "오늘 한도" 링이 같이 쓴다. SUM은 numeric이라 int로
# 매도는 1일 한도에 넣지 않는다: 위험을 줄이는 주문이고, 한도 때문에 못 팔면 오히려 위험을 떠안는다 (2026-10-08 사용자 결정)
# 취소·정정된 원래 주문은 체결된 수량만 센다. 취소 주문 행은 세지 않는다 (3-1)
TODAY_ORDERED_SQL = (
    "SELECT COALESCE(SUM(o.price * CASE WHEN o.status IN ('cancelled', 'replaced') THEN o.filled_qty ELSE o.qty END), 0)"
    " AS total FROM orders o JOIN approvals a ON a.id = o.approval_id JOIN proposals p ON p.id = a.proposal_id"
    " WHERE p.user_id = %s AND p.action = 'buy' AND o.kind <> 'cancel'"
    " AND o.status IN ('accepted', 'filled', 'partially_filled', 'cancelled', 'replaced')"
    " AND o.created_at >= date_trunc('day', now())"
)


def floor_won(value: Decimal) -> int:
    return int(value.to_integral_value(rounding=ROUND_DOWN))


def order_amount(qty: int, price: int) -> int:
    return qty * price


def fee_estimate(amount: int, fee_rate_pct: Decimal | None) -> int | None:
    """수수료 추정. 수수료율을 입력하지 않았으면 None (화면에 '수수료율 미입력')."""
    return None if fee_rate_pct is None else floor_won(Decimal(amount) * Decimal(fee_rate_pct) / 100)


def sell_tax(amount: int, market: str) -> int:
    return floor_won(Decimal(amount) * SELL_TAX_PCT[market] / 100)


# 한국거래소 휴장일 (주말 제외 평일만). 2026년 17일, 2025-12 한국거래소 발표 기준 (언론 보도로 확인)
# ponytail: 해마다 12월에 거래소가 다음 해 휴장일을 발표하면 여기에 더한다. 목록에 없는 해는 주말만 거른다
KRX_HOLIDAYS = {
    date(2026, 1, 1), date(2026, 2, 16), date(2026, 2, 17), date(2026, 2, 18), date(2026, 3, 2),
    date(2026, 5, 1), date(2026, 5, 5), date(2026, 5, 25), date(2026, 6, 3), date(2026, 7, 17),
    date(2026, 8, 17), date(2026, 9, 24), date(2026, 9, 25), date(2026, 10, 5), date(2026, 10, 9),
    date(2026, 12, 25), date(2026, 12, 31),
}


def is_trading_day(day) -> bool:
    return day.weekday() < 5 and day not in KRX_HOLIDAYS


def is_market_open(now: datetime) -> bool:
    return is_trading_day(now.date()) and MARKET_OPEN <= now.time() <= MARKET_CLOSE


def account_values(snapshot: dict, stock_code: str, price: int, closes: dict[str, int]) -> tuple[int, int, int]:
    """(이 종목 보유 수량, 이 종목 평가액, 계좌 전체 평가액).

    이 종목은 주문 가격으로, 다른 종목은 서버의 최근 종가로, 그것도 없으면 평균 매입가로 평가한다.
    """
    held_qty, total = 0, snapshot["cash_krw"]
    for holding in snapshot["holdings"]:
        if holding["stock_code"] == stock_code:
            held_qty = holding["qty"]
            total += holding["qty"] * price
        else:
            total += holding["qty"] * closes.get(holding["stock_code"], holding["avg_price"])
    return held_qty, held_qty * price, total


def rule(name: str, label: str, limit, actual, ok: bool) -> dict:
    return {"rule": name, "label": label, "limit": limit, "actual": actual, "ok": ok}


def policy_check(side: str, qty: int, price: int, policy: dict, today_ordered_krw: int,
                 snapshot: dict | None, closes: dict[str, int], stock_code: str, now: datetime,
                 inputs: list[str], change: str | None = None, replacing_krw: int = 0,
                 account_pct: int | None = None, mock: bool = False) -> dict:
    """PolicyResult (05-schemas.md 6장): 규칙마다 통과 여부. 하나라도 걸리면 처리안 전에 막는다.

    change: None 새 주문 / "cancel" 미체결 주문 취소 / "modify" 가격 정정. 정정은 원래 주문 금액(replacing_krw)을 바꾸는 것이라
    1일 한도·현금은 그 차이로 본다. 취소는 위험을 늘리지 않아 장 운영 시간만 본다 (3-1)
    mock: 모의투자면 금액 한도(1회·1일·계좌 비율)를 보지 않는다. 가상 돈이라 사고팔며 검증하는 게 목적이고,
    살 총액은 사용자가 자동매매 계획에서 정한다 (2026-10-13 사용자 결정). 현금·보유 수량·비중·장 시간은 그대로 본다
    """
    amount = order_amount(qty, price)
    hours = rule("market_hours", "장 운영 시간 (휴장일 제외 평일 09:00~15:30)", "09:00~15:30", f"{now:%a %H:%M}",
                 is_market_open(now))
    if change == "cancel":
        return {"ok": hours["ok"], "rules": [hours], "weight_after": None}
    today_ordered_krw -= replacing_krw
    rules = [hours]
    if not mock:
        rules.append(rule("max_order", "1회 주문 한도", policy["max_order_krw"], amount, amount <= policy["max_order_krw"]))
    if side == "buy" and not mock:  # 1일 한도는 매수만 (위 TODAY_ORDERED_SQL 설명)
        rules.append(rule("max_daily", "1일 주문 한도", policy["max_daily_krw"], today_ordered_krw + amount,
                          today_ordered_krw + amount <= policy["max_daily_krw"]))
    if snapshot is None:
        rules.append(rule("account", "계좌 정보", "최근 30분 안의 잔고", "없음", False))
        return {"ok": False, "rules": rules, "weight_after": None}

    held_qty, position_value, total_value = account_values(snapshot, stock_code, price, closes)
    if side == "buy" and account_pct and not mock:
        limit = total_value * account_pct // 100
        rules.append(rule("account_share", f"1회 매수 한도 (계좌 평가액의 {account_pct}%)", limit, amount - replacing_krw,
                          amount - replacing_krw <= limit))
    if side == "buy":
        rules.append(rule("cash", "현금", snapshot["cash_krw"], amount - replacing_krw, amount - replacing_krw <= snapshot["cash_krw"]))
    else:
        rules.append(rule("holdings", "보유 수량", held_qty, qty, qty <= held_qty))
    weight = metrics.weight_after_order(position_value, total_value, amount, side, inputs)
    if side == "buy":  # 비중 한도는 늘리는 쪽(매수)만 막는다
        rules.append(rule("max_weight", "한 종목 최대 비중 (%)", str(policy["max_weight_pct"]), str(weight["value"]),
                          weight["value"] is not None and weight["value"] <= Decimal(policy["max_weight_pct"])))
    return {"ok": all(r["ok"] for r in rules), "rules": rules, "weight_after": weight["value"]}


def coach_warnings(side: str, recent_trades: int, hot_rank: float | None, five_day_return: Decimal | None,
                   chases_hot_stocks: bool, weight_after: Decimal | None, max_weight_pct: Decimal,
                   gain_pct: Decimal | None, losing_holdings: list[str], cost_krw: int | None,
                   hot_buys_habit: bool = False, monthly_fills: int | None = None) -> list[str]:
    """손실로 이어지기 쉬운 행동을 짚는다. 막지는 않고 처리안에 경고로 보여준다 (자본시장연구원 2022, Barber·Odean 2000)."""
    warnings = []
    if recent_trades >= FREQUENT_TRADE_COUNT:
        cost = f" 이번 주문의 수수료·세금 추정은 {cost_krw:,}원이에요." if cost_krw else ""
        warnings.append(f"최근 {FREQUENT_TRADE_DAYS}일 동안 이 종목을 {recent_trades}번 거래했어요. "
                        f"자주 사고팔수록 비용 때문에 수익이 줄어들기 쉬워요.{cost}")
    if side == "buy" and hot_rank is not None and hot_rank > HOT_RANK and five_day_return and five_day_return >= HOT_MIN_RETURN:
        warnings.append(f"최근 5거래일 {five_day_return}% 올라 분석 대상 중 가장 많이 오른 편이에요. "
                        "급등 직후 매수는 고점에 살 위험이 있어요."
                        + (" 퀴즈에서 급등주를 바로 사는 편이라고 답하셨어요." if chases_hot_stocks else "")
                        + (" 최근 30일 동안 급등 경고를 받고도 산 적이 여러 번 있어요." if hot_buys_habit else ""))
    if side == "buy" and weight_after is not None and weight_after > Decimal(max_weight_pct) * CONCENTRATION_SHARE:
        warnings.append(f"주문 후 이 종목 비중이 {weight_after}%로 한도({max_weight_pct}%)에 가까워요. 여러 종목에 나누는 것도 생각해 보세요.")
    if monthly_fills is not None:  # 내 투자 습관: 잦은 매매 (functions/behavior.py)
        cost = f" 이번 주문의 수수료·세금 추정은 {cost_krw:,}원이에요." if cost_krw else ""
        warnings.append(f"최근 30일 동안 {monthly_fills}건 체결했어요. 거래가 잦을수록 비용이 쌓여요.{cost}")
    if side == "sell" and gain_pct is not None and gain_pct > 0 and losing_holdings:
        warnings.append(f"수익 중인 종목(+{gain_pct}%)을 팔고, 손실 중인 종목({', '.join(losing_holdings)})은 그대로예요. "
                        "오른 것만 먼저 팔고 떨어진 것을 오래 들고 있는 습관은 성과를 낮추기 쉬워요.")
    return warnings


def needs_hot_confirm(warnings: list[str], chases_hot_stocks: bool) -> bool:
    """급등 경고가 있고 퀴즈에서 급등주를 바로 산다고 답했으면 한 번 더 확인받는다."""
    return chases_hot_stocks and any("급등 직후" in w for w in warnings)

