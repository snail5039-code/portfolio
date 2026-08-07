// backend/src/main/java/com/jetrace/backend/studentDto/ChatResponseDto.java
package com.jetrace.backend.studentDto;

public class ChatResponseDto {
    private boolean relevant;
    private int score;
    private String answer;
    private String status;

    public ChatResponseDto() {
    }

    public ChatResponseDto(boolean relevant, int score, String answer, String status) {
        this.relevant = relevant;
        this.score = score;
        this.answer = answer;
        this.status = status;
    }

    public boolean isRelevant() {
        return relevant;
    }

    public void setRelevant(boolean relevant) {
        this.relevant = relevant;
    }

    public int getScore() {
        return score;
    }

    public void setScore(int score) {
        this.score = score;
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
}