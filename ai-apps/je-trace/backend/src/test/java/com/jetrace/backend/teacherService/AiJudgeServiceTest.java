package com.jetrace.backend.teacherService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jetrace.backend.teacherDto.AiJudgeResult;

class AiJudgeServiceTest {

    @Test
    void usesDeterministicFallbackWhenApiKeyIsMissing() {
        AiJudgeService service = new AiJudgeService(new ObjectMapper(), mock(HttpClient.class));

        AiJudgeResult result = service.judge(
                "STUDENT_TO_STUDENT", "학생1", "학생2", "내용", "내용", 75, null
        );

        assertEquals("위험", result.getJudge());
        assertEquals("복사 가능성 높음", result.getSubmissionResult());
    }

    @Test
    void fallsBackWhenOpenAiTimesOut() throws Exception {
        HttpClient httpClient = mock(HttpClient.class);
        doThrow(new HttpTimeoutException("timeout"))
                .when(httpClient).send(any(), any());
        AiJudgeService service = new AiJudgeService(new ObjectMapper(), httpClient);
        ReflectionTestUtils.setField(service, "apiKey", "test-key");
        ReflectionTestUtils.setField(service, "model", "test-model");

        AiJudgeResult result = service.judge(
                "STUDENT_TO_AI_LOG", "학생1", "AI 응답", "내용", "응답", 45, null
        );

        assertEquals("주의", result.getJudge());
        assertEquals("일부 재구성", result.getSubmissionResult());
    }
}
