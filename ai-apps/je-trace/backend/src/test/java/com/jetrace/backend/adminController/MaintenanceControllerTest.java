package com.jetrace.backend.adminController;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import com.jetrace.backend.teacherService.TaskService;

class MaintenanceControllerTest {

    @Test
    void administratorCanRunBackfill() {
        TaskService taskService = mock(TaskService.class);
        MaintenanceController controller = new MaintenanceController(taskService);

        ResponseEntity<Map<String, String>> response =
                controller.backfillSystemData("admin1");

        verify(taskService).backfillSystemData();
        assertEquals(200, response.getStatusCode().value());
        assertEquals("시스템 데이터 백필이 완료되었습니다.", response.getBody().get("message"));
    }

    @Test
    void backfillFailureIsPropagatedAfterLogging() {
        TaskService taskService = mock(TaskService.class);
        MaintenanceController controller = new MaintenanceController(taskService);
        doThrow(new RuntimeException("database failure"))
                .when(taskService).backfillSystemData();

        assertThrows(
                RuntimeException.class,
                () -> controller.backfillSystemData("admin1")
        );
    }
}
