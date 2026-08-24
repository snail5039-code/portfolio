package com.example.demo.service;

import java.util.Map;

import org.springframework.stereotype.Service;

import com.example.demo.dao.WorkspaceDao;
import com.example.demo.dto.WorkspaceMember;

@Service
public class WorkspacePermissionService {
    private static final Map<String, Integer> ROLE_LEVEL = Map.of(
            "MEMBER", 1, "MANAGER", 2, "ADMIN", 3, "OWNER", 4);

    private final WorkspaceDao workspaceDao;

    public WorkspacePermissionService(WorkspaceDao workspaceDao) {
        this.workspaceDao = workspaceDao;
    }

    public WorkspaceMember requireActiveMember(int workspaceId, int memberId) {
        WorkspaceMember membership = workspaceDao.findActiveMembership(workspaceId, memberId);
        if (membership == null) throw new SecurityException("워크스페이스 접근 권한이 없습니다.");
        return membership;
    }

    public WorkspaceMember requireRole(int workspaceId, int memberId, String minimumRole) {
        WorkspaceMember membership = requireActiveMember(workspaceId, memberId);
        int actual = ROLE_LEVEL.getOrDefault(membership.getRole(), 0);
        int required = ROLE_LEVEL.getOrDefault(minimumRole, Integer.MAX_VALUE);
        if (actual < required) throw new SecurityException("이 작업을 수행할 권한이 없습니다.");
        return membership;
    }
}
