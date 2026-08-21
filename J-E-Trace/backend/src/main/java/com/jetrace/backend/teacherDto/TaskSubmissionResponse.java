package com.jetrace.backend.teacherDto;

public class TaskSubmissionResponse {
    private Long id;
    private Long taskId;
    private String studentName;
    private Boolean submitted;
    private String submittedAt;
    private Boolean aiUsed;
    private String result;
    private String content;
    private Integer score;
    private String teacherComment;
    private String createdAt;
    private String updatedAt;
    private Integer topStudentSimilarity;
    private String topStudentTargetName;
    private String topStudentJudge;
    private String topStudentReason;
    private Integer aiLogSimilarity;
    private String aiLogJudge;
    private String aiLogReason;
    private Boolean approvedStudent;
    private Integer learningProgress;
    private String currentStep;
    private Integer questionCount;
    private String reflectionInitialChange;
    private String reflectionVerifiedContent;
    private String reflectionUnresolvedQuestion;
    private String reflectionRetryApproach;
    private Integer reflectionUnderstandingLevel;
    private Boolean reflectionSubmitted;
    private String previousContent;
    private String feedbackStatus;
    private String feedbackReadAt;
    private String feedbackCreatedAt;

    public TaskSubmissionResponse() {
    }

    public TaskSubmissionResponse(
            Long id,
            Long taskId,
            String studentName,
            Boolean submitted,
            String submittedAt,
            Boolean aiUsed,
            String result,
            String content,
            Integer score,
            String teacherComment,
            String createdAt,
            String updatedAt,
            Integer topStudentSimilarity,
            String topStudentTargetName,
            String topStudentJudge,
            String topStudentReason,
            Integer aiLogSimilarity,
            String aiLogJudge,
            String aiLogReason,
            Boolean approvedStudent
    ) {
        this.id = id;
        this.taskId = taskId;
        this.studentName = studentName;
        this.submitted = submitted;
        this.submittedAt = submittedAt;
        this.aiUsed = aiUsed;
        this.result = result;
        this.content = content;
        this.score = score;
        this.teacherComment = teacherComment;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.topStudentSimilarity = topStudentSimilarity;
        this.topStudentTargetName = topStudentTargetName;
        this.topStudentJudge = topStudentJudge;
        this.topStudentReason = topStudentReason;
        this.aiLogSimilarity = aiLogSimilarity;
        this.aiLogJudge = aiLogJudge;
        this.aiLogReason = aiLogReason;
        this.approvedStudent = approvedStudent;
    }

    public Long getId() {
        return id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public String getStudentName() {
        return studentName;
    }

    public Boolean getSubmitted() {
        return submitted;
    }

    public String getSubmittedAt() {
        return submittedAt;
    }

    public Boolean getAiUsed() {
        return aiUsed;
    }

    public String getResult() {
        return result;
    }

    public String getContent() {
        return content;
    }

    public Integer getScore() {
        return score;
    }

    public String getTeacherComment() {
        return teacherComment;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public Integer getTopStudentSimilarity() {
        return topStudentSimilarity;
    }

    public String getTopStudentTargetName() {
        return topStudentTargetName;
    }

    public String getTopStudentJudge() {
        return topStudentJudge;
    }

    public String getTopStudentReason() {
        return topStudentReason;
    }

    public Integer getAiLogSimilarity() {
        return aiLogSimilarity;
    }

    public String getAiLogJudge() {
        return aiLogJudge;
    }

    public String getAiLogReason() {
        return aiLogReason;
    }

    public Boolean getApprovedStudent() {
        return approvedStudent;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public void setSubmitted(Boolean submitted) {
        this.submitted = submitted;
    }

    public void setSubmittedAt(String submittedAt) {
        this.submittedAt = submittedAt;
    }

    public void setAiUsed(Boolean aiUsed) {
        this.aiUsed = aiUsed;
    }

    public void setResult(String result) {
        this.result = result;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public void setScore(Integer score) {
        this.score = score;
    }

    public void setTeacherComment(String teacherComment) {
        this.teacherComment = teacherComment;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public void setTopStudentSimilarity(Integer topStudentSimilarity) {
        this.topStudentSimilarity = topStudentSimilarity;
    }

    public void setTopStudentTargetName(String topStudentTargetName) {
        this.topStudentTargetName = topStudentTargetName;
    }

    public void setTopStudentJudge(String topStudentJudge) {
        this.topStudentJudge = topStudentJudge;
    }

    public void setTopStudentReason(String topStudentReason) {
        this.topStudentReason = topStudentReason;
    }

    public void setAiLogSimilarity(Integer aiLogSimilarity) {
        this.aiLogSimilarity = aiLogSimilarity;
    }

    public void setAiLogJudge(String aiLogJudge) {
        this.aiLogJudge = aiLogJudge;
    }

    public void setAiLogReason(String aiLogReason) {
        this.aiLogReason = aiLogReason;
    }

    public void setApprovedStudent(Boolean approvedStudent) {
        this.approvedStudent = approvedStudent;
    }

    public Integer getLearningProgress() { return learningProgress; }
    public void setLearningProgress(Integer learningProgress) { this.learningProgress = learningProgress; }
    public String getCurrentStep() { return currentStep; }
    public void setCurrentStep(String currentStep) { this.currentStep = currentStep; }
    public Integer getQuestionCount() { return questionCount; }
    public void setQuestionCount(Integer questionCount) { this.questionCount = questionCount; }
    public String getReflectionInitialChange() { return reflectionInitialChange; }
    public void setReflectionInitialChange(String value) { this.reflectionInitialChange = value; }
    public String getReflectionVerifiedContent() { return reflectionVerifiedContent; }
    public void setReflectionVerifiedContent(String value) { this.reflectionVerifiedContent = value; }
    public String getReflectionUnresolvedQuestion() { return reflectionUnresolvedQuestion; }
    public void setReflectionUnresolvedQuestion(String value) { this.reflectionUnresolvedQuestion = value; }
    public String getReflectionRetryApproach() { return reflectionRetryApproach; }
    public void setReflectionRetryApproach(String value) { this.reflectionRetryApproach = value; }
    public Integer getReflectionUnderstandingLevel() { return reflectionUnderstandingLevel; }
    public void setReflectionUnderstandingLevel(Integer value) { this.reflectionUnderstandingLevel = value; }
    public Boolean getReflectionSubmitted() { return reflectionSubmitted; }
    public void setReflectionSubmitted(Boolean value) { this.reflectionSubmitted = value; }
    public String getPreviousContent() { return previousContent; }
    public void setPreviousContent(String value) { this.previousContent = value; }
    public String getFeedbackStatus() { return feedbackStatus; }
    public void setFeedbackStatus(String value) { this.feedbackStatus = value; }
    public String getFeedbackReadAt() { return feedbackReadAt; }
    public void setFeedbackReadAt(String value) { this.feedbackReadAt = value; }
    public String getFeedbackCreatedAt() { return feedbackCreatedAt; }
    public void setFeedbackCreatedAt(String value) { this.feedbackCreatedAt = value; }
}
