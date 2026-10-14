package com.example.demo.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.example.demo.dao.ProjectDao;
import com.example.demo.dto.Project;

@Service
public class ProjectService {
    private final ProjectDao projectDao;

    public ProjectService(ProjectDao projectDao) {
        this.projectDao = projectDao;
    }

    public List<Project> findMyProjects(int memberId) {
        return projectDao.findMyProjects(memberId);
    }

    public Project create(int memberId, Project request) {
        if (request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("프로젝트명을 입력해주세요.");
        }
        String name = request.getName().trim();
        if (name.length() > 150) {
            throw new IllegalArgumentException("프로젝트명은 150자 이하여야 합니다.");
        }
        request.setOwnerMemberId(memberId);
        request.setName(name);
        request.setColor(request.getColor() == null || request.getColor().isBlank() ? "#D95D3B" : request.getColor());
        projectDao.insert(request);
        return request;
    }
}
