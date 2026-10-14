# 프론트엔드와 백엔드 전환 범위

기준일: 2026-08-29 KST

## 프론트엔드 1차 범위

초기 계획은 19개 화면을 한 번에 완벽히 옮기지 않고 핵심 사용자 흐름 6개부터 이전하는 것이었다.

1. 투자 운영 대시보드
2. 승인 대기
3. 포트폴리오 변경 전/후 비교
4. 승인 전 근거 패킷
5. 세금·수수료 영향 점검
6. 결정 회고

현재는 이 초기 범위를 넘어 정적 목업 19개에 대응하는 React/Vite `apps/web` 19개 화면 이전이 완료됐다.

`FRONTEND-005`로 승인 대기 주문 행의 접근성 구조도 정리됐다. `FRONTEND-FINAL-AUDIT` 최초 검증은 16개 화면 1440×900 하단 잘림으로 실패했지만, `FRONTEND-FINAL-AUDIT-R1` CSS 수정 뒤 검증자 19세대가 `FRONTEND-FINAL-AUDIT-R1-V`에서 최종 회귀 `통과`를 판정했다. `npm run typecheck`, `npm run build`, 19개 화면 1440×900 하단 잘림 해소, 사이드바 하단 안전 고지, 새 중대/높음 회귀 없음이 확인됐다.

남은 낮음 후속 후보는 기업 상세 숨김 보조 텍스트 `.chart-alt`, 세금·수수료/결정 회고/역할 상태 테스트 훅 마커 내부 가로 overflow다. 이 이슈들은 최종 회귀 통과를 막지 않았고, 백엔드 진입 전 필수 차단 조건으로 보지 않는다.

## 컴포넌트 분리 기준

- `AppShell`: 타이틀바, 좌측 메뉴, 중앙 영역, 우측 인스펙터
- `SourceList`: 공통 메뉴
- `StatusPill`: 확인 완료, 확인 필요, 차단, 대기
- `DataBoundaryNotice`: 모의투자·API 미연결 안내
- `InspectorPanel`: 우측 상세 패널
- `DecisionList`: 승인·근거·회고 공통 리스트
- `EvidenceList`: 근거 항목 목록
- `MockChart`: 고정 차트 표시

## 백엔드 1단계

- `BACKEND-002`에서 FastAPI 프로젝트 최소 골격 생성 완료
- `BACKEND-003`에서 `GET /api/dashboard`와 프론트 대시보드 연결 완료
- `BACKEND-004`에서 `GET /api/account`, `GET /api/agents/{analysis|verification|execution}`과 신규 화면 4개 완료
- `BACKEND-005`에서 승인 대기 화면의 쓰기 경로(`POST approve`/`reject`)를 메모리 저장소로 완료
- 프론트는 Vite `server.proxy`로 같은 출처 `/api/*`만 호출하고 절대 URL을 쓰지 않음
- CORS는 2차 경계로만 유지. origin은 `http://127.0.0.1:5173`, `http://localhost:5173`, 메서드는 `GET`, 헤더는 명시 목록
- 구현된 라우터는 `GET /api/health`, `GET /api/dashboard`, `GET /api/account`, `GET /api/agents/{stage}`, `GET /api/approvals`, `POST /api/approvals/{id}/{approve|reject}`
- `/api/health` 응답은 평면 JSON, 화면용 fixture 응답은 `data` 봉투 구조
- `/api/approvals` 등 나머지 경로는 아직 미구현이며 404가 기대 상태
- 실전투자 기준 실제 계좌·실제 자금 주문·체결·AI 자동 실행·운영 DB는 연결하지 않음. 예외: 기업 상세의 공시는 OpenDART에 실제 연결(2026-09-01~), 대시보드 보유 종목·승인 대기의 모의승인은 KIS 모의투자(가상계좌) API에 실제 연결(2026-09-02~, `05-safety-validation.md` 참고)
- 승인·반려 상태 변경은 후속 승인 흐름 단계에서만 메모리 fixture로 다룸

## 백엔드 2단계

- 승인 흐름 수직 슬라이스 (`GET /api/approvals`, 모의승인·반려)
- 도메인 모델 분리
- 정책 검사 서비스 추가
- 비용·비중·위험 계산을 서버 함수로 이동
- 프론트에서 임의 계산하던 부분을 서버 응답으로 대체

`BACKEND-003`의 원본 숫자 계약(금액 정수, 비율 퍼센트 단위)은 이 단계를 위한 준비다. 서버 계산 결과를 그대로 내려도 계약을 다시 뜯지 않는다.

## 백엔드 3단계

- 테스트용 SQLite 도입 여부 결정
- 감사 로그를 로컬 DB에 저장
- fixture seed로 초기 상태 재현
