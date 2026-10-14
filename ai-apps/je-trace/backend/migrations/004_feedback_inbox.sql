USE jetrace;

ALTER TABLE taskSubmission
    ADD COLUMN previousContent LONGTEXT NULL AFTER content,
    ADD COLUMN feedbackStatus VARCHAR(30) NULL AFTER teacherComment,
    ADD COLUMN feedbackReadAt DATETIME NULL AFTER feedbackStatus,
    ADD COLUMN feedbackCreatedAt DATETIME NULL AFTER feedbackReadAt,
    ADD INDEX idx_submission_feedback (studentName, feedbackReadAt, feedbackCreatedAt);
