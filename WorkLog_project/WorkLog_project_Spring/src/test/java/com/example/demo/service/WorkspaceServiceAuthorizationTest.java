package com.example.demo.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import com.example.demo.dao.TeamDao;
import com.example.demo.dao.WorkspaceDao;
import com.example.demo.dto.Team;
import com.example.demo.dto.WorkspaceMember;

class WorkspaceServiceAuthorizationTest {
    @Mock WorkspaceDao workspaceDao;
    @Mock MemberService memberService;
    @Mock TeamDao teamDao;
    private WorkspaceService service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        WorkspacePermissionService permissionService = new WorkspacePermissionService(workspaceDao);
        service = new WorkspaceService(workspaceDao, permissionService, memberService, teamDao);
        doAnswer(invocation -> { invocation.<Team>getArgument(0).setId(11); return null; }).when(teamDao).insert(any());
    }

    @ParameterizedTest
    @CsvSource({ "OWNER,true", "ADMIN,true", "MANAGER,true", "MEMBER,false" })
    void teamCreationRequiresManager(String role, boolean allowed) {
        when(workspaceDao.findActiveMembership(3, 7)).thenReturn(membership(role));
        if (allowed) {
            Team result = service.createTeam(3, 7, "제품팀", null);
            assertEquals(11, result.getId());
            verify(teamDao).addLead(11, 7);
        } else {
            assertThrows(SecurityException.class, () -> service.createTeam(3, 7, "제품팀", null));
            verify(teamDao, never()).insert(any());
        }
    }

    @ParameterizedTest
    @CsvSource({ "OWNER,true", "ADMIN,true", "MANAGER,false", "MEMBER,false" })
    void invitationsRequireAdmin(String role, boolean allowed) {
        when(workspaceDao.findActiveMembership(3, 7)).thenReturn(membership(role));
        if (allowed) {
            assertDoesNotThrow(() -> service.invite(3, 7, "member@example.com", "MEMBER"));
            verify(workspaceDao).insertInvitation(any());
        } else {
            assertThrows(SecurityException.class, () -> service.invite(3, 7, "member@example.com", "MEMBER"));
            verify(workspaceDao, never()).insertInvitation(any());
        }
    }

    @ParameterizedTest
    @CsvSource({ "OWNER,true", "ADMIN,true", "MANAGER,false", "MEMBER,false" })
    void roleChangesRequireAdmin(String role, boolean allowed) {
        when(workspaceDao.findActiveMembership(3, 7)).thenReturn(membership(role));
        when(workspaceDao.updateMemberRole(3, 9, "MEMBER")).thenReturn(1);
        if (allowed) assertDoesNotThrow(() -> service.changeRole(3, 7, 9, "MEMBER"));
        else {
            assertThrows(SecurityException.class, () -> service.changeRole(3, 7, 9, "MEMBER"));
            verify(workspaceDao, never()).updateMemberRole(anyInt(), anyInt(), anyString());
        }
    }

    private WorkspaceMember membership(String role) {
        WorkspaceMember membership = new WorkspaceMember();
        membership.setWorkspaceId(3); membership.setMemberId(7);
        membership.setStatus("ACTIVE"); membership.setRole(role);
        return membership;
    }
}
