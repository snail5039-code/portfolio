# GestureOS 실행 방법

이 문서는 Windows 로컬 개발 환경에서 GestureOS 전체 구성을 실행하는 순서를 설명합니다.
저장소별 상세는 [GestureOSManager/README.md](./GestureOSManager/README.md) 와
[GestureOSManagerWeb/README.md](./GestureOSManagerWeb/README.md) 에 있습니다.

## 구성과 포트

| 구성 | 경로 | 포트 |
|---|---|---:|
| PostgreSQL | `GestureOSManagerWeb/docker-compose.yml` | 5432 |
| 제어 서버 | `GestureOSManager/gestureOSManager` | 8080 (127.0.0.1 전용) |
| 웹 API 서버 | `GestureOSManagerWeb/backend-spring` | 8082 |
| 데스크톱 UI | `GestureOSManager/front` | 5173 |
| 웹사이트 UI | `GestureOSManagerWeb/frontend-react` | 5174 |
| 휴대폰 MJPEG | `--phone` 을 줄 때만 | 8081 |
| XR 브리지 | `--phone` 을 줄 때만 | UDP 39500 |

## 필수 프로그램

- Node.js 20 이상
- Java 17
- Maven 3.9 이상 또는 정상 동작하는 Maven Wrapper
- **Python 3.12** — 3.13 은 안 됩니다. 3.13 용 mediapipe 에는 에이전트가 쓰는
  `mp.solutions.hands` 가 없고, 고정 버전 `mediapipe==0.10.21` 은 3.13 에 설치되지 않습니다.
- Docker Desktop 또는 PostgreSQL 16
- 카메라

## 최초 설치

### 프런트엔드

```powershell
cd GestureOSManager\front
npm.cmd install

cd ..\..\GestureOSManagerWeb\frontend-react
npm.cmd install
```

### Python 에이전트

3.12 인터프리터로 가상환경을 만듭니다.

```powershell
cd GestureOSManager\py
& "$env:USERPROFILE\.pyenv\pyenv-win\versions\3.12.8\python.exe" -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

`python --version` 이 이미 3.12 라면 `python -m venv .venv` 로도 됩니다.

## 전체 실행 순서

### 1. PostgreSQL

```powershell
cd GestureOSManagerWeb
docker compose up -d
```

DB 이름과 계정은 `docker-compose.yml` 기준입니다.

- DB: `slt`
- 사용자: `sltuser`
- 비밀번호: `sltpass`

### 2. 제어 서버 (8080)

```powershell
cd GestureOSManager\gestureOSManager
.\mvnw.cmd spring-boot:run
```

정상 상태에서는 다음이 JSON을 반환합니다.

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
# ok=True agentConnected=... hudClients=... uiClients=... profileDbAvailable=False
```

`/api/health` 를 뺀 나머지 API 와 WebSocket 접속에는 **로컬 세션 토큰**이 필요합니다.
서버는 기동할 때마다 임의 토큰을 만들어 `~/.gestureos/session.token` 에 씁니다.
개발 중에는 Vite dev proxy 가, 설치본에서는 Electron 메인 프로세스가 자동으로 붙입니다.

브라우저에서 직접 API 를 눌러 디버깅해야 한다면 헤더로 넘깁니다.

```powershell
$tok = Get-Content "$env:USERPROFILE\.gestureos\session.token"
Invoke-RestMethod http://127.0.0.1:8080/api/control/status -Headers @{ "X-GOS-Token" = $tok }
```

인증 자체를 끄려면 `GOS_AUTH_ENABLED=false` 로 띄웁니다. 끄면 위 보호도 사라집니다.

`GOS_PROFILE_DB_ENABLED` 는 기본 꺼짐입니다. 학습 프로필을 DB로 동기화하려면 스키마를 먼저 넣습니다.

```powershell
psql -U sltuser -d slt -f GestureOSManager\gestureOSManager\src\main\resources\db\schema-profile.sql
```

### 3. 웹 API 서버 (8082)

`JWT_SECRET` 은 **필수**입니다. 없으면 서버가 뜨지 않습니다. 실제 값은 저장소에 커밋하지 않습니다.
전체 목록은 `GestureOSManagerWeb/.env.example` 에 있습니다.

```powershell
$env:JWT_SECRET = "..."            # openssl rand -base64 48
$env:ADMIN_INITIAL_PASSWORD = "..." # 8자 이상. 최초 1회만 admin 비밀번호를 설정한다
$env:OPENAI_API_KEY = "..."        # 없으면 AI 도움말만 비활성
$env:MAIL_USERNAME = "..."         # 없으면 메일 인증만 비활성
$env:MAIL_PASSWORD = "..."
$env:OAUTH_GOOGLE_CLIENT_ID = "..." # 없으면 해당 소셜 로그인만 비활성
$env:OAUTH_GOOGLE_CLIENT_SECRET = "..."
```

```powershell
cd GestureOSManagerWeb\backend-spring
.\mvnw.cmd spring-boot:run
```

기동 로그의 `[CONFIG]` 줄에 설정이 없어 꺼진 기능이 나옵니다.

### 4. 데스크톱 UI (5173)

```powershell
cd GestureOSManager\front
npm.cmd run manager:electron
```

Vite 개발 서버와 Electron 창을 함께 띄웁니다. Vite 만 필요하면 `npm.cmd run dev` 를 씁니다.

### 5. Python 모션 인식

```powershell
cd GestureOSManager\py
.\.venv\Scripts\python.exe main.py
```

기본으로 함께 실행되는 것은 다음입니다.

- MediaPipe 손 인식
- 카메라 미리보기
- 8080 WebSocket 연결 (`/ws/agent`)
- HUD

휴대폰 연동(TCP 8081 화면 스트리밍, UDP 39500 원격 입력)은 **기본 꺼짐**입니다.
두 경로 모두 인증이 없어서, 쓰겠다고 명시할 때만 `--phone` 으로 켭니다.
신뢰할 수 없는 네트워크에서는 켜지 마세요.

단독 인식 테스트만 할 때는 OS 입력과 서버 연결을 끕니다.

```powershell
.\.venv\Scripts\python.exe main.py --no-ws --no-inject --no-hud
```

| 옵션 | 뜻 |
| --- | --- |
| `--phone` | 폰 연동을 켠다 (기본 꺼짐) |
| `--no-hud` | 화면 위 HUD 오버레이를 띄우지 않는다 |
| `--no-inject` | 실제 입력을 만들지 않는다 |
| `--no-ws` | 매니저 서버에 붙지 않는다 |
| `--start-enabled` | 켜진 상태로 시작 |
| `--agent=color` | 손 대신 색 추적 모드로 시작 |

### 6. 웹사이트 UI (5174)

```powershell
cd GestureOSManagerWeb\frontend-react
npm.cmd run dev
```

접속 주소는 `http://localhost:5174` 입니다.

## 설치본 만들기

```powershell
cd GestureOSManager\front
npm.cmd run app:dist   # release\ 에 NSIS 설치 파일
npm.cmd run app:pack   # 설치 파일 없이 폴더만 (release\win-unpacked)
```

설치본은 개발 서버 없이 동작합니다. Electron 메인 프로세스가 `gosapp://` 스킴으로 빌드
결과를 서빙하고 `/api` 요청을 중계합니다. 다만 **설치 파일만으로는 동작하지 않습니다.**
앱은 UI 이므로 제어 서버(8080)와 파이썬 에이전트를 함께 띄워야 합니다.

| 요청 | 중계 대상 |
| --- | --- |
| `/api/auth/**`, `/api/members/**` | 계정 서버 `http://127.0.0.1:8082` |
| `/api/**`, `/motion/**` | 제어 서버 `http://127.0.0.1:8080` |

포트를 바꿨다면 `GOS_AGENT_ORIGIN` / `GOS_ACCOUNT_ORIGIN` 으로 넘깁니다.

## 종료

각 터미널에서 `Ctrl+C` 를 누릅니다. Electron 과 카메라 창도 닫습니다.

```powershell
cd GestureOSManagerWeb
docker compose down
```

데이터까지 삭제하는 `docker compose down -v` 는 DB 볼륨을 제거하므로 명시적으로 초기화할 때만 사용합니다.

## 검사 명령

```powershell
cd GestureOSManager\front
npm.cmd run lint
npm.cmd run build

cd ..\..\GestureOSManagerWeb\frontend-react
npm.cmd run lint
npm.cmd run build

cd ..\backend-spring
.\mvnw.cmd test

cd ..\..\GestureOSManager\gestureOSManager
.\mvnw.cmd test

cd ..\py
.\.venv\Scripts\python.exe -m compileall -q .
```
