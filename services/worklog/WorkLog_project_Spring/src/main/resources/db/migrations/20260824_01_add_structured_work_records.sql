USE workLog_project;

-- WorkLog 업무 기록 구조화 v1
-- MariaDB 10.4 기준이며, 각 변경 전에 information_schema를 확인하므로 재실행할 수 있다.

CREATE TABLE IF NOT EXISTS project (
  id INT NOT NULL AUTO_INCREMENT,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ownerMemberId INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  color VARCHAR(20),
  startDate DATE,
  dueDate DATE,
  archivedAt DATETIME,
  PRIMARY KEY (id),
  UNIQUE KEY uk_project_owner_name (ownerMemberId, name),
  KEY idx_project_owner_status_update (ownerMemberId, status, updateDate),
  CONSTRAINT fk_project_owner FOREIGN KEY (ownerMemberId) REFERENCES member (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 이전 실행이 중간에 멈춰 보조 프로시저만 남은 경우에도 다시 시작할 수 있게 한다.
DROP PROCEDURE IF EXISTS migrate_structured_work_records_v1;

DELIMITER $$
CREATE PROCEDURE migrate_structured_work_records_v1()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'projectId'
  ) THEN
    ALTER TABLE workLog ADD COLUMN projectId INT NULL AFTER boardId;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'workStatus'
  ) THEN
    ALTER TABLE workLog ADD COLUMN workStatus VARCHAR(20) NOT NULL DEFAULT 'PLANNED' AFTER projectId;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'priority'
  ) THEN
    ALTER TABLE workLog ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL' AFTER workStatus;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'startDate'
  ) THEN
    ALTER TABLE workLog ADD COLUMN startDate DATE NULL AFTER priority;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'dueDate'
  ) THEN
    ALTER TABLE workLog ADD COLUMN dueDate DATE NULL AFTER startDate;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'blocker'
  ) THEN
    ALTER TABLE workLog ADD COLUMN blocker TEXT NULL AFTER dueDate;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'nextAction'
  ) THEN
    ALTER TABLE workLog ADD COLUMN nextAction TEXT NULL AFTER blocker;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'previousWorkLogId'
  ) THEN
    ALTER TABLE workLog ADD COLUMN previousWorkLogId INT NULL AFTER nextAction;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND INDEX_NAME = 'idx_worklog_project_status_date'
  ) THEN
    ALTER TABLE workLog ADD INDEX idx_worklog_project_status_date (projectId, workStatus, regDate);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND INDEX_NAME = 'idx_worklog_previous'
  ) THEN
    ALTER TABLE workLog ADD INDEX idx_worklog_previous (previousWorkLogId);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND CONSTRAINT_NAME = 'fk_worklog_project'
  ) THEN
    ALTER TABLE workLog
      ADD CONSTRAINT fk_worklog_project FOREIGN KEY (projectId) REFERENCES project (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND CONSTRAINT_NAME = 'fk_worklog_previous'
  ) THEN
    ALTER TABLE workLog
      ADD CONSTRAINT fk_worklog_previous FOREIGN KEY (previousWorkLogId) REFERENCES workLog (id) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;

CALL migrate_structured_work_records_v1();
DROP PROCEDURE migrate_structured_work_records_v1;

CREATE TABLE IF NOT EXISTS workLogCollaborator (
  workLogId INT NOT NULL,
  memberId INT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'COLLABORATOR',
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workLogId, memberId),
  KEY idx_worklog_collaborator_member (memberId, workLogId),
  CONSTRAINT fk_collaborator_worklog FOREIGN KEY (workLogId) REFERENCES workLog (id) ON DELETE CASCADE,
  CONSTRAINT fk_collaborator_member FOREIGN KEY (memberId) REFERENCES member (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 적용 검증용 조회. 결과는 기존 데이터 보존과 새 구조 생성을 확인하는 데 사용한다.
SELECT COUNT(*) AS workLogCountAfterMigration FROM workLog;
SELECT COUNT(*) AS projectCountAfterMigration FROM project;
SELECT COUNT(*) AS collaboratorCountAfterMigration FROM workLogCollaborator;
