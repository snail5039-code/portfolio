package com.jetrace.backend.studentDto;

public class UpcomingTaskResponse {
    private Long id;
    private String title;
    private String className;
    private String dueDate;
    private Boolean submitted;
    private Integer progress;
    private String currentStep;
    private String nextAction;
    private Integer questionCount;

    public UpcomingTaskResponse() {
    }

    public UpcomingTaskResponse(Long id, String title, String className, String dueDate, Boolean submitted, Integer progress) {
        this.id = id;
        this.title = title;
        this.className = className;
        this.dueDate = dueDate;
        this.submitted = submitted;
        this.progress = progress;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }
    public String getDueDate() { return dueDate; }
    public void setDueDate(String dueDate) { this.dueDate = dueDate; }
    public Boolean getSubmitted() { return submitted; }
    public void setSubmitted(Boolean submitted) { this.submitted = submitted; }
    public Integer getProgress() { return progress; }
    public void setProgress(Integer progress) { this.progress = progress; }
    public String getCurrentStep() { return currentStep; }
    public void setCurrentStep(String currentStep) { this.currentStep = currentStep; }
    public String getNextAction() { return nextAction; }
    public void setNextAction(String nextAction) { this.nextAction = nextAction; }
    public Integer getQuestionCount() { return questionCount; }
    public void setQuestionCount(Integer questionCount) { this.questionCount = questionCount; }
}
