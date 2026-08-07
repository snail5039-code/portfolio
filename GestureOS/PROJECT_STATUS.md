# GestureOS 프로젝트 현황

최종 점검일: 2026-07-25

## 구성

- `GestureOSManager/front`: Electron + React 데스크톱 관리자
- `GestureOSManager/gestureOSManager`: 8080 제어 및 WebSocket 서버
- `GestureOSManager/py`: MediaPipe 인식, OS 입력, HUD, 휴대폰 브리지
- `GestureOSManagerWeb/frontend-react`: 5174 웹사이트
- `GestureOSManagerWeb/backend-spring`: 8082 웹 API
- `GestureOSManagerWeb/docker-compose.yml`: PostgreSQL 16

## 이번 점검에서 수정한 내용

- 웹 프런트의 `ProtectedRoute`에 누락된 React Router 및 인증 훅 import 추가
- 두 프런트의 ESLint 설정을 실제 런타임 결함에 집중하도록 정리
- 사용하지 않는 변수와 헬퍼 제거
- ASCII 판별 정규식을 명시적인 코드포인트 검사로 변경
- Tailwind 설정의 CommonJS `require`를 ESM import로 변경
- React 훅 의존성 배열이 매 렌더마다 바뀌던 값을 메모이제이션
- 웹 API 테스트가 외부 PostgreSQL 없이 실행되도록 H2 테스트 DB 추가
- 테스트용 OAuth, 메일, OpenAI 더미 설정 추가
- 로컬 Maven/Python 설치 산출물과 로그를 루트 `.gitignore`에서 제외

## 검증 상태

| 검사 | 상태 |
|---|---|
| 데스크톱 React ESLint | 통과 |
| 데스크톱 React 프로덕션 빌드 | 통과 |
| 웹 React ESLint | 통과 |
| 웹 React 프로덕션 빌드 | 통과 |
| 8080 Spring 테스트 | 통과 |
| 8082 Spring 테스트 | 통과 |
| Python 전체 구문 검사 | 통과 |
| MediaPipe/OpenCV/PySide6 핵심 import | 통과 |

## 환경 의존 항목

다음 항목은 코드 오류가 아니라 로컬 또는 배포 환경 준비가 필요합니다.

- 실제 서비스 실행용 PostgreSQL 16
- OpenAI API 키
- SMTP 계정
- Google/Kakao/Naver OAuth 등록 정보
- 카메라 권한
- Windows 입력 주입 권한

## 알려진 개선 항목

- 데스크톱 프로덕션 번들의 큰 청크를 화면별 동적 import로 분리
- npm audit 경고를 호환성 검증과 함께 단계적으로 업데이트
- 루트 `README.md`의 깨진 한글 인코딩을 UTF-8 문서로 교체
- 전체 구성을 한 번에 시작하고 종료하는 PowerShell 스크립트 추가
- 실제 PostgreSQL을 사용하는 통합 테스트 또는 Testcontainers 추가
- 카메라/에이전트 중복 실행을 앱 시작 단계에서 자동 감지

## 다음 작업 권장 순서

1. PostgreSQL과 실제 환경변수를 준비해 8082 API 통합 테스트
2. 로그인, 게시판, 댓글, 파일 업로드 흐름 점검
3. 카메라 인식과 MOUSE/KEYBOARD/PRESENTATION 모드 회귀 테스트
4. npm 의존성 보안 경고 검토
5. 배포 환경의 CORS, OAuth redirect URI, WebSocket 프록시 검증

