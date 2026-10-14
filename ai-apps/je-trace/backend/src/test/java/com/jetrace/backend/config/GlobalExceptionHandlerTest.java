package com.jetrace.backend.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void validationErrorReturns400() {
        ResponseEntity<ApiErrorResponse> response = handler.handleRuntimeException(
                new RuntimeException("점수는 0점 이상 100점 이하만 가능합니다."),
                request("/teacher/tasks/submissions/1/evaluation")
        );

        assertEquals(400, response.getStatusCode().value());
    }

    @Test
    void missingResourceReturns404() {
        ResponseEntity<ApiErrorResponse> response = handler.handleRuntimeException(
                new RuntimeException("과제 정보를 찾을 수 없습니다."),
                request("/student/tasks/999")
        );

        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void forbiddenResourceReturns403() {
        ResponseEntity<ApiErrorResponse> response = handler.handleRuntimeException(
                new RuntimeException("해당 과제에 접근할 수 없습니다."),
                request("/student/tasks/999")
        );

        assertEquals(403, response.getStatusCode().value());
    }

    @Test
    void unexpectedErrorDoesNotExposeInternalDetails() {
        ResponseEntity<ApiErrorResponse> response = handler.handleUnexpectedException(
                new Exception("jdbc:mysql://secret-host password=top-secret"),
                request("/teacher/tasks")
        );

        assertEquals(500, response.getStatusCode().value());
        assertEquals("요청을 처리하는 중 오류가 발생했습니다.", response.getBody().message());
        assertFalse(response.getBody().message().contains("secret"));
    }

    private MockHttpServletRequest request(String path) {
        return new MockHttpServletRequest("GET", path);
    }
}
