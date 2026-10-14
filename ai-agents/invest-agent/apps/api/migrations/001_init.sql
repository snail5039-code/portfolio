-- 첫 테이블 15개. 설계: docs/plan/07-database.md, docs/plan/diagrams/erd.mmd
-- 금액은 bigint(원), 비율은 numeric(5,2)(%), 시각은 timestamptz.
-- 증권사 키, 계좌번호, 토큰을 저장하는 칸은 만들지 않는다.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE investor_profiles (
    user_id    uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,
    risk_level smallint NOT NULL CHECK (risk_level BETWEEN 1 AND 5),
    answers    jsonb NOT NULL DEFAULT '{}',
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE policies (
    user_id        uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,
    max_order_krw  bigint NOT NULL CHECK (max_order_krw > 0),
    max_daily_krw  bigint NOT NULL CHECK (max_daily_krw > 0),
    max_weight_pct numeric(5,2) NOT NULL CHECK (max_weight_pct BETWEEN 0 AND 100),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 폰이 올린 계좌 요약. 계좌번호 없음
CREATE TABLE account_snapshots (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    cash_krw   bigint NOT NULL CHECK (cash_krw >= 0),
    holdings   jsonb NOT NULL DEFAULT '[]',
    fetched_at timestamptz NOT NULL
);
CREATE INDEX ON account_snapshots (user_id, fetched_at DESC);

-- id는 LangGraph thread_id로도 쓴다
CREATE TABLE threads (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id  uuid NOT NULL REFERENCES threads ON DELETE CASCADE,
    role       text NOT NULL CHECK (role IN ('user', 'assistant')),
    text       text NOT NULL,
    client     text NOT NULL CHECK (client IN ('app', 'web')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON messages (thread_id, created_at);

CREATE TABLE stocks (
    code      text PRIMARY KEY,
    name      text NOT NULL,
    market    text NOT NULL CHECK (market IN ('KOSPI', 'KOSDAQ')),
    is_target boolean NOT NULL DEFAULT false
);

CREATE TABLE proposals (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    thread_id         uuid NOT NULL REFERENCES threads ON DELETE CASCADE,
    stock_code        text NOT NULL REFERENCES stocks,
    action            text NOT NULL CHECK (action IN ('buy', 'sell', 'hold', 'watch')),
    qty               int CHECK (qty > 0),
    limit_price       bigint CHECK (limit_price > 0),
    claims            jsonb NOT NULL DEFAULT '[]',
    sources           jsonb NOT NULL DEFAULT '[]',
    counter_arguments jsonb NOT NULL DEFAULT '[]',
    risks             jsonb NOT NULL DEFAULT '[]',
    invalid_if        jsonb NOT NULL DEFAULT '[]',
    user_directed     boolean NOT NULL DEFAULT false,
    data_as_of        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON proposals (user_id, created_at);

-- 반박-수정 한 번마다 한 줄 (round 0~2)
CREATE TABLE verifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid NOT NULL REFERENCES proposals ON DELETE CASCADE,
    round       smallint NOT NULL CHECK (round BETWEEN 0 AND 2),
    verdict     text NOT NULL CHECK (verdict IN ('approve', 'conditional', 'reject', 'user_judgement')),
    checks      jsonb NOT NULL DEFAULT '[]',
    challenges  jsonb NOT NULL DEFAULT '[]',
    risk_fit    text NOT NULL CHECK (risk_fit IN ('ok', 'warn', 'mismatch')),
    summary     text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (proposal_id, round)
);

CREATE TABLE policy_checks (
    proposal_id uuid PRIMARY KEY REFERENCES proposals ON DELETE CASCADE,
    ok          boolean NOT NULL,
    rules       jsonb NOT NULL DEFAULT '[]',
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 제안 하나에 승인 요청은 최대 하나
CREATE TABLE approvals (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id     uuid NOT NULL UNIQUE REFERENCES proposals ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    decided_channel text CHECK (decided_channel IN ('app', 'web')),
    expires_at      timestamptz NOT NULL,
    decided_at      timestamptz
);
CREATE INDEX ON approvals (status, expires_at);

CREATE TABLE orders (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id     uuid NOT NULL REFERENCES approvals ON DELETE CASCADE,
    idempotency_key text NOT NULL UNIQUE,
    broker          text NOT NULL CHECK (broker IN ('kb', 'kis_mock')),
    mode            text NOT NULL CHECK (mode IN ('mock', 'real')),
    side            text NOT NULL CHECK (side IN ('buy', 'sell')),
    qty             int NOT NULL CHECK (qty > 0),
    price           bigint NOT NULL CHECK (price > 0),
    broker_order_no text,
    status          text NOT NULL
                    CHECK (status IN ('accepted', 'filled', 'partially_filled', 'failed', 'unknown_checked')),
    filled_qty      int NOT NULL DEFAULT 0 CHECK (filled_qty BETWEEN 0 AND qty),
    filled_price    bigint CHECK (filled_price > 0),
    message         text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    -- KIS 모의 계좌로는 실전 주문이 있을 수 없다
    CHECK (NOT (broker = 'kis_mock' AND mode = 'real'))
);
-- 1일 한도 계산용. orders에는 user_id가 없어서 proposals(user_id, created_at)와 함께 쓴다
CREATE INDEX ON orders (created_at);

CREATE TABLE audit_logs (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    uuid REFERENCES users ON DELETE CASCADE,
    event      text NOT NULL,
    ref_id     uuid,
    payload    jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_logs (user_id, created_at);

CREATE TABLE disclosures (
    rcept_no   text PRIMARY KEY,
    stock_code text NOT NULL REFERENCES stocks,
    title      text NOT NULL,
    url        text NOT NULL,
    filed_at   date NOT NULL
);

-- 임베딩 크기와 인덱스는 4단계에서 모델을 정한 뒤 다음 마이그레이션으로 넣는다
CREATE TABLE disclosure_chunks (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rcept_no  text NOT NULL REFERENCES disclosures ON DELETE CASCADE,
    seq       int NOT NULL,
    content   text NOT NULL,
    embedding vector,
    UNIQUE (rcept_no, seq)
);
