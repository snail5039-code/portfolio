package com.jetrace.backend.authDto;

public class SignupRequestDto {
    private String loginId;
    private String email;
    private String password;
    private String name;
    private String role;
    private String className;
    private String subject;
    private String managedClasses;

    public SignupRequestDto() {
    }

    public SignupRequestDto(String loginId, String email, String password, String name, String role, String className, String subject, String managedClasses) {
        this.loginId = loginId;
        this.email = email;
        this.password = password;
        this.name = name;
        this.role = role;
        this.className = className;
        this.subject = subject;
        this.managedClasses = managedClasses;
    }

    public String getLoginId() {
        return loginId;
    }

    public void setLoginId(String loginId) {
        this.loginId = loginId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
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