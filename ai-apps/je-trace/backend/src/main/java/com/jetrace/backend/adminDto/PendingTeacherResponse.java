package com.jetrace.backend.adminDto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PendingTeacherResponse {
    private String loginId;
    private String email;
    private String name;
    private boolean approved;
    private String subject;
    private String managedClasses;
    private String createdAt;
}