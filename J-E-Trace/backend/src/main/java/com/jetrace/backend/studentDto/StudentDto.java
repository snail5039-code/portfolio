package com.jetrace.backend.studentDto;

import lombok.Data;

@Data
public class StudentDto {
    private String loginId;
    private String email;
    private String password;
    private String name;
    private String role;
    private String className;
}