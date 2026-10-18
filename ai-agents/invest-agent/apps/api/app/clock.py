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


def seconds_until(at: time, now: datetime, trading_days_only: bool = True) -> float:
    """now 다음에 오는 at 시각까지 남은 초. trading_days_only면 거래일의 at 시각까지 (브리핑), 아니면 매일 (수집).
    at이 지금과 같거나 지났으면 다음 날 것"""
    from app.functions.orders import is_trading_day

    target = now.replace(hour=at.hour, minute=at.minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    while trading_days_only and not is_trading_day(target.date()):
        target += timedelta(days=1)
    return (target - now).total_seconds()
