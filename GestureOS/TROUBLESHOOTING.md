# GestureOS 문제 해결

## 앱에서 시작을 누르면 바로 정지 상태로 돌아감

가장 먼저 Python 에이전트 중복 실행을 확인합니다. 여러 에이전트가 `/ws/agent`에 연결되면 서버가 오래된 WebSocket 세션에 명령을 보낼 수 있습니다.

```powershell
Get-Process python -ErrorAction SilentlyContinue
```

GestureOS Python 프로세스를 모두 종료한 뒤 하나만 다시 실행합니다.

```powershell
cd GestureOSManager\py
.\.venv\Scripts\python.exe main.py hands
```

상태 확인:

```powershell
Invoke-RestMethod http://localhost:8080/api/control/status
```

정상 기준:

- `connected: true`
- 시작 후 `enabled: true`
- 잠금 해제 후 `locked: false`
- 손이 보이면 `tracking: true`

## 손은 인식되지만 마우스가 움직이지 않음

상태 JSON에서 다음 값을 확인합니다.

- `enabled`가 `true`
- `locked`가 `false`
- `canMove`가 `true`
- `tracking`이 `true`

`tracking`만 `false`라면 조명, 손과 카메라 거리, 카메라 점유 프로그램을 확인합니다. Zoom, Discord, 브라우저 카메라 탭을 종료한 뒤 다시 시도합니다.

## Electron 실행 시 `requestSingleInstanceLock` 오류

`ELECTRON_RUN_AS_NODE=1` 환경변수가 설정되면 Electron이 Node 모드로 실행됩니다.

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
cd GestureOSManager\front
.\node_modules\.bin\electron.cmd .
```

## 8080 또는 8082 포트 사용 중

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 8080,8082 } |
  Select-Object LocalPort,OwningProcess
```

표시된 PID가 기존 GestureOS 서버인지 확인한 후 해당 프로세스를 종료합니다. 다른 프로그램이면 GestureOS 설정 또는 상대 프로그램의 포트를 변경합니다.

## Spring 서버가 PostgreSQL 연결 오류로 종료됨

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5432 -ErrorAction SilentlyContinue
```

결과가 없으면 PostgreSQL을 먼저 실행합니다.

```powershell
cd GestureOSManagerWeb
docker compose up -d
docker compose ps
```

## Maven Wrapper가 Windows PowerShell에서 실패함

시스템 Maven이 있다면 다음 명령을 사용합니다.

```powershell
mvn test
mvn spring-boot:run
```

Maven이 없다면 Maven 3.9 이상을 설치하거나 Apache Maven 공식 배포본의 `bin\mvn.cmd`를 사용합니다.

## Python 가상환경이 기존 Python 경로를 찾지 못함

Python을 제거하거나 설치 위치를 바꾸면 기존 `.venv`가 깨질 수 있습니다. 가상환경을 새로 만듭니다.

```powershell
cd GestureOSManager\py
Remove-Item .venv -Recurse
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

`.venv` 삭제는 설치된 패키지만 제거하며 프로젝트 소스에는 영향을 주지 않습니다.

## 웹 API가 OAuth 설정 오류로 시작되지 않음

Google, Kakao, Naver 등록 정보가 비어 있으면 OAuth 클라이언트 초기화가 실패할 수 있습니다. 사용하는 공급자의 환경변수를 설정합니다.

- `OAUTH_GOOGLE_CLIENT_ID`
- `OAUTH_GOOGLE_CLIENT_SECRET`
- `OAUTH_KAKAO_CLIENT_ID`
- `OAUTH_KAKAO_CLIENT_SECRET`
- `OAUTH_NAVER_CLIENT_ID`
- `OAUTH_NAVER_CLIENT_SECRET`

## 로그 위치

- Python 에이전트: 실행 터미널
- 휴대폰 서비스: `%TEMP%\GestureOS_phone`
- Spring: 실행 터미널
- Vite: 실행 터미널

