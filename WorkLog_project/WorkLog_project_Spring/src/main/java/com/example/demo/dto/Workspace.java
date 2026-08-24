package com.example.demo.dto;

import lombok.Data;

@Data
public class Workspace {
    private int id;
    private String regDate;
    private String updateDate;
    private String name;
    private String slug;
    private int ownerMemberId;
    private String status;
    private String myRole;
}
