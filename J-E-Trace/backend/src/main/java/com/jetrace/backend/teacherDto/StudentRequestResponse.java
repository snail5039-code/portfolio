// backend/src/main/java/com/jetrace/backend/teacherDto/StudentRequestResponse.java
package com.jetrace.backend.teacherDto;

public class StudentRequestResponse {
    private Long id;
    private String studentName;
    private String className;
    private String status;
    private String requestedAt;
    private String processedAt;

    public StudentRequestResponse() {
    }

    public StudentRequestResponse(
            Long id,
            String studentName,
            String className,
            String status,
            String requestedAt,
            String processedAt
    ) {
        this.id = id;
        this.studentName = studentName;
        this.className = className;
        this.status = status;
        this.requestedAt = requestedAt;
        this.processedAt = processedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(String requestedAt) {
        this.requestedAt = requestedAt;
    }

    public String getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(String processedAt) {
        this.processedAt = processedAt;
    }
}