"""행동 기반 성향 (docs/plan/12-todo-by-stage.md 2-6). LLM 없이 최근 30일 처리안·주문 기록으로 매매 습관을 본다.

습관은 조심하는 쪽으로만 쓴다 (09-investor-profile.md: 성향은 막는 데만 쓴다).
표시 값(flags)을 더해 투자 AI 안내와 행동 코치를 바꿀 뿐, 성향 단계·한도는 바꾸지 않는다.
  frequent_trading  체결이 잦다          → 투자 AI가 비용을 강조, 처리안에 30일 체결 수와 비용 추정
  hot_buys          급등 경고에도 산다    → 퀴즈의 chases_hot_stocks처럼 급등 매수 때 한 번 더 확인
  sells_winners     이익 난 것만 판다     → 투자 AI가 손실 종목도 점검하라고 쓴다
경고를 무릅쓴 주문(성향 초과·검증 반려 확인 뒤 승인)은 사실로 보여주기만 한다.
"""

DAYS = 30
MIN_RECORDS = 5        # 처리안이 이보다 적으면 습관을 판단하지 않는다
FREQUENT_FILLS = 10    # ponytail: 처음 정한 기준값. 사용자 기록이 쌓이면 다시 본다
HOT_BUYS = 2
WINNER_SELLS = 2
# 처리안 카드에 남은 행동 코치 경고 문구 (functions/orders.py coach_warnings)로 알아본다
HOT_MARK = "급등 직후"
WINNER_MARK = "오른 것만 먼저 팔고"

FLAG_NOTES = {
    "frequent_trading": "자주 거래하고 있어요. 처리안에 최근 30일 체결 수와 이번 비용을 함께 보여드려요.",
    "hot_buys": "급등 경고를 받고도 산 적이 여러 번 있어요. 급등 직후 매수는 한 번 더 확인받아요.",
    "sells_winners": "오른 종목만 먼저 판 적이 여러 번 있어요. 분석할 때 손실 중인 종목도 함께 점검해 드려요.",
}


def behavior(conn, user_id) -> dict:
    """최근 30일 습관. 숫자는 모두 서버 기록이다."""
    rows = conn.execute(
        "SELECT a.status, a.card, coalesce(max(o.filled_qty), 0) AS filled FROM approvals a"
        " JOIN proposals p ON p.id = a.proposal_id LEFT JOIN orders o ON o.approval_id = a.id"
        " WHERE p.user_id = %s AND a.created_at >= now() - %s::interval GROUP BY a.id",
        (user_id, f"{DAYS} days"),
    ).fetchall()
    approved = [r["card"] for r in rows if r["status"] == "approved"]

    def warned(side: str, mark: str) -> int:
        return sum(1 for card in approved if card.get("side") == side and any(mark in w for w in card.get("warnings", [])))

    counts = {
        "records": len(rows),
        "fills": sum(1 for r in rows if r["filled"] > 0),
        "hot_buys": warned("buy", HOT_MARK),
        "winner_sells": warned("sell", WINNER_MARK),
        "risky_confirms": sum(1 for card in approved if card.get("confirm_required")),
    }
    enough = counts["records"] >= MIN_RECORDS
    flags = [flag for flag, hit in (("frequent_trading", counts["fills"] >= FREQUENT_FILLS),
                                    ("hot_buys", counts["hot_buys"] >= HOT_BUYS),
                                    ("sells_winners", counts["winner_sells"] >= WINNER_SELLS)) if enough and hit]
    return {"days": DAYS, "enough": enough, "min_records": MIN_RECORDS, **counts, "flags": flags,
            "notes": [FLAG_NOTES[f] for f in flags]}
