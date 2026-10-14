package com.jetrace.backend.studentDto;

public class WeeklyLearningResponse {
    private int questionCount;
    private int revisionCount;
    private int reflectionCount;
    private int feedbackAppliedCount;
    private int feedbackApplicationRate;
    private int previousQuestionCount;
    private int previousRevisionCount;
    private int previousReflectionCount;
    private int previousFeedbackAppliedCount;
    private int previousFeedbackApplicationRate;
    private String frequentBlockedKeyword;
    private String summaryMessage;

    public int getQuestionCount() { return questionCount; }
    public void setQuestionCount(int v) { questionCount = v; }
    public int getRevisionCount() { return revisionCount; }
    public void setRevisionCount(int v) { revisionCount = v; }
    public int getReflectionCount() { return reflectionCount; }
    public void setReflectionCount(int v) { reflectionCount = v; }
    public int getFeedbackAppliedCount() { return feedbackAppliedCount; }
    public void setFeedbackAppliedCount(int v) { feedbackAppliedCount = v; }
    public int getFeedbackApplicationRate() { return feedbackApplicationRate; }
    public void setFeedbackApplicationRate(int v) { feedbackApplicationRate = v; }
    public int getPreviousQuestionCount() { return previousQuestionCount; }
    public void setPreviousQuestionCount(int v) { previousQuestionCount = v; }
    public int getPreviousRevisionCount() { return previousRevisionCount; }
    public void setPreviousRevisionCount(int v) { previousRevisionCount = v; }
    public int getPreviousReflectionCount() { return previousReflectionCount; }
    public void setPreviousReflectionCount(int v) { previousReflectionCount = v; }
    public int getPreviousFeedbackAppliedCount() { return previousFeedbackAppliedCount; }
    public void setPreviousFeedbackAppliedCount(int v) { previousFeedbackAppliedCount = v; }
    public int getPreviousFeedbackApplicationRate() { return previousFeedbackApplicationRate; }
    public void setPreviousFeedbackApplicationRate(int v) { previousFeedbackApplicationRate = v; }
    public String getFrequentBlockedKeyword() { return frequentBlockedKeyword; }
    public void setFrequentBlockedKeyword(String v) { frequentBlockedKeyword = v; }
    public String getSummaryMessage() { return summaryMessage; }
    public void setSummaryMessage(String v) { summaryMessage = v; }
}
