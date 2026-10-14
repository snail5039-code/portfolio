"""Local portfolio health fixture. Ported from `src/fixtures/portfolioHealth.ts`."""

from app.schemas.portfolio_health import HealthCheck, HealthGroup, PortfolioHealthData

PORTFOLIO_HEALTH_DATA_AS_OF = "2026-08-27T15:20:00+09:00"

PORTFOLIO_HEALTH_SOURCE_LABEL = "로컬 fixture"

PORTFOLIO_HEALTH_DISCLAIMER = (
    "모의투자 · 화면 검토용 가상 예시 · 실제 주문 아님 · 실제 매수·매도 가능 판정 아님 · "
    "실제 계좌·API·DB 미연결 · 외부 요청 0건"
)


def _score(checks: list[HealthCheck]) -> int:
    """Same formula as the former `getHealthScore()` in the frontend fixture."""
    blocked = sum(1 for c in checks if c.status == "차단")
    needs = sum(1 for c in checks if c.status == "확인 필요")
    return max(42, round(88 - blocked * 10 - needs * 4))


def build_portfolio_health_data() -> PortfolioHealthData:
    checks = [
        HealthCheck(
            id="H-101", group="policy", title="SK하이닉스 업종 집중 경계", status="차단", impact="높음",
            next="정책 설정 확인", linkPage="policy", basis="반도체 합산 비중 30.0% 예시",
            summary="업종 집중 한도 초과 가능성을 표시하지만 실제 매도 가능 판정은 아닙니다.",
            data="정책값 고정 예시", risk="집중도 확대 시 낙폭 민감도 증가",
        ),
        HealthCheck(
            id="H-102", group="source", title="OpenDART 정정 공시 미확인", status="확인 필요", impact="높음",
            next="데이터 연결 확인", linkPage="data", basis="공시 원문 연결 없음",
            summary="출처 미확인 상태를 승인 전 확인 대상으로 올립니다.",
            data="실제 공시 API 미연결", risk="근거 확정 전 제안 신뢰도 낮음",
        ),
        HealthCheck(
            id="H-103", group="risk", title="20일 변동성 경계 근접", status="확인 필요", impact="보통",
            next="리스크 알림 확인", linkPage="risks", basis="가상 변동성 27.4%",
            summary="변동성 숫자는 화면 검토용이며 실제 시장 위험 경보가 아닙니다.",
            data="실제 시세 미연결", risk="단기 가격 급변 시 지정가 조건 무효",
        ),
        HealthCheck(
            id="H-104", group="approval", title="DEC-1042 승인 만료 임박", status="확인 필요", impact="보통",
            next="승인 대기 확인", linkPage="approvals", basis="남은 시간 9분 예시",
            summary="승인 대기 상태만 표시하며 실제 주문을 생성하지 않습니다.",
            data="주문·계좌 미연결", risk="만료 후 재검토 필요",
        ),
        HealthCheck(
            id="H-105", group="strategy", title="현금 목표와 현재 비중 차이", status="확인 필요", impact="낮음",
            next="전략 조정 확인", linkPage="rebalance", basis="현금 18.4%, 균형형 목표 16.0%",
            summary="목표 전략과 현재 비중 차이를 보여주는 고정 예시입니다.",
            data="실제 계좌 잔고 미반영", risk="기회비용과 방어력 간 균형 필요",
        ),
        HealthCheck(
            id="H-106", group="stress", title="반도체 급락 시 손실 민감도", status="차단", impact="높음",
            next="스트레스 테스트 확인", linkPage="stress", basis="가상 예상 손실 -8.9%",
            summary="충격 시나리오 결과를 승인 전 차단 후보로 표시합니다.",
            data="실제 시세·모델 미연결", risk="삼성전자·SK하이닉스 동반 하락 취약",
        ),
        HealthCheck(
            id="H-107", group="complete", title="시장가 주문 금지 유지", status="완료", impact="낮음",
            next="정책 유지", linkPage="policy", basis="시장가 미허용",
            summary="지정가 중심 운영 기준을 충족한 화면용 점검입니다.",
            data="정책 저장 없음", risk="체결 가능성은 실제 판단 아님",
        ),
        HealthCheck(
            id="H-108", group="complete", title="최소 현금 비중 충족", status="완료", impact="낮음",
            next="주간 리포트 확인", linkPage="weekly", basis="현금 18.4%, 기준 15.0%",
            summary="현금 방어력 기준을 충족한 것으로 표시한 예시입니다.",
            data="실제 계좌 잔고 미연결", risk="성과 보장이나 손실 회피 보장 아님",
        ),
    ]

    return PortfolioHealthData(
        groups=[
            HealthGroup(key="policy", label="정책 위반", score=58, status="차단", summary="종목 비중과 시장가 금지 조건을 먼저 확인해야 합니다."),
            HealthGroup(key="source", label="데이터 미확인", score=61, status="확인 필요", summary="공시와 가격 출처가 실제 연결되지 않은 화면 예시입니다."),
            HealthGroup(key="risk", label="리스크 경보", score=66, status="확인 필요", summary="변동성·집중도 경고가 승인 전 점검 대상으로 남아 있습니다."),
            HealthGroup(key="approval", label="승인 대기", score=74, status="확인 필요", summary="대기 중인 가상 제안의 만료와 정책 조건을 확인합니다."),
            HealthGroup(key="strategy", label="전략 괴리", score=69, status="확인 필요", summary="현재 비중과 목표 전략의 차이가 일부 남아 있습니다."),
            HealthGroup(key="stress", label="스트레스 취약", score=63, status="차단", summary="반도체 급락과 유동성 경색 시나리오에서 취약 항목이 있습니다."),
            HealthGroup(key="complete", label="완료 점검", score=88, status="완료", summary="현금 비중과 지정가 제한은 화면용 기준을 충족합니다."),
        ],
        checks=checks,
        overallScore=_score(checks),
        safetyCopy=PORTFOLIO_HEALTH_DISCLAIMER,
    )
