"""KIS 모의투자 연결 점검 (앱과 따로 도는 개발용 도구).

공식 예제(github.com/koreainvestment/open-trading-api, kis_auth.py)와 같은 순서·헤더로 단계별로 호출하고 결과만 보여준다.
키는 apps/client/dev_keys.env(git 제외)에서 읽고, 화면에 출력하지 않는다. 서버(apps/api)는 이 키를 쓰지 않는다.

    python tools/kis_mock_check.py            # 토큰 → 시세 → 잔고 → 매수가능 → 주문내역
    python tools/kis_mock_check.py --order    # 위 + 모의 매수 1주 (장중에만, 모의투자 서버)

모의투자 서버(openapivts)만 쓴다. 실전 주소는 넣지 않는다.
"""

import datetime
import json
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "apps" / "client" / "dev_keys.env"
TOKEN_CACHE = Path(__file__).resolve().parent / ".kis_token_cache.json"  # git 제외. 토큰 발급은 1분에 1번
BASE = "https://openapivts.koreainvestment.com:29443"
ORDER_CODE, ORDER_QTY = "316140", 1  # 우리금융지주 1주 (싼 종목)


def load_keys() -> dict:
    pairs = (line.split("=", 1) for line in ENV_FILE.read_text(encoding="utf-8").splitlines()
             if "=" in line and not line.lstrip().startswith("#"))
    keys = {name.strip(): value.strip() for name, value in pairs}
    missing = [name for name in ("KIS_APP_KEY", "KIS_APP_SECRET", "KIS_ACCOUNT") if not keys.get(name)]
    if missing:
        sys.exit(f"dev_keys.env에 값이 없어요: {missing}")
    return keys


def token(client: httpx.Client, keys: dict) -> str:
    key_head = keys["KIS_APP_KEY"][:6]
    if TOKEN_CACHE.exists():
        cached = json.loads(TOKEN_CACHE.read_text())
        if cached.get("key_head") == key_head and cached.get("expires", 0) > time.time():
            print("1. 토큰: 저장된 토큰 사용")
            return cached["token"]
    data = client.post(f"{BASE}/oauth2/tokenP", json={
        "grant_type": "client_credentials", "appkey": keys["KIS_APP_KEY"], "appsecret": keys["KIS_APP_SECRET"]}).json()
    if "access_token" not in data:
        sys.exit(f"1. 토큰: 실패 {data.get('error_code')} {data.get('error_description')}")
    TOKEN_CACHE.write_text(json.dumps({"token": data["access_token"], "key_head": key_head,
                                       "expires": time.time() + int(data.get("expires_in", 86400)) - 600}))
    print(f"1. 토큰: 받음 (만료 {data.get('access_token_token_expired')})")
    return data["access_token"]


def headers(keys: dict, access_token: str, tr_id: str) -> dict:
    # 공식 kis_auth.py의 _getBaseHeader + 호출별 칸
    return {
        "Content-Type": "application/json", "Accept": "text/plain", "charset": "UTF-8", "User-Agent": "kis-mock-check",
        "authorization": f"Bearer {access_token}", "appkey": keys["KIS_APP_KEY"], "appsecret": keys["KIS_APP_SECRET"],
        "tr_id": tr_id, "custtype": "P", "tr_cont": "",
    }


def show(step: str, response: httpx.Response, pick=None) -> dict:
    data = response.json()
    ok = data.get("rt_cd") == "0"
    line = f"{step}: {'성공' if ok else '실패'} (HTTP {response.status_code}, {data.get('msg_cd')} {(data.get('msg1') or '').strip()})"
    if ok and pick:
        line += f" → {pick(data)}"
    print(line)
    time.sleep(1.1)  # 모의투자는 초당 호출 수가 적다
    return data


def main() -> None:
    keys = load_keys()
    cano, product = keys["KIS_ACCOUNT"].replace("-", "")[:8], (keys["KIS_ACCOUNT"].replace("-", "")[8:] or "01")
    print(f"계좌: 앞 8자리 {cano[:2]}******, 상품코드 {product} / 서버: 모의투자")
    client = httpx.Client(timeout=15)
    access_token = token(client, keys)
    account = {"CANO": cano, "ACNT_PRDT_CD": product}
    today = datetime.datetime.now().strftime("%Y%m%d")

    show("2. 시세 (계좌 불필요)", client.get(f"{BASE}/uapi/domestic-stock/v1/quotations/inquire-price",
         headers=headers(keys, access_token, "FHKST01010100"), params={"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ORDER_CODE}),
         lambda d: f"우리금융지주 {d['output']['stck_prpr']}원")
    show("3. 잔고 VTTC8434R", client.get(f"{BASE}/uapi/domestic-stock/v1/trading/inquire-balance",
         headers=headers(keys, access_token, "VTTC8434R"), params={
             **account, "AFHR_FLPR_YN": "N", "OFL_YN": "", "INQR_DVSN": "02", "UNPR_DVSN": "01", "FUND_STTL_ICLD_YN": "N",
             "FNCG_AMT_AUTO_RDPT_YN": "N", "PRCS_DVSN": "00", "CTX_AREA_FK100": "", "CTX_AREA_NK100": ""}),
         lambda d: f"예수금 {d['output2'][0]['dnca_tot_amt']}원, 보유 {sum(int(r['hldg_qty']) > 0 for r in d['output1'])}종목")
    show("4. 매수가능 VTTC8908R", client.get(f"{BASE}/uapi/domestic-stock/v1/trading/inquire-psbl-order",
         headers=headers(keys, access_token, "VTTC8908R"), params={
             **account, "PDNO": ORDER_CODE, "ORD_UNPR": "", "ORD_DVSN": "01", "CMA_EVLU_AMT_ICLD_YN": "N", "OVRS_ICLD_YN": "N"}),
         lambda d: f"주문가능현금 {d['output']['ord_psbl_cash']}원")
    show("5. 오늘 주문내역 VTTC0081R", client.get(f"{BASE}/uapi/domestic-stock/v1/trading/inquire-daily-ccld",
         headers=headers(keys, access_token, "VTTC0081R"), params={
             **account, "INQR_STRT_DT": today, "INQR_END_DT": today, "SLL_BUY_DVSN_CD": "00", "PDNO": "", "CCLD_DVSN": "00",
             "INQR_DVSN": "00", "INQR_DVSN_1": "", "INQR_DVSN_3": "00", "ORD_GNO_BRNO": "", "ODNO": "", "EXCG_ID_DVSN_CD": "KRX",
             "CTX_AREA_FK100": "", "CTX_AREA_NK100": ""}),
         lambda d: f"{len(d['output1'])}건")

    if "--order" in sys.argv:
        show(f"6. 모의 매수 {ORDER_QTY}주 (시장가) VTTC0012U", client.post(f"{BASE}/uapi/domestic-stock/v1/trading/order-cash",
             headers=headers(keys, access_token, "VTTC0012U"), json={
                 **account, "PDNO": ORDER_CODE, "ORD_DVSN": "01", "ORD_QTY": str(ORDER_QTY), "ORD_UNPR": "0",
                 "EXCG_ID_DVSN_CD": "KRX", "SLL_TYPE": "", "CNDT_PRIC": ""}),
             lambda d: f"주문번호 {d['output']['ODNO']}, 시각 {d['output']['ORD_TMD']}")


if __name__ == "__main__":
    main()
