CREATE TABLE IF NOT EXISTS dataDeletionRequest (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    loginId VARCHAR(50) NOT NULL,
    studentName VARCHAR(100) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    requestedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processedAt DATETIME NULL,
    CONSTRAINT fk_data_deletion_request_user FOREIGN KEY (loginId) REFERENCES users(login_id) ON DELETE CASCADE,
    INDEX idx_data_deletion_status_requested (status, requestedAt),
    INDEX idx_data_deletion_login_status (loginId, status)
) ENGINE=InnoDB;
