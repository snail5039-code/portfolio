package com.jetrace.backend.studentDto;

import java.util.List;

public class StudentMyPageSummaryResponse {
    private int totalTasks;
    private int submittedCount;
    private int notSubmittedCount;
    private List<StudentTaskLogResponse> recentLogs;
    private List<UpcomingTaskResponse> upcomingTasks;
    private List<StudentFeedbackResponse> feedbacks;
    private int unreadFeedbackCount;
    private WeeklyLearningResponse weeklyLearning;

    public StudentMyPageSummaryResponse() {
    }

    public StudentMyPageSummaryResponse(int totalTasks, int submittedCount, int notSubmittedCount, List<StudentTaskLogResponse> recentLogs) {
        this.totalTasks = totalTasks;
        this.submittedCount = submittedCount;
        this.notSubmittedCount = notSubmittedCount;
        this.recentLogs = recentLogs;
    }

    public int getTotalTasks() {
        return totalTasks;
    }

    public void setTotalTasks(int totalTasks) {
        this.totalTasks = totalTasks;
    }

    public int getSubmittedCount() {
        return submittedCount;
    }

    public void setSubmittedCount(int submittedCount) {
        this.submittedCount = submittedCount;
    }

    public int getNotSubmittedCount() {
        return notSubmittedCount;
    }

    public void setNotSubmittedCount(int notSubmittedCount) {
        this.notSubmittedCount = notSubmittedCount;
    }

    public List<StudentTaskLogResponse> getRecentLogs() {
        return recentLogs;
    }

    public void setRecentLogs(List<StudentTaskLogResponse> recentLogs) {
        this.recentLogs = recentLogs;
    }

    public List<UpcomingTaskResponse> getUpcomingTasks() {
        return upcomingTasks;
    }

    public void setUpcomingTasks(List<UpcomingTaskResponse> upcomingTasks) {
        this.upcomingTasks = upcomingTasks;
    }
    public List<StudentFeedbackResponse> getFeedbacks() { return feedbacks; }
    public void setFeedbacks(List<StudentFeedbackResponse> value) { this.feedbacks = value; }
    public int getUnreadFeedbackCount() { return unreadFeedbackCount; }
    public void setUnreadFeedbackCount(int value) { this.unreadFeedbackCount = value; }
    public WeeklyLearningResponse getWeeklyLearning() { return weeklyLearning; }
    public void setWeeklyLearning(WeeklyLearningResponse value) { this.weeklyLearning = value; }
}
