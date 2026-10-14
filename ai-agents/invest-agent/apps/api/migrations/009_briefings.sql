-- 아침 브리핑: 사용자마다 하루 한 건 (app/briefing.py). 내용은 보유 종목 공시·오늘 한도·매수 제안
CREATE TABLE briefings (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    brief_date date NOT NULL,
    content    jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, brief_date)
);
