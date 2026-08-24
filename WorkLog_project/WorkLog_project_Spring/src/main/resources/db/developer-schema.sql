CREATE DATABASE IF NOT EXISTS workLog_project
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE workLog_project;

CREATE TABLE IF NOT EXISTS member (
  id INT NOT NULL AUTO_INCREMENT,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  loginId VARCHAR(100) NOT NULL,
  loginPw VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  sex VARCHAR(10) DEFAULT 'N',
  address VARCHAR(255) DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uk_member_login_id (loginId),
  UNIQUE KEY uk_member_email (email)
);

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
);

CREATE TABLE IF NOT EXISTS workspaceMember (
  workspaceId INT NOT NULL,
  memberId INT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  invitedByMemberId INT,
  joinedAt DATETIME,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (workspaceId, memberId),
  KEY idx_workspace_member_lookup (memberId, status, workspaceId),
  CONSTRAINT fk_workspace_member_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_member_member FOREIGN KEY (memberId) REFERENCES member (id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_member_inviter FOREIGN KEY (invitedByMemberId) REFERENCES member (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS team (
  id INT NOT NULL AUTO_INCREMENT,
  workspaceId INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_team_workspace_name (workspaceId, name),
  KEY idx_team_workspace_status (workspaceId, status),
  CONSTRAINT fk_team_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teamMember (
  teamId INT NOT NULL,
  memberId INT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (teamId, memberId),
  KEY idx_team_member_lookup (memberId, teamId),
  CONSTRAINT fk_team_member_team FOREIGN KEY (teamId) REFERENCES team (id) ON DELETE CASCADE,
  CONSTRAINT fk_team_member_member FOREIGN KEY (memberId) REFERENCES member (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspaceInvitation (
  id BIGINT NOT NULL AUTO_INCREMENT,
  workspaceId INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  tokenHash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  invitedByMemberId INT NOT NULL,
  acceptedMemberId INT,
  expiresAt DATETIME NOT NULL,
  acceptedAt DATETIME,
  cancelledAt DATETIME,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_workspace_invitation_token (tokenHash),
  KEY idx_workspace_invitation_lookup (workspaceId, email, status, expiresAt),
  CONSTRAINT fk_workspace_invitation_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_invitation_inviter FOREIGN KEY (invitedByMemberId) REFERENCES member (id),
  CONSTRAINT fk_workspace_invitation_acceptor FOREIGN KEY (acceptedMemberId) REFERENCES member (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workspaceAuditLog (
  id BIGINT NOT NULL AUTO_INCREMENT,
  workspaceId INT NOT NULL,
  actorMemberId INT,
  action VARCHAR(80) NOT NULL,
  resourceType VARCHAR(50) NOT NULL,
  resourceId VARCHAR(100),
  detailsJson LONGTEXT,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_workspace_audit_timeline (workspaceId, regDate, id),
  KEY idx_workspace_audit_actor (actorMemberId, regDate),
  CONSTRAINT fk_workspace_audit_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_audit_actor FOREIGN KEY (actorMemberId) REFERENCES member (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project (
  id INT NOT NULL AUTO_INCREMENT,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ownerMemberId INT NOT NULL,
  workspaceId INT,
  teamId INT,
  visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
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
  KEY idx_project_workspace_visibility (workspaceId, teamId, visibility, status),
  CONSTRAINT fk_project_owner FOREIGN KEY (ownerMemberId) REFERENCES member (id),
  CONSTRAINT fk_project_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE SET NULL,
  CONSTRAINT fk_project_team FOREIGN KEY (teamId) REFERENCES team (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workLog (
  id INT NOT NULL AUTO_INCREMENT,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  title VARCHAR(255) NOT NULL,
  mainContent LONGTEXT,
  sideContent LONGTEXT,
  summaryContent LONGTEXT,
  templateId VARCHAR(100),
  memberId INT NOT NULL,
  boardId INT NOT NULL DEFAULT 4,
  workspaceId INT,
  teamId INT,
  visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  projectId INT,
  workStatus VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  startDate DATE,
  dueDate DATE,
  blocker TEXT,
  nextAction TEXT,
  previousWorkLogId INT,
  PRIMARY KEY (id),
  KEY idx_worklog_member_board_date (memberId, boardId, regDate),
  KEY idx_worklog_project_status_date (projectId, workStatus, regDate),
  KEY idx_worklog_previous (previousWorkLogId),
  KEY idx_worklog_workspace_visibility (workspaceId, teamId, visibility, regDate),
  CONSTRAINT fk_worklog_member FOREIGN KEY (memberId) REFERENCES member (id),
  CONSTRAINT fk_worklog_project FOREIGN KEY (projectId) REFERENCES project (id) ON DELETE SET NULL,
  CONSTRAINT fk_worklog_previous FOREIGN KEY (previousWorkLogId) REFERENCES workLog (id) ON DELETE SET NULL,
  CONSTRAINT fk_worklog_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE SET NULL,
  CONSTRAINT fk_worklog_team FOREIGN KEY (teamId) REFERENCES team (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workLogCollaborator (
  workLogId INT NOT NULL,
  memberId INT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'COLLABORATOR',
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workLogId, memberId),
  KEY idx_worklog_collaborator_member (memberId, workLogId),
  CONSTRAINT fk_collaborator_worklog FOREIGN KEY (workLogId) REFERENCES workLog (id) ON DELETE CASCADE,
  CONSTRAINT fk_collaborator_member FOREIGN KEY (memberId) REFERENCES member (id)
);

CREATE TABLE IF NOT EXISTS fileAttach (
  id INT NOT NULL AUTO_INCREMENT,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  workLogId INT NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  filePath VARCHAR(1000) NOT NULL,
  fileSize BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_file_worklog (workLogId),
  CONSTRAINT fk_file_worklog FOREIGN KEY (workLogId) REFERENCES workLog (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rePly (
  id INT NOT NULL AUTO_INCREMENT,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  workLogId INT NOT NULL,
  memberId INT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_reply_worklog (workLogId),
  CONSTRAINT fk_reply_worklog FOREIGN KEY (workLogId) REFERENCES workLog (id) ON DELETE CASCADE,
  CONSTRAINT fk_reply_member FOREIGN KEY (memberId) REFERENCES member (id)
);

CREATE TABLE IF NOT EXISTS handoverLog (
  id INT NOT NULL AUTO_INCREMENT,
  regDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updateDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  memberId INT NOT NULL,
  workspaceId INT,
  teamId INT,
  writerName VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  toName VARCHAR(100),
  toMemberId INT,
  toJob VARCHAR(100),
  fromJob VARCHAR(100),
  fromDate DATE,
  toDate DATE,
  content LONGTEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  deliveredAt DATETIME,
  confirmedAt DATETIME,
  confirmedByMemberId INT,
  completedAt DATETIME,
  PRIMARY KEY (id),
  KEY idx_handover_member (memberId),
  KEY idx_handover_status_update (status, updateDate),
  KEY idx_handover_workspace_status (workspaceId, teamId, status, updateDate),
  CONSTRAINT fk_handover_member FOREIGN KEY (memberId) REFERENCES member (id),
  CONSTRAINT fk_handover_confirmer FOREIGN KEY (confirmedByMemberId) REFERENCES member (id) ON DELETE SET NULL,
  CONSTRAINT fk_handover_workspace FOREIGN KEY (workspaceId) REFERENCES workspace (id) ON DELETE SET NULL,
  CONSTRAINT fk_handover_team FOREIGN KEY (teamId) REFERENCES team (id) ON DELETE SET NULL,
  CONSTRAINT fk_handover_recipient FOREIGN KEY (toMemberId) REFERENCES member (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pageContent (
  id BIGINT NOT NULL AUTO_INCREMENT,
  url VARCHAR(1500) NOT NULL,
  title VARCHAR(500),
  content LONGTEXT,
  crawled_at DATETIME,
  PRIMARY KEY (id),
  UNIQUE KEY uk_page_url (url(255))
);

INSERT INTO member (id, loginId, loginPw, name, email, sex, address)
VALUES (1, 'developer', SHA2('developer', 256), '개발자', 'developer@worklog.local', 'N', '로컬 개발 환경')
ON DUPLICATE KEY UPDATE name = VALUES(name), updateDate = NOW();

INSERT INTO workLog (id, regDate, updateDate, title, mainContent, sideContent, summaryContent, templateId, memberId, boardId)
VALUES
  (1, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, '개발자 모드 화면 점검', '로그인 없이 내부 기능의 화면과 동작을 확인했습니다.', '목록과 상세 페이지 연결 확인', '개발자 모드의 기본 동작을 점검했습니다.', '1', 1, 4),
  (2, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, 'WorkLog 디자인 통일', '소개 페이지와 내부 화면의 색상과 레이아웃을 정리했습니다.', '로그인 화면 대비 개선', '외부와 내부 디자인 시스템을 통일했습니다.', '1', 1, 4),
  (3, NOW(), NOW(), '오늘의 업무 계획', '미리보기와 개발자 모드를 최종 확인합니다.', '서버 및 데이터베이스 연결 점검', '전체 기능 테스트 환경을 준비했습니다.', '1', 1, 4)
ON DUPLICATE KEY UPDATE title = VALUES(title), mainContent = VALUES(mainContent), updateDate = VALUES(updateDate);

INSERT INTO handoverLog (id, memberId, writerName, title, toName, toJob, fromJob, fromDate, toDate, content)
VALUES (1, 1, '개발자', '샘플 인수인계', '다음 담당자', '개발자', '개발자', CURDATE() - INTERVAL 7 DAY, CURDATE(), '개발자 모드에서 인수인계 목록과 다운로드 화면을 확인하기 위한 샘플입니다.')
ON DUPLICATE KEY UPDATE title = VALUES(title), updateDate = NOW();
