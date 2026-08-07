package com.example.demo.token;

import java.io.IOException;

import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    public JwtAuthFilter(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String header = req.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String token = header.substring(7).trim();
            if (!token.isEmpty()) {
                try {
                    var auth = jwtTokenProvider.toAuthenticationFromAccessToken(token);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                } catch (Exception ignored) {
                    // 만료/위조 등은 여기서 떠들지 말고,
                    // 보호 API는 컨트롤러/시큐리티에서 401로 떨어지게 둔다.
                    SecurityContextHolder.clearContext();
                }
            }
        }

        chain.doFilter(req, res);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();

        // auth/token, auth/logout, auth/bridge 등은 토큰 없거나 만료여도 접근해야 함
        if (path.startsWith("/api/auth/")) return true;

        // 네가 기존에 예외 처리한 help 유지
        if (path.startsWith("/api/help/")) return true;

        return false;
    }
}
