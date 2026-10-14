-- 3-1 정정·취소: 원래 주문을 가리키는 정정·취소 주문 행. 원래 주문은 취소되면 cancelled, 정정되면 replaced
ALTER TABLE orders ADD COLUMN kind text NOT NULL DEFAULT 'new' CHECK (kind IN ('new', 'cancel', 'modify'));
ALTER TABLE orders ADD COLUMN original_order_id uuid REFERENCES orders;
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('accepted', 'filled', 'partially_filled', 'failed', 'unknown_checked', 'cancelled', 'replaced'));
