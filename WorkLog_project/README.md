# WorkLog — 업무일지 · 요약 · DOCX 산출 자동화

업무 기록을 **일 · 주 · 월 단위로 작성**하고, 그 내용을 **요약해서 워드(DOCX) 양식으로
바로 뽑아내는** 웹 서비스입니다. 인수인계서도 같은 방식으로 만듭니다.

- **기간**: 2025.11.22 ~ 2025.12.17
- **구성**: `WorkLog_project_Spring`(백엔드) + `WorkLog_project_React`(프론트엔드)
- **만든 계기**: 업무가 끝난 뒤에 업무일지를 또 써야 해서 퇴근이 늦어지는 일이 많았습니다.
  그 시간을 줄이려고 만들었습니다.
- 트러블슈팅 기록은 아래 [트러블슈팅 10건](#트러블슈팅) 에 있습니다.

---

## 지금 상태

**로컬 개발까지 동작하는 상태이고, 배포는 하지 않았습니다.**

2026-08-20 에 저장소 전체(Spring 47개 · React 28개 파일)를 다시 점검해서
**41건을 고쳤습니다.** 무엇을 어떤 근거로 고쳤는지는 [`docs/FIX_PLAN.md`](docs/FIX_PLAN.md)
에 등급별로 적어뒀습니다. 큰 것만 옮기면 이렇습니다.

| 무엇이 문제였나 | 어떻게 됐나 |
| --- | --- |
| 마이페이지에서 비밀번호를 바꾸면 평문으로 저장되어 **본인도 다시 로그인할 수 없었다** | 저장할 때 해시한다. 비워서 보내면 기존 것을 유지한다 |
| 게시글 수정 API 에 인증도 소유권 검사도 없어서 **남의 글을 고칠 수 있었다** | 세션 확인 + 작성자 대조, DAO `where` 절에도 `memberId` 추가 |
| 첨부파일 다운로드가 인증 없이 **임의 경로를 서빙**했다 | 로그인 확인 + 업로드 폴더 하위인지 검증 |
| 새 글 id 를 `select last_insert_id()` 로 따로 읽어서, 동시 등록 시 **첨부가 다른 글에 붙을 수 있었다** | `useGeneratedKeys` 로 전환하고 글+첨부를 한 트랜잭션으로 묶었다 |
| 첨부 저장이 실패해도 **"등록 완료"** 라고 답했다 | 예외를 던지고 글까지 되돌린다 |
| 프론트에 API 주소가 35곳 하드코딩되어 **배포하면 사이트가 통째로 죽는** 상태였다 | `VITE_API_BASE_URL` 환경변수와 `src/config/api.js` 로 단일화 |
| 인수인계 저장 시 인자 순서가 밀려 **DB 컬럼이 뒤섞였다** | 위치 인자 9개를 DTO 하나로 바꿨다 |
| 챗봇이 질문 **문장 전체**를 검색어로 써서 크롤링해둔 문서를 거의 못 찾았다 | 낱말로 쪼개 찾고, 많이 걸린 문서를 앞에 둔다 |

남은 것은 무염 SHA-256 하나입니다. bcrypt 로 바꾸면 기존 계정 비밀번호가 전부
무효화되므로 재해시 절차를 따로 설계해야 합니다.

**아직 확인하지 못한 것**: 위 수정은 컴파일 · 프론트 빌드 · 단위 테스트로만
검증했습니다. MySQL 과 API 키가 있는 환경에서 실제로 눌러본 것은 아닙니다.

---

## 핵심 기능

| 기능 | 설명 |
| --- | --- |
| 업무일지 | 일간 기록 작성 · 목록 · 상세 · 수정 · 삭제. 첨부파일과 댓글 |
| 주간 · 월간 요약 | 기간을 고르면 그 기간의 일간 기록을 AI 가 요약해서 게시판에 등록 |
| DOCX 산출 | 양식(TPL1 · TPL3~7)을 골라 플레이스홀더를 채운 워드 파일 다운로드 |
| 인수인계서 | 기간 · 인수자 · 직무를 넣으면 그 기간 일지를 정리해 인수인계서로 출력 |
| 게시판 | 공지 · 자유 · 질문답변 · 자주 묻는 질문 · 오류 접수 |
| 챗봇 | 사이트 문서를 크롤링해두고, 그 내용을 근거로 답하는 도우미 |
| 회원 | 로그인 · 회원가입 · 아이디/비밀번호 찾기(메일 인증번호) · Firebase 소셜 로그인 |

---

## 기술 스택

### 백엔드

- Java 17 · Spring Boot 3 (REST API)
- MyBatis — 애노테이션 매퍼(`dao/*.java`)에 SQL 을 둔다. 전 구간 `#{}` 바인딩
- MySQL
- Apache POI (`poi-ooxml`) — **DOCX 생성·치환은 POI 로 한다**
- PDFBox · HWPLib — 업로드 문서 텍스트 추출
- Spring AI (OpenAI) — 요약 · 챗봇
- Jsoup — 사이트 문서 크롤링
- Firebase Admin — 소셜 로그인 토큰 검증
- Spring Mail — 인증번호 발송

### 프론트엔드

- React 19 · Vite
- 통신은 브라우저 기본 `fetch` (세션 쿠키를 쓰므로 전부 `credentials: "include"`)
- Ant Design (컴포넌트) + Tailwind CSS (레이아웃 · 간격)
- SimpleMDE — 마크다운 입력

### 선언만 되어 있고 코드에서 쓰지 않는 것

정리 대상입니다. 실제 동작에는 영향이 없지만 빌드 크기와 오해를 만듭니다.

- `docx4j-core` 와 그에 딸린 JAXB 의존성 — 초기에 검토했다가 POI 로 갔습니다.
  **지금 코드에 docx4j import 는 한 곳도 없습니다.**
- `hwpxlib` · `spring-ai-pdf-document-reader` · `commons-io`
- `FileTextExtractor` 는 import 만 되어 있고 호출하는 곳이 없습니다(업로드 문서 요약 기능은 미사용)

---

## 실행 방법 (로컬)

### 1. 설정 파일 3개를 먼저 넣는다

전부 `.gitignore` 대상이라 **이 저장소에 없습니다.** 없으면 애플리케이션이 아예
시작되지 않습니다 — `application.yml` 이 앞의 두 개를 `spring.config.import` 로
필수 import 하기 때문입니다.

| 파일 | 위치 | 담는 값 |
| --- | --- | --- |
| `ai.yml` | `WorkLog_project_Spring/src/main/resources/` | `spring.ai.openai.api-key` |
| `send.yml` | 같은 곳 | `spring.mail.host` · `port` · `username` · `password` |
| `serviceAccountKey.json` | `.../resources/firebase/` | Firebase 서비스 계정 키 |

### 2. MySQL

```sql
CREATE DATABASE workLog_project;
```

접속 정보는 `application.yml` 의 `spring.datasource` 에 있습니다(기본값 `root` · 빈 비밀번호).

> **스키마 SQL 은 저장소에 없습니다.** 코드가 기대하는 테이블은
> `member` · `workLog` · `fileAttach` · `rePly` · `handoverLog` · `pageContent` 이고,
> 컬럼은 `dao/*.java` 의 쿼리에서 읽을 수 있습니다. 덤프를 따로 챙겨두는 게 좋습니다.

### 3. 백엔드 (`:8081`)

```bash
cd WorkLog_project_Spring
./mvnw spring-boot:run
```

### 4. 프론트엔드 (`:5173`)

```bash
cd WorkLog_project_React
npm install
npm run dev
```

배포할 때는 `VITE_API_BASE_URL` 에 실제 API 주소를 넣습니다 (`.env.example` 참고).
넣지 않으면 `http://localhost:8081` 을 쓰고, 그대로 배포하면 방문자의 브라우저가
**자기 PC** 의 8081 로 요청을 보내 사이트가 동작하지 않습니다.

소셜 로그인을 쓰려면 `VITE_FIREBASE_*` 일곱 개도 채워야 합니다 (`.env.example` 참고).
`src/firebaseConfig.jsx` 가 이 값들을 환경변수에서 읽습니다.

> **원본 저장소와 다른 점**: 이 포트폴리오 스냅샷은 Firebase 설정을 환경변수로 읽지만,
> [원본 저장소](https://github.com/snail5039-code/WorkLog_project) 는 아직
> `firebaseConfig.jsx` 에 값을 하드코딩하고 있습니다. 이 저장소가 공개라서 스냅샷 쪽만
> 환경변수로 유지했습니다. Firebase 웹 `apiKey` 는 브라우저 번들에 실리는 공개
> 식별자이므로 급한 유출은 아니지만(보호는 보안 규칙과 승인된 도메인이 담당),
> 원본에도 같은 수정이 필요합니다.

### 검증 명령

```bash
cd WorkLog_project_Spring && ./mvnw -B -DskipTests compile
cd WorkLog_project_Spring && ./mvnw -B test -Dtest='DocxTemplateServiceTest,PageContentServiceTest'
cd WorkLog_project_React  && npm run build
```

테스트 두 개는 스프링 컨텍스트를 띄우지 않아 DB 없이도 돕니다.
`DocxTemplateServiceTest` 는 템플릿 9개를 실제로 채워서 남은 플레이스홀더가 없는지
보고, `PageContentServiceTest` 는 챗봇 검색이 질문을 낱말로 쪼개는지 봅니다.
`./mvnw test` 를 그냥 돌리면 `WorkLogProjectApplicationTests` 가 실패합니다 —
위 설정 파일이 없어 컨텍스트가 뜨지 않기 때문이고, 원래부터 그렇습니다.

---

## 구조

```
FE(React :5173) → BE(Spring :8081) → DB(MySQL)
                        │
                        ├── OpenAI (요약 · 챗봇)
                        ├── SMTP (인증번호)
                        └── 로컬 디스크 (첨부파일 uploads/)
```

문서 산출 흐름: **입력 · 조회 → 양식 선택 → 서버에서 플레이스홀더 치환 → 다운로드.**
인증은 서버 세션(`JSESSIONID`) 하나를 기준으로 삼고, 프론트는 앱이 뜰 때
세션 조회 API 로 상태를 복원합니다.

```bash
WorkLog_project
├─ WorkLog_project_React
├─ WorkLog_project_Spring
└─ docs
   └─ FIX_PLAN.md      # 전체 점검 결과와 수정 내역
```

---

## 트러블슈팅

실제로 막혔던 것과, 그때 무엇을 배웠는지 적었습니다.
각 항목의 **더보기** 를 누르면 증상 · 원인 · 조치 · 검증이 나옵니다.

### 1. 로그인/세션 유지 불안정

- 새로고침·페이지 이동 시 로그인 상태가 풀리거나 401 이 간헐적으로 발생.
- `AuthContext`(프론트 상태)와 세션(서버 인증)이 분리된 상태에서 쿠키 `credentials`
  설정이 빠져 동기화 실패.
- 서버 세션을 단일 기준(SSOT)으로 삼아야 인증이 안정된다는 것을 배웠다.

<details><summary><b>더보기</b></summary>

**증상** — 새로고침·라우팅 이동 후 "로그인 필요" 반복, 간헐적 401.

**원인** — 프론트(`AuthContext`)와 서버(세션) 인증 기준이 분리된 데다,
쿠키 세션인데 `credentials` / `allowCredentials` 가 빠져 있었다.

**조치**
- 프론트: 앱 시작 시 세션 확인 API 호출 → `AuthContext` 상태 재구성
- 서버: 세션 유무로 인증 판단을 통일
- CORS: `allowCredentials=true` + 허용 origin 명시, 요청에 `credentials: "include"`

**검증** — 새로고침 · 다중 탭 · 라우팅 이동에서 로그인 상태 유지 확인.

**남아 있던 구멍(2026-08-20 에 고침)** — 전역 인증 계층은 사실 꺼진 상태였다.
`WebConfig.addInterceptors` 가 통째로 주석 처리되어 있어서 인증을 컨트롤러마다
손으로 하고 있었고, 그래서 빠뜨린 곳(게시글 수정)이 생겼다. 인터셉터가 차단할 때
상태 코드를 세우지 않아 클라이언트가 `200` + 빈 본문을 받는 문제도 함께 고쳤다.
`Modify.jsx` 의 저장 요청에만 `credentials` 가 빠져 있던 것도 같은 뿌리다.

</details>

### 2. DOCX 템플릿 플레이스홀더 치환 누락/깨짐

- DOCX 자동 생성 시 플레이스홀더가 안 바뀌거나 문장이 끊겨서 출력.
- 워드는 텍스트를 **run 단위로 쪼개** 저장하기 때문에 단순 문자열 replace 가 실패한다.
- 코드뿐 아니라 템플릿 작성 규칙까지 정해야 재현 가능한 산출물이 된다는 걸 배웠다.

<details><summary><b>더보기</b></summary>

**증상** — 플레이스홀더 일부 미치환, 문장 중간 끊김.

**원인** — `${NAME}` 이 `${업무` / `일자}` 처럼 여러 run 으로 나뉘어 저장되면
run 하나만 보고 치환할 수 없다.

**조치** — Apache POI(`XWPFDocument`)로 **문단 안 run 의 텍스트를 전부 이어붙여
판단하고, 치환이 필요하면 run 을 다시 쓴다.** 템플릿 작성 규칙(플레이스홀더 중간에
서식을 바꾸지 않기)도 함께 정했다.

**검증** — 템플릿 9개를 실제로 채워 남은 플레이스홀더가 없는지 보는 테스트를 뒀다
(`DocxTemplateServiceTest`). docx 를 압축 파일로 열어 XML 을 직접 훑으므로
치환 코드와 같은 방식으로 검사하지 않는다.

**2026-08-20 에 추가로 고친 것**
- 치환할 때 기존 run 을 지우고 새로 만들면서 **서식(`rPr`)이 사라졌다.** 템플릿에
  지정된 글자 크기가 날아가 표를 넘쳤다. 첫 run 의 서식을 복사해 물려준다.
- `values`(HashMap)를 순회하며 replace 를 반복해서 치환 순서가 불정이었다.
  사용자가 본문에 `${from_name}` 이라고 적으면 그것까지 2차로 치환됐다.
  정규식으로 한 번만 훑는다.
- 머리글 · 바닥글 · 텍스트박스 · 중첩 표까지 순회 대상을 넓혔다. 다만 지금
  템플릿에는 그 자리에 플레이스홀더가 없어서, 당장 달라지는 건 없다.

</details>

### 3. LLM 응답 JSON 파싱 실패/스키마 불일치

- LLM 요약 결과를 JSON 으로 저장하려 했는데 출력이 깨져 파싱·저장이 실패.
- LLM 은 "JSON 처럼 보이는 텍스트" 를 낼 수 있어 스키마가 흔들린다.
- 생성형 결과는 프롬프트와 서버 방어 로직을 같이 설계해야 운영이 된다는 걸 체감했다.

<details><summary><b>더보기</b></summary>

**증상** — JSON 파싱 오류(따옴표·쉼표·필드 누락), 필드명 변동으로 후처리 실패.

**원인** — 프롬프트가 느슨하면 형식이 흔들린다. 엄격한 JSON 을 항상 보장하지 않는다.

**조치**
- 프롬프트: "JSON only + 키 목록 고정 + 예시 제공" 으로 강화
- 서버: 백틱 제거 → 여는·닫는 괄호 위치로 잘라내기 → 실패 시 폴백 JSON
- 화면: JSON 이 아니면 원문 텍스트로 보여주는 경로 마련

**검증** — 파싱 실패로 기능이 멈추는 경우가 줄었다(실패를 흡수하고 계속 동작).

**2026-08-20 에 고친 것** — 프론트에 `extractPureJson`(백틱 벗기기)을 만들어 놓고
정작 호출하지 않아서, 상세 화면의 `JSON.parse` 가 늘 실패하고 요약 표 대신 회색
원문 덩어리가 나오고 있었다. 서버가 날짜를 주입할 때 어떤 양식이든 `TPL1_DATE` 만
넣던 것도 고쳤다 — TPL3~6 은 `TPL3_DATE` … 를 쓰므로 주입값이 버려지고
**AI 가 지어낸 날짜**가 문서에 들어갔다.

</details>

### 4. AI 연동 품질/안정성 이슈로 모델 교체 (Ollama → OpenAI)

- 로컬 모델 요약은 품질 편차와 지연·실패가 있어 사용자 경험이 불안정했다.
- 서비스 기준에서는 "가끔 잘 됨" 이 아니라 "항상 비슷한 품질" 이 필요하다.
- 요구 품질을 기준으로 모델·서빙을 고르는 트레이드오프 판단을 배웠다.

<details><summary><b>더보기</b></summary>

**증상** — 요약 품질 편차, 응답 지연·실패.

**원인** — 모델 성능 · 서빙 환경 · 프롬프트 최적화 난이도 차이로 일관성 확보가 어렵다.

**조치** — Spring AI 로 연동 구조를 정리하고 OpenAI 로 전환. 프롬프트·후처리 개선,
실패 시 안내 문구 표준화. (`application.yml` 에 Ollama 설정이 주석으로 남아 있다.)

**검증** — 응답 안정성과 결과 품질 편차가 줄었다.

</details>

### 5. Ant Design + Tailwind 스타일 충돌

- Antd 컴포넌트 스타일이 페이지마다 깨지거나 전역 스타일에 오염되는 문제.
- Tailwind reset(preflight)과 CSS import 순서·우선순위 충돌이 원인.
- UI 는 라이브러리 혼용 자체보다 **스타일 정책**을 먼저 세워야 유지보수된다는 걸 배웠다.

<details><summary><b>더보기</b></summary>

**증상** — 버튼 · 모달 스타일이 페이지마다 다르게 깨짐.

**원인** — reset(preflight) + 전역 우선순위 + CSS import 순서 충돌.

**조치** — CSS 로딩 순서를 정리하고, **Antd 는 컴포넌트 / Tailwind 는 레이아웃·간격**
으로 역할을 나눴다.

**검증** — 공통 컴포넌트 스타일이 화면 전반에서 일관되게 유지된다.

</details>

### 6. 파일 처리 라이브러리 선택 (Tika → 포맷별 분리)

- 로컬에서는 되는데 환경에 따라 예외가 나서 재현이 어려웠다.
- Tika 는 내부 의존과 런타임 영향이 커서 포맷별 안정성이 흔들릴 수 있다.
- 범용 도구 하나로 통합하기보다 포맷별로 책임을 나누는 설계를 배웠다.

<details><summary><b>더보기</b></summary>

**증상** — 환경별 예외 · 동작 불일치, 재현 어려움.

**원인** — Tika 의 내부 의존성과 포맷별 지원 범위 차이.

**조치** — Tika 를 걷어내고 **PDFBox(PDF) · POI(DOC/DOCX) · HWPLib(HWP)** 로
포맷별로 나눴다(`util/FileTextExtractor.java`). 지원 범위도 좁혀서 명시했다.

**검증** — 환경 차이로 인한 오류 빈도가 줄었다.

**2026-08-20 에 고친 것** — HWP 추출이 실패하면 예외를 삼키고 **파일 이름을 본문으로
반환**하고 있었다. 지금은 예외를 던진다.

</details>

### 7. HWP 문서 지원 제약

- HWP 는 라이브러리 지원이 약해 구현 리스크가 크다.
- 무리한 범용화는 일정·품질을 흔들 수 있어 지원 범위를 명확히 잡았다.
- 기술 한계가 있을 때 **지원 범위 정의**로 품질을 지키는 방법을 배웠다.

<details><summary><b>더보기</b></summary>

**증상** — HWP 처리·변환 기능 확장이 어렵다.

**원인** — 생태계 지원 부족 + Java 에서의 범용 처리 제약.

**조치** — HWPLib 으로 처리 범위를 확정하고, 요구사항을 조정해 안정성을 확보.

**검증** — 지원 범위 안의 기능은 안정적으로 동작한다.

</details>

### 8. Firebase 소셜 로그인: 클라이언트 인증 vs 서버 세션 불일치

- 프론트는 로그인처럼 보이는데 서버는 비로그인으로 판단하는 문제.
- Firebase Auth 는 클라이언트 기준이라 서버 세션과 연결하지 않으면 어긋난다.
- **토큰 검증 → 서버 세션화**까지가 소셜 로그인의 완성이라는 걸 배웠다.

<details><summary><b>더보기</b></summary>

**증상** — 서버 API 가 비로그인으로 판단, 계정 처리·가입 로직이 꼬임.

**원인** — 클라이언트(Firebase Auth) 상태와 서버 세션 체계가 분리.

**조치** — 프론트가 `idToken` 을 넘기고, 서버(Firebase Admin)가 검증한 뒤
회원 조회·가입까지 처리하고 세션에 로그인 상태를 저장한다.

**검증** — 프론트와 서버의 로그인 상태가 일관되게 동작한다.

**2026-08-20 에 고친 것** — 이메일만 맞으면 기존 계정의 세션을 내주고 있었다.
`isEmailVerified()` 확인이 없어서, 미검증 이메일을 싣는 공급자가 있으면 비밀번호
없이 계정을 넘겨받을 수 있는 구조였다. 이메일 기반 자동 병합을 없앴다.

</details>

### 9. Git 업로드 시 API 키/민감정보 유출 리스크

- 레포에 올리는 과정에서 API 키가 실수로 커밋될 위험이 있었다.
- 로컬 개발 편의로 설정·하드코딩이 섞여 있던 게 문제였다.
- 시크릿은 코드에서 분리하고 **관리 규칙**을 갖추는 습관이 생겼다.

<details><summary><b>더보기</b></summary>

**증상** — 설정 파일에 키가 포함된 채 커밋될 가능성.

**원인** — 키 하드코딩 · 설정 파일을 그대로 커밋.

**조치** — `ai.yml` · `send.yml` · `serviceAccountKey.json` 을 분리하고 `.gitignore`
처리. 프론트 API 주소도 `.env` 로 뺐다.

**검증** — 2026-08-20 점검에서 **커밋된 비밀키와 이력에 남은 키 모두 없음**을 확인했다.
전 DAO 가 `#{}` 바인딩이라 SQL 인젝션도 없다.

</details>

### 10. 파일 다운로드(Blob/헤더) 문제로 실패·손상·파일명 깨짐

- 다운로드가 브라우저마다 실패하거나 파일이 손상되고 한글 파일명이 깨졌다.
- 서버 헤더(`Content-Disposition`)와 프론트 Blob 처리가 맞지 않아서 생긴 문제.
- HTTP 헤더와 바이너리 처리까지 이해해야 안정적인 기능이 된다는 걸 배웠다.

<details><summary><b>더보기</b></summary>

**증상** — 다운로드 실패 · 파일 손상 · 한글 파일명 깨짐(환경별).

**원인** — 프론트가 바이너리 응답을 JSON 처럼 처리하거나 Blob 변환 누락.
서버의 `Content-Disposition` · 파일명 인코딩 처리 미흡.

**조치**
- 서버: `Content-Disposition: attachment` + UTF-8 파일명(RFC 6266 `filename*`)
- 프론트: 응답을 `blob()` 으로 받아 `URL.createObjectURL` → `<a download>` 로 저장

**검증** — Chrome · Edge 에서 정상 다운로드와 한글 파일명 유지 확인.

**2026-08-20 에 고친 것** — 인수인계서 다운로드 두 곳만 옛 방식이 남아 있었다.
`setContentDispositionFormData` 를 써서 응답에 `form-data` 타입이 나가고, 한글
파일명을 UTF-8 바이트에서 latin-1 로 재해석하고 있었다(Firefox · Safari 에서 깨진다).
나머지 다운로드와 같은 방식으로 통일했다.

</details>

---

## 내가 한 일

- 요구사항 정리 → DB 설계 → REST API → 화면 연동 → 예외 · 로그 → DOCX 산출까지
  엔드투엔드 구현
- "동작한다" 가 아니라 **운영 가능한가** 를 기준으로 개선 — 예외 분리, 재현 가능한 로그,
  실패했을 때 사용자에게 보이는 것까지
- 완성 후 저장소 전체를 다시 점검해 42건을 등급별로 정리하고 41건을 고쳤습니다
  ([`docs/FIX_PLAN.md`](docs/FIX_PLAN.md))

---

## 링크

- **발표 자료**: [PPT 다운로드](https://docs.google.com/presentation/d/1XuoEwugzBxHUy2-d6O0ZkvLRTWGguqHm/edit?usp=drive_link&ouid=112309789916009126624&rtpof=true&sd=true)
  — 트러블슈팅 내용 포함
- **작업 기록(노션)**: [방문하기](https://www.notion.so/2ecc2c49a250802ca80bd418e5d148fe?source=copy_link)
- **점검 · 수정 내역**: [`docs/FIX_PLAN.md`](docs/FIX_PLAN.md)

## 발표 자료 미리보기

아래 두 장은 발표 자료의 표지와 개요 슬라이드입니다. **실행 화면 스크린샷은 아직 없습니다.**

<img width="1919" height="1079" alt="발표 자료 표지 — WorkLog_Project Presentation, 2025.12.18" src="https://github.com/user-attachments/assets/2e4caa3d-8cbe-4322-8460-88471340a8a5" />
<img width="1920" height="1080" alt="발표 자료 개요 슬라이드 — 프로젝트명·기간(25.11.22~25.12.17)·목표" src="https://github.com/user-attachments/assets/c9863cd7-b685-4370-981f-e7d9030c4a15" />
