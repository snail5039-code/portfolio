# invest_client (Flutter 앱)

자연어 투자 에이전트의 폰·웹 앱. 증권사 키 저장과 주문은 이 앱(폰)에서만 한다. 서버(`apps/api`)는 말 이해·제안·검증만 한다.

- `lib/broker/`: 증권사 연결 (KIS 모의 `kis_mock_broker.dart`, KB `kb_broker.dart`, 개발용 `fake_broker.dart`)
- `lib/features/auto/`: 모의 자동매매 (`auto_trader.dart`: 사고팔 시점·금액 규칙, 조절 값은 [AI 수정 기록](../../docs/AI_CHANGELOG.md))
- `lib/features/`: 채팅·처리안·기록·설정 화면
- `test/client_test.dart`: 자동매매·금액 계산 테스트

## 실행

개발 키는 `dev_keys.env`(git 제외, 양식 `dev_keys.example.env`)에 둔다. 키가 없으면 디버그 빌드는 가짜 증권사를 쓴다.

```bash
flutter run -d emulator-5554 --no-enable-impeller --dart-define-from-file=dev_keys.env
```

```bash
flutter test
```

전체 진행 상황은 [docs/plan/PROGRESS.md](../../docs/plan/PROGRESS.md).
