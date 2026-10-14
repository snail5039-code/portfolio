# 결정 ID 전수 대조 (16개 전체)

기준일: 2026-09-01 KST

## 배경

`10-decision-consolidation.md`(BACKEND-006)는 DEC-1042 하나만 화면 간 통합했고, 나머지 15개 ID는 "다음에 더 넓힐 때" 과제로 남겼다. `BACKEND-007`로 17개 화면이 전부 백엔드에 연결된 뒤, 사용자 요청으로 **백엔드 fixture 전체에서 등장하는 16개 결정 ID를 전수 대조**했다.

## 방법

각 결정 ID가 등장하는 모든 백엔드 fixture 파일을 찾고, 그 ID가 `approvals.py`(승인 대기 실시간 스토어)에서 **아직 `pending`** 상태인 경우, 다른 화면이 그 ID를 "이미 승인됨"/"이미 반려됨"/"이미 보류됨" 같은 **완료된 과거 결정**으로 서술하고 있는지 확인했다. 이게 실제로 동시에 모순되는 상태를 만드는 유일한 패턴이다 — 검증 단계 라벨(`reviewLabel`)이나 위험 이벤트 설명은 "아직 대기 중"인 것과 공존할 수 있으므로 모순이 아니다.

## 찾아서 고친 것: DEC-1043 충돌이 절반만 고쳐져 있었다

`BACKEND-006`에서 `agents.py`(검증 에이전트 화면)의 "NAVER 관찰, 반려" 서사만 `DEC-1057`로 옮기고, **같은 서사를 참조하던 다른 두 파일을 놓쳤다**.

| 파일 | 수정 전 | 수정 후 |
|---|---|---|
| `agent_role_status.py` (제안자 role) | `history="DEC-1043 반려 후 근거 보강"` | `history="DEC-1057 반려 후 근거 보강"` |
| `agent_role_status.py` (검증자 role) | `history="DEC-1043 출처 신뢰도 보강 요청", decision="DEC-1043"` | `history="DEC-1057 출처 신뢰도 보강 요청", decision="DEC-1057"` |
| `decision_review.py` (NAVER 행) | `id="DEC-1043", decision="반려"` | `id="DEC-1057", decision="반려"` |

승인 대기의 실제 DEC-1043은 NAVER 매도 주문이고 `pending`, `reviewLabel="검토 완료"`(검증 통과)다. 세 파일 모두 "이미 반려됨"이라고 말하고 있어서, 검증자 화면에 방금 들어갔다가 승인 대기 화면으로 넘어가면 같은 ID가 정반대 상태로 보이는 실제 버그였다.

## 추가로 발견해 같이 고친 것: `decision_review.py`의 DEC-1042·DEC-1044

새 회귀 테스트를 넣자마자 두 건이 더 걸렸다.

| 화면 항목 | 문제 | 조치 |
|---|---|---|
| 결정 회고의 삼성전자 행 | `id="DEC-1042", decision="승인"`, "2026-08-25에 이미 승인됨" — 그런데 대시보드/승인 대기는 같은 ID를 "2026-08-27 신규 대기중"으로 보여줌 | `DEC-1058`로 분리 |
| 결정 회고의 KODEX 200 행 | `id="DEC-1044", decision="보류"`, "2026-08-25에 보류됨" — 승인 대기의 실제 DEC-1044는 여전히 `pending` | `DEC-1059`로 분리 |

이 두 건은 원래 `10-decision-consolidation.md`에 "확인했지만 의도적으로 안 고침"으로 기록돼 있었다. 사용자 확인 후 이번에 함께 고쳤다.

## 대조했지만 문제없다고 확인한 것

- **DEC-1052**(SK하이닉스): `agents.py`, `decision_review.py`, `tax_fee_impact.py`, `agent_role_status.py` 4곳 전부 "비용 문제로 재검토/반려" 테마로 일관됨. `decision_review`가 "반려"로, `agents.py`가 "사용자 판단 필요"로 조금 다른 단계를 말하지만 같은 흐름의 다른 시점 서술이라 모순은 아니다.
- **DEC-1056**(포트폴리오 변경 비교): `agent_role_status.py`와 `portfolio_change_compare.py` 둘 다 "승인 대기 전" 상태로 일관됨. "+2%"라는 대략적 표현은 실제 +0.8%p(7.2%→8.0%)의 근사치일 뿐 모순이 아니다.
- **`agent_role_status.py`의 DEC-1042**(승인 관리자 role): `history="DEC-1042 조건부 승인 기록"` — 승인 대기의 실제 `reviewLabel="조건부 승인"`과 정확히 일치. 모순 아님.
- **`audit_logs.py`의 DEC-1042/1043/1044**: "검증 후" 비교값이 이미 `decisions.py` 공유 상수를 참조하고(BACKEND-006/007), `status` 필드도 각 ID의 `reviewLabel`과 일치. 모순 아님.

## 남겨둔 것 (다른 시점의 별개 사건으로 읽을 수 있어 놔둠)

이 항목들은 같은 ID를 다른 날짜의 사건으로 재사용하는 것처럼 보이지만, **동시에 정반대 상태를 주장하지는 않는다** — DEC-1043/1042/1044처럼 "이미 완료된 결정"이라고 딱 잘라 말하는 것과는 다르다.

- `trade_history.py`의 마지막 항목: DEC-1042를 47일 전 "정책 차단" 이력으로 재사용. 같은 수량·가격이지만 시점이 다른 별개 시도처럼 읽을 수 있다.
- `weekly_report.py`의 "정책 차단 기록" 행: "DEC-1042 출처 미확인"을 이번 주 처리 기록으로 언급. 현재 대기 중인 것과는 다른, 더 이른 시점의 차단 이력으로 읽을 수 있다.
- `risk_alerts.py`의 RISK-2041: DEC-1042를 "출처 미확인 차단"과 연결. 같은 종류의 이전 시점 사건으로 읽을 수 있다.

셋 다 "지금 이 순간 pending인 결정을 동시에 완료된 것으로 주장"하는 패턴이 아니라서 이번에 손대지 않았다. 더 강한 확신이 필요하면 다음 논의에서 정한다.

## 회귀 테스트

두 개 추가했다. 앞으로 같은 종류의 충돌이 생기면 바로 잡힌다.

- `test_decision_review.py::test_no_row_contradicts_a_currently_pending_approval`: 결정 회고의 어떤 행도 승인 대기에서 아직 `pending`인 ID를 재사용할 수 없다.
- `test_agent_role_status.py::test_no_role_claims_a_pending_decision_was_rejected`: 역할 상태의 어떤 role도 `history`에 "반려"와 함께 아직 `pending`인 ID를 언급할 수 없다.

두 테스트 다 `/api/approvals`를 실시간으로 조회해서 비교하므로, 나중에 승인 대기의 주문 구성이 바뀌어도 하드코딩된 ID 목록을 유지보수할 필요가 없다.

## 검증

- `uv run pytest`: 108개(BACKEND-007 종료 시점) → **110개**
- 브라우저로 결정 회고·역할 상태·승인 대기 3개 화면 확인: 새 ID(DEC-1057/1058/1059)로 정상 렌더링, 콘솔 오류 0건, 1440×900 레이아웃 정상
