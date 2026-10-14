// backend/src/main/java/com/jetrace/backend/teacherDto/SimilarityResponse.java
package com.jetrace.backend.teacherDto;

public class SimilarityResponse {
    private Long id;
    private Long taskId;
    private String taskTitle;
    private String studentName;
    private String targetName;
    private String comparisonType;
    private Integer similarity;
    private String judge;
    private String reason;
    private String studentContent;
    private String targetContent;
    private String checkedAt;

    public SimilarityResponse() {
    }

    public SimilarityResponse(
            Long id,
            Long taskId,
            String taskTitle,
            String studentName,
            String targetName,
            String comparisonType,
            Integer similarity,
            String judge,
            String reason,
            String studentContent,
            String targetContent,
            String checkedAt
    ) {
        this.id = id;
        this.taskId = taskId;
        this.taskTitle = taskTitle;
        this.studentName = studentName;
        this.targetName = targetName;
        this.comparisonType = comparisonType;
        this.similarity = similarity;
        this.judge = judge;
        this.reason = reason;
        this.studentContent = studentContent;
        this.targetContent = targetContent;
        this.checkedAt = checkedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public String getTaskTitle() {
        return taskTitle;
    }

    public void setTaskTitle(String taskTitle) {
        this.taskTitle = taskTitle;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getTargetName() {
        return targetName;
    }

    public void setTargetName(String targetName) {
        this.targetName = targetName;
    }

    public String getComparisonType() {
        return comparisonType;
    }

    public void setComparisonType(String comparisonType) {
        this.comparisonType = comparisonType;
    }

    public Integer getSimilarity() {
        return similarity;
    }

    public void setSimilarity(Integer similarity) {
        this.similarity = similarity;
    }

    public String getJudge() {
        return judge;
    }

    public void setJudge(String judge) {
        this.judge = judge;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getStudentContent() {
        return studentContent;
    }

    public void setStudentContent(String studentContent) {
        this.studentContent = studentContent;
    }

    public String getTargetContent() {
        return targetContent;
    }

    public void setTargetContent(String targetContent) {
        this.targetContent = targetContent;
    }

    public String getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(String checkedAt) {
        this.checkedAt = checkedAt;
    }
}