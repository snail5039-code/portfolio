-- 장중 계좌 기록에 그때 코스피·코스닥 전일 대비 %를 같이 남긴다 (2026-10-22).
-- 서버에는 지수 장중 기록이 없어서 "아침 하락 뒤 반등하는지"를 계좌와 나란히 볼 수 없었다. 폰이 올린다
ALTER TABLE account_snapshots ADD COLUMN kospi_pct numeric(6, 2), ADD COLUMN kosdaq_pct numeric(6, 2);
