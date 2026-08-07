// backend/src/main/java/com/jetrace/backend/teacherDto/AiJudgeResult.java
package com.jetrace.backend.teacherDto;

public class AiJudgeResult {
    private String judge;
    private String reason;
    private String submissionResult;

    public AiJudgeResult() {
    }

    public AiJudgeResult(String judge, String reason, String submissionResult) {
        this.judge = judge;
        this.reason = reason;
        this.submissionResult = submissionResult;
    }

    public String getJudge() {
        return judge;
    }

    public void setJudge(String judge) {
        this.judge = judge;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getSubmissionResult() {
        return submissionResult;
    }

    public void setSubmissionResult(String submissionResult) {
        this.submissionResult = submissionResult;
    }
}