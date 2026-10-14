-- 3-2 예약·조건부 주문, 3-3 분할 매수: 조건(가격 도달 또는 시각)이 되면 폰이 일반 주문 흐름으로 주문한다.
-- 서버는 조건만 저장한다 (증권사 키는 폰에만 있어서 가격 확인·주문은 폰이 한다, AGENTS.md 1장)
CREATE TABLE reservations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    stock_code    text NOT NULL REFERENCES stocks,
    side          text NOT NULL CHECK (side IN ('buy', 'sell')),
    qty           int NOT NULL CHECK (qty > 0),
    kind          text NOT NULL CHECK (kind IN ('price', 'split')),
    trigger_price bigint CHECK (trigger_price > 0),           -- price: 이 가격에 닿으면
    direction     text CHECK (direction IN ('below', 'above')), -- below: 이하로 내려오면 / above: 이상으로 오르면
    due_at        timestamptz,                                -- split: 이 시각이 지나면
    group_id      uuid,                                       -- split: 같은 분할 매수 묶음
    status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled', 'expired')),
    expires_at    timestamptz NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    triggered_at  timestamptz,
    CHECK ((kind = 'price' AND trigger_price IS NOT NULL AND direction IS NOT NULL) OR (kind = 'split' AND due_at IS NOT NULL))
);
CREATE INDEX ON reservations (user_id, status);
