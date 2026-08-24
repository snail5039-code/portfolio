package com.example.demo.dto;

import java.time.LocalDateTime;

import lombok.Data;

@Data
public class WorkspaceInvitation {
    private long id;
    private int workspaceId;
    private String email;
    private String role;
    private String tokenHash;
    private String status;
    private int invitedByMemberId;
    private Integer acceptedMemberId;
    private LocalDateTime expiresAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime cancelledAt;
    private String regDate;
}
