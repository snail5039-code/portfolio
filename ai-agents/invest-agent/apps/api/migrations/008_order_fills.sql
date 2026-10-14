-- 체결 갱신: 폰이 증권사 주문 내역을 다시 보고 체결 수량·평균가를 올린 시각 (POST /api/orders/fills)
ALTER TABLE orders ADD COLUMN checked_at timestamptz;
