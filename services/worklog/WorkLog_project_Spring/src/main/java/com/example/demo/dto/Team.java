package com.example.demo.dto;

import lombok.Data;

@Data
public class Team {
    private int id;
    private int workspaceId;
    private String name;
    private String description;
    private String status;
    private String myRole;
}
