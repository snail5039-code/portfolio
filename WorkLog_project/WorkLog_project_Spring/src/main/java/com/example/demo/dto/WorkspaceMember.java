package com.example.demo.dto;

import lombok.Data;

@Data
public class WorkspaceMember {
    private int workspaceId;
    private int memberId;
    private String role;
    private String status;
    private Integer invitedByMemberId;
    private String joinedAt;
    private String regDate;
    private String updateDate;
    private String memberName;
    private String memberEmail;
}
