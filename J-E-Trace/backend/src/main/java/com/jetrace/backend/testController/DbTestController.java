package com.jetrace.backend.testController;

import java.util.HashMap;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class DbTestController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping("/api/db-test")
    public Map<String, Object> dbTest() {
        Map<String, Object> result = new HashMap<>();

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users",
                Integer.class
        );

        result.put("status", true);
        result.put("message", "DB 연결 성공");
        result.put("userCount", count);

        return result;
    }
}