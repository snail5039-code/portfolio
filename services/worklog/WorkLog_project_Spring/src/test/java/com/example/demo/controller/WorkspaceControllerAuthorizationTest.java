package com.example.demo.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.example.demo.service.WorkspaceService;

class WorkspaceControllerAuthorizationTest {
    private WorkspaceService workspaceService;
    private MockMvc mockMvc;
    private MockHttpSession loginSession;

    @BeforeEach
    void setUp() {
        workspaceService = mock(WorkspaceService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new WorkspaceController(workspaceService)).build();
        loginSession = new MockHttpSession();
        loginSession.setAttribute("logindeMemberId", 7);
    }

    @Test
    void anonymousUserCannotListWorkspaces() throws Exception {
        mockMvc.perform(get("/api/workspaces"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void forbiddenTeamCreationReturns403() throws Exception {
        when(workspaceService.createTeam(3, 7, "제품팀", null))
                .thenThrow(new SecurityException("이 작업을 수행할 권한이 없습니다."));
        mockMvc.perform(post("/api/workspaces/3/teams").session(loginSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"제품팀\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void forbiddenInvitationReturns403() throws Exception {
        when(workspaceService.invite(3, 7, "member@example.com", "MEMBER"))
                .thenThrow(new SecurityException("이 작업을 수행할 권한이 없습니다."));
        mockMvc.perform(post("/api/workspaces/3/invitations").session(loginSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"member@example.com\",\"role\":\"MEMBER\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void forbiddenRoleChangeReturns403() throws Exception {
        doThrow(new SecurityException("이 작업을 수행할 권한이 없습니다."))
                .when(workspaceService).changeRole(3, 7, 9, "MEMBER");
        mockMvc.perform(put("/api/workspaces/3/members/9/role").session(loginSession)
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"MEMBER\"}"))
                .andExpect(status().isForbidden());
    }
}
