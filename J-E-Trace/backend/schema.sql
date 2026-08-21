-- J·E TRACE canonical MySQL 8 schema
-- This is the only schema used by the current backend DAO layer.

CREATE DATABASE IF NOT EXISTS jetrace
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE jetrace;

CREATE TABLE users (
    login_id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('STUDENT', 'TEACHER', 'ADMIN') NOT NULL,
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    class_name VARCHAR(100) NULL,
    subject VARCHAR(100) NULL,
    managed_classes VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    INDEX idx_users_role_approved_created (role, approved, created_at),
    INDEX idx_users_class_role_approved (class_name, role, approved)
) ENGINE=InnoDB;

CREATE TABLE task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    className VARCHAR(100) NOT NULL,
    description TEXT NULL,
    dueDate DATETIME NOT NULL,
    aiAllowed BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_task_class_due (className, dueDate),
    INDEX idx_task_created (createdAt)
) ENGINE=InnoDB;

CREATE TABLE studentRequest (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    studentName VARCHAR(100) NOT NULL,
    className VARCHAR(100) NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    requestedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processedAt DATETIME NULL,
    INDEX idx_student_request_class_status (className, status, requestedAt),
    INDEX idx_student_request_student_class (studentName, className)
) ENGINE=InnoDB;

CREATE TABLE student (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    studentName VARCHAR(100) NOT NULL,
    className VARCHAR(100) NOT NULL,
    finalScore INT NOT NULL DEFAULT 0,
    grade INT NULL,
    approvedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_name_class UNIQUE (studentName, className),
    CONSTRAINT chk_student_final_score CHECK (finalScore BETWEEN 0 AND 100),
    INDEX idx_student_class (className)
) ENGINE=InnoDB;

CREATE TABLE taskSubmission (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    taskId BIGINT NOT NULL,
    studentName VARCHAR(100) NOT NULL,
    submitted BOOLEAN NOT NULL DEFAULT FALSE,
    submittedAt DATETIME NULL,
    aiUsed BOOLEAN NOT NULL DEFAULT FALSE,
    result VARCHAR(100) NULL,
    score INT NOT NULL DEFAULT 0,
    content LONGTEXT NULL,
    previousContent LONGTEXT NULL,
    teacherComment TEXT NULL,
    feedbackStatus VARCHAR(30) NULL,
    feedbackReadAt DATETIME NULL,
    feedbackCreatedAt DATETIME NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_submission_task
        FOREIGN KEY (taskId) REFERENCES task(id) ON DELETE CASCADE,
    CONSTRAINT uq_task_submission_task_student UNIQUE (taskId, studentName),
    CONSTRAINT chk_task_submission_score CHECK (score BETWEEN 0 AND 100),
    INDEX idx_task_submission_student (studentName),
    INDEX idx_task_submission_status (taskId, submitted)
) ENGINE=InnoDB;

CREATE TABLE taskAiLog (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    taskId BIGINT NOT NULL,
    studentName VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    answer LONGTEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL,
    CONSTRAINT fk_task_ai_log_task
        FOREIGN KEY (taskId) REFERENCES task(id) ON DELETE CASCADE,
    INDEX idx_task_ai_log_task_student_created (taskId, studentName, createdAt)
) ENGINE=InnoDB;

CREATE TABLE taskReflection (
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

CREATE TABLE similarityResult (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    taskId BIGINT NOT NULL,
    studentName VARCHAR(100) NOT NULL,
    targetName VARCHAR(100) NOT NULL,
    comparisonType VARCHAR(30) NOT NULL,
    similarity INT NOT NULL,
    judge VARCHAR(20) NOT NULL,
    reason TEXT NULL,
    studentContent LONGTEXT NULL,
    targetContent LONGTEXT NULL,
    checkedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_similarity_result_task
        FOREIGN KEY (taskId) REFERENCES task(id) ON DELETE CASCADE,
    CONSTRAINT chk_similarity_percentage CHECK (similarity BETWEEN 0 AND 100),
    INDEX idx_similarity_task_student (taskId, studentName),
    INDEX idx_similarity_task_type (taskId, comparisonType),
    INDEX idx_similarity_checked (checkedAt)
) ENGINE=InnoDB;

CREATE TABLE teacherProfileChangeRequest (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    loginId VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    managedClasses VARCHAR(255) NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    requestedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processedAt DATETIME NULL,
    CONSTRAINT fk_teacher_profile_change_user
        FOREIGN KEY (loginId) REFERENCES users(login_id) ON DELETE CASCADE,
    INDEX idx_teacher_profile_change_status_requested (status, requestedAt),
    INDEX idx_teacher_profile_change_login_status (loginId, status)
) ENGINE=InnoDB;

CREATE TABLE dataDeletionRequest (
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

-- No default administrator credentials are created here.
-- Insert administrator passwords only as BCrypt hashes through a controlled process.
