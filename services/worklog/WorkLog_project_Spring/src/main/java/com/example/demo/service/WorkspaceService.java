package com.example.demo.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.dao.WorkspaceDao;
import com.example.demo.dao.TeamDao;
import com.example.demo.dto.Team;
import com.example.demo.dto.Member;
import com.example.demo.dto.Workspace;
import com.example.demo.dto.WorkspaceInvitation;
import com.example.demo.dto.WorkspaceMember;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class WorkspaceService {
    private static final List<String> INVITABLE_ROLES = List.of("ADMIN", "MANAGER", "MEMBER");
    private static final List<String> CHANGEABLE_ROLES = List.of("ADMIN", "MANAGER", "MEMBER");

    private final WorkspaceDao workspaceDao;
    private final WorkspacePermissionService permissionService;
    private final MemberService memberService;
    private final TeamDao teamDao;
    private final SecureRandom secureRandom = new SecureRandom();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public WorkspaceService(WorkspaceDao workspaceDao, WorkspacePermissionService permissionService,
            MemberService memberService, TeamDao teamDao) {
        this.workspaceDao = workspaceDao;
        this.permissionService = permissionService;
        this.memberService = memberService;
        this.teamDao = teamDao;
    }

    public List<Team> teams(int workspaceId, int memberId) {
        permissionService.requireActiveMember(workspaceId, memberId);
        return teamDao.findMine(workspaceId, memberId);
    }

    @Transactional
    public Team createTeam(int workspaceId, int memberId, String name, String description) {
        permissionService.requireRole(workspaceId, memberId, "MANAGER");
        Team team = new Team();
        team.setWorkspaceId(workspaceId);
        team.setName(requireText(name, "팀 이름", 150));
        team.setDescription(description == null ? null : description.trim());
        teamDao.insert(team);
        teamDao.addLead(team.getId(), memberId);
        team.setStatus("ACTIVE");
        team.setMyRole("LEAD");
        workspaceDao.insertAudit(workspaceId, memberId, "TEAM_CREATED", "TEAM", String.valueOf(team.getId()),
                json(Map.of("name", team.getName())));
        return team;
    }

    @Transactional
    public Workspace create(int memberId, String name, String slug) {
        String normalizedName = requireText(name, "워크스페이스 이름", 150);
        String normalizedSlug = requireText(slug, "워크스페이스 주소", 50).toLowerCase(Locale.ROOT);
        if (!normalizedSlug.matches("[a-z0-9][a-z0-9-]{2,49}")) {
            throw new IllegalArgumentException("워크스페이스 주소는 영문 소문자·숫자·하이픈으로 3~50자여야 합니다.");
        }
        Workspace workspace = new Workspace();
        workspace.setName(normalizedName);
        workspace.setSlug(normalizedSlug);
        workspace.setOwnerMemberId(memberId);
        workspaceDao.insertWorkspace(workspace);
        workspaceDao.insertMembership(workspace.getId(), memberId, "OWNER");
        workspaceDao.insertAudit(workspace.getId(), memberId, "WORKSPACE_CREATED", "WORKSPACE",
                String.valueOf(workspace.getId()), json(Map.of("name", normalizedName, "slug", normalizedSlug)));
        workspace.setStatus("ACTIVE");
        workspace.setMyRole("OWNER");
        return workspace;
    }

    public List<Workspace> list(int memberId) {
        return workspaceDao.findActiveWorkspaces(memberId);
    }

    public List<WorkspaceMember> members(int workspaceId, int memberId) {
        permissionService.requireActiveMember(workspaceId, memberId);
        return workspaceDao.findMembers(workspaceId);
    }

    @Transactional
    public Map<String, Object> invite(int workspaceId, int actorMemberId, String email, String role) {
        permissionService.requireRole(workspaceId, actorMemberId, "ADMIN");
        String normalizedEmail = requireText(email, "초대 이메일", 255).toLowerCase(Locale.ROOT);
        if (!normalizedEmail.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new IllegalArgumentException("올바른 이메일 주소를 입력해주세요.");
        }
        String normalizedRole = normalizeRole(role, INVITABLE_ROLES);
        String token = generateToken();
        WorkspaceInvitation invitation = new WorkspaceInvitation();
        invitation.setWorkspaceId(workspaceId);
        invitation.setEmail(normalizedEmail);
        invitation.setRole(normalizedRole);
        invitation.setTokenHash(hash(token));
        invitation.setInvitedByMemberId(actorMemberId);
        invitation.setExpiresAt(LocalDateTime.now().plusDays(7));
        workspaceDao.insertInvitation(invitation);
        workspaceDao.insertAudit(workspaceId, actorMemberId, "MEMBER_INVITED", "INVITATION",
                String.valueOf(invitation.getId()), json(Map.of("email", normalizedEmail, "role", normalizedRole)));
        return Map.of("invitationId", invitation.getId(), "token", token, "expiresAt", invitation.getExpiresAt());
    }

    @Transactional
    public WorkspaceMember accept(int memberId, String token) {
        Member member = memberService.getMemberById(memberId);
        WorkspaceInvitation invitation = workspaceDao.findUsableInvitation(hash(requireText(token, "초대 토큰", 500)));
        if (invitation == null) throw new IllegalStateException("유효하지 않거나 만료된 초대입니다.");
        if (!member.getEmail().equalsIgnoreCase(invitation.getEmail())) {
            throw new SecurityException("초대받은 이메일 계정으로 로그인해주세요.");
        }
        workspaceDao.acceptMembership(invitation, memberId);
        if (workspaceDao.markInvitationAccepted(invitation.getId(), memberId) != 1) {
            throw new IllegalStateException("이미 처리된 초대입니다.");
        }
        workspaceDao.insertAudit(invitation.getWorkspaceId(), memberId, "INVITATION_ACCEPTED", "MEMBER",
                String.valueOf(memberId), json(Map.of("role", invitation.getRole())));
        return workspaceDao.findActiveMembership(invitation.getWorkspaceId(), memberId);
    }

    @Transactional
    public void changeRole(int workspaceId, int actorMemberId, int targetMemberId, String role) {
        permissionService.requireRole(workspaceId, actorMemberId, "ADMIN");
        String normalizedRole = normalizeRole(role, CHANGEABLE_ROLES);
        if (workspaceDao.updateMemberRole(workspaceId, targetMemberId, normalizedRole) != 1) {
            throw new IllegalStateException("대상 회원을 찾을 수 없거나 소유자 역할은 변경할 수 없습니다.");
        }
        workspaceDao.insertAudit(workspaceId, actorMemberId, "MEMBER_ROLE_CHANGED", "MEMBER",
                String.valueOf(targetMemberId), json(Map.of("role", normalizedRole)));
    }

    private String normalizeRole(String role, List<String> allowed) {
        String normalized = role == null ? "MEMBER" : role.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) throw new IllegalArgumentException("허용되지 않는 역할입니다.");
        return normalized;
    }

    private String requireText(String value, String label, int maxLength) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(label + "을(를) 입력해주세요.");
        String trimmed = value.trim();
        if (trimmed.length() > maxLength) throw new IllegalArgumentException(label + "은(는) " + maxLength + "자 이하여야 합니다.");
        return trimmed;
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("초대 토큰을 처리할 수 없습니다.");
        }
    }

    private String json(Map<String, ?> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }
}
