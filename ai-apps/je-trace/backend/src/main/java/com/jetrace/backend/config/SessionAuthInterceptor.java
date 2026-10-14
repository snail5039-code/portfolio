package com.jetrace.backend.config;

import java.io.IOException;
import java.time.Instant;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

@Component
public class SessionAuthInterceptor implements HandlerInterceptor {

    public static final String LOGIN_ID = "loginId";
    public static final String LOGIN_ROLE = "loginRole";

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler
    ) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute(LOGIN_ID) == null) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "로그인이 필요하거나 세션이 만료되었습니다.", request.getRequestURI());
            return false;
        }

        String requiredRole = requiredRole(request.getRequestURI());
        Object sessionRole = session.getAttribute(LOGIN_ROLE);
        if (requiredRole != null && !requiredRole.equals(sessionRole)) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN,
                    "이 기능에 접근할 권한이 없습니다.", request.getRequestURI());
            return false;
        }

        return true;
    }

    private String requiredRole(String requestUri) {
        if (requestUri.startsWith("/student/")) return "STUDENT";
        if (requestUri.startsWith("/teacher/")) return "TEACHER";
        if (requestUri.startsWith("/admin/")) return "ADMIN";
        return null;
    }

    private void writeError(
            HttpServletResponse response,
            int status,
            String message,
            String path
    )
            throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String error = status == HttpServletResponse.SC_UNAUTHORIZED
                ? "Unauthorized"
                : "Forbidden";
        response.getWriter().write(
                "{\"timestamp\":\"" + Instant.now()
                        + "\",\"status\":" + status
                        + ",\"error\":\"" + error
                        + "\",\"message\":\"" + message
                        + "\",\"path\":\"" + path + "\"}"
        );
    }
}
