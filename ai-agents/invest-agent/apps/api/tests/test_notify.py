"""폰 푸시 알림 (2-1): 기기 등록, 알림 쌓기, Firebase가 있으면 보내기. FCM은 가짜로 바꾼다 (인터넷 안 씀)."""

from datetime import date

import psycopg

from app import config, notify
from app.briefing import save_briefing
from app.db import connect


def test_device_register_and_notification_list(client, user, migrated) -> None:
    token = "fcm-token-" + user["id"]
    assert client.put("/api/devices", headers=user["headers"], json={"token": token, "platform": "android"}).status_code == 204
    assert client.put("/api/devices", headers=user["headers"], json={"token": token, "platform": "android"}).status_code == 204
    assert client.put("/api/devices", headers=user["headers"], json={"token": "x", "platform": "android"}).status_code == 422
    with psycopg.connect(migrated) as conn:
        assert conn.execute("SELECT count(*) FROM devices WHERE user_id = %s", (user["id"],)).fetchone()[0] == 1

    save_briefing(migrated, user["id"], date(2026, 10, 12), "morning", {"picks": [{}, {}]})
    [item] = client.get("/api/notifications", headers=user["headers"]).json()
    assert (item["kind"], item["title"], item["body"], item["pushed"]) == ("briefing", "아침 브리핑", "오늘의 매수 제안 2개가 왔어요", False)


def test_notify_sends_fcm_when_configured(client, user, migrated, monkeypatch) -> None:
    sent = []
    monkeypatch.setattr(config, "FIREBASE_CREDENTIALS", "service-account.json")
    monkeypatch.setattr(notify, "send_fcm", lambda token, title, body, data: sent.append((token, title, data)) or None)
    client.put("/api/devices", headers=user["headers"], json={"token": "fcm-token-abcdef", "platform": "android"})
    with connect(migrated) as conn:
        notify.notify(conn, user["id"], "filled", "체결됐어요 (모의투자)", "현대건설 22주 매도", {"approval_id": "A1"})
    assert sent == [("fcm-token-abcdef", "체결됐어요 (모의투자)", {"kind": "filled", "approval_id": "A1"})]
    assert client.get("/api/notifications", headers=user["headers"]).json()[0]["pushed"] is True


def test_notify_failure_does_not_break_caller(user, migrated, monkeypatch) -> None:
    def broken(*_):
        raise RuntimeError("FCM 연결 실패")

    monkeypatch.setattr(config, "FIREBASE_CREDENTIALS", "service-account.json")
    monkeypatch.setattr(notify, "send_fcm", broken)
    with psycopg.connect(migrated) as conn:
        conn.execute("INSERT INTO devices (token, user_id, platform) VALUES ('fcm-broken-1', %s, 'android')", (user["id"],))
    with connect(migrated) as conn:
        notify.notify(conn, user["id"], "close", "장 마감 요약", "10월 12일")
        error = conn.execute("SELECT error, sent_at FROM notifications WHERE user_id = %s", (user["id"],)).fetchone()
    assert error[0] == "FCM 연결 실패" and error[1] is None
