-- 투자 용어집 (app/glossary.py). 원본은 data/glossary_*.json, 이 테이블은 찾기용 사본이다
CREATE TABLE glossary_terms (
    id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    term     text NOT NULL,
    names    text[] NOT NULL,        -- 이름·다른 이름을 normalize한 값 (찾기용)
    short    text,                   -- 한 줄 설명 (앱 용어집만)
    body     text NOT NULL,
    caution  text,
    source   text NOT NULL,          -- 금융위원회 금융용어사전 / 투자 에이전트 용어집
    url      text,
    reviewed boolean NOT NULL        -- false면 "검토 전 초안"으로 보여준다
);
CREATE INDEX ON glossary_terms USING gin (names);
