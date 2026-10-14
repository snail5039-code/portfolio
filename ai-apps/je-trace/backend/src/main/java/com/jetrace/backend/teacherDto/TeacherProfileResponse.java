// backend/src/main/java/com/jetrace/backend/teacherDto/TeacherProfileResponse.java
package com.jetrace.backend.teacherDto;

public class TeacherProfileResponse {
    private String loginId;
    private String name;
    private String email;
    private String subject;
    private String managedClasses;

    public TeacherProfileResponse() {
    }

    public TeacherProfileResponse(String loginId, String name, String email, String subject, String managedClasses) {
        this.loginId = loginId;
        this.name = name;
        this.email = email;
        this.subject = subject;
        this.managedClasses = managedClasses;
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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
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