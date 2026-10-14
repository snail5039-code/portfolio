"""5단계 포트폴리오 점검·리밸런싱 제안 (FR-44). AI 없이 코드로 계산한다. 주문은 만들지 않고 제안만 한다.

평가는 서버의 최근 종가(하루 늦은 공개 데이터)로, 종가가 없으면 평균 매입가로 한다. 계좌 요약은 폰이 보낸 최근 스냅샷.
"""

from decimal import ROUND_UP, Decimal

# 성향 단계별 최소 현금 비율 (%): 위험을 덜 지는 단계일수록 현금을 더 둔다. 일반 모드는 1단계로 본다
MIN_CASH_PCT = {1: 30, 2: 20, 3: 10, 4: 5, 5: 0}
CONCENTRATION_HHI = Decimal("0.4")   # 비중 제곱합(허핀달 지수, 0~1)이 이보다 크면 쏠림
BIG_LOSS_PCT = Decimal("-10")        # 평가손익이 이보다 나쁘면 다시 분석을 권한다
MIN_HOLDINGS = 3


def analyze(snapshot: dict, closes: dict[str, int], max_weight_pct: Decimal, level: int,
            risky: dict[str, str] | None = None, mode: str = "custom") -> dict:
    """snapshot: {cash_krw, holdings: [{stock_code, stock_name, qty, avg_price}]}, risky: 위험 1등급 종목 → 근거 공시 제목"""
    risky = risky or {}
    rows = []
    for h in snapshot["holdings"]:
        price = closes.get(h["stock_code"]) or h["avg_price"]
        value = h["qty"] * price
        gain = (Decimal(price - h["avg_price"]) / h["avg_price"] * 100).quantize(Decimal("0.1")) if h["avg_price"] else None
        rows.append({**h, "price": price, "value": value, "gain_pct": gain, "priced": h["stock_code"] in closes})
    stocks = sum(r["value"] for r in rows)
    total = stocks + snapshot["cash_krw"]
    pct = (lambda v: (Decimal(v) / total * 100).quantize(Decimal("0.1"))) if total else (lambda v: Decimal(0))
    for r in rows:
        r["weight_pct"] = pct(r["value"])
    cash_pct = pct(snapshot["cash_krw"])
    hhi = sum((Decimal(r["value"]) / stocks) ** 2 for r in rows).quantize(Decimal("0.01")) if stocks else Decimal(0)

    suggestions = []
    for r in sorted(rows, key=lambda r: r["value"], reverse=True):
        if r["weight_pct"] > max_weight_pct:
            excess = Decimal(r["value"]) - Decimal(total) * max_weight_pct / 100
            qty = int((excess / r["price"]).to_integral_value(rounding=ROUND_UP))
            suggestions.append({"kind": "overweight", "stock_code": r["stock_code"],
                                "text": f"{r['stock_name']} 비중 {r['weight_pct']}%가 한도 {max_weight_pct}%를 넘어요. "
                                        f"{qty:,}주 줄이면 한도 안이에요."})
        if r["stock_code"] in risky:
            suggestions.append({"kind": "risk_grade", "stock_code": r["stock_code"],
                                "text": f"{r['stock_name']}은(는) 위험 1등급이에요 ({risky[r['stock_code']]}). 근거 공시를 확인해 보세요."})
        if r["gain_pct"] is not None and r["gain_pct"] <= BIG_LOSS_PCT:
            suggestions.append({"kind": "big_loss", "stock_code": r["stock_code"],
                                "text": f"{r['stock_name']} 평가손익 {r['gain_pct']}%예요. 처음 산 이유가 아직 맞는지 "
                                        f"\"{r['stock_name']} 지금 어때?\"로 다시 분석해 보세요."})
    if stocks and hhi > CONCENTRATION_HHI:
        top = max(rows, key=lambda r: r["value"])
        suggestions.append({"kind": "concentration",
                            "text": f"주식이 몇 종목에 쏠려 있어요 (쏠림 지수 {hhi}, {top['stock_name']} 비중이 가장 커요). 나눠 두면 한 종목 손실 영향이 줄어요."})
    if rows and len(rows) < MIN_HOLDINGS:
        suggestions.append({"kind": "few_holdings", "text": f"보유 종목이 {len(rows)}개예요. 여러 종목에 나누는 것도 생각해 보세요."})
    min_cash = MIN_CASH_PCT[level if mode == "custom" else 1]
    if total and cash_pct < min_cash:
        suggestions.append({"kind": "low_cash", "text": f"현금 비율 {cash_pct}%가 성향 기준 {min_cash}%보다 낮아요. 급할 때 쓸 돈과 다음 기회를 위한 현금을 남겨 두세요."})
    return {
        "total_krw": total, "stocks_krw": stocks, "cash_krw": snapshot["cash_krw"], "cash_pct": cash_pct,
        "concentration": hhi, "holdings": sorted(rows, key=lambda r: r["value"], reverse=True), "suggestions": suggestions,
    }
