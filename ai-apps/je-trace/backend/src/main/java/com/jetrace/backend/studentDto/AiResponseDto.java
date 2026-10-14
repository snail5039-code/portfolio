package com.jetrace.backend.studentDto;

public class AiResponseDto {
    private String answer;
    private boolean relevant;
    private int score;

    public AiResponseDto() {
    }

    public AiResponseDto(String answer, boolean relevant, int score) {
        this.answer = answer;
        this.relevant = relevant;
        this.score = score;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
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
}