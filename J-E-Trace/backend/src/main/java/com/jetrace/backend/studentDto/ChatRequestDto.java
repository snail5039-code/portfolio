package com.jetrace.backend.studentDto;

import lombok.Data;

@Data
public class ChatRequestDto {
    private Long taskId;
    private String studentName;
    private String question;
}