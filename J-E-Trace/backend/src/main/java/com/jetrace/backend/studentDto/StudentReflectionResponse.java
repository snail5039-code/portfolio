package com.jetrace.backend.studentDto;

public class StudentReflectionResponse {
    private Long taskId;
    private String initialChange;
    private String verifiedContent;
    private String unresolvedQuestion;
    private String retryApproach;
    private Integer understandingLevel;
    private Boolean submitted;
    private String updatedAt;

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public String getInitialChange() { return initialChange; }
    public void setInitialChange(String initialChange) { this.initialChange = initialChange; }
    public String getVerifiedContent() { return verifiedContent; }
    public void setVerifiedContent(String verifiedContent) { this.verifiedContent = verifiedContent; }
    public String getUnresolvedQuestion() { return unresolvedQuestion; }
    public void setUnresolvedQuestion(String unresolvedQuestion) { this.unresolvedQuestion = unresolvedQuestion; }
    public String getRetryApproach() { return retryApproach; }
    public void setRetryApproach(String retryApproach) { this.retryApproach = retryApproach; }
    public Integer getUnderstandingLevel() { return understandingLevel; }
    public void setUnderstandingLevel(Integer understandingLevel) { this.understandingLevel = understandingLevel; }
    public Boolean getSubmitted() { return submitted; }
    public void setSubmitted(Boolean submitted) { this.submitted = submitted; }
    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
