ALTER TABLE handoverLog
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' AFTER content,
  ADD COLUMN deliveredAt DATETIME NULL AFTER status,
  ADD COLUMN confirmedAt DATETIME NULL AFTER deliveredAt,
  ADD COLUMN confirmedByMemberId INT NULL AFTER confirmedAt,
  ADD COLUMN completedAt DATETIME NULL AFTER confirmedByMemberId,
  ADD KEY idx_handover_status_update (status, updateDate),
  ADD CONSTRAINT fk_handover_confirmer
    FOREIGN KEY (confirmedByMemberId) REFERENCES member (id) ON DELETE SET NULL;

UPDATE handoverLog
   SET status = 'DRAFT'
 WHERE status IS NULL OR status = '';
