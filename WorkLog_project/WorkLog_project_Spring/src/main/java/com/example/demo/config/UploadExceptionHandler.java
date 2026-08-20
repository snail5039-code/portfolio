package com.example.demo.config;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * 업로드 한도를 넘긴 요청을 사람이 읽을 수 있는 응답으로 바꿔준다.
 *
 * 이 핸들러가 없으면 한도 초과는 컨트롤러에 닿기 전에 터져서 500 이 나가고,
 * 프론트는 "등록 실패" 만 보여줄 뿐 왜 실패했는지 알려주지 못했다.
 */
@RestControllerAdvice
public class UploadExceptionHandler {

	@ExceptionHandler(MaxUploadSizeExceededException.class)
	public ResponseEntity<Map<String, String>> handleMaxUploadSize(MaxUploadSizeExceededException e) {
		return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
				.body(Map.of("message", "첨부파일 용량이 한도를 넘었습니다. 파일 하나당 10MB, 요청 전체 50MB 까지 올릴 수 있습니다."));
	}
}
