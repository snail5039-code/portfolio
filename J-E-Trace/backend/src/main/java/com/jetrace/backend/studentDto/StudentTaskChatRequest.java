// backend/src/main/java/com/jetrace/backend/studentDto/StudentTaskChatRequest.java
package com.jetrace.backend.studentDto;

public class StudentTaskChatRequest {
    private String loginId;
    private String question;

    public StudentTaskChatRequest() {
    }

    public StudentTaskChatRequest(String loginId, String question) {
        this.loginId = loginId;
        this.question = question;
    }

    public String getLoginId() {
        return loginId;
    }

    public void setLoginId(String loginId) {
        this.loginId = loginId;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }
}