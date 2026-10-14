-- 반기·분기 보고서의 손익은 "이번 3개월"과 "올해 누적"이 따로 온다.
-- 최근 4개 분기 순이익(PER)과 누적 기간 증감률을 계산하려고 누적값을 저장한다.
ALTER TABLE financials ADD COLUMN add_amount bigint;       -- 이번 기간 누적 (손익 계정만, 사업보고서는 비어 있음)
ALTER TABLE financials ADD COLUMN prev_add_amount bigint;  -- 전년 같은 기간 누적
