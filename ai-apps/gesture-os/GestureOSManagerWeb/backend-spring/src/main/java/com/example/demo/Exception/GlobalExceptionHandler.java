package com.example.demo.Exception;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<?> handleApi(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of(
                "code", e.getCode(),
                "message", e.getMessage()
        ));
    }

    // ResponseStatusException도 code/message 형태로 통일(기존 코드 유지해도 일관성 확보)
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> handleRse(ResponseStatusException e) {
        HttpStatus status = (HttpStatus) e.getStatusCode();
        return ResponseEntity.status(status).body(Map.of(
                "code", "COMMON_" + status.value(),
                "message", e.getReason()
        ));
    }

    // Spring 6+에서 던지는 ErrorResponseException까지 잡아주면 더 안전
    @ExceptionHandler(ErrorResponseException.class)
    public ResponseEntity<?> handleEre(ErrorResponseException e) {
        HttpStatus status = (HttpStatus) e.getStatusCode();
        String msg = e.getBody() != null ? e.getBody().getDetail() : e.getMessage();
        return ResponseEntity.status(status).body(Map.of(
                "code", "COMMON_" + status.value(),
                "message", msg
        ));
    }

    // 최후의 방어막(원인 모를 에러는 500)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleUnknown(Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "code", "COMMON_500",
                "message", "서버 오류가 발생했습니다."
        ));
    }
}