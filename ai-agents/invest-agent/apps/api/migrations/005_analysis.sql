-- 4단계 분석 기록에 빠져 있던 칸 (docs/plan/05-schemas.md 3·5장)
ALTER TABLE proposals ADD COLUMN metrics jsonb NOT NULL DEFAULT '[]';          -- 코드가 계산한 지표
ALTER TABLE verifications ADD COLUMN conditions jsonb NOT NULL DEFAULT '[]';   -- 조건부 승인의 조건
ALTER TABLE verifications ADD COLUMN disagreements jsonb NOT NULL DEFAULT '[]';  -- 투자 AI와 의견이 다른 점
