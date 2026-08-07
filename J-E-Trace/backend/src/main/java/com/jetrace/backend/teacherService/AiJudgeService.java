package com.jetrace.backend.teacherService;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jetrace.backend.teacherDto.AiJudgeResult;
import com.jetrace.backend.teacherDto.TaskAiLogResponse;

@Service
public class AiJudgeService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${openai.api-key:}")
    private String apiKey;

    @Value("${openai.model:gpt-5.4-mini}")
    private String model;

    public AiJudgeResult judge(
            String comparisonType,
            String studentName,
            String targetName,
            String studentContent,
            String targetContent,
            Integer similarity,
            List<TaskAiLogResponse> logs
    ) {
        try {
            System.out.println("=====================================");
            System.out.println(">>> AI 판정 시작");
            System.out.println(">>> comparisonType = " + comparisonType);
            System.out.println(">>> studentName = " + studentName);
            System.out.println(">>> targetName = " + targetName);
            System.out.println(">>> similarity = " + similarity);
            System.out.println(">>> model = " + model);
            System.out.println(">>> apiKey 존재 여부 = " + (apiKey != null && !apiKey.isBlank()));
            System.out.println("=====================================");

            if (apiKey == null || apiKey.isBlank()) {
                System.out.println(">>> OPENAI API KEY 없음 -> fallback 사용");
                return fallback(comparisonType, similarity);
            }

            String logSummary = buildLogSummary(logs);

            String systemPrompt = """
                    너는 교사용 표절/AI 의존 판정보조기다.
                    반드시 JSON만 반환해라.
                    설명문 없이 JSON만 반환한다.
                    
                    허용 키:
                    {
                      "judge": "정상|주의|위험",
                      "reason": "한글 1~3문장",
                      "submissionResult": "자기화 수준 높음|일부 재구성|복사 가능성 높음"
                    }
                    
                    판정 기준:
                    - similarity 수치만 보지 말고 표현 반복, 구조 유사성, AI 답변 의존 가능성, 자기화 정도를 함께 본다.
                    - STUDENT_TO_STUDENT 는 학생 간 유사성 중심
                    - STUDENT_TO_AI_LOG 는 학생 제출문이 자기 AI 로그 답변 표현을 얼마나 직접 반영했는지 중심
                    - 너무 단정적으로 범죄처럼 말하지 말고 교육용 판정 문장으로 작성한다.
                    - judge는 반드시 정상, 주의, 위험 중 하나만 사용한다.
                    - submissionResult는 반드시 자기화 수준 높음, 일부 재구성, 복사 가능성 높음 중 하나만 사용한다.
                    """;

            String userPrompt = """
                    comparisonType: %s
                    studentName: %s
                    targetName: %s
                    similarity: %d
                    
                    [학생 제출문]
                    %s
                    
                    [비교 대상 텍스트]
                    %s
                    
                    [해당 학생 AI 로그 요약]
                    %s
                    """.formatted(
                    safe(comparisonType),
                    safe(studentName),
                    safe(targetName),
                    similarity == null ? 0 : similarity,
                    safe(studentContent),
                    safe(targetContent),
                    safe(logSummary)
            );

            String requestBody = """
                    {
                      "model": %s,
                      "temperature": 0.2,
                      "messages": [
                        { "role": "system", "content": %s },
                        { "role": "user", "content": %s }
                      ]
                    }
                    """.formatted(
                    toJson(model),
                    toJson(systemPrompt),
                    toJson(userPrompt)
            );

            System.out.println(">>> OPENAI 실제 호출 시작");

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.openai.com/v1/chat/completions"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            System.out.println(">>> OPENAI 응답 코드 = " + response.statusCode());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                System.out.println(">>> OPENAI 호출 실패 -> fallback 사용");
                return fallback(comparisonType, similarity);
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode choices = root.path("choices");

            if (!choices.isArray() || choices.isEmpty()) {
                System.out.println(">>> OPENAI choices 비어있음 -> fallback 사용");
                return fallback(comparisonType, similarity);
            }

            String content = choices.get(0).path("message").path("content").asText();

            if (content == null || content.isBlank()) {
                System.out.println(">>> OPENAI content 비어있음 -> fallback 사용");
                return fallback(comparisonType, similarity);
            }

            JsonNode parsed = objectMapper.readTree(content);

            String judge = normalizeJudge(parsed.path("judge").asText());
            String submissionResult = normalizeSubmissionResult(parsed.path("submissionResult").asText());
            String reason = parsed.path("reason").asText();

            if (judge == null || submissionResult == null || reason == null || reason.isBlank()) {
                System.out.println(">>> OPENAI 응답 형식 불일치 -> fallback 사용");
                return fallback(comparisonType, similarity);
            }

            System.out.println(">>> OPENAI 판정 성공");
            System.out.println(">>> judge = " + judge);
            System.out.println(">>> submissionResult = " + submissionResult);

            return new AiJudgeResult(judge, reason, submissionResult);

        } catch (Exception e) {
            System.out.println(">>> OPENAI 예외 발생 -> fallback 사용");
            e.printStackTrace();
            return fallback(comparisonType, similarity);
        }
    }

    private AiJudgeResult fallback(String comparisonType, Integer similarity) {
        int value = similarity == null ? 0 : similarity;

        String judge;
        if (value >= 70) {
            judge = "위험";
        } else if (value >= 40) {
            judge = "주의";
        } else {
            judge = "정상";
        }

        String reason;
        if ("STUDENT_TO_AI_LOG".equals(comparisonType)) {
            if (value >= 70) {
                reason = "AI 응답 표현이 제출문에 직접 반영된 가능성이 높습니다.";
            } else if (value >= 40) {
                reason = "AI 응답의 일부 표현이 제출문에 반영된 것으로 보여 추가 확인이 필요합니다.";
            } else {
                reason = "AI 응답과 제출문 차이가 커서 직접 반영 가능성은 낮습니다.";
            }
        } else {
            if (value >= 70) {
                reason = "학생 제출물 간 핵심 표현과 구조가 매우 유사합니다.";
            } else if (value >= 40) {
                reason = "일부 핵심 표현과 구조가 유사하여 추가 확인이 필요합니다.";
            } else {
                reason = "유사 표현은 있으나 전체 구조 차이가 큽니다.";
            }
        }

        String submissionResult = switch (judge) {
            case "위험" -> "복사 가능성 높음";
            case "주의" -> "일부 재구성";
            default -> "자기화 수준 높음";
        };

        System.out.println(">>> fallback 결과");
        System.out.println(">>> judge = " + judge);
        System.out.println(">>> submissionResult = " + submissionResult);

        return new AiJudgeResult(judge, reason, submissionResult);
    }

    private String buildLogSummary(List<TaskAiLogResponse> logs) {
        if (logs == null || logs.isEmpty()) {
            return "AI 로그 없음";
        }

        StringBuilder sb = new StringBuilder();
        for (TaskAiLogResponse log : logs) {
            if (log == null) {
                continue;
            }

            sb.append("- 질문: ").append(safe(log.getQuestion())).append("\n");
            sb.append("  답변: ").append(safe(log.getAnswer())).append("\n");
            sb.append("  상태: ").append(safe(log.getStatus())).append("\n");
        }
        return sb.toString();
    }

    private String normalizeJudge(String value) {
        if ("정상".equals(value) || "주의".equals(value) || "위험".equals(value)) {
            return value;
        }
        return null;
    }

    private String normalizeSubmissionResult(String value) {
        if ("자기화 수준 높음".equals(value)
                || "일부 재구성".equals(value)
                || "복사 가능성 높음".equals(value)) {
            return value;
        }
        return null;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String toJson(String value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "\"\"";
        }
    }
}