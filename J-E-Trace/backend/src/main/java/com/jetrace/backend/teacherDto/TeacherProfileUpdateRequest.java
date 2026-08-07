// backend/src/main/java/com/jetrace/backend/teacherDto/TeacherProfileUpdateRequest.java
package com.jetrace.backend.teacherDto;

public class TeacherProfileUpdateRequest {
    private String loginId;
    private String name;
    private String subject;
    private String managedClasses;

    public TeacherProfileUpdateRequest() {
    }

    public TeacherProfileUpdateRequest(String loginId, String name, String subject, String managedClasses) {
        this.loginId = loginId;
        this.name = name;
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