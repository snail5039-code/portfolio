# 수정 계획

작성일: 2026-08-20 (갱신: 2026-08-20)

> **진행 상황**: 42건 중 **41건을 이 브랜치에서 고쳤습니다.** 남은 것은 38번
> (무염 SHA-256) 하나이고, 그건 기존 계정 비밀번호가 전부 무효화되는 일이라
> 따로 계획해야 합니다. 아래 "안 고치는 것" 과 "남은 일" 을 보세요.
>
> 점검 목록에 없었지만 같이 고친 것 네 가지도 "덧붙여 고친 것" 에 적었습니다.
>
> 컴파일·빌드·단위 테스트로 검증했습니다. **런타임 검증은 못 했습니다** —
> MySQL·OpenAI 키·Firebase 자격증명이 있어야 하고 이 환경엔 없습니다.
> 머지 전에 로컬에서 직접 돌려보셔야 합니다. 특히 아래 세 가지는 화면에서
> 직접 확인하는 게 좋습니다.
>
> 1. **첨부파일 등록** — 글과 첨부를 한 트랜잭션으로 묶었습니다. 첨부가 실패하면
>    글도 남지 않습니다(예전에는 글만 남고 "완료" 라고 답했습니다).
> 2. **글 삭제** — 댓글·첨부 메타·디스크 파일까지 함께 지웁니다.
> 3. **DOCX 다운로드** — 치환한 문단의 서식(글자 크기)이 유지되는지.

`WorkLog_project` 전체(Spring 47개 · React 28개 파일)를 네 영역으로 나눠 검토한 결과와
수정 순서입니다. 영역은 인증·세션 / 데이터 접근·비즈니스 로직 / DOCX·파일 처리 / 프론트엔드입니다.

각 항목은 **직접 코드를 열어 확인한 것만** 적었습니다. 추측은 넣지 않았습니다.

---

## 요약

| 등급 | 건수 | 성격 |
| --- | --- | --- |
| P0 치명 | 8 | 클론하면 빌드가 안 되거나, 인증 없이 남의 데이터를 읽고 쓸 수 있거나, 저장 데이터가 오염됨 |
| P1 심각 | 11 | 배포하면 동작 불능, 사용자가 데이터를 잃거나 계정을 못 쓰게 됨 |
| P2 중간 | 14 | 기능이 조용히 안 되거나 잘못된 결과를 냄 |
| P3 낮음 | 9 | 표시 오류, 죽은 코드, 운영 위생 |

### 이 브랜치에서 고친 것

| 커밋 | 담은 항목 |
| --- | --- |
| `build: 클론하면 백엔드가 빌드되지 않던 문제` | 1 |
| `fix(security): 인증이 비어 있던 자리 넷을 메움` | 3, 6, 7, 17 |
| `fix(security): 남의 글을 고치고 남의 첨부를 받을 수 있던 문제` | 2, 4, 10, 16, 26(일부) |
| `fix: 인수인계 인자 순서와 문서 자원 누수, 빈 목록` | 5, 13, 20 |
| `fix(ui): 배포하면 사이트가 통째로 죽던 문제와 그 주변` | 8, 14, 15, 18, 19, 21 |
| `fix: 첨부가 조용히 사라지고 남의 글 id 를 받을 수 있던 문제` | 9, 11, 12, 27 |
| `fix: 조회가 조용히 틀린 값을 주던 자리 다섯` | 22, 23, 24, 32, 39 |
| `fix: 글을 지워도 댓글·첨부가 남던 문제와 인수인계 응답 헤더` | 25, 26(나머지) |
| `fix(docx): 치환이 서식을 지우고 두 번 일어나던 문제` | 28, 29, 30, 31, 41 |
| `fix(security): 인증 없이 열려 있던 두 API 와 인증번호 만료·시도 제한` | 34, 35, 36, 37 |
| `fix(ui): 목록이 이전 게시판을 보여주던 문제와 메뉴 키 충돌` | 33, 40, 42 |
| `fix: 챗봇이 크롤링해둔 문서를 거의 못 찾던 문제` | (아래 "덧붙여") |

**38번을 빼고 전부 처리했습니다.**

### 덧붙여 고친 것

점검 목록에 번호로 없던 것들인데, 코드를 보다가 같은 뿌리라서 함께 고쳤습니다.

| 위치 | 증상 |
| --- | --- |
| `ChatController.java:65` | 질문 **문장 전체**를 LIKE 패턴으로 써서 검색 결과가 사실상 늘 0건. 챗봇의 사이트 문맥이 항상 비어 크롤링해둔 것이 쓰이지 않았다. 낱말로 쪼개 찾도록 바꿨다 |
| `WorkChatAIService.java:180` | `result.replace("\n","\n\n")` 가 문단 구분이 아니라 **모든 줄**에 적용되어 불릿 사이까지 빈 줄이 생겼다. 인수인계서 줄 간격이 전부 벌어졌다 |
| `WorkChatAIService.java:101` | 어떤 템플릿이든 `TPL1_DATE` 만 주입했다. TPL3~6 은 `TPL3_DATE` … 를 쓰므로 주입값이 버려지고 **AI 가 지어낸 날짜**가 문서에 들어갔다 |
| `Write.jsx:167` | 보조내용을 비우면 `formData.append("sideContent", undefined)` 가 문자열 `"undefined"` 를 보내 DB 에 그대로 저장됐다 |

### 확인해 보니 지금은 증상이 없는 것 (28, 29)

템플릿 9개를 압축 파일로 열어 직접 셌습니다.

- **텍스트박스**: 양식4 에 2개, 양식6 에 6개 있습니다. 그런데 **그 안에
  플레이스홀더는 하나도 없습니다.** 머리글·바닥글도 양식6·7 에 있지만 비어 있습니다.
  순회 대상을 넓힌 것은 나중에 템플릿을 고칠 때를 위한 것이고, 지금 고쳐지는
  증상은 없습니다.
- **`<w:t>` 가 둘 이상인 run**: 전 템플릿에서 **0개**입니다. `run.getText(0)` →
  `run.text()` 변경도 지금은 눈에 보이는 차이가 없습니다.
- 반면 **30번(서식 유실)은 지금 실제로 일어납니다** — 치환되는 문단은 전부
  해당합니다.

**깨끗한 항목**: SQL 인젝션 없음(전 DAO `#{}` 바인딩, `${}` 사용 0건) · 커밋된 비밀키 없음
(`ai.yml`·`send.yml`·`serviceAccountKey.json`·`.env` 모두 `.gitignore` 처리, 이력에도 없음) ·
리스트 `key` prop 누락 없음 · 댓글/게시글 삭제의 소유권 검사 정상 ·
하드코딩된 파일시스템 절대경로 없음 · 템플릿 파일명 선택은 switch 화이트리스트로 고정됨.

---

## P0 — 치명

### 1. 클론하면 백엔드가 빌드되지 않는다
- **위치**: `WorkLog_project_Spring/.mvn/` (통째로 누락)
- **증상**: `mvnw`·`mvnw.cmd`만 커밋되어 `./mvnw`가
  `.mvn/wrapper/maven-wrapper.properties: No such file or directory`로 죽는다.
  README의 `mvn spring-boot:run`은 로컬에 Maven이 설치된 사람만 된다.
- **조치**: `.mvn/wrapper/maven-wrapper.properties` 추가. 신형(only-script) 래퍼라
  jar은 필요 없고 이 파일 하나면 Maven을 직접 내려받는다.
- **먼저 고치는 이유**: 이게 되어야 나머지 수정을 컴파일로 검증할 수 있다.

### 2. 게시글 수정 API에 인증도 소유권 검사도 없다
- **위치**: `WorkLogController.java:510`, `WorkLogDao.java:62`
- **증상**: `HttpSession`조차 받지 않는다. DAO도 `where id = #{id}`뿐.
  비로그인 상태로 `POST /api/usr/work/modify/1`을 보내면 남의 글이 덮어써진다.
  바로 아래 `deleteWorkLog`(515~535)는 세션 확인 + 작성자 대조를 제대로 한다.
- **조치**: 세션 로그인 확인 + `showDetail(id).getMemberId()` 대조 추가,
  DAO WHERE절에 `and memberId = #{memberId}` 추가(이중 방어).

### 3. 전역 인증 계층이 없다
- **위치**: `WebConfig.java:27-32`
- **증상**: `addInterceptors`가 통째로 주석 처리("혹시 모르니 남겨놓자").
  Spring Security 의존성도 없다. 각 메서드가 개별로 세션을 보지 않으면 그 API는 공개다.
  2번이 그 결과다. 게다가 `NeedLoginInterceptor:19-22`는 차단 시 `return false`만 하고
  상태 코드를 안 세워, 등록하더라도 클라이언트는 200 + 빈 본문을 받는다.
- **조치**: 인터셉터를 401을 세우도록 고치고 등록한다. 개별 컨트롤러 검사와 병행한다.

### 4. 첨부파일 다운로드가 인증 없이 임의 경로를 서빙한다
- **위치**: `WorkLogController.java:253-300`
- **증상**: 세 가지가 겹쳐 있다.
  1. `originalFilename == null`일 때 로그만 찍고 **return이 없어 그대로 진행**한다.
     DB에 없는 이름도 서빙된다.
  2. `Paths.get(uploadDir).resolve(storedFilename).normalize()` — `normalize()`는 `..`를
     정리할 뿐 차단하지 않는다. `startsWith(uploadDir)` 검증이 없다.
  3. 세션 검사가 없다.
- **조치**: null이면 즉시 404 · 정규화 후 `uploadDir` 하위인지 검증 · 로그인과 소유권 확인.
  셋이 함께 들어가야 의미가 있다.

### 5. 인수인계 저장 시 인자 순서가 두 번 밀려 컬럼이 뒤섞인다
- **위치**: `WorkLogController.java:577` → `HandoverLogService.java:29` → `HandoverLogDao.java:45`
- **증상**: 실제 저장되는 값

  | DB 컬럼 | 들어가는 값 |
  | --- | --- |
  | `name` | 보내는 사람 직무 |
  | `toName` | 로그인 사용자 이름 |
  | `toJob` | 제목 |
  | `fromJob` | 받는 사람 이름 |
  | `title` | 받는 사람 직무 |

  574행의 DOCX 생성은 값을 직접 넘기므로 **즉시 받는 파일은 멀쩡하다.** 대신 DB 기록이
  오염되어 목록(`/api/handover/list`)과 재다운로드(`/handover/download/{id}`)가 전부 엉킨다.
  `toJob VARCHAR(100)`에 제목이 들어가므로 제목이 101자를 넘으면 `Error 1406`으로
  다운로드 자체가 실패한다.
- **조치**: 위치 인자 9개를 `HandoverLog` DTO 하나로 바꾼다. 순서 실수가 재발할 수 없는 형태로.

### 6. 정보 수정 시 비밀번호가 평문 저장되어 본인도 로그인 불가
- **위치**: `MemberService.java:34`
- **증상**: `memberJoin`(20~21행)과 `changePassword`(41행)는 `SHA256Util.encrypt`를 쓰는데
  `updateMyInfo`만 빠졌다. 로그인은 해시로 대조하므로 마이페이지에서 비밀번호를 바꾸면
  **영구 로그인 불가**. 동시에 평문이 DB에 남는다.
- **조치**: `updateMyInfo`에도 암호화 적용. 빈 값이면 비밀번호를 건드리지 않도록 분기.
- **추가 필요**: 이미 평문으로 저장된 계정이 있는지 운영 DB 점검. (코드 수정만으로 복구 안 됨)

### 7. 소셜 로그인이 이메일만 맞으면 기존 계정 세션을 내준다
- **위치**: `MemberController.java:237-239`
- **증상**: `decodedToken.isEmailVerified()` 확인 없이 `findEmail(email)`로 기존 계정을 찾아
  세션을 발급한다. 미검증 이메일을 클레임에 싣는 공급자가 있으면 비밀번호 없이 계정 탈취.
  같은 블록 233행 `provider.toUpperCase()`는 `provider`가 null이면 NPE.
- **조치**: 이메일 기반 자동 병합 제거. `isEmailVerified()` 확인. `provider` null 검증.

### 8. 배포하면 프론트엔드가 통째로 죽는다
- **위치**: `WorkLog_project_React/src` 전역 35곳
- **증상**: API 주소 `http://localhost:8081` 하드코딩 35곳, `import.meta.env` 사용 0곳.
  배포본에서 사용자 브라우저가 자기 PC의 8081로 요청한다. 세션 조회부터 실패하므로
  로그인이 안 되고 모든 페이지가 로그인 화면으로 튕긴다.
- **조치**: `VITE_API_BASE_URL` 환경변수 도입, `src/config/api.js`로 단일화. `.env.example` 추가.

---

## P1 — 심각

### 9. `LAST_INSERT_ID()`를 트랜잭션 없이 별도 커넥션에서 호출
- **위치**: `WorkLogDao.java:72`, 호출부 `WorkLogController.java:203, 244, 864, 1127`
- **증상**: 프로젝트 전체에 `@Transactional`이 **0건**. MyBatis-Spring은 트랜잭션이 없으면
  statement마다 커넥션을 반납한다. `LAST_INSERT_ID()`는 커넥션 단위 값이라 동시 등록 시
  **남의 글 ID**를 받아 첨부파일이 엉뚱한 글에 붙는다. 새 커넥션을 잡으면 0이 반환되어
  첨부가 조용히 유실된다.
- **조치**: `@Options(useGeneratedKeys = true, keyProperty = "id")`로 전환.
  글 등록~첨부 저장 구간에 `@Transactional`.

### 10. 비로그인 요청이 401이 아니라 500을 낸다
- **위치**: `WorkLogController.java:184`, `:365-371`
- **증상**: `int memberIdObj = (int) session.getAttribute(...)` — 세션이 없으면 언박싱 NPE.
  184행은 **AI 호출(166~183행) 뒤에** 있어, 인증 없이도 매 요청마다 LLM 추론이 돈다(비용 낭비).
  365~371행의 `if (memberId == -1)` 검사는 그 전에 NPE가 나므로 도달 불가능한 죽은 코드.
- **조치**: `Integer`로 받아 null 검사 후 401. 인증 검사를 AI 호출 **앞으로** 옮긴다.

### 11. 업로드 실패를 삼켜서 "완료"라고 답한다
- **위치**: `FileAttachService.java:42-54`
- **증상**: `catch (IOException e)`가 `System.out.println` 한 줄로 끝나고 재던지지 않는다.
  호출부는 결과를 확인하지 않고 무조건 `return "데이터 입력 완료"`. 디스크 쓰기나 DB insert가
  실패해도 사용자는 성공 응답을 받고 첨부는 사라진다.
- **조치**: 예외를 던지도록 변경. 호출부에서 처리.

### 12. 업로드 크기·형식 검증이 없고 multipart 한도가 기본값(1MB)이다
- **위치**: `FileAttachService.java:27-55`, `application.yml`(`spring.servlet.multipart` 섹션 없음)
- **증상**: 3MB PDF를 첨부하면 컨트롤러 진입 전에 `MaxUploadSizeExceededException`이 나고,
  이를 받을 `@ControllerAdvice`가 없어 **업무일지 본문까지 통째로 저장 실패**. 사용자는
  원인 안내를 못 받는다. 반대로 `report.docx.exe`는 아무 검증 없이 저장된다.
- **조치**: `max-file-size`·`max-request-size` 명시, 확장자 화이트리스트,
  `MaxUploadSizeExceededException` 핸들러 추가.

### 13. `XWPFDocument`를 닫지 않는다
- **위치**: `DocxTemplateService.java:23-36`
- **증상**: try-with-resources가 `InputStream`만 관리한다. `XWPFDocument`은 내부에
  `OPCPackage`를 들고 있어 명시적으로 닫아야 한다. `return`으로 빠져나가 정리 코드도 없다.
  DOCX 다운로드마다 누수.
- **조치**: try-with-resources에 `XWPFDocument`도 포함. 한 줄 수정.

### 14. 수정 저장 요청에만 `credentials` 누락
- **위치**: `Modify.jsx:78-85`
- **증상**: 같은 파일 45행의 조회에는 `credentials: "include"`가 있는데 저장에만 빠졌다.
  JSESSIONID가 안 실려 서버가 새 익명 세션을 만든다. 수정 내용이 통째로 날아간다.
- **조치**: `credentials: "include"` 추가.

### 15. 에러 처리 코드가 스스로 에러를 낸다
- **위치**: `Login.jsx:209, 239, 285`
- **증상**: `catch (error)`인데 본문에서 `err.message`를 참조한다.
  `ReferenceError: err is not defined`로 에러 처리 경로가 다시 터져 **아무 메시지도 안 뜬다.**
  `finally`는 돌아 스피너만 꺼지므로 사용자는 버튼이 먹통이라고 느낀다.
  176행만 `error.message`로 올바르다.
- **조치**: 세 곳 모두 `error.message`로 수정.

### 16. 월간 보고서에 이슈 섹션이 중복 출력된다
- **위치**: `WorkLogController.java:971`
- **증상**: 964행에서 이슈 블록을 제거한 `mainText`를 계산해 놓고, 971행에서 `full`을 넣는다.
  주간 메서드(913행)는 `mainText`를 올바르게 넣는다. 복사·붙여넣기 실수.
  결과적으로 본문 칸과 이슈 칸에 같은 내용이 두 번 인쇄된다.
- **조치**: `values.put("${TPLM1_MAIN}", mainText)`. 한 단어 수정.

### 17. CORS 오리진 하나가 조용히 사라진다
- **위치**: `WebConfig.java:24-25`
- **증상**: `allowedOrigins`를 두 번 호출한다. 이 메서드는 누적이 아니라 치환이라
  두 번째가 첫 번째를 지운다. `http://localhost:3000`은 삭제된다.
- **조치**: 인자 두 개를 한 번에 넘긴다.

### 18. `AuthProvider`가 이중으로 감싸여 있다
- **위치**: `main.jsx:10`, `App.jsx:31`
- **증상**: Provider가 두 번 중첩되어 각각 독립된 상태와 `useEffect`를 갖는다. 안쪽이
  바깥을 가리므로 바깥은 아무도 구독하지 않는 죽은 상태인데 세션 API 요청은 그대로 나간다.
  페이지 진입마다 세션 조회 2회(StrictMode 개발 모드에서는 4회).
- **조치**: `App.jsx`쪽 하나만 남긴다.

### 19. 세션 응답을 검증하지 않아 로그인 상태를 오판한다
- **위치**: `AuthContext.jsx:24-34`
- **증상**: `res.ok`가 아닐 때 else 분기가 없어 500과 "비로그인"을 구분하지 않는다.
  응답이 `null`이나 객체로 오면 `isLoginedId`가 그 값이 되는데, 앱 전역 가드는
  `isLoginedId === 0` / `!== 0` 비교라 `null !== 0`은 참 → **로그인 상태로 오판**한다.
- **조치**: 숫자 검증 후 대입, 실패 시 0으로 확정.

---

## P2 — 중간

| # | 위치 | 증상 | 조치 |
| --- | --- | --- | --- |
| 20 | `PageContentController.java:28` | `searchByKeyword(null)`이 `findAll()`을 부른다는 주석과 달리 null 분기가 없다. `LIKE CONCAT('%', NULL, '%')`는 NULL이라 **항상 빈 배열**. `findAll()`은 죽은 코드 | null이면 `findAll()` 호출 |
| 21 | `Detail.jsx:66` | 코드펜스 제거용 `extractPureJson`을 만들어 놓고 한 번도 호출하지 않는다. `JSON.parse`가 항상 throw → **AI 요약 표가 안 나오고 회색 원문 덩어리** 노출 | 파싱 전에 호출 |
| 22 | `WorkLogDao.java` + `application.yml` | `map-underscore-to-camel-case` 미설정이라 `crawled_at` → `crawledAt` 매핑 실패. 응답이 항상 `null` | 설정 추가 또는 `AS` 별칭 |
| 23 | `WorkLogController.java:329-337` | 마이페이지 페이징만 하한 검증이 없다(`showList`·`getMyHandoverList`에는 있음). `?page=0` → `OFFSET -10` → 500 | 클램프 추가 |
| 24 | `WorkLogController.java:635-669` | 인수인계 본문을 "최근 200건"만 조회해 Java에서 기간 필터. 정확한 SQL(`getLogsByDateRange`)이 이미 있는데 안 쓴다. 글 300건이면 오래된 기간은 **내용 없는 인수인계서**가 나오고 에러도 안 난다 | `getLogsByDateRange` 사용 |
| 25 | `WorkLogController.java:533` | 게시글 삭제 시 댓글·첨부 메타·디스크 파일이 전부 고아로 남는다. 스키마에 FK도 CASCADE도 없음 | 자식 행·파일 삭제 추가 |
| 26 | `WorkLogController.java:284-293` 외 2곳 | 한글 파일명을 UTF-8 바이트→latin-1 재해석으로 보낸다. Firefox·Safari에서 깨진 이름으로 저장. 587행은 `setContentDispositionFormData`를 써서 **응답에 `form-data` 타입**이 나간다 | `ContentDisposition.attachment().filename(name, UTF_8)`로 통일 (정답 코드가 925·983행·`TestDocxController:66`에 이미 있다) |
| 27 | `FileAttachService.java:29-39` | `getOriginalFilename()`을 정제 없이 쓴다. UUID 접두어가 선두 `../`는 막지만 중간 구분자는 못 막는다. `mkdir()`은 한 단계만 만들고 반환값 무시 | `cleanPath` + `mkdirs()` 반환값 확인 |
| 28 | `DocxTemplateService.java:72, 104` | `run.getText(0)`은 run의 첫 `<w:t>`만 읽는데, 치환 시 run을 전부 지우고 다시 쓴다. 읽지 못한 나머지 텍스트가 **사라진다.** 양식4·6에 해당 run 존재 확인 | run 내 전체 `<w:t>` 이어붙이기 |
| 29 | `DocxTemplateService.java` | 텍스트박스(`w:txbxContent`)·헤더·푸터·중첩 표를 순회하지 않는다. 양식4·6에 텍스트박스 존재. 그 안의 플레이스홀더는 **문자열 그대로 인쇄**된다 | 순회 대상 확장 |
| 30 | `DocxTemplateService.java:84-89` | 치환 시 기존 run을 지우고 `createRun()`으로 새로 만들어 서식(`rPr`)이 사라진다. 10pt 지정이 날아가 표를 넘친다 | 첫 run의 `rPr` 복사 |
| 31 | `DocxTemplateService.java:133` | `values`가 `HashMap`이라 치환 순서가 불정. 사용자가 본문에 `${from_name}`이라고 쓰면 **2차 치환**된다 | 한 번에 훑는 방식으로 변경 |
| 32 | `TemplateMetaService.java:116-119` | 미등록 templateId가 조용히 TPL1로 폴백. 다운로드 경로의 switch는 TPL2에 404를 내므로 두 경로의 유효 ID 집합이 다르다. 결과는 **플레이스홀더가 그대로 남은 빈 문서** | 미등록 ID는 거부 |
| 33 | `List.jsx:53-85` | 게시판 전환 시 `setPage(1)`과 fetch가 같은 커밋에서 돌아 요청 2개가 나간다. `AbortController`가 없어 늦게 온 응답이 덮어쓴다 | AbortController 추가 |

---

## P3 — 낮음

| # | 위치 | 증상 |
| --- | --- | --- |
| 34 | `MailTestController.java:18` | 인증 없는 메일 발송. 임의 주소로 무제한 발송 가능 — 운영 배포 시 제거 대상 |
| 35 | `CrawlController.java:25-45` | 인증 없는 크롤링(SSRF). 내부 주소를 서버가 대신 요청하고 결과가 `/api/pages`로 노출 |
| 36 | `MemberController.java:102-110` | 아이디 찾기 인증번호에 만료 검증 누락(비밀번호 찾기 쪽에는 있음). 시도 횟수 제한도 없음 |
| 37 | `Member.java:16` | `loginPw`에 `@JsonIgnore`가 없어 마이페이지 응답 JSON에 해시가 실린다 |
| 38 | `SHA256Util.java:14` | 무염·1회 SHA-256. `text.getBytes()`가 플랫폼 기본 인코딩 |
| 39 | `WorkLogController.java:387` | 목록 기본 `size`가 1. `size` 없이 호출하면 1건만 온다 |
| 40 | `MainLayout.jsx:97, 118` | 서로 다른 두 메뉴가 `work` 키를 공유해 함께 접힌다(`etc` 키는 선언만 되고 미사용) |
| 41 | `FileTextExtractor.java:46-59` | HWP 추출 실패 시 `IOException`을 삼키고 **파일 이름을 본문으로 반환**한다. 현재 미호출이라 잠복 상태 |
| 42 | `package.json` | `@ant-design/icons`·`dayjs`가 미선언 유령 의존성. 엄격한 호이스팅 환경에서 빌드 실패 |

---

## 안 고치는 것

| 항목 | 이유 |
| --- | --- |
| `SHA256Util` → bcrypt 전환 | 기존 계정 비밀번호가 전부 무효화된다. 마이그레이션 절차(로그인 시 재해시)를 따로 설계해야 하므로 이번 범위 밖. 38번으로 남긴다 |
| `firebaseConfig.jsx` 하드코딩 | Firebase 웹 `apiKey`는 설계상 공개되는 식별자라 유출 사고가 아니다. 다만 8번(환경변수 도입)과 함께 정리하면 dev/prod 분리가 가능해진다 |
| 번들 코드 스플리팅 | 1.53MB(gzip 461KB) 단일 청크는 경고지 버그가 아니다 |
| `logindeMemberId` 오타 | 21곳 전부 동일 철자라 동작에 문제 없다. 고치면 오히려 누락 위험 |

---

## 남은 일

1. **38번 — 무염 SHA-256** (P3, 코드 수정 안 함)
   bcrypt 로 바꾸면 기존 계정 비밀번호가 전부 무효화됩니다. "로그인 성공 시
   재해시" 같은 마이그레이션 절차를 따로 설계해야 합니다.
   `text.getBytes()` 의 플랫폼 기본 인코딩도 **일부러 손대지 않았습니다** —
   지금 저장된 해시가 어떤 인코딩으로 만들어졌는지 알 수 없어서, UTF-8 로 고정하면
   비ASCII 비밀번호를 쓰는 계정이 로그인하지 못할 수 있습니다. 재해시 절차를
   만들 때 같이 정하는 게 맞습니다.

2. **운영 DB 점검** — 6번 때문에 이미 평문으로 저장된 비밀번호가 있는지는
   코드로 알 수 없습니다. 직접 확인해야 합니다.

3. **정한 뒤에 조정할 값**
   - 업로드 한도를 **파일 10MB · 요청 50MB** 로 넣었습니다(기본값은 1MB·10MB).
     디스크 용량과 운영 정책에 맞게 `application.yml` 에서 조정하세요.
   - 허용 확장자 목록은 `FileAttachService.ALLOWED_EXTENSIONS` 에 있습니다.
   - 인수인계서 재료는 여전히 **최근 20건까지만** AI 에 넘깁니다. 이제는
     조용히 자르지 않고 로그에 남깁니다(`인수인계 재료를 N건 중 앞 20건만`).
   - `/api/chat` 은 아직 **무인증**입니다. 유료 LLM 호출이 열려 있는 셈인데,
     비로그인 방문자도 챗봇을 쓰게 할지는 제품 판단이라 그대로 뒀습니다.

## 검증 방법

```bash
cd WorkLog_project_Spring && ./mvnw -B -DskipTests compile
cd WorkLog_project_Spring && ./mvnw -B test -Dtest='DocxTemplateServiceTest,PageContentServiceTest'
cd WorkLog_project_React  && npm run build
```

테스트 두 개는 스프링 컨텍스트를 띄우지 않는 단위 테스트라 이 환경에서도 돕니다.

- `DocxTemplateServiceTest` — 템플릿 9개를 실제로 채워서 남은 플레이스홀더가
  없는지 본다. docx 를 압축 파일로 열어 XML 을 직접 훑으므로 치환 코드와 같은
  방식으로 검사하지 않는다.
- `PageContentServiceTest` — 챗봇 검색이 질문을 낱말로 쪼개는지 본다.

`./mvnw test` 를 그냥 돌리면 **`WorkLogProjectApplicationTests` 가 실패합니다.**
이건 원래부터 그렇습니다 — `application.yml` 이 `classpath:ai.yml`·`send.yml` 을
import 하는데 두 파일은 `.gitignore` 처리되어 이 환경에 없어서 컨텍스트가
아예 안 뜹니다. 제 수정과는 무관합니다.

런타임 검증(MySQL·OpenAI 키·Firebase 자격증명 필요)은 이 환경에서 불가능하다.
**실제 동작 확인은 로컬에서 직접 돌려봐야 한다.**
