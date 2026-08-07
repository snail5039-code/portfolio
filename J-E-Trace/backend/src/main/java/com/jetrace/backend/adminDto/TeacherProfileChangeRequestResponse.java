package com.jetrace.backend.adminDto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TeacherProfileChangeRequestResponse {
    private Long id;
    private String loginId;
    private String name;
    private String subject;
    private String managedClasses;
    private String status;
    private String requestedAt;
}