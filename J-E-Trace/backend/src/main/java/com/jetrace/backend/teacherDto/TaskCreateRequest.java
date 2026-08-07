// backend/src/main/java/com/jetrace/backend/teacherDto/TaskCreateRequest.java
package com.jetrace.backend.teacherDto;

public class TaskCreateRequest {
    private Long id;
    private String loginId;
    private String title;
    private String className;
    private String description;
    private String dueDate;
    private Boolean aiAllowed;

    public TaskCreateRequest() {
    }

    public TaskCreateRequest(
            Long id,
            String loginId,
            String title,
            String className,
            String description,
            String dueDate,
            Boolean aiAllowed
    ) {
        this.id = id;
        this.loginId = loginId;
        this.title = title;
        this.className = className;
        this.description = description;
        this.dueDate = dueDate;
        this.aiAllowed = aiAllowed;
    }

    public Long getId() {
        return id;
    }

    public String getLoginId() {
        return loginId;
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

    public void setId(Long id) {
        this.id = id;
    }

    public void setLoginId(String loginId) {
        this.loginId = loginId;
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
}