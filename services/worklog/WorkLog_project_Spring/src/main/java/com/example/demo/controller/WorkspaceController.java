package com.example.demo.controller;

import java.util.List;
import java.util.Map;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dto.Workspace;
import com.example.demo.dto.WorkspaceMember;
import com.example.demo.dto.Team;
import com.example.demo.service.WorkspaceService;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/workspaces")
public class WorkspaceController {
    private final WorkspaceService workspaceService;

    public WorkspaceController(WorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    @GetMapping
    public List<Workspace> list(HttpSession session) {
        return workspaceService.list(requireMemberId(session));
    }

    @PostMapping
    public Workspace create(@RequestBody Map<String, String> request, HttpSession session) {
        try {
            return workspaceService.create(requireMemberId(session), request.get("name"), request.get("slug"));
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 워크스페이스 주소입니다.");
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @GetMapping("/{workspaceId}/members")
    public List<WorkspaceMember> members(@PathVariable int workspaceId, HttpSession session) {
        try {
            return workspaceService.members(workspaceId, requireMemberId(session));
        } catch (SecurityException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    @GetMapping("/{workspaceId}/teams")
    public List<Team> teams(@PathVariable int workspaceId, HttpSession session) {
        try { return workspaceService.teams(workspaceId, requireMemberId(session)); }
        catch (SecurityException e) { throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage()); }
    }

    @PostMapping("/{workspaceId}/teams")
    public Team createTeam(@PathVariable int workspaceId, @RequestBody Map<String, String> request, HttpSession session) {
        try {
            return workspaceService.createTeam(workspaceId, requireMemberId(session), request.get("name"), request.get("description"));
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "같은 이름의 팀이 이미 있습니다.");
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (SecurityException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    @PostMapping("/{workspaceId}/invitations")
    public Map<String, Object> invite(@PathVariable int workspaceId, @RequestBody Map<String, String> request,
            HttpSession session) {
        try {
            return workspaceService.invite(workspaceId, requireMemberId(session), request.get("email"), request.get("role"));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (SecurityException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    @PostMapping("/invitations/{token}/accept")
    public WorkspaceMember accept(@PathVariable String token, HttpSession session) {
        try {
            return workspaceService.accept(requireMemberId(session), token);
        } catch (SecurityException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    @PutMapping("/{workspaceId}/members/{memberId}/role")
    public Map<String, Boolean> changeRole(@PathVariable int workspaceId, @PathVariable int memberId,
            @RequestBody Map<String, String> request, HttpSession session) {
        try {
            workspaceService.changeRole(workspaceId, requireMemberId(session), memberId, request.get("role"));
            return Map.of("success", true);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (SecurityException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    private int requireMemberId(HttpSession session) {
        Integer memberId = (Integer) session.getAttribute("logindeMemberId");
        if (memberId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        return memberId;
    }
}
