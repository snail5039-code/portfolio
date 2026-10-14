"""migrations/*.sql을 이름 순서대로, 아직 적용하지 않은 것만 적용한다.

실행: uv run python -m app.migrate
"""

from pathlib import Path

from app.db import connect

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def migrate(url: str | None = None) -> list[str]:
    """적용한 파일 이름 목록을 돌려준다. 파일 하나가 실패하면 그 파일은 되돌리고 멈춘다."""
    applied_now = []
    with connect(url) as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            " version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        conn.commit()
        done = {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in done:
                continue
            with conn.transaction():
                conn.execute(path.read_text(encoding="utf-8"))
                conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (path.name,))
            applied_now.append(path.name)
    return applied_now


if __name__ == "__main__":
    applied = migrate()
    print(f"적용: {', '.join(applied)}" if applied else "적용할 마이그레이션 없음")
