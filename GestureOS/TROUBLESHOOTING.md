# GestureOS 문제 해결

## 앱에서 시작을 누르면 바로 정지 상태로 돌아감

가장 먼저 Python 에이전트 중복 실행을 확인합니다. 여러 에이전트가 `/ws/agent` 에 연결되면
서버가 오래된 WebSocket 세션에 명령을 보낼 수 있습니다.

```powershell
Get-Process python -ErrorAction SilentlyContinue
```

GestureOS Python 프로세스를 모두 종료한 뒤 하나만 다시 실행합니다.

```powershell
cd GestureOSManager\py
.\.venv\Scripts\python.exe main.py
```

상태 확인은 토큰이 필요 없는 `/api/health` 로 합니다.

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
```

- `agentConnected: true` — 파이썬 에이전트가 붙어 있음
- `uiClients: 1` 이상 — 앱 창이 붙어 있음

둘 중 하나가 0 이면 그쪽 프로세스가 안 떠 있는 것입니다.

자세한 제어 상태는 세션 토큰을 붙여서 봅니다.

```powershell
$tok = Get-Content "$env:USERPROFILE\.gestureos\session.token"
Invoke-RestMethod http://127.0.0.1:8080/api/control/status -Headers @{ "X-GOS-Token" = $tok }
```

정상 기준:

- `connected: true`
- 시작 후 `enabled: true`
- 잠금 해제 후 `locked: false`
- 손이 보이면 `tracking: true`

## API 호출이 401 로 떨어짐

제어 서버는 기동할 때마다 새 세션 토큰을 만듭니다. **서버를 재시작했으면 앱도 다시 켜야
합니다.** 앱이 예전 토큰을 들고 있으면 상태 조회가 401 이 됩니다.

직접 호출할 때는 `~/.gestureos/session.token` 을 다시 읽어 `X-GOS-Token` 헤더에 넣습니다.
WebSocket 은 쿼리로 넘깁니다(`ws://127.0.0.1:8080/ws/ui?token=...`).

브라우저에서 `http://localhost:5173` 을 직접 열어 디버깅해야 한다면 인증을 끌 수 있습니다.
끄면 웹페이지가 에이전트를 조작하는 경로도 함께 열립니다.

```powershell
$env:GOS_AUTH_ENABLED = "false"
```

## 손은 인식되지만 마우스가 움직이지 않음

상태 JSON에서 다음 값을 확인합니다.

- `enabled` 가 `true`
- `locked` 가 `false`
- `canMove` 가 `true`
- `tracking` 이 `true`

`tracking` 만 `false` 라면 조명, 손과 카메라 거리, 카메라 점유 프로그램을 확인합니다.
Zoom, Discord, 브라우저 카메라 탭을 종료한 뒤 다시 시도합니다.

에이전트를 `--no-inject` 로 띄웠는지도 확인합니다. 이 옵션은 인식만 하고 입력을 만들지 않습니다.

## FPS 가 0.0 으로 표시됨

카메라를 열지 못한 상태입니다. 다른 앱이 카메라를 잡고 있는지 확인합니다.

## 에이전트가 mediapipe import 에서 실패함

파이썬 버전 문제입니다. 에이전트는 `mp.solutions.hands` 를 쓰는데, **3.13 용 mediapipe 에는
이 API 가 없습니다**(3.13 빌드는 `Image`, `ImageFormat`, `tasks` 만 포함). 게다가
`requirements.txt` 가 고정한 `mediapipe==0.10.21` 은 3.13 에 설치조차 되지 않습니다.

**파이썬 3.12 이하**로 가상환경을 다시 만듭니다.

```powershell
cd GestureOSManager\py
Remove-Item .venv -Recurse
& "$env:USERPROFILE\.pyenv\pyenv-win\versions\3.12.8\python.exe" -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -c "import mediapipe as mp; print(mp.solutions.hands)"
```

`.venv` 삭제는 설치된 패키지만 제거하며 프로젝트 소스에는 영향을 주지 않습니다.

## Electron 창이 안 뜸

```powershell
cd GestureOSManager\front
npm.cmd run manager:electron
```

이 스크립트가 Vite(5173)를 기다린 뒤 Electron 을 띄웁니다. 수동으로 띄울 때는
`ELECTRON_RUN_AS_NODE` 가 남아 있으면 창이 뜨지 않습니다.

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
.\node_modules\.bin\electron.cmd .
```

## 8080 또는 8082 포트 사용 중

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 8080,8082 } |
  Select-Object LocalPort,OwningProcess
```

표시된 PID가 기존 GestureOS 서버인지 확인한 후 해당 프로세스를 종료합니다.
다른 프로그램이면 GestureOS 설정 또는 상대 프로그램의 포트를 변경합니다.

## 웹 API 서버(8082)가 기동하지 않음

### JWT_SECRET 이 없음

`JWT_SECRET` 은 필수입니다. 기본값을 두지 않기 때문에 없으면 서버가 뜨지 않습니다.

```powershell
$env:JWT_SECRET = "..."   # openssl rand -base64 48
```

### PostgreSQL 연결 오류

DB 는 기동 시 `schema.sql` / `data.sql` 을 실행하므로 없으면 서버가 뜨지 않습니다.

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5432 -ErrorAction SilentlyContinue
```

결과가 없으면 PostgreSQL 을 먼저 실행합니다.

```powershell
cd GestureOSManagerWeb
docker compose up -d
docker compose ps
```

### 메일·AI·소셜 로그인 설정이 없음

이 세 가지는 없어도 서버가 뜹니다. 해당 기능만 비활성되고, 기동 로그의 `[CONFIG]` 줄에
무엇이 꺼졌는지 나옵니다. 쓰려면 `.env.example` 의 변수를 채웁니다.

- `MAIL_USERNAME`, `MAIL_PASSWORD`
- `OPENAI_API_KEY`
- `OAUTH_GOOGLE_CLIENT_ID` / `_SECRET`, `OAUTH_KAKAO_*`, `OAUTH_NAVER_*`

## admin 으로 로그인이 안 됨

`data.sql` 이 만드는 `admin` 계정은 **비밀번호가 비어 있는(로그인 불가) 상태**입니다.
`ADMIN_INITIAL_PASSWORD` (8자 이상)를 주고 기동하면 최초 1회만 설정됩니다.
이미 비밀번호가 있으면 이 값을 바꿔도 덮어쓰지 않습니다.

## 기존 계정으로 로그인이 안 됨

두 가지 경우입니다.

- **소셜로 가입한 계정** — 아이디/비밀번호 로그인을 허용하지 않습니다. 소셜 로그인을 쓰세요.
- **약한 비밀번호를 쓰던 계정** — 기동 시 `LegacyPasswordMigration` 이 평문 비밀번호를
  bcrypt 해시로 이관하는데, 널리 알려진 값(`admin`, `1234` 등)이면 로그인 불가로 바꾸고
  경고를 남깁니다. '비밀번호 찾기' 로 재설정해야 합니다.

## 학습 프로필이 저장되지 않음

`/api/health` 의 `profileDbAvailable` 이 `false` 면 DB 동기화가 꺼진 상태입니다.
이는 기본값이며, 로컬 파일 저장만으로도 학습·사용이 됩니다. DB 동기화를 켜려면
스키마를 넣고 플래그를 줍니다.

```powershell
psql -U sltuser -d slt -f GestureOSManager\gestureOSManager\src\main\resources\db\schema-profile.sql
$env:GOS_PROFILE_DB_ENABLED = "true"
```

학습 모델 파일은 `%TEMP%` 에 저장되므로 임시 파일 정리 도구에 지워질 수 있습니다.

## Maven Wrapper가 Windows PowerShell에서 실패함

시스템 Maven이 있다면 다음 명령을 사용합니다.

```powershell
mvn test
mvn spring-boot:run
```

Maven이 없다면 Maven 3.9 이상을 설치하거나 Apache Maven 공식 배포본의 `bin\mvn.cmd` 를 사용합니다.

## 로그 위치

- Python 에이전트: 실행 터미널
- 휴대폰 서비스: `%TEMP%\GestureOS_phone`
- Spring: 실행 터미널
- Vite: 실행 터미널
