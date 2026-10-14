import sqlite3
import threading

from app.clock import now_kst_iso
from app.schemas.policy_settings import PolicyApplyRequest

NUMBER_KEYS = ("maxWeight", "maxOrder", "maxLoss", "minCash", "volatility", "expiry")
CHECK_KEYS = ("limitOrder", "marketOrder", "blockUnknown", "blockCorrection")
_COLUMNS = NUMBER_KEYS + CHECK_KEYS


class PolicySettingsStore:
    """Persists the one thing "가상 정책 적용" changes: the applied number-rule
    values and check toggles. Still a paper/demo setting only — nothing here
    enforces a real order or touches a real account; it just means the
    applied state survives a server restart instead of silently reverting to
    the fixture defaults, mirroring `ApprovalStore`'s design.

    `db_path=":memory:"` (the default, and what every test's bare
    `create_app()` gets) keeps each store isolated and non-persistent.
    `app/main.py` passes a real file path for the actual running app.
    """

    def __init__(self, db_path: str = ":memory:") -> None:
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        columns_sql = ", ".join(f"{key} TEXT NOT NULL" for key in NUMBER_KEYS)
        columns_sql += ", " + ", ".join(f"{key} INTEGER NOT NULL" for key in CHECK_KEYS)
        self._conn.execute(
            f"CREATE TABLE IF NOT EXISTS policy_settings_applied ("
            f"id INTEGER PRIMARY KEY CHECK (id = 1), {columns_sql}, applied_at TEXT NOT NULL)"
        )
        self._conn.commit()

    def get_applied(self) -> tuple[PolicyApplyRequest, str] | None:
        with self._lock:
            row = self._conn.execute(
                f"SELECT {', '.join(_COLUMNS)}, applied_at FROM policy_settings_applied WHERE id = 1"
            ).fetchone()
        if row is None:
            return None
        values = dict(zip(_COLUMNS, row[: len(_COLUMNS)]))
        for key in CHECK_KEYS:
            values[key] = bool(values[key])
        return PolicyApplyRequest(**values), row[-1]

    def apply(self, payload: PolicyApplyRequest) -> str:
        applied_at = now_kst_iso()
        values = [getattr(payload, key) for key in NUMBER_KEYS]
        values += [int(getattr(payload, key)) for key in CHECK_KEYS]
        values.append(applied_at)
        columns_sql = ", ".join(_COLUMNS)
        placeholders = ", ".join("?" for _ in _COLUMNS)
        update_sql = ", ".join(f"{key} = excluded.{key}" for key in _COLUMNS)
        with self._lock:
            self._conn.execute(
                f"INSERT INTO policy_settings_applied (id, {columns_sql}, applied_at) "
                f"VALUES (1, {placeholders}, ?) "
                f"ON CONFLICT(id) DO UPDATE SET {update_sql}, applied_at = excluded.applied_at",
                values,
            )
            self._conn.commit()
        return applied_at
