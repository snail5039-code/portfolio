package com.jetrace.backend.studentDto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginResponseDto {
    private boolean success;
    private String loginId;
    private String studentName;
    private String className;
    private String role;
}