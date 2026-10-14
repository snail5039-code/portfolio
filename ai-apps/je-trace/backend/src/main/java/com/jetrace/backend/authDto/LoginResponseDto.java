package com.jetrace.backend.authDto;

public class LoginResponseDto {
    private boolean success;
    private String message;
    private String loginId;
    private String name;
    private String role;
    private boolean approved;
    private String className;
    private String subject;
    private String managedClasses;

    public LoginResponseDto() {
    }

    public LoginResponseDto(
            boolean success,
            String message,
            String loginId,
            String name,
            String role,
            boolean approved,
            String className,
            String subject,
            String managedClasses
    ) {
        this.success = success;
        this.message = message;
        this.loginId = loginId;
        this.name = name;
        this.role = role;
        this.approved = approved;
        this.className = className;
        this.subject = subject;
        this.managedClasses = managedClasses;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getLoginId() {
        return loginId;
    }

    public void setLoginId(String loginId) {
        this.loginId = loginId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public boolean isApproved() {
        return approved;
    }

    public void setApproved(boolean approved) {
        this.approved = approved;
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getManagedClasses() {
        return managedClasses;
    }

    public void setManagedClasses(String managedClasses) {
        this.managedClasses = managedClasses;
    }
}