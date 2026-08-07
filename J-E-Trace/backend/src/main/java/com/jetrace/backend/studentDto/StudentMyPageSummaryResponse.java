package com.jetrace.backend.studentDto;

import java.util.List;

public class StudentMyPageSummaryResponse {
    private int totalTasks;
    private int submittedCount;
    private int notSubmittedCount;
    private List<StudentTaskLogResponse> recentLogs;

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
}