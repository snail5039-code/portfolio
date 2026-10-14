"""환경변수 설정. 값은 `apps/api/.env`(git 제외)에 둔다.

서버는 증권사 키·계좌번호를 받지 않는다 (AGENTS.md 1장). 여기에 추가하지 않는다.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
# OpenDART 공시 API 키
OPENDART_API_KEY = os.environ.get("OPENDART_API_KEY", "").strip() or None

# Gemini. 모델은 .env에서 바꿀 수 있다
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip() or None
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "").strip() or "gemini-3.6-flash"
GEMINI_EMBEDDING_MODEL = os.environ.get("GEMINI_EMBEDDING_MODEL", "").strip() or "gemini-embedding-2"

# 공공데이터포털 금융위원회_주식시세정보: 일별 종가와 시가총액
DATA_GO_KR_API_KEY = os.environ.get("DATA_GO_KR_API_KEY", "").strip() or None

# 서버가 매일 이 시각(KST)에 분석용 데이터(공시·재무·시세)를 자동 수집한다. 시세는 영업일 다음 날 오후에 갱신된다.
# 쉼표로 여러 번. 비우면 7시·14시: 7시는 아침 브리핑 전에 밤사이 공시를 (2026-10-13 사용자 요청),
# 14시는 전 거래일 종가를 받는다 (공공데이터 시세가 다음 영업일 오후에 올라와 7시엔 이틀 전 종가뿐, 2026-10-14 점검). "off"면 끈다
AUTO_COLLECT_HOUR = os.environ.get("AUTO_COLLECT_HOUR", "").strip() or "7,14"
# 아침 브리핑 자동 실행 시각. 비우면 08:20, "off"면 안 함 (사용자마다 Gemini 호출이 생긴다).
# 2026-10-13 사용자 요청: 사람이 손으로 돌리지 않고 서버가 매일 만든다
MORNING_BRIEF_TIME = None if (_brief := os.environ.get("MORNING_BRIEF_TIME", "").strip() or "08:20") == "off" else _brief
# 장 마감 요약 시각. LLM이 없어 비용이 없으므로 기본으로 켠다. "off"면 안 함
CLOSE_SUMMARY_TIME = os.environ.get("CLOSE_SUMMARY_TIME", "").strip() or "15:40"
# 장 마감 AI 회고·내일 계획 시각 (예: "15:50", 장 마감 요약 뒤). Gemini 비용이 생겨 비어 있으면 끈다
CLOSE_REVIEW_TIME = os.environ.get("CLOSE_REVIEW_TIME", "").strip() or None

# 분석할 때 Google 뉴스 RSS에서 종목 뉴스(제목·링크)를 받는다. 무료, 키 없음. "off"면 저장된 뉴스만 쓴다
NEWS_FETCH = os.environ.get("NEWS_FETCH", "").strip().lower() != "off"

# 폰 푸시 알림 (2-1): Firebase 서비스 계정 JSON 파일 경로. 비우면 알림을 쌓기만 하고 보내지 않는다 (앱 알림 목록에는 보임)
FIREBASE_CREDENTIALS = os.environ.get("FIREBASE_CREDENTIALS", "").strip() or None

# 개발용: 장 운영 시간 검사를 이 시각(KST, 예: "10:00")으로 한다. 비우면 실제 시계. 운영 서버에서는 비운다
MARKET_CLOCK = os.environ.get("MARKET_CLOCK", "").strip() or None

# 웹(Flutter Web) 개발 서버 주소. 쉼표로 여러 개. 비우면 다른 주소의 브라우저 요청을 받지 않는다
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

# 대화 속 성향 신호 감지 모델 (5-4, apps/finetune/serve.py 주소, 예: http://127.0.0.1:8100/classify). 비우면 쓰지 않는다
SIGNAL_MODEL_URL = os.environ.get("SIGNAL_MODEL_URL", "").strip() or None
# 모의투자에도 금액 한도(1회·1일·계좌 비율)를 적용할지. 기본 끔: 모의는 가상 돈으로 사고팔며 검증하고,
# 살 총액은 사용자가 자동매매 계획에서 정한다 (2026-10-13 사용자 결정). 실전은 항상 적용한다
MOCK_ORDER_LIMITS = os.environ.get("MOCK_ORDER_LIMITS", "").strip().lower() in ("1", "on", "true")
