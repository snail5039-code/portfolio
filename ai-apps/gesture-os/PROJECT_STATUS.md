# GestureOS 프로젝트 현황

최종 점검일: 2026-08-20

> **원본 저장소가 세 개로 갈라져 있습니다.** 이 스냅샷은 세 곳의 최신 내용을 합친 것입니다.
>
> | 저장소 | 최신 | 담고 있는 것 |
> | --- | --- | --- |
> | [GestureOS](https://github.com/snail5039-code/GestureOS) | 2026-08-20 | 합본. 마우스 모드 크래시 수정. 8/19 보안 작업은 **없음** |
> | [GestureOSManager](https://github.com/snail5039-code/GestureOSManager) | 2026-08-19 | 데스크톱·에이전트·제어 서버. 보안 작업 포함. 크래시 수정은 **없음** |
> | [GestureOSManagerWeb](https://github.com/snail5039-code/GestureOSManagerWeb) | 2026-08-19 | 계정·게시판 웹. 보안 작업 포함 |
>
> 합본 저장소의 마지막 커밋은 부모가 7월 25일이라 8/19 보안 작업을 담고 있지 않고,
> 반대로 분리 저장소들에는 크래시 수정이 없습니다. 어느 쪽도 다른 쪽의 상위집합이 아니라
> 이 스냅샷에서 양쪽을 합쳤습니다. 원본 저장소 중 어디를 기준으로 삼을지는 정리가 필요합니다.

## 구성

- `GestureOSManager/front`: Electron + React 데스크톱 관리자 (5173)
- `GestureOSManager/gestureOSManager`: 제어 및 WebSocket 서버 (8080)
- `GestureOSManager/py`: MediaPipe 인식, OS 입력, HUD, 휴대폰 브리지
- `GestureOSManager/PhoneController-master`: 안드로이드 컨트롤러 (선택)
- `GestureOSManagerWeb/frontend-react`: 웹사이트 (5174)
- `GestureOSManagerWeb/backend-spring`: 계정·게시판 API (8082)
- `GestureOSManagerWeb/docker-compose.yml`: PostgreSQL 16

각 저장소의 실행 방법과 알려진 제한은 하위 README에 있습니다.

- [GestureOSManager/README.md](./GestureOSManager/README.md)
- [GestureOSManagerWeb/README.md](./GestureOSManagerWeb/README.md)

## 2026-08-20 수정한 내용

### 마우스 모드가 첫 프레임에서 죽던 문제

`run()` 이 `block_by_palette` 를 대입하기 전에 읽고 있었습니다. 같은 함수 안에서 나중에
대입되는 이름이라 파이썬은 지역변수로 잡고 `UnboundLocalError` 를 냅니다. 조건이
`mode_u == "MOUSE" and self.enabled and (not self.ui_locked)` 뒤라 **마우스 모드를 켜면 매
프레임 걸리는 자리**였고, `main.py` 가 `run()` 을 `try/finally` 로만 감싸므로 에이전트가
그대로 종료됐습니다.

팔레트 모달 계산을 핀치 고정 블록보다 앞으로 옮겼습니다. 원래 의도가 "팔레트가 떠 있으면
핀치 고정을 걸지 않는다" 이므로 계산 뒤에서 읽는 것이 맞습니다.

같은 것을 또 놓치지 않게 두 가지를 함께 고쳤습니다.

- 검사 목록에 `pyflakes` 를 넣었습니다. `compileall` 은 구문만 보므로 이 오류를 잡지
  못합니다. 실제로 7월 점검에서 구문 검사는 통과하고 있었습니다.
- `front/eslint.config.js` 의 `files` 가 `js,jsx` 만 잡아 Electron 진입 파일
  (`main.cjs`·`preload.cjs`)에 규칙이 0개 적용되고 있었습니다. `**/*.cjs` 를
  CommonJS + Node 전역으로 넣었습니다.

## 2026-08-19 점검에서 수정한 내용

이번 회차는 로컬에서 열려 있던 권한·인증 경로를 닫는 데 집중했습니다.

### 제어 서버 (8080)

| 무엇이 문제였나 | 어떻게 됐나 |
| --- | --- |
| 서버가 모든 인터페이스에 바인딩되어 **같은 네트워크의 다른 기기가 제어 API를 호출**할 수 있었다 | `127.0.0.1` 에만 바인딩 |
| 사용자가 열어둔 웹페이지가 `localhost:8080` 으로 요청해 **에이전트를 조작**할 수 있었다 | 기동 시 임의 토큰을 만들어 `~/.gestureos/session.token` 에 쓰고, `/api/health` 를 뺀 모든 API와 WebSocket 접속에서 요구 (`LocalSessionToken`, `LocalTokenAuthFilter`, `WsTokenHandshakeInterceptor`) |
| 클라이언트가 보낸 `X-User-Id` 헤더 숫자를 그대로 회원 ID로 써서 **헤더만 바꾸면 남의 학습 프로필을 읽고 지울 수 있었다** | 액세스 토큰을 계정 서버 `/api/members/me` 에 확인해서 회원 ID를 정한다 (`MemberIdentityService`). 확인 실패 시 게스트 |
| UI가 에이전트와 같은 `/ws/agent` 를 써서 **UI가 접속하면 에이전트 세션을 빼앗았다** | UI를 `/ws/ui` 로 분리 (`UiWsHandler`) |
| 에이전트가 꺼져 있어도 UI에 **트래킹 ON 으로 표시**됐다 | 연결 상태와 트래킹 상태를 분리해 표시 |
| 에이전트 WebSocket이 끊기면 다시 붙지 않았다 | 재연결 추가 |
| HUD 패널이 상태 카드를 덮어 잘렸다 | 레이아웃 수정 |

### 웹 API 서버 (8082)

| 무엇이 문제였나 | 어떻게 됐나 |
| --- | --- |
| 인증키·JWT 서명키가 **소스에 커밋**되어 있었다 | 전부 환경변수로 옮기고 기본값을 제거. `.env.example` 로 목록만 남김 |
| 소셜 가입 계정도 아이디/비밀번호로 로그인돼 **공용 계정 경로**가 열려 있었다 | 소셜 계정의 비밀번호 로그인을 차단 |
| 평문 비밀번호가 남아 있었다 | 기동 시 bcrypt 해시로 이관하고, 널리 알려진 약한 값(`admin`, `1234` 등)을 쓰던 계정은 로그인 불가로 바꿔 재설정을 유도 (`LegacyPasswordMigration`) |
| 회원 응답에 **비밀번호 해시와 `providerKey` 가 그대로 나갔다** | 직렬화에서 제외 (`MemberSerializationTest`) |
| 프로필 이미지 확장자만 보고 저장해 **아무 파일이나 업로드**됐다 | 파일 내용으로 이미지 형식을 판별 (`UploadedImageTypeTest`, `UploadedFileSecurityFilter`) |
| 선택 설정(메일·AI·소셜)이 없으면 **서버가 아예 뜨지 않았다** | 그 기능만 끄고 기동하며, `[CONFIG]` 로그로 무엇이 꺼졌는지 알린다 (`StartupConfigReport`) |
| `data.sql` 의 `admin` 계정이 고정 비밀번호를 가졌다 | 비밀번호 없는(로그인 불가) 상태로 만들고, `ADMIN_INITIAL_PASSWORD` 로 최초 1회만 설정 |

### 문서

- 두 저장소에 README를 새로 썼습니다. 실행 순서, 설치본 사용법, 확인 방법, 알려진 제한을 담았습니다.
- 에이전트가 **파이썬 3.12 이하**를 요구한다는 점을 명시했습니다. 3.13 용 mediapipe에는 에이전트가 쓰는 `mp.solutions.hands` 가 없고, 고정 버전인 `mediapipe==0.10.21` 은 3.13 에 설치되지 않습니다.

## 검증 상태

| 검사 | 상태 |
| --- | --- |
| 데스크톱 React ESLint · 프로덕션 빌드 | 통과 |
| 웹 React ESLint · 프로덕션 빌드 | 통과 |
| 8080 Spring 테스트 | 통과 |
| 8082 Spring 테스트 (직렬화·업로드 형식 검사 포함) | 통과 |
| Python 전체 구문 검사 (`compileall`) | 통과 |
| Python 미정의 이름 검사 (`pyflakes`) | 통과 — 0건 |
| MediaPipe/OpenCV/PySide6 핵심 import | 통과 (3.12) |

데스크톱 React `npm run lint` 는 **에러 25건**이 남아 있습니다. `src/tailwind.config.js` 의
`require`, `vite.config.js` 의 `process` 미정의, `applyTheme.js`·`TrainingLab.jsx` 의 빈 블록
등으로, `.cjs` 규칙 추가와는 무관하게 그 전부터 있던 것입니다. 정리 대상입니다.

실제 카메라·DB·OAuth 키가 있는 환경에서 전체 흐름을 눌러본 것은 아닙니다.

## 환경 의존 항목

다음 항목은 코드 오류가 아니라 로컬 또는 배포 환경 준비가 필요합니다.

- PostgreSQL 16
- `JWT_SECRET` (없으면 8082 가 뜨지 않습니다)
- 파이썬 3.12 (3.13 불가)
- OpenAI API 키 (없으면 AI 도움말만 비활성)
- SMTP 계정 (없으면 메일 인증만 비활성)
- Google/Kakao/Naver OAuth 등록 정보 (없으면 해당 소셜 로그인만 비활성)
- 카메라 권한, Windows 입력 주입 권한

## 남은 개선 항목

우선순위 순입니다.

1. **폰 연동 인증** — `--phone` 을 켜면 TCP 8081(화면 스트리밍)과 UDP 39500(원격 입력)이 인증 없이 열립니다. 그래서 기본이 꺼짐입니다. 페어링에 시크릿을 붙이는 작업이 남았습니다.
2. **웹 `/api/help/**` 인증** — 인증 없이 열려 있어 AI 도움말 호출량(비용)에 제한이 없습니다.
3. **이메일 인증코드 시도 제한** — 횟수 제한이 없습니다.
4. **WebRTC 시그널링(`/ws`) 인증** — roomId 만 알면 참여할 수 있습니다.
5. **웹 프런트 라우트 가드** — 비로그인 상태로 `/mypage` 등에 접근됩니다.
6. **설치본 단독 실행** — 앱이 UI 만이라, 매니저 서버와 파이썬 에이전트를 손으로 함께 띄워야 합니다.
7. **학습 모델 저장 위치** — `%TEMP%` 에 저장되어 임시 파일 정리 도구에 지워질 수 있습니다.
8. **다중 모니터 좌표** — 마우스 모드 포인터 좌표가 주 모니터 크기로 정규화되어 1을 넘을 수 있습니다.
9. 데스크톱 프로덕션 번들의 큰 청크를 화면별 동적 import로 분리
10. 실제 PostgreSQL을 사용하는 통합 테스트 또는 Testcontainers 추가
