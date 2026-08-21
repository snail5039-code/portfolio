package com.jetrace.backend.adminController;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.SessionAttribute;

import com.jetrace.backend.config.SessionAuthInterceptor;
import com.jetrace.backend.teacherService.TaskService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/admin/maintenance")
@ConditionalOnProperty(
        name = "maintenance.backfill-enabled",
        havingValue = "true"
)
public class MaintenanceController {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceController.class);

    private final TaskService taskService;

    @PostMapping("/backfill")
    public ResponseEntity<Map<String, String>> backfillSystemData(
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String adminLoginId) {
        log.info("System data backfill started by admin={}", adminLoginId);

        try {
            taskService.backfillSystemData();
            log.info("System data backfill completed by admin={}", adminLoginId);
            return ResponseEntity.ok(Map.of("message", "시스템 데이터 백필이 완료되었습니다."));
        } catch (RuntimeException error) {
            log.error(
                    "System data backfill failed by admin={}, errorType={}",
                    adminLoginId,
                    error.getClass().getSimpleName()
            );
            throw error;
        }
    }
}
