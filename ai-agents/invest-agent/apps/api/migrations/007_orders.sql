-- 5단계 주문: 처리안 카드와 시각 (docs/plan/05-schemas.md 7장)
ALTER TABLE approvals ADD COLUMN card jsonb NOT NULL DEFAULT '{}';                -- 처리안 카드 (화면 S-07)
ALTER TABLE approvals ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();   -- 처리안을 만든 시각 (타임라인)
CREATE INDEX ON orders (approval_id);
