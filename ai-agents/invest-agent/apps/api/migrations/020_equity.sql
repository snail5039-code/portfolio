-- 총자산 기록 (자산 탭 그래프). 폰이 현재가로 계산한 총자산(현금 + 보유 평가액)을 스냅샷과 함께 올린다.
-- 서버에는 실시간 시세가 없어서 스냅샷(매입가만)으로는 총자산을 다시 계산할 수 없다
ALTER TABLE account_snapshots ADD COLUMN total_krw bigint CHECK (total_krw >= 0);
