"""Local notification settings fixture. Ported from
`src/fixtures/notificationSettings.ts`.

These are the fixture defaults `build_notification_settings_data()` always
returns. `app/routers/notification_settings.py` overlays any channel/
event-type toggles and severity threshold saved via
`POST /api/notification-settings/apply` (persisted by
`app/store/notification_settings.py`) on top of them — so those survive a
server restart. A channel's `enabled` flag can be overridden this way, but
its `state`/`summary` text below never is, so "미연결"/"권한 요청 없음" always
describes each channel's real (non-)connection honestly regardless of the
saved toggle. Nothing here ever sends a real notification, requests a
browser permission, or connects to email/messenger/an external API.
"""

from app.schemas.notification_settings import NotificationChannel, NotificationSettingsData, NotificationType

NOTIFICATION_SETTINGS_DATA_AS_OF = "2026-08-27T15:20:00+09:00"

NOTIFICATION_SETTINGS_SOURCE_LABEL = "로컬 fixture"

NOTIFICATION_SETTINGS_DISCLAIMER = (
    "모의투자 · 화면 검토용 가상 예시 · 실제 주문 아님 · 채널·유형·심각도 설정은 로컬에 저장됨 · "
    "채널 활성화는 가상 표시일 뿐 실제 권한 요청·연결 아님 · 실제 계좌·외부 API 미연결 · "
    "실제 알림 발송 없음 · 외부 요청 0건"
)


def build_notification_settings_data() -> NotificationSettingsData:
    return NotificationSettingsData(
        safetyCopy=NOTIFICATION_SETTINGS_DISCLAIMER,
        channels=[
            NotificationChannel(id="inapp", name="앱 내부", state="앱 내부만", summary="화면 안 배지와 목록에만 표시합니다.", enabled=True),
            NotificationChannel(id="browser", name="브라우저", state="권한 요청 없음", summary="브라우저 알림 권한은 요청하지 않습니다.", enabled=False),
            NotificationChannel(id="email", name="이메일", state="미연결", summary="메일 서버와 계정은 연결하지 않았습니다.", enabled=False),
            NotificationChannel(id="messenger", name="메신저", state="미연결", summary="메신저 앱과 외부 전송은 없습니다.", enabled=False),
        ],
        types=[
            NotificationType(id="policy", name="정책 차단", desc="종목 비중·주문 한도 같은 정책 이벤트", enabled=True),
            NotificationType(id="source", name="출처 미확인", desc="공시·가격 출처가 확인되지 않은 이벤트", enabled=True),
            NotificationType(id="approval", name="승인 만료", desc="사용자 승인 제한 시간이 지난 이벤트", enabled=True),
            NotificationType(id="data", name="데이터 연결 문제", desc="API·DB·계좌 미연결 상태 알림", enabled=True),
            NotificationType(id="volatility", name="변동성 경계", desc="화면용 변동성 기준 초과 이벤트", enabled=False),
            NotificationType(id="cost", name="비용 한계", desc="수수료·세금·슬리피지 가정 안내", enabled=False),
        ],
        defaultSeverity="높음",
    )
