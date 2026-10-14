// src/main/java/com/example/demo/config/FirebaseConfig.java
package com.example.demo.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @PostConstruct
    public void init() throws IOException {
        // 이미 초기화된 게 없을 때만
        if (FirebaseApp.getApps().isEmpty()) {
            ClassPathResource serviceAccount =
                    new ClassPathResource("firebase/serviceAccountKey.json");
            if (!serviceAccount.exists()) {
                log.warn("Firebase 서비스 계정 파일이 없어 소셜 로그인을 비활성화합니다.");
                return;
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(
                            GoogleCredentials.fromStream(
                                    serviceAccount.getInputStream()
                            )
                    )
                    .build();

            FirebaseApp.initializeApp(options);
            log.info("Firebase App 초기화 완료");
        }
    }
}
