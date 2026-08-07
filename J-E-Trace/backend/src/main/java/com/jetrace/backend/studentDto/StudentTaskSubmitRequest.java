package com.jetrace.backend.studentDto;

public class StudentTaskSubmitRequest {
    private String loginId;
    private String content;
    private Boolean aiUsed;

    public StudentTaskSubmitRequest() {
    }

    public StudentTaskSubmitRequest(String loginId, String content, Boolean aiUsed) {
        this.loginId = loginId;
        this.content = content;
        this.aiUsed = aiUsed;
    }

    public String getLoginId() {
        return loginId;
    }

    public void setLoginId(String loginId) {
        this.loginId = loginId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Boolean getAiUsed() {
        return aiUsed;
    }

    public void setAiUsed(Boolean aiUsed) {
        this.aiUsed = aiUsed;
    }
}