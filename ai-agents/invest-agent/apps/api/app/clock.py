from datetime import datetime, time, timedelta, timezone

from app import config

KST = timezone(timedelta(hours=9), name="KST")


def now() -> datetime:
    """지금 한국 시각. 장 운영 시간·만료 판단에 쓴다 (테스트에서 바꿔 끼울 수 있게 한 곳에 둔다)."""
    return datetime.now(KST)


def market_now() -> datetime:
    """장 운영 시간 검사에 쓰는 시각.

    개발용: .env의 MARKET_CLOCK(예: "10:00")이 있으면 시각만 그 값으로 바꾸고, 주말·휴장일이면 직전 거래일로 본다.
    장이 닫힌 시간에도 주문 흐름을 확인하기 위한 것이다. 서버 시작 로그에 경고가 남는다.
    """
    from app.functions.orders import is_trading_day

    current = now()
    if not config.MARKET_CLOCK:
        return current
    fixed = time.fromisoformat(config.MARKET_CLOCK)
    while not is_trading_day(current.date()):
        current -= timedelta(days=1)
    return current.replace(hour=fixed.hour, minute=fixed.minute, second=0, microsecond=0)
