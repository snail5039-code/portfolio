package com.example.demo.dto;

import lombok.Data;

@Data
public class Project {
    private int id;
    private String regDate;
    private String updateDate;
    private int ownerMemberId;
    private String name;
    private String description;
    private String status;
    private String color;
    private String startDate;
    private String dueDate;
    private String archivedAt;
}
