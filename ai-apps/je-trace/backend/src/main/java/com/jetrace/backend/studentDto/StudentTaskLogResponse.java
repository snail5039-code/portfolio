// backend/src/main/java/com/jetrace/backend/studentDto/StudentTaskLogResponse.java
package com.jetrace.backend.studentDto;

public class StudentTaskLogResponse {
    private Long id;
    private Long taskId;
    private String studentName;
    private String question;
    private String answer;
    private String status;
    private String createdAt;

    public StudentTaskLogResponse() {
    }

    public StudentTaskLogResponse(
            Long id,
            Long taskId,
            String studentName,
            String question,
            String answer,
            String status,
            String createdAt
    ) {
        this.id = id;
        this.taskId = taskId;
        this.studentName = studentName;
        this.question = question;
        this.answer = answer;
        this.status = status;
        this.createdAt = createdAt;
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

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}