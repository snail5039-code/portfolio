-- 자동매매가 "시장 탓 하락"이라 매도 판단을 미룬 기록 (2026-10-20). 점수표가 미룬 때 가격과 그날 종가를 비교한다.
-- 폰이 올린다 (서버에는 실시간 시세가 없다)
CREATE TABLE sell_deferrals (
    id          bigserial PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    stock_code  text NOT NULL REFERENCES stocks ON DELETE CASCADE,
    reason      text NOT NULL CHECK (reason IN ('stop', 'drop', 'giveback', 'market')),
    price       bigint NOT NULL CHECK (price > 0),
    market_pct  numeric(6, 2),
    stock_pct   numeric(6, 2),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sell_deferrals_user_day ON sell_deferrals (user_id, created_at);
