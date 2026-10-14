-- 4단계: 분석에 쓰는 시세·재무 데이터와 공시 검색 (docs/plan/07-database.md)
-- 수집: uv run python -m app.collect

-- 일별 종가. 출처: 금융위원회_주식시세정보 (공공데이터포털). 하루 늦은 값이다
CREATE TABLE stock_prices (
    stock_code    text NOT NULL REFERENCES stocks ON DELETE CASCADE,
    trade_date    date NOT NULL,
    close         bigint NOT NULL CHECK (close > 0),
    market_cap    bigint NOT NULL CHECK (market_cap > 0),
    listed_shares bigint NOT NULL CHECK (listed_shares > 0),
    PRIMARY KEY (stock_code, trade_date)
);

-- 주요 재무 계정. 출처: OpenDART 단일회사 주요계정. 금액은 원
CREATE TABLE financials (
    stock_code  text NOT NULL REFERENCES stocks ON DELETE CASCADE,
    bsns_year   smallint NOT NULL,
    reprt_code  text NOT NULL CHECK (reprt_code IN ('11011', '11012', '11013', '11014')),  -- 사업 / 반기 / 1분기 / 3분기
    fs_div      text NOT NULL CHECK (fs_div IN ('CFS', 'OFS')),                           -- 연결 / 별도
    account     text NOT NULL,         -- 매출액, 영업이익, 당기순이익, 부채총계, 자본총계 등
    amount      bigint,                -- 이번 기간
    prev_amount bigint,                -- 전년 같은 기간
    rcept_no    text NOT NULL,         -- 이 수치가 실린 공시 접수번호 (출처)
    PRIMARY KEY (stock_code, bsns_year, reprt_code, fs_div, account)
);

-- 공시 검색: gemini-embedding-2, 768차원 (Gemini가 정해 둔 줄임 크기 중 하나)
ALTER TABLE disclosure_chunks ALTER COLUMN embedding TYPE vector(768);
CREATE INDEX ON disclosure_chunks USING hnsw (embedding vector_cosine_ops);
-- 정기보고서는 본문에서 어느 부분인지 남긴다 (예: "II. 사업의 내용")
ALTER TABLE disclosure_chunks ADD COLUMN section text;
