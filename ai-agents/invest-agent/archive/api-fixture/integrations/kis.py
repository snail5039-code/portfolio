"""Thin client for 한국투자증권(KIS) Developers' 모의투자(paper-trading) API.

This module only ever talks to KIS's paper-trading server
(`openapivts.koreainvestment.com`) — the real-trading domain
(`openapi.koreainvestment.com`) and its tr_id family (`T`/`J`/`C`-prefixed,
e.g. `TTTC8434R`) never appear anywhere in this file, on purpose. Every
tr_id used here is the `V`-prefixed paper-trading id KIS documents for the
same endpoint. An order placed through `place_paper_order` fills (or is
rejected) against KIS's own virtual account — no real money or real
securities are ever involved, regardless of the response.

Endpoints (see https://apiportal.koreainvestment.com and the reference
implementation at https://github.com/koreainvestment/open-trading-api):
- `POST /oauth2/tokenP`                                    — access token
- `GET  /uapi/domestic-stock/v1/trading/inquire-balance`    (tr_id VTTC8434R)
- `GET  /uapi/domestic-stock/v1/quotations/inquire-price`   (tr_id FHKST01010100)
- `POST /uapi/domestic-stock/v1/trading/order-cash`         (tr_id VTTC0012U buy / VTTC0011U sell)
"""

import threading
import time
from datetime import datetime
from typing import Literal

import httpx

from app.clock import KST

PAPER_BASE_URL = "https://openapivts.koreainvestment.com:29443"
REQUEST_TIMEOUT_SECONDS = 15

# KIS's own success code inside the JSON body (distinct from the HTTP status,
# which is 200 even for a rejected order — the real result is `rt_cd`).
STATUS_OK = "0"

DEFAULT_TOKEN_TTL_SECONDS = 23 * 60 * 60  # KIS documents ~1 day; refresh a bit early.


class KisApiError(Exception):
    """A non-success (`rt_cd` != "0") response from KIS, or a token issuance failure."""


class _TokenCache:
    """Caches the OAuth access token in memory for its ~1 day lifetime so a
    request doesn't re-issue a token every call — KIS returns the same token
    if re-requested within 6h of issuance anyway, but there's no reason to
    even make that round trip. One process-wide cache is fine here: every
    call already passes the same `app_key`, since this app only ever has one
    KIS paper account configured at a time (see `app/config.py`).
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._token: str | None = None
        self._expires_at_monotonic: float = 0.0

    async def get(self, app_key: str, app_secret: str) -> str:
        with self._lock:
            if self._token is not None and time.monotonic() < self._expires_at_monotonic:
                return self._token

        token, ttl_seconds = await _issue_token(app_key, app_secret)

        with self._lock:
            self._token = token
            self._expires_at_monotonic = time.monotonic() + max(ttl_seconds - 300, 60)
        return token


_token_cache = _TokenCache()


def _seconds_until_expiry(payload: dict) -> int:
    expired_at = payload.get("access_token_token_expired")
    if expired_at:
        try:
            expires_dt = datetime.strptime(expired_at, "%Y-%m-%d %H:%M:%S").replace(tzinfo=KST)
            return max(int((expires_dt - datetime.now(KST)).total_seconds()), 60)
        except ValueError:
            pass
    return DEFAULT_TOKEN_TTL_SECONDS


async def _issue_token(app_key: str, app_secret: str) -> tuple[str, int]:
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{PAPER_BASE_URL}/oauth2/tokenP",
            json={"grant_type": "client_credentials", "appkey": app_key, "appsecret": app_secret},
        )
        response.raise_for_status()
        payload = response.json()

    token = payload.get("access_token")
    if not token:
        raise KisApiError(f"KIS 모의투자 토큰 발급 실패: {payload}")
    return token, _seconds_until_expiry(payload)


def _headers(token: str, app_key: str, app_secret: str, tr_id: str) -> dict[str, str]:
    return {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "appkey": app_key,
        "appsecret": app_secret,
        "tr_id": tr_id,
        "custtype": "P",
    }


def _raise_for_kis_error(payload: dict, what: str) -> None:
    if payload.get("rt_cd") != STATUS_OK:
        raise KisApiError(f"KIS {what} 실패: {payload.get('msg_cd')} {payload.get('msg1')}")


async def get_balance(app_key: str, app_secret: str, cano: str, acnt_prdt_cd: str) -> tuple[list[dict], dict]:
    """Returns `(holdings, summary)` from the paper account: `holdings` is
    the list of currently held positions (KIS's `output1`, one dict per
    position with keys like `pdno`/`hldg_qty`/`pchs_avg_pric`/`prpr`/
    `evlu_amt`/`evlu_pfls_amt`/`evlu_pfls_rt`), `summary` is the
    account-level totals (`output2`, e.g. `dnca_tot_amt` cash on hand,
    `tot_evlu_amt` total valuation).
    """
    token = await _token_cache.get(app_key, app_secret)
    params = {
        "CANO": cano,
        "ACNT_PRDT_CD": acnt_prdt_cd,
        "AFHR_FLPR_YN": "N",
        "OFL_YN": "",
        "INQR_DVSN": "02",
        "UNPR_DVSN": "01",
        "FUND_STTL_ICLD_YN": "N",
        "FNCG_AMT_AUTO_RDPT_YN": "N",
        "PRCS_DVSN": "00",
        "CTX_AREA_FK100": "",
        "CTX_AREA_NK100": "",
    }
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.get(
            f"{PAPER_BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance",
            headers=_headers(token, app_key, app_secret, "VTTC8434R"),
            params=params,
        )
        response.raise_for_status()
        payload = response.json()

    _raise_for_kis_error(payload, "잔고조회")

    holdings = [row for row in payload.get("output1", []) if int(row.get("hldg_qty", "0") or "0") > 0]
    summary_rows = payload.get("output2") or [{}]
    return holdings, summary_rows[0]


async def get_current_price(app_key: str, app_secret: str, stock_code: str) -> dict:
    """Live current-price quote for `stock_code`. Same tr_id and data for
    both paper and real trading — price quotes aren't account-scoped."""
    token = await _token_cache.get(app_key, app_secret)
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.get(
            f"{PAPER_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price",
            headers=_headers(token, app_key, app_secret, "FHKST01010100"),
            params={"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": stock_code},
        )
        response.raise_for_status()
        payload = response.json()

    _raise_for_kis_error(payload, "현재가 조회")
    return payload.get("output", {})


async def place_paper_order(
    app_key: str,
    app_secret: str,
    cano: str,
    acnt_prdt_cd: str,
    stock_code: str,
    side: Literal["buy", "sell"],
    quantity: int,
    price: int,
) -> dict:
    """Places a limit order against KIS's own paper-trading account
    (tr_id `VTTC0012U`/`VTTC0011U` — the `V`-prefixed, virtual-account
    versions of the real order tr_ids `TTTC0012U`/`TTTC0011U`, which this
    module never sends). Returns KIS's order acknowledgement (order number,
    order time) — this fills against a virtual balance KIS itself manages,
    never a real one.
    """
    token = await _token_cache.get(app_key, app_secret)
    tr_id = "VTTC0012U" if side == "buy" else "VTTC0011U"
    body = {
        "CANO": cano,
        "ACNT_PRDT_CD": acnt_prdt_cd,
        "PDNO": stock_code,
        "ORD_DVSN": "00",  # 00: 지정가
        "ORD_QTY": str(quantity),
        "ORD_UNPR": str(price),
        "EXCG_ID_DVSN_CD": "KRX",
        "SLL_TYPE": "01" if side == "sell" else "",
        "CNDT_PRIC": "",
    }
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{PAPER_BASE_URL}/uapi/domestic-stock/v1/trading/order-cash",
            headers=_headers(token, app_key, app_secret, tr_id),
            json=body,
        )
        response.raise_for_status()
        payload = response.json()

    _raise_for_kis_error(payload, "모의투자 주문")
    return payload.get("output", {})
