-- 종목별 대화방 (docs/plan/12-todo-by-stage.md 1-4): 종목 방에서 시작한 대화는 그 종목을 기억한다
ALTER TABLE threads ADD COLUMN stock_code text REFERENCES stocks;
CREATE INDEX ON threads (user_id, stock_code, created_at DESC);
