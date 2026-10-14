-- 2-2 뉴스: 종목 이름으로 찾은 기사의 제목·언론사·발행 시각·원문 링크만 저장한다. 본문은 저장하지 않는다 (AGENTS.md 5장)
CREATE TABLE news (
    id           bigserial PRIMARY KEY,
    stock_code   text NOT NULL REFERENCES stocks,
    title        text NOT NULL,
    press        text,
    url          text NOT NULL,
    published_at timestamptz NOT NULL,
    fetched_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (stock_code, url)
);
CREATE INDEX news_stock_published ON news (stock_code, published_at DESC);
