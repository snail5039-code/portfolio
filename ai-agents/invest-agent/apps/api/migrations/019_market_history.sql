-- 5단계 백테스트: 시장 전체(코스피·코스닥 모든 종목) 일별 종가·시가총액. 상장폐지된 종목도 그날 기록이 남아서
-- 날마다 "그날 기준" 시가총액 상위 종목으로 대상을 다시 고를 수 있다 (생존 편향 없이). stocks와 연결하지 않는다
CREATE TABLE market_history (
    trade_date  date NOT NULL,
    stock_code  text NOT NULL,
    stock_name  text NOT NULL,
    market      text NOT NULL CHECK (market IN ('KOSPI', 'KOSDAQ')),
    close       bigint NOT NULL,
    market_cap  bigint NOT NULL,
    PRIMARY KEY (trade_date, stock_code)
);
CREATE INDEX ON market_history (stock_code, trade_date);
