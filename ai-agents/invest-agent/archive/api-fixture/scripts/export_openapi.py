"""Writes the FastAPI app's OpenAPI schema to a JSON file.

Used by `apps/web`'s `npm run generate:types` to feed openapi-typescript, so
the frontend's API types can be regenerated from the backend's actual response
models without needing a running server.

    uv run python scripts/export_openapi.py openapi.json
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402


def main() -> None:
    out_path = Path(sys.argv[1] if len(sys.argv) > 1 else "openapi.json")
    out_path.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
