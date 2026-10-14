-- 관심 종목 (routers/watchlist.py). 아침 브리핑의 소식·매수 후보에도 쓴다
CREATE TABLE watchlist (
    user_id    uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    stock_code text NOT NULL REFERENCES stocks,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, stock_code)
);
