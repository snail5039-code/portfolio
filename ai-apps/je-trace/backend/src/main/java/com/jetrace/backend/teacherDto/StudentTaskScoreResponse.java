// backend/src/main/java/com/jetrace/backend/teacherDto/StudentTaskScoreResponse.java
package com.jetrace.backend.teacherDto;

public class StudentTaskScoreResponse {
    private Long id;
    private Long taskId;
    private String taskTitle;
    private String className;
    private Boolean submitted;
    private String submittedAt;
    private Integer score;

    public StudentTaskScoreResponse() {
    }

    public StudentTaskScoreResponse(
            Long id,
            Long taskId,
            String taskTitle,
            String className,
            Boolean submitted,
            String submittedAt,
            Integer score
    ) {
        this.id = id;
        this.taskId = taskId;
        this.taskTitle = taskTitle;
        this.className = className;
        this.submitted = submitted;
        this.submittedAt = submittedAt;
        this.score = score;
    }

    public Long getId() {
        return id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public String getTaskTitle() {
        return taskTitle;
    }

    public String getClassName() {
        return className;
    }

    public Boolean getSubmitted() {
        return submitted;
    }

    public String getSubmittedAt() {
        return submittedAt;
    }

    public Integer getScore() {
        return score;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public void setTaskTitle(String taskTitle) {
        this.taskTitle = taskTitle;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public void setSubmitted(Boolean submitted) {
        this.submitted = submitted;
    }

    public void setSubmittedAt(String submittedAt) {
        this.submittedAt = submittedAt;
    }

    public void setScore(Integer score) {
        this.score = score;
    }
}