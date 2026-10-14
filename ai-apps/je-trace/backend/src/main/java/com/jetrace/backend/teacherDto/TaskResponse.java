// backend/src/main/java/com/jetrace/backend/teacherDto/TaskResponse.java
package com.jetrace.backend.teacherDto;

public class TaskResponse {
    private Long id;
    private String title;
    private String className;
    private String description;
    private String dueDate;
    private Boolean aiAllowed;
    private String createdAt;
    private Integer totalStudentCount;
    private Integer submittedCount;
    private Integer notSubmittedCount;

    public TaskResponse() {
    }

    public TaskResponse(
            Long id,
            String title,
            String className,
            String description,
            String dueDate,
            Boolean aiAllowed,
            String createdAt,
            Integer totalStudentCount,
            Integer submittedCount,
            Integer notSubmittedCount
    ) {
        this.id = id;
        this.title = title;
        this.className = className;
        this.description = description;
        this.dueDate = dueDate;
        this.aiAllowed = aiAllowed;
        this.createdAt = createdAt;
        this.totalStudentCount = totalStudentCount;
        this.submittedCount = submittedCount;
        this.notSubmittedCount = notSubmittedCount;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getClassName() {
        return className;
    }

    public String getDescription() {
        return description;
    }

    public String getDueDate() {
        return dueDate;
    }

    public Boolean getAiAllowed() {
        return aiAllowed;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public Integer getTotalStudentCount() {
        return totalStudentCount;
    }

    public Integer getSubmittedCount() {
        return submittedCount;
    }

    public Integer getNotSubmittedCount() {
        return notSubmittedCount;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public void setDueDate(String dueDate) {
        this.dueDate = dueDate;
    }

    public void setAiAllowed(Boolean aiAllowed) {
        this.aiAllowed = aiAllowed;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public void setTotalStudentCount(Integer totalStudentCount) {
        this.totalStudentCount = totalStudentCount;
    }

    public void setSubmittedCount(Integer submittedCount) {
        this.submittedCount = submittedCount;
    }

    public void setNotSubmittedCount(Integer notSubmittedCount) {
        this.notSubmittedCount = notSubmittedCount;
    }
}