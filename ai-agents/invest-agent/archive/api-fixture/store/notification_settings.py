import sqlite3
import threading

from app.clock import now_kst_iso
from app.schemas.notification_settings import NotificationApplyRequest

CHANNEL_KEYS = ("inapp", "browser", "email", "messenger")
TYPE_KEYS = ("policy", "source", "approval", "data", "volatility", "cost")


class NotificationSettingsStore:
    """Persists the things the notification settings screen lets a user
    actually change and save: per-channel enabled state, which event types
    are enabled, and the default severity threshold. Channel `enabled` here
    is purely a virtual on/off preference — saving `browser`/`email`/
    `messenger` as enabled never requests a real browser permission or opens
    a real connection (see `NotificationApplyRequest`).

    Same `db_path=":memory:"` default/real-file-in-`main.py` split as
    `ApprovalStore`/`PolicySettingsStore`.
    """

    def __init__(self, db_path: str = ":memory:") -> None:
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        columns_sql = ", ".join(f"channel_{key} INTEGER NOT NULL" for key in CHANNEL_KEYS)
        columns_sql += ", " + ", ".join(f"type_{key} INTEGER NOT NULL" for key in TYPE_KEYS)
        self._conn.execute(
            f"CREATE TABLE IF NOT EXISTS notification_settings_applied ("
            f"id INTEGER PRIMARY KEY CHECK (id = 1), {columns_sql}, "
            f"default_severity TEXT NOT NULL, applied_at TEXT NOT NULL)"
        )
        self._conn.commit()

    def get_applied(self) -> tuple[NotificationApplyRequest, str] | None:
        channel_cols = [f"channel_{key}" for key in CHANNEL_KEYS]
        type_cols = [f"type_{key}" for key in TYPE_KEYS]
        with self._lock:
            row = self._conn.execute(
                f"SELECT {', '.join(channel_cols + type_cols)}, default_severity, applied_at "
                "FROM notification_settings_applied WHERE id = 1"
            ).fetchone()
        if row is None:
            return None
        channels = {key: bool(value) for key, value in zip(CHANNEL_KEYS, row[: len(CHANNEL_KEYS)])}
        types = {
            key: bool(value)
            for key, value in zip(TYPE_KEYS, row[len(CHANNEL_KEYS) : len(CHANNEL_KEYS) + len(TYPE_KEYS)])
        }
        default_severity, applied_at = row[len(CHANNEL_KEYS) + len(TYPE_KEYS) :]
        return NotificationApplyRequest(channels=channels, types=types, defaultSeverity=default_severity), applied_at

    def apply(self, payload: NotificationApplyRequest) -> str:
        applied_at = now_kst_iso()
        columns = [f"channel_{key}" for key in CHANNEL_KEYS] + [f"type_{key}" for key in TYPE_KEYS]
        values = [int(payload.channels[key]) for key in CHANNEL_KEYS]
        values += [int(payload.types[key]) for key in TYPE_KEYS]
        values += [payload.defaultSeverity, applied_at]
        columns_sql = ", ".join(columns)
        placeholders = ", ".join("?" for _ in columns)
        update_sql = ", ".join(f"{col} = excluded.{col}" for col in columns)
        with self._lock:
            self._conn.execute(
                f"INSERT INTO notification_settings_applied (id, {columns_sql}, default_severity, applied_at) "
                f"VALUES (1, {placeholders}, ?, ?) "
                f"ON CONFLICT(id) DO UPDATE SET {update_sql}, default_severity = excluded.default_severity, "
                "applied_at = excluded.applied_at",
                values,
            )
            self._conn.commit()
        return applied_at
