# 기획 문서 목록

자연어 투자 에이전트의 설계 문서다. 큰 방향은 루트의 [INVEST_AGENT_PLAN.md](../../INVEST_AGENT_PLAN.md), 작업 규칙은 [AGENTS.md](../../AGENTS.md)를 본다.

| 문서 | 내용 |
|---|---|
| [01-requirements.md](01-requirements.md) | 요구사항 정의 (기능 FR, 비기능 NFR, 미확정 값) |
| [02-architecture.md](02-architecture.md) | 전체 구조, 서버가 지휘하고 폰이 증권사 일을 하는 방식, 폴더 구조 |
| [03-screens.md](03-screens.md) | 화면 목록, 화면 흐름, 화면별 정의 |
| [04-graph-design.md](04-graph-design.md) | LangGraph 그래프, 멈춤 4종류, State, 분기 조건 |
| [05-schemas.md](05-schemas.md) | 투자 AI 제안서, 검증 AI 판정, 처리안, 주문 요청·결과 형식 |
| [06-api-spec.md](06-api-spec.md) | 서버 API, 대화 이벤트 스트림, 멈춤 메시지 형식 |
| [07-database.md](07-database.md) | PostgreSQL ERD, 테이블, 제약조건, 자주 쓰는 SQL |
| [PROGRESS.md](PROGRESS.md) | **지금 진행 상황, 실행 방법, 주요 결정, 남은 일 (새 세션은 여기부터)** |
| [08-dev-order.md](08-dev-order.md) | **개발 순서와 진행 체크**. 단계마다 그때 볼 참고 문서 링크 |
| [10-coverage-expansion.md](10-coverage-expansion.md) | 분석 대상 30종목을 넓힐 때 바꿔야 할 것 (호출 한도, 수집 방식, 코스닥·ETF, 위험등급) |
| [11-rag-expansion.md](11-rag-expansion.md) | 검색 근거(RAG) 확장: 뉴스(제목·요약·링크만), 투자 용어, 내 기록 |
| [09-investor-profile.md](09-investor-profile.md) | 투자성향 퀴즈, 일반·맞춤 모드, 행동 코치, 조사 근거와 단계별 할 일 |

그림은 각 md 파일 안에 직접 들어 있다. 그림 원본만 따로 둔다.

- `diagrams/*.mmd`: 다이어그램 원본 (머메이드)
- `wireframes/make_wireframes.py`: 화면 그림(와이어프레임) 원본 (HTML로 그린 뒤 Chrome으로 캡처)

그림을 고칠 때는 원본을 수정해 PNG를 만든 뒤, 그 PNG를 md 안에 다시 넣는다. PNG 파일은 저장소에 올리지 않는다.

```bash
npx -p @mermaid-js/mermaid-cli mmdc -i docs/plan/diagrams/erd.mmd -o erd.png -s 2 -b white
python docs/plan/wireframes/make_wireframes.py <PNG를 만들 폴더>
```

## 다음에 만들 문서

- 테스트·평가 계획 (데모 시나리오, Golden Set, 검증 AI 오류 주입 세트)
- 보안 위협 정리 (프롬프트 인젝션 등), 예외 상황 정의, 데이터 출처 확정, 개발 환경 설치 안내
