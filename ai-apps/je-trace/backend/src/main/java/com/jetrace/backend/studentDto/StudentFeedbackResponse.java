package com.jetrace.backend.studentDto;

public class StudentFeedbackResponse {
    private Long submissionId;
    private Long taskId;
    private String taskTitle;
    private String teacherComment;
    private String feedbackStatus;
    private String feedbackCreatedAt;
    private String feedbackReadAt;

    public Long getSubmissionId() { return submissionId; }
    public void setSubmissionId(Long value) { this.submissionId = value; }
    public Long getTaskId() { return taskId; }
    public void setTaskId(Long value) { this.taskId = value; }
    public String getTaskTitle() { return taskTitle; }
    public void setTaskTitle(String value) { this.taskTitle = value; }
    public String getTeacherComment() { return teacherComment; }
    public void setTeacherComment(String value) { this.teacherComment = value; }
    public String getFeedbackStatus() { return feedbackStatus; }
    public void setFeedbackStatus(String value) { this.feedbackStatus = value; }
    public String getFeedbackCreatedAt() { return feedbackCreatedAt; }
    public void setFeedbackCreatedAt(String value) { this.feedbackCreatedAt = value; }
    public String getFeedbackReadAt() { return feedbackReadAt; }
    public void setFeedbackReadAt(String value) { this.feedbackReadAt = value; }
}
