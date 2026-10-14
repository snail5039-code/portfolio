"""Local data connections fixture. Ported from `src/fixtures/dataConnections.ts`."""

from app.schemas.data_connections import (
    DataConnectionCard,
    DataConnectionDetail,
    DataConnectionRow,
    DataConnectionsData,
    DataQualityChip,
)

DATA_CONNECTIONS_DATA_AS_OF = "2026-08-25T14:32:00+09:00"

DATA_CONNECTIONS_SOURCE_LABEL = "로컬 fixture"

DATA_CONNECTIONS_DISCLAIMER = (
    "모의투자 · 화면 검토용 가상 예시 · 실제 주문 아님 · 실제 계좌·API·DB 미연결 · 외부 요청 0건"
)


def _detail(key: str, title: str, summary: str, *pairs: tuple[str, str]) -> DataConnectionDetail:
    return DataConnectionDetail(
        key=key, title=title, summary=summary,
        facts=[{"label": label, "value": value} for label, value in pairs],
    )


def build_data_connections_data() -> DataConnectionsData:
    return DataConnectionsData(
        safetyCopy=DATA_CONNECTIONS_DISCLAIMER,
        details={
            "opendart": _detail(
                "opendart", "OpenDART 공시",
                "실제 OpenDART API 키나 공시 원문 요청 없이 미연결 상태만 표시합니다.",
                ("상태", "미연결"), ("권한", "API 키 없음"), ("마지막 확인", "화면용 14:32"), ("외부 요청", "0건"),
            ),
            "price": _detail(
                "price", "가격 데이터", "현재가와 벤치마크는 실제 시세가 아닌 고정 예시입니다.",
                ("상태", "가상"), ("현재가 예시", "71,200원"), ("실시간 구독", "없음"), ("저장", "없음"),
            ),
            "securities": _detail(
                "securities", "증권사 계좌·주문",
                "잔고 조회, 주문 생성, 매수·매도 권한이 모두 차단된 목업 상태입니다.",
                ("상태", "차단"), ("계좌 권한", "없음"), ("주문 생성", "0건"), ("실제 주문", "불가"),
            ),
            "database": _detail(
                "database", "운영 데이터베이스",
                "설정과 결정 기록은 실제 DB에 저장되지 않고 화면 상태로만 표현됩니다.",
                ("상태", "미사용"), ("DB 연결", "없음"), ("쓰기 작업", "0건"), ("복구 대상", "없음"),
            ),
            "report": _detail(
                "report", "주간 리포트 산출물", "리포트의 성과와 위험 수치는 화면 검토용 고정 계산입니다.",
                ("상태", "가상"), ("기간", "2026.08.19~08.25"), ("통화", "KRW"), ("외부 전송", "없음"),
            ),
            "unknown": _detail(
                "unknown", "출처 미확인 2건", "미확인 출처는 실제 투자 판단에 쓰지 않도록 경고로 분리합니다.",
                ("미확인", "2건"), ("정책 처리", "차단"), ("표시", "텍스트 경고"), ("실제 검증", "없음"),
            ),
            "stale": _detail(
                "stale", "기준 시각 고정", "모든 시각은 목업 표시용이며 최신 데이터 조회를 뜻하지 않습니다.",
                ("기준", "2026.08.25 14:32"), ("갱신", "수동 목업"), ("자동 동기화", "없음"), ("외부 요청", "0건"),
            ),
            "permission": _detail(
                "permission", "권한 범위 없음", "읽기·쓰기·주문 권한을 부여하지 않은 상태를 명확히 보여줍니다.",
                ("공시 읽기", "없음"), ("계좌 읽기", "없음"), ("주문 쓰기", "없음"), ("비밀키", "없음"),
            ),
            "paper": _detail(
                "paper", "모의투자 전용", "모든 동작은 실제 거래와 분리된 화면용 시뮬레이션입니다.",
                ("환경", "모의투자"), ("실계좌", "미연결"), ("주문", "실제 주문 아님"), ("데이터", "고정 예시"),
            ),
        },
        cards=[
            DataConnectionCard(key="opendart", label="공시 출처", value="미연결", note="OpenDART API 없음"),
            DataConnectionCard(key="securities", label="증권사", value="차단", note="계좌·주문 권한 없음"),
            DataConnectionCard(key="database", label="저장소", value="미사용", note="DB 저장 없음"),
        ],
        rows=[
            DataConnectionRow(key="opendart", name="OpenDART 공시", status="미연결", detail="정정 공시와 원문 링크는 화면용 예시만 표시", note="API 키 없음", kind="blocked"),
            DataConnectionRow(key="price", name="가격 데이터", status="가상", detail="71,200원 등 고정 예시만 사용", note="실시간 시세 없음", kind="mock"),
            DataConnectionRow(key="securities", name="증권사 계좌·주문", status="차단", detail="매수·매도·잔고 조회 권한 없음", note="주문 생성 0건", kind="blocked"),
            DataConnectionRow(key="database", name="운영 데이터베이스", status="미사용", detail="저장·조회 없이 브라우저 메모리 상태만 사용", note="DB 연결 없음", kind="blocked"),
            DataConnectionRow(key="report", name="주간 리포트 산출물", status="가상", detail="기간별 손익과 벤치마크는 고정 계산 예시", note="외부 전송 없음", kind="mock"),
        ],
        qualityChips=[
            DataQualityChip(key="unknown", label="출처 미확인 2건"),
            DataQualityChip(key="stale", label="기준 시각 고정"),
            DataQualityChip(key="permission", label="권한 범위 없음"),
            DataQualityChip(key="paper", label="모의투자 전용"),
        ],
    )
