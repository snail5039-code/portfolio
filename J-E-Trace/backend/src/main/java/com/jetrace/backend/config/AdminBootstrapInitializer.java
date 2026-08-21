package com.jetrace.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.jetrace.backend.authDao.AuthDao;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = "admin.bootstrap.enabled",
        havingValue = "true"
)
public class AdminBootstrapInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapInitializer.class);

    private final AuthDao authDao;
    private final PasswordEncoder passwordEncoder;
    private final AdminBootstrapProperties properties;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String loginId = required(properties.getLoginId(), "ADMIN_BOOTSTRAP_LOGIN_ID");

        if (authDao.countByLoginId(loginId) > 0) {
            log.info("Administrator bootstrap skipped because loginId already exists: {}", loginId);
            return;
        }

        String email = required(properties.getEmail(), "ADMIN_BOOTSTRAP_EMAIL");
        String password = required(properties.getPassword(), "ADMIN_BOOTSTRAP_PASSWORD");
        String name = required(properties.getName(), "ADMIN_BOOTSTRAP_NAME");

        if (authDao.countByEmail(email) > 0) {
            throw new IllegalStateException(
                    "Administrator bootstrap email already belongs to another account."
            );
        }

        authDao.insertUser(
                loginId,
                email,
                passwordEncoder.encode(password),
                name,
                "ADMIN",
                true,
                null,
                null,
                null
        );
        log.info("Administrator account created by bootstrap: {}", loginId);
    }

    private String required(String value, String environmentName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    environmentName + " must be set when administrator bootstrap is enabled."
            );
        }
        return value.trim();
    }
}
