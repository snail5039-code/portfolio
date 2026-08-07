package com.jetrace.backend.authController;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.jetrace.backend.authDto.LoginRequestDto;
import com.jetrace.backend.authDto.LoginResponseDto;
import com.jetrace.backend.authDto.SignupRequestDto;
import com.jetrace.backend.authService.AuthService;

import lombok.RequiredArgsConstructor;

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
        try {
            authService.signup(dto);
            return ResponseEntity.ok("ok");
        } catch (Exception e) {
            e.printStackTrace();

            Map<String, Object> error = new HashMap<>();
            error.put("message", buildCauseMessage(e));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDto dto) {
        try {
            LoginResponseDto response = authService.login(dto);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();

            Map<String, Object> error = new HashMap<>();
            error.put("message", buildCauseMessage(e));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    private String buildCauseMessage(Throwable e) {
        StringBuilder sb = new StringBuilder();
        int depth = 0;

        while (e != null && depth < 10) {
            sb.append(e.getClass().getName())
              .append(": ")
              .append(e.getMessage())
              .append("\n\n");
            e = e.getCause();
            depth++;
        }

        return sb.toString();
    }
}