package com.example.demo.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthBridgeService {
    private static final long TTL_MS = 60_000; // 60초
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Entry> byCode = new ConcurrentHashMap<>();

    public long getTtlSeconds() {
        return TTL_MS / 1000;
    }

    public String createCode(Integer memberId) {
        cleanupExpired();

        byte[] buf = new byte[16];
        random.nextBytes(buf);
        String code = HexFormat.of().formatHex(buf);

        byCode.put(code, new Entry(memberId, Instant.now().toEpochMilli() + TTL_MS));
        return code;
    }

    public Integer consume(String code) {
        if (code == null || code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "code is required");
        }

        Entry e = byCode.remove(code);
        if (e == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid code");
        }
        if (Instant.now().toEpochMilli() > e.expiresAtMs) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "code expired");
        }
        return e.memberId;
    }

    private void cleanupExpired() {
        long now = Instant.now().toEpochMilli();
        byCode.entrySet().removeIf(en -> en.getValue().expiresAtMs < now);
    }

    private static class Entry {
        final Integer memberId;
        final long expiresAtMs;

        Entry(Integer memberId, long expiresAtMs) {
            this.memberId = memberId;
            this.expiresAtMs = expiresAtMs;
        }
    }
}
