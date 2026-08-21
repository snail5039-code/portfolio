# GestureOS / GestureOSManager

손 제스처를 인식해 **Windows 마우스/키보드/PPT/드로잉**을 제어하는 접근성(대체 입력) 기반 프로젝트입니다.  
초기 목표는 **수어 번역**(Sign Language Translation)이었으나, 실사용 환경에서 연속 동작 안정성이 부족하여 **모드별 매핑 + 개인별 학습(MLP)** 중심의 **OS 제어 시스템**으로 방향을 전환했습니다.

- **구성**: `GestureOSManager`(데스크톱·에이전트·제어 서버) + `GestureOSManagerWeb`(계정·게시판 웹)
- **지금 상태**: 로컬 개발까지 동작합니다. 배포는 하지 않았고, 설치본은 제어 서버와
  파이썬 에이전트를 함께 띄워야 동작합니다.
- **최근 점검**: 2026-08-20 — [점검 내역](#2026-08-최근-점검)
- 개발 과정의 트러블슈팅 기록은 바로 아래 [트러블슈팅(상세)](#트러블슈팅상세) 에 있습니다.

---

## 트러블슈팅(상세)

### 1) 소셜 로그인 / 토큰 불일치
- **증상**
  - 로그인 직후 사용자 정보/프로필이 UI에 즉시 반영되지 않음(새로고침 필요)
  - 간헐적으로 인증이 풀리거나, 일부 API만 401이 발생
- **원인**
  - Access/Refresh 토큰 저장 위치/전달 방식(쿠키/헤더/스토리지) 혼재
  - OAuth 콜백 이후 상태 갱신 타이밍 부족(콜백 직후 me 재조회 누락)
  - 401 발생 시 갱신/재시도 흐름이 화면별로 달라 일관성 붕괴
- **조치**
  - 토큰 규격/저장 규칙 단일화
  - 로그인 성공 직후 **me(사용자 정보) 재호출**로 상태 확정
  - Axios **401 인터셉터**로 refresh → 재시도 흐름 표준화
- **결과**
  - 로그인 직후 UI 반영 안정화, 세션 유지/재시도 일관성 확보

---

### 2) Windows 10/11 호환 · SendInput 입력주입 이슈
- **증상**
  - 개발 환경(VSCode 실행)에서는 정상
  - **설치본(EXE) + Windows 11**에서만 `SendInput`이 무시되어 마우스/키보드 입력이 들어가지 않음  
    → PPT/드로잉 등 제어 모드 전부 동작 불가
- **원인**
  - UAC(관리자 권한)/무결성 레벨 조건에 따라 입력 주입이 제한될 수 있음
  - 커서 이동의 **절대좌표(0~65535) 정규화** 불일치 가능
  - 클릭/키입력에서 **Down→Up 이벤트 시퀀스** 누락/순서 꼬임 가능
  - Win10/Win11 환경 차이에 따른 입력 처리 민감도 차이
- **조치**
  - 관리자 권한 실행 기준 정리(테스트/실행 조건 통일)
  - SendInput 이벤트 **Down→Up 순서 고정**
  - 커서 이동 **절대좌표 정규화 적용**
  - 반환값/에러/상태를 로그로 남겨 재현 가능한 검증 루프 구성
- **결과**
  - 로컬 실행(개발/테스트)에서는 입력주입 안정화까지 진행  
  - **설치본(EXE) 환경에서는 Win11 호환/권한 조건 이슈로 최종 완전 해결에 미도달** → 설치형 배포는 개선 과제로 분리

---

### 3) MediaPipe 인식 한계 + 수어 번역 목표의 현실성 문제 → 방향 전환(Pivot)
- **증상**
  - 조명/각도/거리 변화에서 인식이 흔들리고 연속 동작에서 라벨 안정성이 낮아짐
  - 번역 목표는 “정확도”가 핵심인데, 환경 편차로 품질 보장이 어려움
- **원인**
  - 전이 구간(손 모양이 변하는 순간)에서 오분류가 발생하기 쉬움
  - 같은 제스처가 여러 기능에 매핑되면 충돌이 커짐
- **조치**
  - 목표를 번역 중심에서 **접근성 OS 제어(대체 입력)**로 전환
  - 정적 제스처/확실한 구간 중심으로 제스처 세트 재정의
  - **모드 시스템**으로 제스처 세트를 분리(Mouse/Keyboard/PPT/Drawing)
- **결과**
  - “인식 데모”가 아니라 실제로 조작 가능한 제어 체계로 정리됨

---

### 4) 로컬 vs 배포 API/WS 불일치 / 배포 실패
- **증상**
  - 로컬에서는 정상 동작하지만 배포에서는 API/WS 호출이 깨짐(401/404/timeout/WS disconnect)
- **원인**
  - 로컬/배포 환경에서 API/WS 경로·포트·라우팅 규칙이 다름
  - Nginx 프록시/리버스프록시/WS 업그레이드 설정 미정리
  - 일부 하드코딩(주소/포트)이 환경별로 충돌
- **조치**
  - 로컬 기준으로 baseURL/WS URL 분리 및 호출 구조 정리(8080/8082 역할 분리)
  - 배포는 라우팅/프록시까지 포함해 설정 정리가 필요했으나 일정/범위상 미완
- **결과**
  - **로컬 성공, 배포 실패(개선 과제로 분리)**

---

### 5) file://(설치본) 환경에서 API 경로가 파일 경로로 해석되는 문제
- **증상**
  - 설치본(Electron, file://)에서 `/api` 호출이 `C:\api\...`처럼 해석되어 호출 실패
- **원인**
  - file 프로토콜에서는 상대경로가 파일 시스템 경로로 해석될 수 있음
- **조치**
  - 설치본에서는 `http://localhost:8080/api` 또는 `http://localhost:8082/api`로 **환경 분기**
  - 개발환경(http)에서는 proxy/상대경로 유지
- **결과**
  - 설치 환경에서 API 호출 구조가 깨지지 않도록 기준 수립

---

### 6) 8080/8082 포트 혼재로 기능별 랜덤 오류
- **증상**
  - 로그인/프로필/트레이닝/제어가 서로 다른 포트를 섞어 쓰며 화면별로 랜덤 오류 발생
- **원인**
  - 기능 책임 서버(제어/웹) 기준이 불명확한 상태에서 포트가 섞임
- **조치**
  - 포트 역할을 명시적으로 분리하고(8080=제어, 8082=웹) baseURL/WS를 통일
- **결과**
  - 재현 가능한 호출 구조 확보(특히 로컬에서 안정화)

---

### 7) WebSocket 끊김 / 상태 미갱신
- **증상**
  - UI는 떠 있는데 상태가 갱신되지 않아 제어가 안 되는 것처럼 보임
- **원인**
  - WS URL 환경 분기 실패, 재연결/구독 처리 미흡
- **조치**
  - WS URL 분기 + 재연결 로직 + 구독자(listener) 패턴으로 안정화
- **결과**
  - 상태/명령 동기화 품질 향상

---

### 8) OpenAI 키(401) / 응답 파싱 안정화
- **증상**
  - 실행 방식(STS/PowerShell/빌드 환경) 따라 이전 키가 물려 401
  - 응답은 왔으나 텍스트 추출이 실패하는 케이스 발생
- **원인**
  - 설정 주입 우선순위 혼재(환경변수/설정파일/런타임)
  - Responses API 응답 구조 처리 미흡
- **조치**
  - `OPENAI_API_KEY` 환경변수 기반으로 단일화(레포에 키 미포함)
  - 텍스트 추출 로직 보강 + 실패 시 raw 응답 로깅으로 추적 가능화
- **결과**
  - 키/응답 처리 안정성 개선

---

### 9) 다국어 번역(n8n) 품질 이슈
- **증상**
  - 자동번역 문장 어색함, 용어 불일치로 UX 품질 저하
- **원인**
  - 문맥/용어 일관성 부족, 언어별 품질 편차
- **조치**
  - i18n JSON 수동 고정 + 키 네이밍/검수 규칙 적용
- **결과**
  - 화면 품질/일관성 개선

---

## 2026-08 최근 점검

### 마우스 모드가 첫 프레임에서 죽던 문제 (08-20)

`run()` 이 `block_by_palette` 를 대입하기 전에 읽고 있었습니다. 같은 함수 안에서 나중에
대입되는 이름이라 파이썬은 지역변수로 잡고 `UnboundLocalError` 를 냅니다. 조건이
`mode_u == "MOUSE"` 뒤라 마우스 모드를 켜면 매 프레임 걸리는 자리였고, `main.py` 가
`run()` 을 `try/finally` 로만 감싸므로 에이전트가 그대로 종료됐습니다. 팔레트 모달 계산을
핀치 고정 블록보다 앞으로 옮겨서 해결했습니다.

구문 검사(`compileall`)는 이걸 못 잡습니다. 7월 점검에서 통과하고 있었던 것이 그 이유라
검사 목록에 `pyflakes` 를 넣었습니다. 같이 발견한 것으로, `eslint.config.js` 의 `files` 가
`js,jsx` 만 잡아 Electron 진입 파일(`main.cjs`·`preload.cjs`)에 규칙이 0개 적용되고
있던 것도 고쳤습니다.

### 인증·권한 (08-19)

이 회차는 새 기능 대신, 로컬에서 열려 있던 인증·권한 경로를 닫는 데 썼습니다.
전체 목록은 [PROJECT_STATUS.md](./PROJECT_STATUS.md) 에 있고, 큰 것만 옮기면 이렇습니다.

| 무엇이 문제였나 | 어떻게 됐나 |
| --- | --- |
| 제어 서버가 모든 인터페이스에 바인딩되어 **같은 네트워크의 다른 기기가 제어 API를 호출**할 수 있었다 | `127.0.0.1` 에만 바인딩 |
| 사용자가 열어둔 웹페이지가 `localhost:8080` 으로 요청해 **제스처 에이전트를 조작**할 수 있었다 | 기동 시 임의 토큰을 만들어 `~/.gestureos/session.token` 에 쓰고, `/api/health` 외 모든 API·WebSocket 에서 요구 |
| 클라이언트가 보낸 `X-User-Id` 헤더 숫자를 그대로 회원 ID로 써서 **헤더만 바꾸면 남의 학습 프로필을 읽고 지울 수 있었다** | 액세스 토큰을 계정 서버 `/api/members/me` 에 확인해 회원 ID를 정한다. 확인 실패 시 게스트 |
| UI가 에이전트와 같은 `/ws/agent` 를 써서 **UI가 접속하면 에이전트 세션을 빼앗았다** | UI를 `/ws/ui` 로 분리 |
| 인증키·JWT 서명키가 **소스에 커밋**되어 있었다 | 전부 환경변수로 옮기고 기본값 제거. `.env.example` 로 목록만 남김 |
| 소셜 가입 계정도 아이디/비밀번호로 로그인돼 **공용 계정 경로**가 열려 있었다 | 소셜 계정의 비밀번호 로그인 차단, 평문 비밀번호는 bcrypt 로 이관 |
| 회원 응답에 **비밀번호 해시와 `providerKey` 가 그대로 나갔다** | 직렬화에서 제외 |
| 프로필 이미지 확장자만 보고 저장해 **아무 파일이나 업로드**됐다 | 파일 내용으로 이미지 형식 판별 |
| 선택 설정(메일·AI·소셜)이 없으면 **서버가 아예 뜨지 않았다** | 그 기능만 끄고 기동하며 `[CONFIG]` 로그로 알린다 |

남은 것 중 가장 큰 항목은 **폰 연동 인증**입니다. `--phone` 을 켜면 TCP 8081(화면 스트리밍)과
UDP 39500(원격 입력)이 인증 없이 열립니다. 그래서 기본이 꺼짐이고, 페어링에 시크릿을
붙이는 작업이 남았습니다.

---

## 핵심 기능
- **모드별 매핑(Mode-based Mapping)**: Mouse / Keyboard / PPT / Drawing 모드별 제스처→동작 규칙 분리
- **개인별 학습(MLP 트레이닝)**: 손 랜드마크(21×3=63) 기반 개인화 학습으로 사용자/환경 편차 보정
- **Windows 입력주입**: WinAPI `SendInput` 기반 전역 입력 주입
- **실시간 연동**: 매니저 ↔ 서버(8080/8082) ↔ 에이전트 상태/명령 WebSocket 연동
- **OpenAI 도우미**: OpenAI Responses API 기반 도우미/가이드 기능
- **페어링(QR/UDP)**: 자동 감지/연결 시도(설정 저장 포함). 기본 꺼짐
- **HUD/오버레이**: 현재 모드/상태/제스처 피드백 표시

### 기본 제스처 매핑 (마우스 모드)

| 제스처 | 동작 |
| --- | --- |
| 손 펴기 (OPEN_PALM) | 커서 이동 |
| 검지 집기 (PINCH_INDEX) | 클릭 / 드래그 |
| 브이 (V_SIGN) | 우클릭 |
| 주먹 (FIST) | 잠금 토글 · 다른 손으로 스크롤 |

매핑은 설정 화면에서 바꿀 수 있고, 잘 안 잡히면 학습 화면에서 본인 손으로 학습시킬 수 있습니다.

---

## 기술 스택
- **매니저(데스크톱)**: Electron, React 19, Vite, Axios, WebSocket, electron-builder
- **웹(웹 매니저)**: React 19, Vite, Axios
- **백엔드(제어/웹)**: Java 17, Spring Boot 3, Spring Security(OAuth2/JWT), REST API, WebSocket, MyBatis
- **DB**: PostgreSQL 16 (docker-compose)
- **에이전트(AI/제어)**: Python 3.12, MediaPipe Hands, OpenCV, NumPy, MLP, PySide6, WinAPI(ctypes), SendInput
- **AI API**: OpenAI Responses API, Embeddings(text-embedding-3-small)
- **모바일(확장)**: Android, Kotlin
- **배포/인프라(시도)**: Nginx, Linux VM(GCP), 방화벽/포트 설정, 도메인/DDNS
- **도구**: Git, GitHub, VSCode, PowerShell, curl/Postman

---

## 저장소 구조

이 폴더는 별도 저장소를 포트폴리오용으로 합쳐 둔 스냅샷입니다.
각 저장소의 실행 방법과 알려진 제한은 하위 README에 있습니다.

원본이 세 개로 갈라져 있어, 이 스냅샷은 세 곳의 최신 내용을 합친 것입니다.
어느 쪽도 다른 쪽의 상위집합이 아닙니다 — 자세한 내용은
[PROJECT_STATUS.md](./PROJECT_STATUS.md) 를 보세요.

| 원본 저장소 | 최신 | 이 스냅샷에 반영된 것 |
| --- | --- | --- |
| [GestureOS](https://github.com/snail5039-code/GestureOS) | 2026-08-20 | 마우스 모드 크래시 수정, pyflakes·eslint 검사 보강 |
| [GestureOSManager](https://github.com/snail5039-code/GestureOSManager) | 2026-08-19 | 데스크톱·에이전트·제어 서버 전체 + 인증·권한 작업 |
| [GestureOSManagerWeb](https://github.com/snail5039-code/GestureOSManagerWeb) | 2026-08-19 | 계정·게시판 웹 전체 + 인증·권한 작업 |

```text
GestureOS/
├─ GestureOSManager/           # https://github.com/snail5039-code/GestureOSManager
│  ├─ front/                   # 데스크톱 매니저(Electron + React), 5173
│  ├─ gestureOSManager/        # 제어 서버(Spring), 8080 — 127.0.0.1 전용
│  ├─ py/                      # 파이썬 에이전트(MediaPipe + MLP + SendInput + HUD)
│  └─ PhoneController-master/  # 안드로이드 컨트롤러(Kotlin), 선택
└─ GestureOSManagerWeb/        # https://github.com/snail5039-code/GestureOSManagerWeb
   ├─ backend-spring/          # 계정·게시판 API(Spring), 8082
   ├─ frontend-react/          # 웹사이트(React), 5174
   ├─ docker-compose.yml       # PostgreSQL 16
   └─ docs/sql/                # DB 초기화
```

| 문서 | 내용 |
| --- | --- |
| [GestureOSManager/README.md](./GestureOSManager/README.md) | 데스크톱·에이전트 실행, 설치본 사용법, 로컬 세션 토큰, 학습 프로필 |
| [GestureOSManagerWeb/README.md](./GestureOSManagerWeb/README.md) | 웹 실행, 관리자 계정, 비밀번호 정책 |
| [RUNBOOK.md](./RUNBOOK.md) | 전체 구성을 순서대로 띄우는 방법 |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | 증상별 확인 절차 |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | 최근 점검 내역, 검증 상태, 남은 개선 항목 |

---

## Ports

| 포트 | 무엇 |
| ---: | --- |
| **8080** | 제어 서버(Spring) + 에이전트/UI/HUD WebSocket. `127.0.0.1` 전용, 세션 토큰 필요 |
| **8082** | 웹 API(Spring) — 계정·게시판. 데스크톱 앱의 로그인도 여기를 쓴다 |
| **5173** | 데스크톱 매니저 Vite dev server |
| **5174** | 웹사이트 Vite dev server |
| **5432** | PostgreSQL |
| 8081 | 휴대폰 MJPEG 화면 스트리밍 — `--phone` 을 줄 때만, 인증 없음 |
| UDP 39500 | 휴대폰 원격 입력 브리지 — `--phone` 을 줄 때만, 인증 없음 |

---

## Quick Start (Local)

상세 절차와 확인 방법은 [RUNBOOK.md](./RUNBOOK.md) 에 있습니다.

### Prerequisites
- Windows 10/11
- Node.js 20 이상
- Java 17 이상
- **Python 3.12** (3.13 불가 — 3.13 용 mediapipe 에는 에이전트가 쓰는 `mp.solutions.hands` 가 없습니다)
- PostgreSQL 16 또는 docker-compose
- 카메라

### 1) DB(Postgres) — 웹 버전 사용 시
```powershell
cd GestureOSManagerWeb
docker compose up -d
```

### 2) 제어 백엔드(Spring, 8080)
```powershell
cd GestureOSManager\gestureOSManager
.\mvnw.cmd spring-boot:run
```

`Invoke-RestMethod http://127.0.0.1:8080/api/health` 로 확인합니다.

### 3) 에이전트(Python)
```powershell
cd GestureOSManager\py
& "$env:USERPROFILE\.pyenv\pyenv-win\versions\3.12.8\python.exe" -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe main.py
```

### 4) 데스크톱 매니저(Electron, 5173)
```powershell
cd GestureOSManager\front
npm.cmd install
npm.cmd run manager:electron
```

### 5) 웹 백엔드(Spring, 8082)

`JWT_SECRET` 은 필수입니다. 없으면 서버가 뜨지 않습니다.

```powershell
$env:JWT_SECRET = "..."             # openssl rand -base64 48
$env:ADMIN_INITIAL_PASSWORD = "..." # 8자 이상, 최초 1회만 admin 비밀번호를 설정
cd GestureOSManagerWeb\backend-spring
.\mvnw.cmd spring-boot:run
```

### 6) 웹 프론트(React, 5174)
```powershell
cd GestureOSManagerWeb\frontend-react
npm.cmd install
npm.cmd run dev
```

---

## Configuration

값은 전부 환경변수로 받습니다. 저장소에는 키를 두지 않습니다.
변수 목록은 각 저장소의 `.env.example` 에 있습니다.

| 파일 | 대상 |
| --- | --- |
| `GestureOSManager/gestureOSManager/.env.example` | 제어 서버(8080) — 전부 기본값이 있어 그냥 띄워도 동작합니다 |
| `GestureOSManagerWeb/.env.example` | 웹 API(8082) — 필수 / DB / 선택으로 나눠 두었습니다 |

| 변수 | 없으면 |
| --- | --- |
| `JWT_SECRET` | **8082 서버가 뜨지 않습니다** |
| `ADMIN_INITIAL_PASSWORD` | admin 계정이 로그인 불가 상태로 남습니다 |
| `OPENAI_API_KEY` | AI 도움말(`/api/help`)만 비활성 |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | 메일 인증번호만 비활성 |
| `OAUTH_GOOGLE_*` / `OAUTH_KAKAO_*` / `OAUTH_NAVER_*` | 해당 소셜 로그인만 비활성 |
| `GOS_PROFILE_DB_ENABLED` | 학습 프로필을 로컬 파일에만 저장 (기본값) |
| `GOS_AUTH_ENABLED` | 기본 `true`. `false` 로 끄면 로컬 세션 토큰 보호가 사라집니다 |

기동 로그의 `[CONFIG]` 줄에 설정이 없어 꺼진 기능이 나옵니다.

## License
자유롭게 사용 가능합니다.

## 발표 자료
- [PPT 다운로드](https://docs.google.com/presentation/d/1O1Uhgqkik3zDHVuossR1SH4L7NgAqtbo/edit?usp=sharing&ouid=112309789916009126624&rtpof=true&sd=true)
- 발표 자료 안에는 트러블 슈팅 관련 내용 포함

## 미리보기
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/e435081f-d0a8-4c86-87c2-0ba3ca05450f" />
<img width="1920" height="1079" alt="image" src="https://github.com/user-attachments/assets/1d57ec2b-add2-4454-b9e1-9dcf47de8a71" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/51c39e3c-0902-455c-9f5e-8fb039e5ba23" />


## 팀 프로젝트(노션 정리)
- [노션 방문하기](https://www.notion.so/GestureOSManager-2ecc2c49a2508074a3e8fdeb7b6fef63?source=copy_link)
