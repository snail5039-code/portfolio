import json
from collections.abc import Iterator
from typing import Annotated
from uuid import UUID

import psycopg
from fastapi import Depends, Request
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app import config


def connect(url: str | None = None, **kwargs) -> psycopg.Connection:
    # ponytail: 요청마다 새 연결. 3단계(PostgresSaver)에서 psycopg_pool로 바꾼다
    url = url or config.DATABASE_URL
    if not url:
        raise RuntimeError("DATABASE_URL이 비어 있습니다. apps/api/.env를 확인하세요.")
    # 세션 시간대를 서울로 둔다. 시각을 +09:00으로 돌려받고, SQL의 now()·current_date·date_trunc('day', now())·
    # timestamptz::date가 모두 한국 날짜 기준이 된다 (오늘 주문·오늘 분석 수 등은 이것에 기대어 짧게 쓴다)
    return psycopg.connect(url, connect_timeout=3, options="-c TimeZone=Asia/Seoul", **kwargs)


def get_conn(request: Request) -> Iterator[psycopg.Connection]:
    """FastAPI 의존성: 요청 하나에 연결 하나. 오류가 나면 되돌리고, 쓰기는 각 API에서 commit 한다."""
    with connect(request.app.state.database_url, row_factory=dict_row) as conn:
        yield conn


Conn = Annotated[psycopg.Connection, Depends(get_conn)]


def json_dumps(value) -> str:
    """날짜·Decimal도 글자로 바꿔 JSON으로 (DB jsonb 저장용)."""
    return json.dumps(value, default=str, ensure_ascii=False)


def jsonb(value) -> Jsonb:
    return Jsonb(value, dumps=json_dumps)


def audit(conn: psycopg.Connection, user_id: UUID, event: str, payload: dict | None = None) -> None:
    """audit_logs에 한 줄 남긴다. 비밀번호·토큰은 payload에 넣지 않는다 (NFR-05)."""
    conn.execute("INSERT INTO audit_logs (user_id, event, payload) VALUES (%s, %s, %s)", (user_id, event, jsonb(payload or {})))
