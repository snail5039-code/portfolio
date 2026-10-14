package com.jetrace.backend.authController;

import java.util.HashMap;
import java.util.Map;
import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.SessionAttribute;

import com.jetrace.backend.authDto.LoginRequestDto;
import com.jetrace.backend.authDto.LoginResponseDto;
import com.jetrace.backend.authDto.PasswordChangeRequest;
import com.jetrace.backend.authDto.SignupRequestDto;
import com.jetrace.backend.authService.AuthService;
import com.jetrace.backend.config.SessionAuthInterceptor;
import com.jetrace.backend.config.ApiErrorResponse;

import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

@RestController
@RequiredArgsConstructor
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    @GetMapping("/check-id")
    public Map<String, Boolean> checkId(@RequestParam String loginId) {
        boolean available = authService.isAvailableLoginId(loginId);

        Map<String, Boolean> result = new HashMap<>();
        result.put("available", available);
        return result;
    }

    @GetMapping("/check-login-id")
    public boolean checkLoginId(@RequestParam String loginId) {
        return authService.isAvailableLoginId(loginId);
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody SignupRequestDto dto) {
        authService.signup(dto);
        return ResponseEntity.ok("ok");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody LoginRequestDto dto,
            HttpServletRequest request
    ) {
        LoginResponseDto response = authService.login(dto);
        if (!response.isSuccess()) {
            HttpStatus status = response.getMessage() != null
                    && response.getMessage().contains("승인")
                    ? HttpStatus.FORBIDDEN
                    : HttpStatus.UNAUTHORIZED;
            return ResponseEntity.status(status).body(new ApiErrorResponse(
                    Instant.now(),
                    status.value(),
                    status.getReasonPhrase(),
                    response.getMessage(),
                    request.getRequestURI()
            ));
        }

        HttpSession session = request.getSession(true);
        request.changeSessionId();
        session.setAttribute(SessionAuthInterceptor.LOGIN_ID, response.getLoginId());
        session.setAttribute(SessionAuthInterceptor.LOGIN_ROLE, response.getRole());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute(SessionAuthInterceptor.LOGIN_ID) == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiErrorResponse(
                            Instant.now(),
                            HttpStatus.UNAUTHORIZED.value(),
                            HttpStatus.UNAUTHORIZED.getReasonPhrase(),
                            "로그인이 필요하거나 세션이 만료되었습니다.",
                            request.getRequestURI()
                    ));
        }

        return ResponseEntity.ok(Map.of(
                "loginId", session.getAttribute(SessionAuthInterceptor.LOGIN_ID),
                "role", session.getAttribute(SessionAuthInterceptor.LOGIN_ROLE)
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.ok(Map.of("message", "로그아웃되었습니다."));
    }

    @PostMapping("/password")
    public ResponseEntity<?> changePassword(
            @RequestBody PasswordChangeRequest passwordChangeRequest,
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId
    ) {
        authService.changePassword(loginId, passwordChangeRequest);
        return ResponseEntity.ok(Map.of("message", "비밀번호가 변경되었습니다."));
    }
}
