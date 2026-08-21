package com.jetrace.backend.authController;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import com.jetrace.backend.authDto.LoginRequestDto;
import com.jetrace.backend.authDto.LoginResponseDto;
import com.jetrace.backend.authService.AuthService;
import com.jetrace.backend.config.SessionAuthInterceptor;

import jakarta.servlet.http.HttpSession;

class AuthControllerSessionTest {

    private final AuthService authService = mock(AuthService.class);
    private final AuthController controller = new AuthController(authService);

    @Test
    void successfulLoginCreatesAuthenticatedSession() {
        LoginRequestDto loginRequest = new LoginRequestDto("teacher1", "secret123");
        when(authService.login(loginRequest)).thenReturn(new LoginResponseDto(
                true, "로그인 성공", "teacher1", "교사", "TEACHER", true, null, "수학", "A"
        ));
        MockHttpServletRequest request = new MockHttpServletRequest();

        controller.login(loginRequest, request);

        HttpSession session = request.getSession(false);
        assertEquals("teacher1", session.getAttribute(SessionAuthInterceptor.LOGIN_ID));
        assertEquals("TEACHER", session.getAttribute(SessionAuthInterceptor.LOGIN_ROLE));
    }

    @Test
    void failedLoginDoesNotCreateSession() {
        LoginRequestDto loginRequest = new LoginRequestDto("teacher1", "wrong");
        when(authService.login(loginRequest)).thenReturn(new LoginResponseDto(
                false, "로그인 실패", null, null, null, false, null, null, null
        ));
        MockHttpServletRequest request = new MockHttpServletRequest();

        ResponseEntity<?> response = controller.login(loginRequest, request);

        assertNull(request.getSession(false));
        assertEquals(401, response.getStatusCode().value());
    }

    @Test
    void meReturns401WithoutSession() {
        ResponseEntity<?> response = controller.me(new MockHttpServletRequest());

        assertEquals(401, response.getStatusCode().value());
    }

    @Test
    void logoutInvalidatesSession() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        HttpSession session = request.getSession();
        session.setAttribute(SessionAuthInterceptor.LOGIN_ID, "teacher1");

        controller.logout(request);

        assertThrows(IllegalStateException.class, () -> session.getAttribute("loginId"));
    }
}
