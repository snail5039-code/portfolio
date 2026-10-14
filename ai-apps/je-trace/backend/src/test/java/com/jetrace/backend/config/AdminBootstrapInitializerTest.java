package com.jetrace.backend.config;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.jetrace.backend.authDao.AuthDao;

class AdminBootstrapInitializerTest {

    private AuthDao authDao;
    private PasswordEncoder passwordEncoder;
    private AdminBootstrapProperties properties;
    private AdminBootstrapInitializer initializer;

    @BeforeEach
    void setUp() {
        authDao = org.mockito.Mockito.mock(AuthDao.class);
        passwordEncoder = new BCryptPasswordEncoder(4);
        properties = new AdminBootstrapProperties();
        properties.setLoginId("system-admin");
        properties.setEmail("admin@example.com");
        properties.setPassword("one-time-secret");
        properties.setName("시스템 관리자");
        initializer = new AdminBootstrapInitializer(authDao, passwordEncoder, properties);
    }

    @Test
    void createsApprovedAdministratorWithBcryptPassword() {
        ArgumentCaptor<String> passwordCaptor = ArgumentCaptor.forClass(String.class);

        initializer.run(null);

        verify(authDao).insertUser(
                eq("system-admin"),
                eq("admin@example.com"),
                passwordCaptor.capture(),
                eq("시스템 관리자"),
                eq("ADMIN"),
                eq(true),
                isNull(),
                isNull(),
                isNull()
        );
        assertNotEquals("one-time-secret", passwordCaptor.getValue());
        assertTrue(passwordEncoder.matches("one-time-secret", passwordCaptor.getValue()));
    }

    @Test
    void neverOverwritesExistingAdministrator() {
        when(authDao.countByLoginId("system-admin")).thenReturn(1);
        properties.setPassword("");

        initializer.run(null);

        verify(authDao, never()).insertUser(
                eq("system-admin"),
                eq("admin@example.com"),
                org.mockito.ArgumentMatchers.anyString(),
                eq("시스템 관리자"),
                eq("ADMIN"),
                eq(true),
                isNull(),
                isNull(),
                isNull()
        );
        verify(authDao, never()).updatePassword(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString()
        );
    }
}
