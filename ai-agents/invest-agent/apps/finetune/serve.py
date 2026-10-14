"""학습한 모델을 이 PC에서만 띄운다. 서버(apps/api)가 SIGNAL_MODEL_URL로 부른다.

  uv run python serve.py        # http://127.0.0.1:8100/classify  POST {"text": "..."} → {"signal": "..."}
"""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

from common import classify, load

MAX_CHARS = 500
model, tok = load(adapter=True)
lock = Lock()  # ponytail: GPU 하나라 한 번에 하나씩. 사용자가 많아지면 묶어서 처리


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            text = json.loads(self.rfile.read(int(self.headers["Content-Length"])))["text"]
            if not isinstance(text, str) or not text.strip():
                raise ValueError
        except (ValueError, KeyError, TypeError):
            return self.reply(400, {"error": "text가 필요합니다"})
        with lock:
            signal = classify(model, tok, [text[:MAX_CHARS]])[0]
        self.reply(200, {"signal": signal})

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8100), Handler).serve_forever()
