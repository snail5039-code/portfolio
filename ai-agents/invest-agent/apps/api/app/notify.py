"""폰 푸시 알림 (docs/plan/12-todo-by-stage.md 2-1).

알림은 먼저 notifications 테이블에 남기고(앱의 알림 목록), Firebase가 설정돼 있으면 FCM HTTP v1로 그 사용자의 폰에 보낸다.
Firebase 설정(.env FIREBASE_CREDENTIALS = 서비스 계정 JSON 파일 경로)이 없으면 보내지 않고 쌓아만 둔다.
알림에는 계좌번호·키를 넣지 않는다. 알림 실패가 원래 일(브리핑·주문 기록)을 막지 않는다.
"""

import json
import logging

import httpx
from psycopg.rows import tuple_row

from app import config
from app.db import jsonb

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
TIMEOUT_SECONDS = 10


def notify(conn, user_id, kind: str, title: str, body: str, data: dict | None = None) -> int:
    """알림을 남기고 보낸다 (보내기는 최선). 부르는 쪽이 commit 한다. 알림 번호를 돌려준다"""
    cur = conn.cursor(row_factory=tuple_row)  # 부르는 쪽 연결이 dict_row여도 같게
    notification_id = cur.execute(
        "INSERT INTO notifications (user_id, kind, title, body, data) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (user_id, kind, title, body, jsonb(data or {})),
    ).fetchone()[0]
    if config.FIREBASE_CREDENTIALS:
        try:
            tokens = [row[0] for row in cur.execute("SELECT token FROM devices WHERE user_id = %s", (user_id,))]
            errors = [error for token in tokens if (error := send_fcm(token, title, body, {"kind": kind, **(data or {})}))]
            conn.execute("UPDATE notifications SET sent_at = now(), error = %s WHERE id = %s",
                         ("; ".join(errors)[:300] or None, notification_id))
        except Exception as error:  # noqa: BLE001 알림 실패로 원래 일을 되돌리지 않는다
            logging.getLogger(__name__).warning("알림을 보내지 못했어요: %s", error)
            conn.execute("UPDATE notifications SET error = %s WHERE id = %s", (str(error)[:300], notification_id))
    return notification_id


def _access_token() -> tuple[str, str]:
    """서비스 계정으로 FCM 접속 토큰과 프로젝트 ID. google-auth가 토큰을 캐시하지 않으므로 호출마다 받는다
    ponytail: 알림이 많아지면 토큰을 만료 전까지 재사용한다"""
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account

    credentials = service_account.Credentials.from_service_account_file(config.FIREBASE_CREDENTIALS, scopes=[FCM_SCOPE])
    credentials.refresh(Request())
    with open(config.FIREBASE_CREDENTIALS, encoding="utf-8") as file:
        project = json.load(file)["project_id"]
    return credentials.token, project


def send_fcm(token: str, title: str, body: str, data: dict) -> str | None:
    """FCM HTTP v1로 한 기기에 보낸다. 실패하면 사유 글자 (토큰이 만료됐으면 기기를 지운다는 판단은 부르는 쪽이 하지 않는다)"""
    access, project = _access_token()
    response = httpx.post(
        f"https://fcm.googleapis.com/v1/projects/{project}/messages:send",
        headers={"Authorization": f"Bearer {access}"},
        json={"message": {"token": token, "notification": {"title": title, "body": body},
                          "data": {k: str(v) for k, v in data.items()}}},
        timeout=TIMEOUT_SECONDS,
    )
    return None if response.status_code == 200 else f"FCM {response.status_code}: {response.text[:120]}"
