// backend/src/main/java/com/jetrace/backend/teacherDto/SimilarityRunRequest.java
package com.jetrace.backend.teacherDto;

public class SimilarityRunRequest {
    private Long taskId;

    public SimilarityRunRequest() {
    }

    public SimilarityRunRequest(Long taskId) {
        this.taskId = taskId;
    }

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }
}