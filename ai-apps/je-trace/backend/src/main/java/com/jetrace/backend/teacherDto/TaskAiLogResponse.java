// backend/src/main/java/com/jetrace/backend/teacherDto/TaskAiLogResponse.java
package com.jetrace.backend.teacherDto;

public class TaskAiLogResponse {
    private Long id;
    private Long taskId;
    private String studentName;
    private String question;
    private String answer;
    private String createdAt;
    private String status;

    public TaskAiLogResponse() {
    }

    public TaskAiLogResponse(
            Long id,
            Long taskId,
            String studentName,
            String question,
            String answer,
            String createdAt,
            String status
    ) {
        this.id = id;
        this.taskId = taskId;
        this.studentName = studentName;
        this.question = question;
        this.answer = answer;
        this.createdAt = createdAt;
        this.status = status;
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

    public String getQuestion() {
        return question;
    }

    public String getAnswer() {
        return answer;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public String getStatus() {
        return status;
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

    public void setQuestion(String question) {
        this.question = question;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}