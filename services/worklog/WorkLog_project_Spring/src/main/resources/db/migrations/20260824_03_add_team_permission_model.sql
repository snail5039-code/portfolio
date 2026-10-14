USE workLog_project;

CREATE TABLE IF NOT EXISTS workspace (
  id INT NOT NULL AUTO_INCREMENT,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  ownerMemberId INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (id),
  UNIQUE KEY uk_workspace_slug (slug),
  KEY idx_workspace_owner_status (ownerMemberId, status),
  CONSTRAINT fk_workspace_owner FOREIGN KEY (ownerMemberId) REFERENCES member (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspaceMember (
  workspaceId INT NOT NULL,
  memberId INT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  invitedByMemberId INT NULL,
  joinedAt DATETIME NULL,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (workspaceId, memberId),
  KEY idx_workspace_member_lookup (memberId, status, workspaceId),
  CONSTRAINT fk_workspace_member_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_member_member FOREIGN KEY (memberId) REFERENCES member (id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_member_inviter FOREIGN KEY (invitedByMemberId) REFERENCES member (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team (
  id INT NOT NULL AUTO_INCREMENT,
  workspaceId INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_team_workspace_name (workspaceId, name),
  KEY idx_team_workspace_status (workspaceId, status),
  CONSTRAINT fk_team_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teamMember (
  teamId INT NOT NULL,
  memberId INT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (teamId, memberId),
  KEY idx_team_member_lookup (memberId, teamId),
  CONSTRAINT fk_team_member_team FOREIGN KEY (teamId) REFERENCES team (id) ON DELETE CASCADE,
  CONSTRAINT fk_team_member_member FOREIGN KEY (memberId) REFERENCES member (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspaceInvitation (
  id BIGINT NOT NULL AUTO_INCREMENT,
  workspaceId INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  tokenHash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  invitedByMemberId INT NOT NULL,
  acceptedMemberId INT NULL,
  expiresAt DATETIME NOT NULL,
  acceptedAt DATETIME NULL,
  cancelledAt DATETIME NULL,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_workspace_invitation_token (tokenHash),
  KEY idx_workspace_invitation_lookup (workspaceId, email, status, expiresAt),
  CONSTRAINT fk_workspace_invitation_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_invitation_inviter FOREIGN KEY (invitedByMemberId) REFERENCES member (id),
  CONSTRAINT fk_workspace_invitation_acceptor FOREIGN KEY (acceptedMemberId) REFERENCES member (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspaceAuditLog (
  id BIGINT NOT NULL AUTO_INCREMENT,
  workspaceId INT NOT NULL,
  actorMemberId INT NULL,
  action VARCHAR(80) NOT NULL,
  resourceType VARCHAR(50) NOT NULL,
  resourceId VARCHAR(100) NULL,
  detailsJson LONGTEXT NULL,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_workspace_audit_timeline (workspaceId, regDate, id),
  KEY idx_workspace_audit_actor (actorMemberId, regDate),
  CONSTRAINT fk_workspace_audit_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_audit_actor FOREIGN KEY (actorMemberId) REFERENCES member (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS migrate_team_permission_model_v1;
DELIMITER $$
CREATE PROCEDURE migrate_team_permission_model_v1()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'workspaceId') THEN
    ALTER TABLE workLog ADD COLUMN workspaceId INT NULL AFTER boardId;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'teamId') THEN
    ALTER TABLE workLog ADD COLUMN teamId INT NULL AFTER workspaceId;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND COLUMN_NAME = 'visibility') THEN
    ALTER TABLE workLog ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE' AFTER teamId;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project' AND COLUMN_NAME = 'workspaceId') THEN
    ALTER TABLE project ADD COLUMN workspaceId INT NULL AFTER ownerMemberId;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project' AND COLUMN_NAME = 'teamId') THEN
    ALTER TABLE project ADD COLUMN teamId INT NULL AFTER workspaceId;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project' AND COLUMN_NAME = 'visibility') THEN
    ALTER TABLE project ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE' AFTER teamId;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoverLog' AND COLUMN_NAME = 'workspaceId') THEN
    ALTER TABLE handoverLog ADD COLUMN workspaceId INT NULL AFTER memberId;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoverLog' AND COLUMN_NAME = 'teamId') THEN
    ALTER TABLE handoverLog ADD COLUMN teamId INT NULL AFTER workspaceId;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoverLog' AND COLUMN_NAME = 'toMemberId') THEN
    ALTER TABLE handoverLog ADD COLUMN toMemberId INT NULL AFTER toName;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND INDEX_NAME = 'idx_worklog_workspace_visibility') THEN
    ALTER TABLE workLog ADD INDEX idx_worklog_workspace_visibility (workspaceId, teamId, visibility, regDate);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project' AND INDEX_NAME = 'idx_project_workspace_visibility') THEN
    ALTER TABLE project ADD INDEX idx_project_workspace_visibility (workspaceId, teamId, visibility, status);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'handoverLog' AND INDEX_NAME = 'idx_handover_workspace_status') THEN
    ALTER TABLE handoverLog ADD INDEX idx_handover_workspace_status (workspaceId, teamId, status, updateDate);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND CONSTRAINT_NAME = 'fk_worklog_workspace') THEN
    ALTER TABLE workLog ADD CONSTRAINT fk_worklog_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'workLog' AND CONSTRAINT_NAME = 'fk_worklog_team') THEN
    ALTER TABLE workLog ADD CONSTRAINT fk_worklog_team FOREIGN KEY (teamId) REFERENCES team (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'project' AND CONSTRAINT_NAME = 'fk_project_workspace') THEN
    ALTER TABLE project ADD CONSTRAINT fk_project_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'project' AND CONSTRAINT_NAME = 'fk_project_team') THEN
    ALTER TABLE project ADD CONSTRAINT fk_project_team FOREIGN KEY (teamId) REFERENCES team (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'handoverLog' AND CONSTRAINT_NAME = 'fk_handover_workspace') THEN
    ALTER TABLE handoverLog ADD CONSTRAINT fk_handover_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'handoverLog' AND CONSTRAINT_NAME = 'fk_handover_team') THEN
    ALTER TABLE handoverLog ADD CONSTRAINT fk_handover_team FOREIGN KEY (teamId) REFERENCES team (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'handoverLog' AND CONSTRAINT_NAME = 'fk_handover_recipient') THEN
    ALTER TABLE handoverLog ADD CONSTRAINT fk_handover_recipient FOREIGN KEY (toMemberId) REFERENCES member (id) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;

CALL migrate_team_permission_model_v1();
DROP PROCEDURE migrate_team_permission_model_v1;

SELECT COUNT(*) AS workspaceCountAfterMigration FROM workspace;
SELECT COUNT(*) AS existingPrivateWorkLogCount FROM workLog WHERE workspaceId IS NULL AND visibility = 'PRIVATE';
