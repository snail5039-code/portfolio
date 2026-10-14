# 단계별 인수 문서 읽기 안내

긴 문서를 한 번에 읽어 컨텍스트를 많이 쓰지 않도록, 새 관리자·기획자·구현자·검증자는 필요한 단계의 문서만 골라 읽는다.

## 기본 읽기 순서

1. `AGENTS.md`
   - 역할, 승인, 금융 안전 규칙은 항상 최우선이다.
2. `docs/handoff/01-current-state.md`
   - 현재 완료 상태, 최신 커밋, 다음 작업 번호만 빠르게 확인한다.
3. `docs/handoff/02-active-roles.md`
   - 현재 활성 관리자·기획자·구현자·검증자 작업 ID를 확인한다.
4. `docs/handoff/04-next-candidates.md`
   - 다음 화면 후보와 우선순위를 확인한다.

## 작업별 추가 참조

- 새 화면을 기획할 때: `03-completed-screens.md`, `04-next-candidates.md`
- 구현 지시를 받을 때: `03-completed-screens.md`, `05-validation-runbook.md`
- 독립 검증을 맡을 때: `01-current-state.md`, `03-completed-screens.md`, `05-validation-runbook.md`
- 이전 세부 이력 확인이 필요할 때만 루트 `HANDOFF.md` 전체를 읽는다.

## 운영 원칙

- 실제 금융 데이터, 계좌, 주문, API, DB는 연결하지 않는다.
- 모든 화면 수치와 상태는 화면 검토용 가상 예시다.
- 사용자가 이 프로젝트에서 `커밋`이라고 지시하면 별도 반대 지시가 없는 한 `commit`과 `push origin main`까지 의미한다.
