// backend/src/main/java/com/jetrace/backend/studentDto/StudentTaskResponse.java
package com.jetrace.backend.studentDto;

public class StudentTaskResponse {
    private Long id;
    private String title;
    private String description;
    private String dueDate;
    private Boolean submitted;
    private Boolean aiAllowed;
    private Integer score;

    public StudentTaskResponse() {
    }

    public StudentTaskResponse(
            Long id,
            String title,
            String description,
            String dueDate,
            Boolean submitted,
            Boolean aiAllowed,
            Integer score
    ) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.dueDate = dueDate;
        this.submitted = submitted;
        this.aiAllowed = aiAllowed;
        this.score = score;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getDueDate() {
        return dueDate;
    }

    public void setDueDate(String dueDate) {
        this.dueDate = dueDate;
    }

    public Boolean getSubmitted() {
        return submitted;
    }

    public void setSubmitted(Boolean submitted) {
        this.submitted = submitted;
    }

    public Boolean getAiAllowed() {
        return aiAllowed;
    }

    public void setAiAllowed(Boolean aiAllowed) {
        this.aiAllowed = aiAllowed;
    }

    public Integer getScore() {
        return score;
    }

    public void setScore(Integer score) {
        this.score = score;
    }
}