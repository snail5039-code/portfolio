package com.example.demo.controller;

import java.util.List;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dto.Project;
import com.example.demo.service.ProjectService;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public List<Project> list(HttpSession session) {
        return projectService.findMyProjects(requireMemberId(session));
    }

    @PostMapping
    public Project create(@RequestBody Project request, HttpSession session) {
        try {
            return projectService.create(requireMemberId(session), request);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "같은 이름의 프로젝트가 이미 있습니다.");
        }
    }

    private int requireMemberId(HttpSession session) {
        Integer memberId = (Integer) session.getAttribute("logindeMemberId");
        if (memberId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }
        return memberId;
    }
}
