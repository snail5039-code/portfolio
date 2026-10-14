-- 종목 위험등급 (docs/plan/12-todo-by-stage.md 2-5). 수집할 때 OpenDART 거래소 공시로 정한다 (app/collect.py)
-- 1 매우 높음 ~ 6 매우 낮음. 국내 상장 주식은 원칙 2등급, 관리종목·상장폐지 사유 등 위험 공시가 있으면 1등급
ALTER TABLE stocks ADD COLUMN risk_grade smallint NOT NULL DEFAULT 2 CHECK (risk_grade BETWEEN 1 AND 6);
-- 1등급으로 본 근거 공시 (없으면 NULL). disclosures에 FK를 걸지 않는다: 공시를 다시 받을 때 순서가 엇갈려도 되게
ALTER TABLE stocks ADD COLUMN risk_rcept_no text;
