"""Local-only settings loaded from environment variables / `apps/api/.env`.

`.env` is git-ignored (see root `.gitignore`) — copy `.env.example` to `.env`
and fill in real values there, never commit a key.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Get a free personal key at https://opendart.fss.or.kr (회원가입 > 인증키
# 신청/관리). Company Detail's filings fall back to a clearly-labeled fixture
# placeholder whenever this is unset — see app/routers/company_detail.py.
OPENDART_API_KEY = os.environ.get("OPENDART_API_KEY", "").strip() or None

# 한국투자증권(KIS) Developers 모의투자(paper trading) 앱키/시크릿/계좌번호.
# apiportal.koreainvestment.com 에서 KIS Developers 서비스 신청 후 "모의투자"용
# 앱키/앱시크리트를 발급받는다(실전투자용과는 별개 키). 계좌번호는 모의투자
# 참가신청으로 받은 가상계좌의 8자리(CANO)+2자리(ACNT_PRDT_CD).
# 이 중 하나라도 비어 있으면 대시보드 보유종목·승인 시 주문 전송이 fixture로
# 폴백한다 — app/integrations/kis.py, app/routers/dashboard.py,
# app/routers/approvals.py 참고.
KIS_PAPER_APP_KEY = os.environ.get("KIS_PAPER_APP_KEY", "").strip() or None
KIS_PAPER_APP_SECRET = os.environ.get("KIS_PAPER_APP_SECRET", "").strip() or None
KIS_PAPER_CANO = os.environ.get("KIS_PAPER_CANO", "").strip() or None
KIS_PAPER_ACNT_PRDT_CD = os.environ.get("KIS_PAPER_ACNT_PRDT_CD", "").strip() or None
