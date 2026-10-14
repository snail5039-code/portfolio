-- 2단계: 로그인 토큰, 이용 안내 동의 시각, 수수료율

-- 로그인 토큰. 토큰 원문은 저장하지 않고 sha256 해시만 저장한다
CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);
CREATE INDEX ON sessions (user_id);

-- 가입 때 받은 이용 안내 동의 (투자 판단과 책임은 사용자에게 있음)
ALTER TABLE users ADD COLUMN terms_agreed_at timestamptz NOT NULL;

-- 내 증권사 수수료율(%). 비어 있으면 처리안에 "수수료율 미입력"으로 표시한다
ALTER TABLE policies ADD COLUMN fee_rate_pct numeric(6,4) CHECK (fee_rate_pct BETWEEN 0 AND 1);
ALTER TABLE policies ADD CHECK (max_daily_krw >= max_order_krw);
