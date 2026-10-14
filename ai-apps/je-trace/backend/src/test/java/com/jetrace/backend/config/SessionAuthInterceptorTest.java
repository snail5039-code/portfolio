package com.jetrace.backend.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class SessionAuthInterceptorTest {

    private final SessionAuthInterceptor interceptor = new SessionAuthInterceptor();

    @Test
    void rejectsRequestWithoutSessionWith401() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/teacher/tasks");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean allowed = interceptor.preHandle(request, response, new Object());

        assertFalse(allowed);
        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("세션이 만료"));
        assertTrue(response.getContentAsString().contains("\"path\":\"/teacher/tasks\""));
    }

    @Test
    void acceptsRequestWithAuthenticatedSession() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/teacher/tasks");
        request.getSession().setAttribute(SessionAuthInterceptor.LOGIN_ID, "teacher1");
        request.getSession().setAttribute(SessionAuthInterceptor.LOGIN_ROLE, "TEACHER");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean allowed = interceptor.preHandle(request, response, new Object());

        assertTrue(allowed);
        assertEquals(200, response.getStatus());
    }

    @Test
    void rejectsDifferentRoleWith403() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/admin/teachers/pending");
        request.getSession().setAttribute(SessionAuthInterceptor.LOGIN_ID, "student1");
        request.getSession().setAttribute(SessionAuthInterceptor.LOGIN_ROLE, "STUDENT");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean allowed = interceptor.preHandle(request, response, new Object());

        assertFalse(allowed);
        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("권한이 없습니다"));
    }

    @Test
    void enforcesRoleForEveryProtectedArea() throws Exception {
        assertRoleAccess("/student/tasks", "STUDENT", true);
        assertRoleAccess("/student/tasks", "TEACHER", false);
        assertRoleAccess("/teacher/tasks", "TEACHER", true);
        assertRoleAccess("/teacher/tasks", "ADMIN", false);
        assertRoleAccess("/admin/teachers/pending", "ADMIN", true);
        assertRoleAccess("/admin/teachers/pending", "STUDENT", false);
    }

    @Test
    void acceptsAdministratorForMaintenancePath() throws Exception {
        MockHttpServletRequest request =
                new MockHttpServletRequest("POST", "/admin/maintenance/backfill");
        request.getSession().setAttribute(SessionAuthInterceptor.LOGIN_ID, "admin1");
        request.getSession().setAttribute(SessionAuthInterceptor.LOGIN_ROLE, "ADMIN");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean allowed = interceptor.preHandle(request, response, new Object());

        assertTrue(allowed);
        assertEquals(200, response.getStatus());
    }

    @Test
    void passwordChangeRequiresAuthenticatedSession() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/password");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean allowed = interceptor.preHandle(request, response, new Object());

        assertFalse(allowed);
        assertEquals(401, response.getStatus());
    }

    private void assertRoleAccess(String path, String role, boolean expected) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.getSession().setAttribute(SessionAuthInterceptor.LOGIN_ID, "test-user");
        request.getSession().setAttribute(SessionAuthInterceptor.LOGIN_ROLE, role);
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertEquals(expected, interceptor.preHandle(request, response, new Object()));
        assertEquals(expected ? 200 : 403, response.getStatus());
    }
}
