"""성향에 맞는 행동만 제안하게 하는 규칙 (docs/plan/09-investor-profile.md 4·5장).

투자 AI에게 허용 행동과 매수가 빠진 이유를 알려주고, AI가 그 밖의 행동을 내면 코드가 '관찰'로 바꾼다.
성향은 막는 데만 쓴다: 매도·보유·관찰은 막지 않고, 매수만 성향·종목 위험등급·변동성으로 제한한다.
"""

from app.functions.profile import LABELS

# 종목 위험등급 1(매우 높음) ~ 6(매우 낮음). 국내 상장 주식은 원칙 2등급 (토스증권 준칙 별지 제17호)
DOMESTIC_STOCK_GRADE = 2
# 이 등급을 매수 제안받을 수 있는 최소 성향 단계. 결정 (2026-10-05): 완화안 — 2등급은 위험중립형(3)부터
MIN_LEVEL_FOR_GRADE = {1: 5, 2: 3}
# 성향 단계별로 매수를 제안할 수 있는 변동성 순위 상한 (분석 대상 안에서, 0~1, 1이면 가장 출렁임).
# 결정 (2026-10-06): 고정 숫자(예: 40%)는 시장 상황에 따라 너무 엄격하거나 느슨해져서, 대상 안의 순위로 정한다.
#   위험중립형: 변동성 하위 1/3만 / 적극투자형: 가장 출렁이는 20% 제외 / 공격투자형: 제한 없음
# 분석 대상이 늘어도 같은 규칙을 쓴다 (docs/plan/10-coverage-expansion.md 2-6)
MAX_VOLATILITY_RANK_FOR_BUY = {3: 1 / 3, 4: 0.8}


# 1등급(매우 높음)으로 보는 거래소 공시 제목 (OpenDART 거래소 공시, 2026-10-07 실제 제목으로 확인).
# 투자주의·경고·위험(시장경보)은 DART에 없고 KRX KIND에만 있어 아직 못 본다 (미확인, 10-coverage-expansion.md 2-5)
# 횡령·배임 혐의, 불성실공시법인 지정(예고)도 1등급 (2026-10-19 사용자 결정: LG에너지솔루션을 이 공시 뒤에 자동매매가 샀다)
RISK_TITLE_PATTERN = "관리종목|상장폐지|상장적격성|투자유의|투자주의환기|횡령|배임|불성실공시"
# 위험이 아닌 제목: 심사 대상 "제외" 결정, 이전상장(코스닥→코스피)을 위한 상장폐지 "의안상정", 결정 "철회"
# (2026-10-07 실제 수집에서 알테오젠·파두가 잘못 1등급으로 잡혀 추가)
# "불성실공시법인미지정"(지정 안 함)도 위험이 아니다 (2026-10-19 클래시스·POSCO홀딩스가 잘못 1등급으로 잡혀 추가)
RISK_TITLE_EXCLUDE = "제외|의안상정|철회|미지정"
RISK_DAYS = 365  # 이 날 수 안에 위험 공시가 있으면 1등급. ponytail: "해제" 공시로 바로 풀지 않고 1년 동안 1등급으로 본다


def stock_risk(conn, stock_code: str) -> tuple[int, dict | None]:
    """종목 위험등급과 1등급의 근거 공시 {rcept_no, title, filed_at, later} (없으면 None). 등급은 수집 때 정해 둔 값이다.
    later: 근거 공시 뒤에 나온 관련 공시 (예: 심사 대상 "제외" 결정). 1등급은 그대로 두되 함께 보여줘 오해하지 않게 한다."""
    row = conn.execute(
        "SELECT s.risk_grade, d.rcept_no, d.title, d.filed_at FROM stocks s"
        " LEFT JOIN disclosures d ON d.rcept_no = s.risk_rcept_no WHERE s.code = %s", (stock_code,)).fetchone()
    if row is None:
        return DOMESTIC_STOCK_GRADE, None
    if row["rcept_no"] is None:
        return row["risk_grade"], None
    later = conn.execute(
        "SELECT title, filed_at FROM disclosures WHERE stock_code = %s AND filed_at > %s"
        " AND regexp_replace(title, '\\s', '', 'g') ~ %s ORDER BY filed_at DESC LIMIT 1",
        (stock_code, row["filed_at"], RISK_TITLE_PATTERN)).fetchone()
    return row["risk_grade"], {"rcept_no": row["rcept_no"], "title": row["title"], "filed_at": row["filed_at"],
                               "later": later and f"{later['title']} ({later['filed_at']})"}


def stock_risk_grade(conn, stock_code: str) -> int:
    return stock_risk(conn, stock_code)[0]


def buy_block_reason(mode: str, risk_level: int | None, flags: list[str], grade: int,
                     volatility_rank: float | None, mock: bool = False) -> str | None:
    """매수를 제안하면 안 되는 이유. 괜찮으면 None.
    mock: 모의투자. 1등급도 2등급처럼 보고 매수 여부를 AI가 판단한다 (2026-10-19 사용자 결정: 악재 공시 종목도 AI가 스스로
    잘 판단하는지 확인하려고). 1등급 근거 공시는 그대로 AI·검증 AI에게 간다 (analysis.grade_text). 실전은 그대로 막는다"""
    if mode != "custom":
        return "일반 모드(성향 퀴즈 안 함)라 판단하지 않음"
    if "no_buy_proposals" in flags:
        return "생활비나 빌린 돈으로 투자한다고 답함"
    if mock:
        grade = max(grade, DOMESTIC_STOCK_GRADE)
    if risk_level < MIN_LEVEL_FOR_GRADE.get(grade, 1):
        return f"{grade}등급 종목은 {LABELS[MIN_LEVEL_FOR_GRADE[grade]]} 이상만 매수 제안"
    limit = MAX_VOLATILITY_RANK_FOR_BUY.get(risk_level)
    if limit is not None and volatility_rank is not None and volatility_rank > limit:
        return (f"60일 변동성이 분석 대상 중 높은 편이라 (낮은 쪽부터 {volatility_rank:.0%} 위치) "
                f"{LABELS[risk_level]} 기준(낮은 쪽 {limit:.0%} 이내)을 넘음")
    return None


def allowed_actions(mode: str, risk_level: int | None, flags: list[str], grade: int, holds_stock: bool,
                    volatility_rank: float | None = None, mock: bool = False) -> list[str]:
    """투자 AI가 낼 수 있는 행동.

    - 일반 모드(퀴즈 안 함): 판단하지 않으므로 '관찰'만
    - 매도·보유: 이 종목을 갖고 있을 때만 (없으면 의미가 없음). 갖고 있으면 '관찰' 대신 보유·매도 중에서 고른다
      (2026-10-12 보유 종목에 '관찰'이 나와 팔지 들고 있을지 모호했다)
    - 매수: buy_block_reason이 없을 때만
    """
    if mode != "custom":
        return ["watch"]
    actions = ["hold", "sell"] if holds_stock else ["watch"]
    if buy_block_reason(mode, risk_level, flags, grade, volatility_rank, mock) is None:
        actions.append("buy")
    return actions
