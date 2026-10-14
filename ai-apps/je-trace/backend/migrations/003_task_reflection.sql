USE jetrace;

CREATE TABLE IF NOT EXISTS taskReflection (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    taskId BIGINT NOT NULL,
    studentName VARCHAR(100) NOT NULL,
    initialChange TEXT NULL,
    verifiedContent TEXT NULL,
    unresolvedQuestion TEXT NULL,
    retryApproach TEXT NULL,
    understandingLevel TINYINT NULL,
    submitted BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_reflection_task FOREIGN KEY (taskId) REFERENCES task(id) ON DELETE CASCADE,
    CONSTRAINT uq_task_reflection_task_student UNIQUE (taskId, studentName),
    CONSTRAINT chk_task_reflection_understanding CHECK (understandingLevel IS NULL OR understandingLevel BETWEEN 1 AND 5),
    INDEX idx_task_reflection_student (studentName),
    INDEX idx_task_reflection_submitted (taskId, submitted)
) ENGINE=InnoDB;
