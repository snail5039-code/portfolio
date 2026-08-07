package com.jetrace.backend.studentService;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jetrace.backend.studentDao.StudentDao;
import com.jetrace.backend.studentDto.AiResponseDto;
import com.jetrace.backend.studentDto.ChatResponseDto;
import com.jetrace.backend.studentDto.StudentMyPageSummaryResponse;
import com.jetrace.backend.studentDto.StudentTaskDetailResponse;
import com.jetrace.backend.studentDto.StudentTaskLogResponse;
import com.jetrace.backend.studentDto.StudentTaskResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StudentTaskService {

    private final StudentDao studentDao;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${openai.api-key}")
    private String apiKey;

    private static final Set<String> BROAD_TOPIC_KEYWORDS = Set.of(
            "it", "ai", "ict", "sw",
            "정보", "기술", "컴퓨터", "소프트웨어", "하드웨어",
            "프로그래밍", "코딩", "개발", "데이터", "네트워크",
            "보안", "시스템", "알고리즘", "인공지능", "디지털"
    );

    private static final Set<String> QUESTION_HELPER_KEYWORDS = Set.of(
            "설명", "의미", "개념", "정의", "예시", "사례", "동향", "최근",
            "구성", "방법", "방향", "정리", "차이", "비교", "특징", "종류"
    );

    public List<StudentTaskResponse> getTasks(String loginId) {
        validateLoginId(loginId);

        String className = studentDao.findApprovedClassNameByLoginId(loginId);
        String studentName = studentDao.findStudentNameByLoginId(loginId);

        if (className == null || studentName == null) {
            throw new RuntimeException("승인된 학생 계정을 찾을 수 없습니다.");
        }

        return studentDao.findTasksByClassNameAndStudentName(className, studentName);
    }

    public StudentMyPageSummaryResponse getMyPageSummary(String loginId) {
        validateLoginId(loginId);

        String className = studentDao.findApprovedClassNameByLoginId(loginId);
        String studentName = studentDao.findStudentNameByLoginId(loginId);

        if (className == null || studentName == null) {
            throw new RuntimeException("승인된 학생 계정을 찾을 수 없습니다.");
        }

        StudentMyPageSummaryResponse summary =
                studentDao.findStudentMyPageSummary(className, studentName);

        if (summary == null) {
            summary = new StudentMyPageSummaryResponse();
            summary.setSubmittedCount(0);
            summary.setNotSubmittedCount(0);
        }

        summary.setRecentLogs(studentDao.findRecentTaskLogsByStudentName(studentName));
        return summary;
    }

    public StudentTaskDetailResponse getTaskDetail(Long taskId, String loginId) {
        validateLoginId(loginId);

        String className = studentDao.findApprovedClassNameByLoginId(loginId);
        String studentName = studentDao.findStudentNameByLoginId(loginId);

        if (className == null || studentName == null) {
            throw new RuntimeException("승인된 학생 계정을 찾을 수 없습니다.");
        }

        int allowed = studentDao.countTaskInStudentClass(taskId, className);
        if (allowed == 0) {
            throw new RuntimeException("해당 과제에 접근할 수 없습니다.");
        }

        if (studentDao.countTaskSubmission(taskId, studentName) == 0) {
            studentDao.insertTaskSubmissionIfNotExists(taskId, studentName);
        }

        StudentTaskDetailResponse detail =
                studentDao.findTaskDetailByTaskIdAndStudentName(taskId, studentName, className);

        if (detail == null) {
            throw new RuntimeException("과제 정보를 찾을 수 없습니다.");
        }

        detail.setLogs(studentDao.findTaskLogsByTaskIdAndStudentName(taskId, studentName));
        return detail;
    }

    @Transactional
    public void submitTask(Long taskId, String loginId, String content, Boolean aiUsed) {
        validateLoginId(loginId);

        if (content == null || content.isBlank()) {
            throw new RuntimeException("제출 내용이 비어 있습니다.");
        }

        String className = studentDao.findApprovedClassNameByLoginId(loginId);
        String studentName = studentDao.findStudentNameByLoginId(loginId);

        if (className == null || studentName == null) {
            throw new RuntimeException("승인된 학생 계정을 찾을 수 없습니다.");
        }

        int allowed = studentDao.countTaskInStudentClass(taskId, className);
        if (allowed == 0) {
            throw new RuntimeException("해당 과제에 접근할 수 없습니다.");
        }

        if (studentDao.countTaskSubmission(taskId, studentName) == 0) {
            studentDao.insertTaskSubmissionIfNotExists(taskId, studentName);
        }

        studentDao.updateTaskSubmission(taskId, studentName, content.trim(), Boolean.TRUE.equals(aiUsed));
    }

    @Transactional
    public ChatResponseDto askTaskAi(Long taskId, String loginId, String question) {
        validateLoginId(loginId);

        if (question == null || question.isBlank()) {
            throw new RuntimeException("질문을 입력하세요.");
        }

        String className = studentDao.findApprovedClassNameByLoginId(loginId);
        String studentName = studentDao.findStudentNameByLoginId(loginId);

        if (className == null || studentName == null) {
            throw new RuntimeException("승인된 학생 계정을 찾을 수 없습니다.");
        }

        StudentTaskResponse task = studentDao.findTaskById(taskId);
        if (task == null) {
            throw new RuntimeException("과제를 찾을 수 없습니다.");
        }

        int allowed = studentDao.countTaskInStudentClass(taskId, className);
        if (allowed == 0) {
            throw new RuntimeException("해당 과제에 접근할 수 없습니다.");
        }

        if (Boolean.FALSE.equals(task.getAiAllowed())) {
            throw new RuntimeException("이 과제는 AI 사용이 허용되지 않았습니다.");
        }

        ChatResponseDto response = callOpenAi(question.trim(), task.getDescription());

        StudentTaskLogResponse log = new StudentTaskLogResponse();
        log.setTaskId(taskId);
        log.setStudentName(studentName);
        log.setQuestion(question.trim());
        log.setAnswer(response.getAnswer());
        log.setStatus(response.getStatus());

        studentDao.insertTaskAiLog(log);

        return response;
    }

    private ChatResponseDto callOpenAi(String question, String taskDescription) {
        RestTemplate restTemplate = new RestTemplate();
        String url = "https://api.openai.com/v1/chat/completions";

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> responseFormat = Map.of(
                "type", "json_schema",
                "json_schema", Map.of(
                        "name", "task_ai_response",
                        "schema", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "relevant", Map.of("type", "boolean"),
                                        "score", Map.of("type", "integer"),
                                        "answer", Map.of("type", "string")
                                ),
                                "required", List.of("relevant", "score", "answer"),
                                "additionalProperties", false
                        )
                )
        );

        Map<String, Object> body = Map.of(
                "model", "gpt-4o-mini",
                "response_format", responseFormat,
                "messages", List.of(
                        Map.of(
                                "role", "system",
                                "content",
                                """
                                너는 학생 과제 도우미 AI다.

                                아래 과제 설명을 기준으로 학생 질문이 과제와 관련 있는지 판단하고 답변하라.
                                중요한 원칙:
                                1. 정상적인 확장 질문은 최대한 relevant=true로 판단한다.
                                2. 과제 주제와 직접 일치하지 않더라도, 과제 이해/설명/정리/사례/동향/배경지식에 도움이 되면 관련 질문이다.
                                3. relevant=false는 정말로 과제와 무관한 경우에만 사용한다.

                                다음은 관련 질문(relevant=true) 예시다.
                                - 과제 주제, 개념, 용어 설명 요청
                                - 작성 방법, 답안 구성, 정리 방식 질문
                                - 예시, 사례, 최근 동향 요청
                                - 과제 설명을 쉽게 풀어달라는 질문
                                - 과제 주제와 연결되는 배경지식 질문
                                - 넓은 주제(예: IT, AI, 컴퓨터, 소프트웨어)에 대한 확장 질문

                                relevant=false 예시:
                                - 잡담
                                - 음식 추천, 게임, 연예, 날씨
                                - 과제와 전혀 관계없는 개인 질문
                                - 의미 없는 입력

                                score는 0~100 정수로 반환한다.
                                answer는 학생에게 바로 보여줄 자연스러운 한국어로 작성한다.

                                과제 설명:
                                """ + taskDescription
                        ),
                        Map.of("role", "user", "content", question)
                )
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response =
                    restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

            Map<?, ?> responseBody = response.getBody();
            if (responseBody == null || responseBody.get("choices") == null) {
                throw new RuntimeException("OpenAI 응답이 비어 있습니다.");
            }

            List<?> choices = (List<?>) responseBody.get("choices");
            if (choices.isEmpty()) {
                throw new RuntimeException("OpenAI choices가 비어 있습니다.");
            }

            Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
            Map<?, ?> message = (Map<?, ?>) firstChoice.get("message");
            if (message == null || message.get("content") == null) {
                throw new RuntimeException("OpenAI message content가 없습니다.");
            }

            String content = (String) message.get("content");
            AiResponseDto result = objectMapper.readValue(content, AiResponseDto.class);

            boolean adjustedRelevant = adjustRelevance(taskDescription, question, result);
            int adjustedScore = adjustScore(taskDescription, question, result, adjustedRelevant);

            if (!adjustedRelevant) {
                return new ChatResponseDto(
                        false,
                        adjustedScore,
                        "과제와 관련된 질문을 해주세요.",
                        "주의"
                );
            }

            String answer = result.getAnswer();
            if (answer == null || answer.isBlank()) {
                answer = "과제 설명과 연결해서 핵심 개념을 정리해보세요.";
            }

            return new ChatResponseDto(
                    true,
                    adjustedScore,
                    answer,
                    "정상"
            );

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("AI 응답 처리 실패");
        }
    }

    private boolean adjustRelevance(String taskDescription, String question, AiResponseDto result) {
        if (result.isRelevant()) {
            return true;
        }

        String task = normalize(taskDescription);
        String q = normalize(question);

        Set<String> taskTokens = tokenize(task);
        Set<String> questionTokens = tokenize(q);

        boolean hasDirectOverlap = taskTokens.stream()
                .anyMatch(token -> token.length() >= 2 && questionTokens.contains(token));

        if (hasDirectOverlap) {
            return true;
        }

        boolean taskHasBroadTopic = taskTokens.stream().anyMatch(BROAD_TOPIC_KEYWORDS::contains);
        boolean questionHasBroadTopic = questionTokens.stream().anyMatch(BROAD_TOPIC_KEYWORDS::contains);

        if (taskHasBroadTopic && questionHasBroadTopic) {
            return true;
        }

        boolean taskHasBroadTopicAsSubstring = containsBroadTopic(task);
        boolean questionHasBroadTopicAsSubstring = containsBroadTopic(q);

        if (taskHasBroadTopicAsSubstring && questionHasBroadTopicAsSubstring) {
            return true;
        }

        boolean helperQuestion = questionTokens.stream().anyMatch(QUESTION_HELPER_KEYWORDS::contains)
                || containsHelperKeyword(q);

        if ((taskHasBroadTopic || taskHasBroadTopicAsSubstring) && helperQuestion) {
            return true;
        }

        return result.getScore() >= 40;
    }

    private int adjustScore(String taskDescription, String question, AiResponseDto result, boolean adjustedRelevant) {
        int score = result.getScore();

        if (!adjustedRelevant) {
            return Math.min(score, 39);
        }

        String task = normalize(taskDescription);
        String q = normalize(question);

        boolean taskHasBroadTopic = containsBroadTopic(task);
        boolean questionHasBroadTopic = containsBroadTopic(q);

        if (!result.isRelevant() && taskHasBroadTopic && questionHasBroadTopic && score < 65) {
            score = 65;
        }

        if (score < 40) {
            score = 40;
        }

        if (score > 100) {
            score = 100;
        }

        return score;
    }

    private String normalize(String text) {
        if (text == null) {
            return "";
        }

        String normalized = Normalizer.normalize(text, Normalizer.Form.NFKC).toLowerCase();
        normalized = normalized.replaceAll("[^a-z0-9가-힣\\s]", " ");
        normalized = normalized.replaceAll("\\s+", " ").trim();
        return normalized;
    }

    private Set<String> tokenize(String text) {
        if (text == null || text.isBlank()) {
            return Set.of();
        }

        return new HashSet<>(Arrays.asList(text.split("\\s+")));
    }

    private boolean containsBroadTopic(String text) {
        return BROAD_TOPIC_KEYWORDS.stream().anyMatch(text::contains);
    }

    private boolean containsHelperKeyword(String text) {
        return QUESTION_HELPER_KEYWORDS.stream().anyMatch(text::contains);
    }

    private void validateLoginId(String loginId) {
        if (loginId == null || loginId.isBlank()) {
            throw new RuntimeException("로그인이 필요합니다.");
        }
    }
}