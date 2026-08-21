package com.jetrace.backend.studentService;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jetrace.backend.studentDao.StudentDao;
import com.jetrace.backend.studentDto.AiResponseDto;
import com.jetrace.backend.studentDto.ChatResponseDto;
import com.jetrace.backend.studentDto.StudentMyPageSummaryResponse;
import com.jetrace.backend.studentDto.StudentTaskDetailResponse;
import com.jetrace.backend.studentDto.StudentTaskLogResponse;
import com.jetrace.backend.studentDto.StudentTaskResponse;
import com.jetrace.backend.studentDto.StudentReflectionResponse;
import com.jetrace.backend.studentDto.StudentFeedbackResponse;
import com.jetrace.backend.studentDto.WeeklyLearningResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StudentTaskService {

    private static final Logger log = LoggerFactory.getLogger(StudentTaskService.class);

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
        summary.setUpcomingTasks(studentDao.findUpcomingTasks(className, studentName));
        List<StudentFeedbackResponse> feedbacks = studentDao.findFeedbacksByStudentName(studentName);
        summary.setFeedbacks(feedbacks);
        summary.setUnreadFeedbackCount((int) feedbacks.stream().filter(item -> item.getFeedbackReadAt() == null).count());
        summary.setWeeklyLearning(buildWeeklyLearning(studentName));
        return summary;
    }

    private WeeklyLearningResponse buildWeeklyLearning(String studentName) {
        return buildWeeklyLearning(studentName, LocalDate.now(ZoneId.of("Asia/Seoul")));
    }

    WeeklyLearningResponse buildWeeklyLearning(String studentName, LocalDate today) {
        LocalDate thisMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDateTime currentFrom = thisMonday.atStartOfDay();
        LocalDateTime currentTo = currentFrom.plusWeeks(1);
        LocalDateTime previousFrom = currentFrom.minusWeeks(1);

        WeeklyLearningResponse response = new WeeklyLearningResponse();
        response.setQuestionCount(studentDao.countQuestionsInPeriod(studentName, currentFrom, currentTo));
        response.setRevisionCount(studentDao.countRevisionsInPeriod(studentName, currentFrom, currentTo));
        response.setReflectionCount(studentDao.countReflectionsInPeriod(studentName, currentFrom, currentTo));
        response.setFeedbackAppliedCount(studentDao.countFeedbackAppliedInPeriod(studentName, currentFrom, currentTo));
        int feedbackRequests = studentDao.countFeedbackRequestsInPeriod(studentName, currentFrom, currentTo);
        response.setFeedbackApplicationRate(calculateRate(response.getFeedbackAppliedCount(), feedbackRequests));
        response.setPreviousQuestionCount(studentDao.countQuestionsInPeriod(studentName, previousFrom, currentFrom));
        response.setPreviousRevisionCount(studentDao.countRevisionsInPeriod(studentName, previousFrom, currentFrom));
        response.setPreviousReflectionCount(studentDao.countReflectionsInPeriod(studentName, previousFrom, currentFrom));
        response.setPreviousFeedbackAppliedCount(studentDao.countFeedbackAppliedInPeriod(studentName, previousFrom, currentFrom));
        int previousFeedbackRequests = studentDao.countFeedbackRequestsInPeriod(studentName, previousFrom, currentFrom);
        response.setPreviousFeedbackApplicationRate(calculateRate(response.getPreviousFeedbackAppliedCount(), previousFeedbackRequests));
        response.setFrequentBlockedKeyword(findFrequentKeyword(
                studentDao.findUnresolvedQuestionsInPeriod(studentName, currentFrom, currentTo)));
        response.setSummaryMessage(buildWeeklyMessage(response));
        return response;
    }

    private int calculateRate(int applied, int requested) {
        if (requested == 0) return 0;
        return (int) Math.round(applied * 100.0 / requested);
    }

    private String findFrequentKeyword(List<String> texts) {
        if (texts == null || texts.isEmpty()) return null;
        Set<String> stopWords = Set.of("아직", "이해", "부분", "어렵다", "모르겠다", "무엇", "대한", "에서", "으로", "하는", "있다");
        Map<String, Integer> counts = new HashMap<>();
        texts.stream().filter(text -> text != null).forEach(text ->
                Arrays.stream(text.replaceAll("[^a-zA-Z0-9가-힣\\s]", " ").split("\\s+"))
                        .map(String::trim).filter(word -> word.length() >= 2 && !stopWords.contains(word))
                        .forEach(word -> counts.merge(word, 1, Integer::sum)));
        return counts.entrySet().stream()
                .max(Comparator.<Map.Entry<String, Integer>>comparingInt(Map.Entry::getValue)
                        .thenComparing(Map.Entry::getKey, Comparator.reverseOrder()))
                .map(Map.Entry::getKey).orElse(null);
    }

    private String buildWeeklyMessage(WeeklyLearningResponse response) {
        int currentActivity = response.getQuestionCount() + response.getRevisionCount() + response.getReflectionCount();
        int previousActivity = response.getPreviousQuestionCount() + response.getPreviousRevisionCount() + response.getPreviousReflectionCount();
        if (currentActivity == 0) return "이번 주 첫 학습 기록을 남겨 보세요.";
        if (currentActivity > previousActivity) return "지난주보다 질문과 수정·성찰 활동이 늘었어요.";
        if (response.getFeedbackAppliedCount() > 0) return "교사 피드백을 실제 수정에 반영했어요.";
        return "이번 주에도 꾸준히 생각의 과정을 기록하고 있어요.";
    }

    public Map<String, Object> exportMyRecords(String loginId) {
        validateLoginId(loginId);
        String studentName = studentDao.findStudentNameByLoginId(loginId);
        if (studentName == null) throw new RuntimeException("승인된 학생 계정을 찾을 수 없습니다.");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("exportedAt", LocalDateTime.now(ZoneId.of("Asia/Seoul")).toString());
        data.put("studentName", studentName);
        data.put("purpose", "본인 학습 기록 확인 및 이동");
        data.put("aiLogs", studentDao.exportAiLogs(studentName));
        data.put("submissions", studentDao.exportSubmissions(studentName));
        data.put("reflections", studentDao.exportReflections(studentName));
        return data;
    }

    @Transactional
    public void requestDataDeletion(String loginId, String reason) {
        validateLoginId(loginId);
        String studentName = studentDao.findStudentNameByLoginId(loginId);
        if (studentName == null) throw new RuntimeException("승인된 학생 계정을 찾을 수 없습니다.");
        if (studentDao.countPendingDataDeletionRequest(loginId) > 0) {
            throw new RuntimeException("이미 처리 대기 중인 삭제 요청이 있습니다.");
        }
        String safeReason = reason == null || reason.isBlank() ? "본인 학습 기록 삭제 요청" : reason.trim();
        studentDao.insertDataDeletionRequest(loginId, studentName, safeReason);
    }

    @Transactional
    public void markFeedbackRead(Long submissionId, String loginId) {
        validateLoginId(loginId);
        String studentName = studentDao.findStudentNameByLoginId(loginId);
        if (studentName == null || studentDao.markFeedbackRead(submissionId, studentName) == 0) {
            throw new RuntimeException("피드백을 찾을 수 없습니다.");
        }
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

    public StudentReflectionResponse getReflection(Long taskId, String loginId) {
        StudentIdentity identity = requireStudentTaskAccess(taskId, loginId);
        StudentReflectionResponse reflection = studentDao.findReflection(taskId, identity.studentName());
        if (reflection == null) {
            reflection = new StudentReflectionResponse();
            reflection.setTaskId(taskId);
            reflection.setSubmitted(false);
        }
        return reflection;
    }

    @Transactional
    public StudentReflectionResponse saveReflection(Long taskId, String loginId, StudentReflectionResponse reflection) {
        StudentIdentity identity = requireStudentTaskAccess(taskId, loginId);
        if (reflection == null) throw new RuntimeException("성찰 내용을 입력하세요.");
        Integer level = reflection.getUnderstandingLevel();
        if (level != null && (level < 1 || level > 5)) throw new RuntimeException("이해도는 1에서 5 사이여야 합니다.");
        if (Boolean.TRUE.equals(reflection.getSubmitted()) && (
                isBlank(reflection.getInitialChange()) || isBlank(reflection.getVerifiedContent()) ||
                isBlank(reflection.getUnresolvedQuestion()) || isBlank(reflection.getRetryApproach()) || level == null)) {
            throw new RuntimeException("성찰 질문과 이해도를 모두 작성하세요.");
        }
        reflection.setTaskId(taskId);
        studentDao.upsertReflection(identity.studentName(), reflection);
        return studentDao.findReflection(taskId, identity.studentName());
    }

    private StudentIdentity requireStudentTaskAccess(Long taskId, String loginId) {
        validateLoginId(loginId);
        String className = studentDao.findApprovedClassNameByLoginId(loginId);
        String studentName = studentDao.findStudentNameByLoginId(loginId);
        if (className == null || studentName == null) throw new RuntimeException("승인된 학생 계정을 찾을 수 없습니다.");
        if (studentDao.countTaskInStudentClass(taskId, className) == 0) throw new RuntimeException("해당 과제에 접근할 수 없습니다.");
        return new StudentIdentity(className, studentName);
    }

    private boolean isBlank(String value) { return value == null || value.isBlank(); }

    private record StudentIdentity(String className, String studentName) {}

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

    ChatResponseDto callOpenAi(String question, String taskDescription) {
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
            log.error("AI response processing failed, errorType={}", e.getClass().getSimpleName());
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
