# GestureOS 실행 방법

이 문서는 Windows 로컬 개발 환경에서 GestureOS 전체 구성을 실행하는 순서를 설명합니다.

## 구성과 포트

| 구성 | 경로 | 포트 |
|---|---|---:|
| PostgreSQL | `GestureOSManagerWeb/docker-compose.yml` | 5432 |
| 제어 서버 | `GestureOSManager/gestureOSManager` | 8080 |
| 휴대폰 MJPEG | Python 에이전트가 자동 실행 | 8081 |
| 웹 API 서버 | `GestureOSManagerWeb/backend-spring` | 8082 |
| 데스크톱 UI | `GestureOSManager/front` | 5173 |
| 웹사이트 UI | `GestureOSManagerWeb/frontend-react` | 5174 |
| XR 브리지 | Python 에이전트가 자동 실행 | UDP 39500 |

## 필수 프로그램

- Node.js 20 이상
- Java 17
- Maven 3.9 이상 또는 정상 동작하는 Maven Wrapper
- Python 3.10
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

```powershell
cd GestureOSManager\py
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 전체 실행 순서

### 1. PostgreSQL

```powershell
cd GestureOSManagerWeb
docker compose up -d
```

DB 이름과 계정은 `docker-compose.yml` 기준으로 다음과 같습니다.

- DB: `slt`
- 사용자: `sltuser`
- 비밀번호: `sltpass`

### 2. 제어 서버

```powershell
cd GestureOSManager\gestureOSManager
.\mvnw.cmd spring-boot:run
```

정상 상태에서는 `http://localhost:8080/api/control/status`가 JSON을 반환합니다.

### 3. 웹 API 서버

환경변수를 먼저 설정합니다. 실제 값은 저장소에 커밋하지 않습니다.

```powershell
$env:OPENAI_API_KEY = "..."
$env:MAIL_USERNAME = "..."
$env:MAIL_PASSWORD = "..."
$env:OAUTH_GOOGLE_CLIENT_ID = "..."
$env:OAUTH_GOOGLE_CLIENT_SECRET = "..."
```

```powershell
cd GestureOSManagerWeb\backend-spring
.\mvnw.cmd spring-boot:run
```

### 4. 데스크톱 UI

```powershell
cd GestureOSManager\front
npm.cmd run dev
```

별도 터미널에서 Electron을 실행합니다.

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
.\node_modules\.bin\electron.cmd .
```

### 5. Python 모션 인식

```powershell
cd GestureOSManager\py
.\.venv\Scripts\python.exe main.py hands
```

이 명령은 기본적으로 다음 기능을 함께 실행합니다.

- MediaPipe 손 인식
- 카메라 미리보기
- 8080 WebSocket 연결
- HUD
- 휴대폰 MJPEG 서버
- XR UDP 브리지

단독 인식 테스트만 할 때는 OS 입력과 서버 연결을 끕니다.

```powershell
.\.venv\Scripts\python.exe main.py hands --no-ws --no-inject --no-phone --no-hud
```

### 6. 웹사이트 UI

```powershell
cd GestureOSManagerWeb\frontend-react
npm.cmd run dev
```

접속 주소는 `http://localhost:5174`입니다.

## 종료

각 터미널에서 `Ctrl+C`를 누릅니다. Electron과 카메라 창도 닫습니다.

Docker DB를 종료할 때:

```powershell
cd GestureOSManagerWeb
docker compose down
```

데이터까지 삭제하는 `docker compose down -v`는 DB 볼륨을 제거하므로 명시적으로 초기화할 때만 사용합니다.

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

