// backend/src/main/java/com/jetrace/backend/studentDto/StudentTaskDetailResponse.java
package com.jetrace.backend.studentDto;

import java.util.List;

public class StudentTaskDetailResponse {
    private Long id;
    private String title;
    private String description;
    private String dueDate;
    private Boolean aiAllowed;
    private Boolean submitted;
    private String content;
    private Integer score;
    private String teacherComment;
    private List<StudentTaskLogResponse> logs;

    public StudentTaskDetailResponse() {
    }

    public StudentTaskDetailResponse(
            Long id,
            String title,
            String description,
            String dueDate,
            Boolean aiAllowed,
            Boolean submitted,
            String content,
            Integer score,
            String teacherComment,
            List<StudentTaskLogResponse> logs
    ) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.dueDate = dueDate;
        this.aiAllowed = aiAllowed;
        this.submitted = submitted;
        this.content = content;
        this.score = score;
        this.teacherComment = teacherComment;
        this.logs = logs;
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

    public Boolean getAiAllowed() {
        return aiAllowed;
    }

    public void setAiAllowed(Boolean aiAllowed) {
        this.aiAllowed = aiAllowed;
    }

    public Boolean getSubmitted() {
        return submitted;
    }

    public void setSubmitted(Boolean submitted) {
        this.submitted = submitted;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Integer getScore() {
        return score;
    }

    public void setScore(Integer score) {
        this.score = score;
    }

    public String getTeacherComment() {
        return teacherComment;
    }

    public void setTeacherComment(String teacherComment) {
        this.teacherComment = teacherComment;
    }

    public List<StudentTaskLogResponse> getLogs() {
        return logs;
    }

    public void setLogs(List<StudentTaskLogResponse> logs) {
        this.logs = logs;
    }
}