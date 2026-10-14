package com.jetrace.backend.config;

import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import jakarta.servlet.http.HttpServletRequest;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String INTERNAL_ERROR_MESSAGE =
            "요청을 처리하는 중 오류가 발생했습니다.";

    @ExceptionHandler({
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class,
            IllegalArgumentException.class
    })
    public ResponseEntity<ApiErrorResponse> handleInvalidRequest(
            Exception error,
            HttpServletRequest request
    ) {
        return response(HttpStatus.BAD_REQUEST, "요청 값이 올바르지 않습니다.", request);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiErrorResponse> handleRuntimeException(
            RuntimeException error,
            HttpServletRequest request
    ) {
        HttpStatus status = classifyBusinessError(error.getMessage());
        if (status == HttpStatus.INTERNAL_SERVER_ERROR) {
            log.error(
                    "Unhandled server error: path={}, errorType={}",
                    request.getRequestURI(),
                    error.getClass().getSimpleName()
            );
            return response(status, INTERNAL_ERROR_MESSAGE, request);
        }

        return response(status, error.getMessage(), request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpectedException(
            Exception error,
            HttpServletRequest request
    ) {
        log.error(
                "Unexpected server error: path={}, errorType={}",
                request.getRequestURI(),
                error.getClass().getSimpleName()
        );
        return response(HttpStatus.INTERNAL_SERVER_ERROR, INTERNAL_ERROR_MESSAGE, request);
    }

    private HttpStatus classifyBusinessError(String message) {
        if (message == null || message.isBlank()) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }

        if (message.contains("OpenAI") || message.contains("AI 응답 처리 실패")) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }

        if (message.contains("로그인이 필요") || message.contains("로그인 아이디가 필요")) {
            return HttpStatus.UNAUTHORIZED;
        }

        if (containsAny(message,
                "접근할 수 없습니다",
                "승인된 학생 계정을 찾을 수 없습니다",
                "승인 전 학생",
                "해당 학생의 제출 정보가 아닙니다",
                "학생 반의 과제만 수정할 수 있습니다",
                "AI 사용이 허용되지 않았습니다",
                "관리 반 정보가 없습니다")) {
            return HttpStatus.FORBIDDEN;
        }

        if (message.contains("찾을 수 없습니다")) {
            return HttpStatus.NOT_FOUND;
        }

        if (containsAny(message,
                "입력",
                "필수",
                "필요",
                "비어 있습니다",
                "잘못된",
                "허용되지 않은",
                "이미 ",
                "동일한",
                "과제 정보가 없습니다",
                "점수는")) {
            return HttpStatus.BAD_REQUEST;
        }

        return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    private boolean containsAny(String value, String... candidates) {
        for (String candidate : candidates) {
            if (value.contains(candidate)) {
                return true;
            }
        }
        return false;
    }

    private ResponseEntity<ApiErrorResponse> response(
            HttpStatus status,
            String message,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(status).body(new ApiErrorResponse(
                Instant.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                request.getRequestURI()
        ));
    }
}
