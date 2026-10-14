-- 성향 설문을 퀴즈로 바꾸고 일반 모드를 추가한다 (docs/plan/09-investor-profile.md)
-- investor_profiles 줄이 있고 expires_at이 지나지 않았으면 맞춤 모드, 아니면 일반 모드.
-- 정책(policies)은 가입할 때 안정형 기본값으로 만든다.
-- 적용 당시(2026-10-04) 개발 DB에 성향 행이 없어서 기존 행 변환은 하지 않는다.

ALTER TABLE investor_profiles
    ADD COLUMN birth_year smallint NOT NULL CHECK (birth_year BETWEEN 1900 AND 2100),
    -- vulnerable / no_buy_proposals / high_interest_debt / chases_hot_stocks / quiz_missed
    ADD COLUMN flags      text[] NOT NULL DEFAULT '{}',
    -- 퀴즈 결과 유효기간 (24개월)
    ADD COLUMN expires_at timestamptz NOT NULL;
