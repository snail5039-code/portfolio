package com.jetrace.backend.teacherService;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jetrace.backend.teacherDao.TaskDao;
import com.jetrace.backend.teacherDao.TeacherProfileDao;
import com.jetrace.backend.teacherDto.AiJudgeResult;
import com.jetrace.backend.teacherDto.SimilarityResponse;
import com.jetrace.backend.teacherDto.StudentRequestResponse;
import com.jetrace.backend.teacherDto.StudentResponse;
import com.jetrace.backend.teacherDto.StudentTaskScoreResponse;
import com.jetrace.backend.teacherDto.TaskAiLogResponse;
import com.jetrace.backend.teacherDto.TaskCreateRequest;
import com.jetrace.backend.teacherDto.TaskResponse;
import com.jetrace.backend.teacherDto.TaskSubmissionResponse;
import com.jetrace.backend.teacherDto.TeacherProfileResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskDao taskDao;
    private final TeacherProfileDao teacherProfileDao;
    private final AiJudgeService aiJudgeService;

    @Transactional
    public void createTask(TaskCreateRequest request) {
        validateTaskCreateRequest(request);
        validateTeacherAccessToClass(request.getLoginId(), request.getClassName());

        if (request.getDueDate() != null) {
            request.setDueDate(request.getDueDate().replace("T", " "));
        }

        taskDao.insertTask(request);

        List<String> studentNames = taskDao.findStudentNamesByClassName(request.getClassName());
        for (String studentName : studentNames) {
            taskDao.insertTaskSubmissionIfNotExists(request.getId(), studentName);
        }
    }

    public List<TaskResponse> getTaskList(String loginId) {
        Set<String> managedClasses = getManagedClassSet(loginId);

        return taskDao.findAllTasks().stream()
                .filter(task -> managedClasses.contains(normalizeClassName(task.getClassName())))
                .collect(Collectors.toList());
    }

    public TaskResponse getTaskDetail(String loginId, Long taskId) {
        TaskResponse task = getAccessibleTask(loginId, taskId);

        if (task == null) {
            throw new RuntimeException("과제 정보를 찾을 수 없습니다.");
        }

        return task;
    }

    public List<TaskSubmissionResponse> getTaskSubmissions(String loginId, Long taskId) {
        TaskResponse task = getAccessibleTask(loginId, taskId);

        return taskDao.findTaskSubmissionsByTaskId(taskId).stream()
                .peek(submission -> submission.setApprovedStudent(
                        isApprovedStudentInTaskClass(task.getClassName(), submission.getStudentName())
                ))
                .collect(Collectors.toList());
    }

    public List<TaskAiLogResponse> getTaskAiLogs(String loginId, Long taskId, String studentName) {
        if (studentName == null || studentName.isBlank()) {
            throw new RuntimeException("학생명이 필요합니다.");
        }

        TaskResponse task = getAccessibleTask(loginId, taskId);

        if (!isApprovedStudentInTaskClass(task.getClassName(), studentName)) {
            throw new RuntimeException("아직 승인 전 학생입니다. 학생 관리에서 승인 후 AI 로그를 확인할 수 있습니다.");
        }

        return taskDao.findTaskAiLogsByTaskIdAndStudentName(taskId, studentName);
    }

    public List<StudentRequestResponse> getPendingStudentRequests(String loginId) {
        Set<String> managedClasses = getManagedClassSet(loginId);

        return taskDao.findPendingStudentRequests().stream()
                .filter(request -> managedClasses.contains(normalizeClassName(request.getClassName())))
                .collect(Collectors.toList());
    }

    @Transactional
    public void approveStudentRequest(String loginId, Long requestId) {
        StudentRequestResponse request = taskDao.findStudentRequestById(requestId);

        if (request == null) {
            throw new RuntimeException("학생 신청 정보를 찾을 수 없습니다.");
        }

        validateTeacherAccessToClass(loginId, request.getClassName());

        if ("APPROVED".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("이미 승인된 신청입니다.");
        }

        if ("REJECTED".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("이미 거절된 신청입니다.");
        }

        int studentCount = taskDao.countStudentByNameAndClassName(
                request.getStudentName(),
                request.getClassName()
        );

        if (studentCount > 0) {
            taskDao.approveStudentRequest(requestId);
            taskDao.approveStudentUser(request.getStudentName(), request.getClassName());
            syncStudentSubmissionsByClass(request.getStudentName(), request.getClassName());
            return;
        }

        taskDao.approveStudentRequest(requestId);
        taskDao.insertApprovedStudent(request);
        taskDao.approveStudentUser(request.getStudentName(), request.getClassName());
        syncStudentSubmissionsByClass(request.getStudentName(), request.getClassName());
    }

    @Transactional
    public void rejectStudentRequest(String loginId, Long requestId) {
        StudentRequestResponse request = taskDao.findStudentRequestById(requestId);

        if (request == null) {
            throw new RuntimeException("학생 신청 정보를 찾을 수 없습니다.");
        }

        validateTeacherAccessToClass(loginId, request.getClassName());

        if ("APPROVED".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("이미 승인된 신청은 거절할 수 없습니다.");
        }

        if ("REJECTED".equalsIgnoreCase(request.getStatus())) {
            throw new RuntimeException("이미 거절된 신청입니다.");
        }

        taskDao.rejectStudentRequest(requestId);
    }

    public List<StudentResponse> getStudentList(String loginId) {
        Set<String> managedClasses = getManagedClassSet(loginId);

        return taskDao.findAllStudents().stream()
                .filter(student -> managedClasses.contains(normalizeClassName(student.getClassName())))
                .collect(Collectors.toList());
    }

    public StudentResponse getStudentDetail(String loginId, Long studentId) {
        StudentResponse student = taskDao.findStudentById(studentId);

        if (student == null) {
            throw new RuntimeException("학생 정보를 찾을 수 없습니다.");
        }

        validateTeacherAccessToClass(loginId, student.getClassName());
        return student;
    }

    @Transactional
    public void updateStudentInfo(String loginId, Long studentId, StudentResponse request) {
        StudentResponse currentStudent = taskDao.findStudentById(studentId);

        if (currentStudent == null) {
            throw new RuntimeException("학생 정보를 찾을 수 없습니다.");
        }

        validateTeacherAccessToClass(loginId, currentStudent.getClassName());

        if (request.getStudentName() == null || request.getStudentName().isBlank()) {
            throw new RuntimeException("학생명을 입력해주세요.");
        }

        if (request.getClassName() == null || request.getClassName().isBlank()) {
            throw new RuntimeException("반 정보를 입력해주세요.");
        }

        validateTeacherAccessToClass(loginId, request.getClassName());

        int duplicateCount = taskDao.countOtherStudentByNameAndClassName(
                studentId,
                request.getStudentName(),
                request.getClassName()
        );

        if (duplicateCount > 0) {
            throw new RuntimeException("같은 반에 동일한 학생명이 이미 존재합니다.");
        }

        String oldStudentName = currentStudent.getStudentName();
        String newStudentName = request.getStudentName();

        request.setId(studentId);
        taskDao.updateStudentInfo(request);

        if (!oldStudentName.equals(newStudentName)) {
            taskDao.updateTaskSubmissionStudentName(oldStudentName, newStudentName);
            taskDao.updateTaskAiLogStudentName(oldStudentName, newStudentName);
            taskDao.updateSimilarityStudentName(oldStudentName, newStudentName);
            taskDao.updateSimilarityTargetName(oldStudentName, newStudentName);
            taskDao.updateStudentRequestStudentName(oldStudentName, newStudentName);
        }

        syncStudentSubmissionsByClass(request.getStudentName(), request.getClassName());
        taskDao.syncStudentFinalScore(studentId);
    }

    public List<StudentTaskScoreResponse> getStudentTaskScores(String loginId, Long studentId) {
        StudentResponse student = getStudentDetail(loginId, studentId);
        String studentClassName = normalizeClassName(student.getClassName());

        return taskDao.findStudentTaskScoresByStudentName(student.getStudentName()).stream()
                .filter(score -> studentClassName.equals(normalizeClassName(score.getClassName())))
                .collect(Collectors.toList());
    }

    @Transactional
    public void updateStudentTaskScore(String loginId, Long studentId, Long submissionId, Integer score) {
        StudentResponse student = getStudentDetail(loginId, studentId);
        TaskSubmissionResponse submission = taskDao.findTaskSubmissionDetailById(submissionId);

        if (submission == null) {
            throw new RuntimeException("제출 정보를 찾을 수 없습니다.");
        }

        if (!student.getStudentName().equals(submission.getStudentName())) {
            throw new RuntimeException("해당 학생의 제출 정보가 아닙니다.");
        }

        TaskResponse task = getAccessibleTask(loginId, submission.getTaskId());
        if (!normalizeClassName(student.getClassName()).equals(normalizeClassName(task.getClassName()))) {
            throw new RuntimeException("해당 학생 반의 과제만 수정할 수 있습니다.");
        }

        validateScore(score);

        taskDao.updateTaskSubmissionScore(submissionId, score);
        taskDao.syncStudentFinalScore(studentId);
    }

    public TaskSubmissionResponse getTaskSubmissionDetail(String loginId, Long submissionId) {
        TaskSubmissionResponse submission = taskDao.findTaskSubmissionDetailById(submissionId);

        if (submission == null) {
            throw new RuntimeException("제출 정보를 찾을 수 없습니다.");
        }

        TaskResponse task = getAccessibleTask(loginId, submission.getTaskId());

        if (!isApprovedStudentInTaskClass(task.getClassName(), submission.getStudentName())) {
            submission.setApprovedStudent(false);
            throw new RuntimeException("아직 승인 전 학생입니다. 학생 관리에서 승인 후 제출 상세를 확인할 수 있습니다.");
        }

        submission.setApprovedStudent(true);

        SimilarityResponse topStudentSimilarity = taskDao.findTopStudentSimilarity(
                submission.getTaskId(),
                submission.getStudentName()
        );

        SimilarityResponse aiLogSimilarity = taskDao.findAiLogSimilarity(
                submission.getTaskId(),
                submission.getStudentName()
        );

        if (topStudentSimilarity != null) {
            submission.setTopStudentSimilarity(topStudentSimilarity.getSimilarity());
            submission.setTopStudentTargetName(topStudentSimilarity.getTargetName());
            submission.setTopStudentJudge(topStudentSimilarity.getJudge());
            submission.setTopStudentReason(topStudentSimilarity.getReason());
        }

        if (aiLogSimilarity != null) {
            submission.setAiLogSimilarity(aiLogSimilarity.getSimilarity());
            submission.setAiLogJudge(aiLogSimilarity.getJudge());
            submission.setAiLogReason(aiLogSimilarity.getReason());
        }

        return submission;
    }

    @Transactional
    public void updateTaskSubmissionEvaluation(String loginId, Long submissionId, TaskSubmissionResponse request) {
        TaskSubmissionResponse submission = taskDao.findTaskSubmissionDetailById(submissionId);

        if (submission == null) {
            throw new RuntimeException("제출 정보를 찾을 수 없습니다.");
        }

        TaskResponse task = getAccessibleTask(loginId, submission.getTaskId());

        if (!isApprovedStudentInTaskClass(task.getClassName(), submission.getStudentName())) {
            throw new RuntimeException("아직 승인 전 학생입니다. 학생 관리에서 승인 후 평가할 수 있습니다.");
        }

        validateScore(request.getScore());

        taskDao.updateTaskSubmissionEvaluation(
                submissionId,
                request.getScore(),
                request.getTeacherComment()
        );

        StudentResponse student = findStudentByNameAndClassName(
                submission.getStudentName(),
                task.getClassName()
        );

        if (student != null) {
            taskDao.syncStudentFinalScore(student.getId());
        }
    }

    @Transactional
    public void runSimilarityAnalysis(String loginId, Long taskId) {
        TaskResponse task = getAccessibleTask(loginId, taskId);
        List<TaskSubmissionResponse> submissions = taskDao.findTaskSubmissionsByTaskId(taskId);

        taskDao.deleteSimilarityResultsByTaskId(taskId);
        taskDao.clearTaskSubmissionResults(taskId);

        List<TaskSubmissionResponse> submittedList = submissions.stream()
                .filter(s -> Boolean.TRUE.equals(s.getSubmitted()))
                .filter(s -> s.getContent() != null && !s.getContent().isBlank())
                .filter(s -> isApprovedStudentInTaskClass(task.getClassName(), s.getStudentName()))
                .collect(Collectors.toList());

        Map<String, List<SimilarityResponse>> studentResultMap = new HashMap<>();

        for (int i = 0; i < submittedList.size(); i++) {
            TaskSubmissionResponse a = submittedList.get(i);

            List<TaskAiLogResponse> aLogs =
                    taskDao.findTaskAiLogsByTaskIdAndStudentName(taskId, a.getStudentName());

            for (int j = i + 1; j < submittedList.size(); j++) {
                TaskSubmissionResponse b = submittedList.get(j);

                int similarity = calculateSimilarity(a.getContent(), b.getContent());

                AiJudgeResult aiDecision = aiJudgeService.judge(
                        "STUDENT_TO_STUDENT",
                        a.getStudentName(),
                        b.getStudentName(),
                        a.getContent(),
                        b.getContent(),
                        similarity,
                        aLogs
                );

                SimilarityResponse result = new SimilarityResponse(
                        null,
                        taskId,
                        null,
                        a.getStudentName(),
                        b.getStudentName(),
                        "STUDENT_TO_STUDENT",
                        similarity,
                        aiDecision.getJudge(),
                        aiDecision.getReason(),
                        a.getContent(),
                        b.getContent(),
                        null
                );

                taskDao.insertSimilarityResult(result);

                studentResultMap.computeIfAbsent(a.getStudentName(), k -> new ArrayList<>()).add(result);
                studentResultMap.computeIfAbsent(b.getStudentName(), k -> new ArrayList<>()).add(
                        new SimilarityResponse(
                                null,
                                taskId,
                                null,
                                b.getStudentName(),
                                a.getStudentName(),
                                "STUDENT_TO_STUDENT",
                                similarity,
                                aiDecision.getJudge(),
                                aiDecision.getReason(),
                                b.getContent(),
                                a.getContent(),
                                null
                        )
                );
            }

            String mergedAiAnswers = aLogs.stream()
                    .map(TaskAiLogResponse::getAnswer)
                    .filter(Objects::nonNull)
                    .filter(answer -> !answer.isBlank())
                    .collect(Collectors.joining("\n"));

            if (!mergedAiAnswers.isBlank()) {
                int similarity = calculateSimilarity(a.getContent(), mergedAiAnswers);

                AiJudgeResult aiDecision = aiJudgeService.judge(
                        "STUDENT_TO_AI_LOG",
                        a.getStudentName(),
                        "AI 응답",
                        a.getContent(),
                        mergedAiAnswers,
                        similarity,
                        aLogs
                );

                SimilarityResponse result = new SimilarityResponse(
                        null,
                        taskId,
                        null,
                        a.getStudentName(),
                        "AI 응답",
                        "STUDENT_TO_AI_LOG",
                        similarity,
                        aiDecision.getJudge(),
                        aiDecision.getReason(),
                        a.getContent(),
                        mergedAiAnswers,
                        null
                );

                taskDao.insertSimilarityResult(result);
                studentResultMap.computeIfAbsent(a.getStudentName(), k -> new ArrayList<>()).add(result);
            }
        }

        for (TaskSubmissionResponse submission : submittedList) {
            List<SimilarityResponse> results =
                    studentResultMap.getOrDefault(submission.getStudentName(), List.of());

            String finalResult = decideFinalSubmissionResult(results);
            taskDao.updateTaskSubmissionResult(taskId, submission.getStudentName(), finalResult);
        }
    }

    public List<SimilarityResponse> getSimilarityResults(String loginId) {
        Set<String> managedClasses = getManagedClassSet(loginId);

        return taskDao.findAllSimilarityResults().stream()
                .filter(result -> {
                    TaskResponse task = taskDao.findTaskById(result.getTaskId());
                    return task != null && managedClasses.contains(normalizeClassName(task.getClassName()));
                })
                .collect(Collectors.toList());
    }

    public SimilarityResponse getSimilarityResultDetail(String loginId, Long similarityId) {
        SimilarityResponse result = taskDao.findSimilarityResultById(similarityId);

        if (result == null) {
            throw new RuntimeException("유사도 분석 결과를 찾을 수 없습니다.");
        }

        TaskResponse task = getAccessibleTask(loginId, result.getTaskId());

        if ("STUDENT_TO_STUDENT".equals(result.getComparisonType())) {
            if (!isApprovedStudentInTaskClass(task.getClassName(), result.getStudentName())
                    || !isApprovedStudentInTaskClass(task.getClassName(), result.getTargetName())) {
                throw new RuntimeException("아직 승인 전 학생이 포함되어 있습니다. 학생 관리에서 승인 후 유사도 결과를 확인할 수 있습니다.");
            }
        } else if ("STUDENT_TO_AI_LOG".equals(result.getComparisonType())) {
            if (!isApprovedStudentInTaskClass(task.getClassName(), result.getStudentName())) {
                throw new RuntimeException("아직 승인 전 학생입니다. 학생 관리에서 승인 후 유사도 결과를 확인할 수 있습니다.");
            }
        }

        return result;
    }

    @Transactional
    public void backfillSystemData() {
        taskDao.backfillMissingTaskSubmissions();
        taskDao.syncAiUsedByLogs();

        List<StudentResponse> students = taskDao.findAllStudents();
        for (StudentResponse student : students) {
            taskDao.syncStudentFinalScore(student.getId());
        }
    }

    private void validateTaskCreateRequest(TaskCreateRequest request) {
        if (request == null) {
            throw new RuntimeException("과제 정보가 없습니다.");
        }

        if (request.getLoginId() == null || request.getLoginId().isBlank()) {
            throw new RuntimeException("교사 로그인 아이디가 필요합니다.");
        }

        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new RuntimeException("과제명을 입력해주세요.");
        }

        if (request.getClassName() == null || request.getClassName().isBlank()) {
            throw new RuntimeException("반 정보를 입력해주세요.");
        }

        if (request.getDueDate() == null || request.getDueDate().isBlank()) {
            throw new RuntimeException("마감일을 입력해주세요.");
        }

        if (request.getAiAllowed() == null) {
            request.setAiAllowed(Boolean.TRUE);
        }
    }

    private void validateScore(Integer score) {
        if (score == null) {
            throw new RuntimeException("점수를 입력해주세요.");
        }

        if (score < 0 || score > 100) {
            throw new RuntimeException("점수는 0점 이상 100점 이하만 가능합니다.");
        }
    }

    private void syncStudentSubmissionsByClass(String studentName, String className) {
        List<Long> taskIds = taskDao.findTaskIdsByClassName(className);

        for (Long taskId : taskIds) {
            taskDao.insertTaskSubmissionIfNotExists(taskId, studentName);
        }
    }

    private StudentResponse findStudentByNameAndClassName(String studentName, String className) {
        String normalizedClassName = normalizeClassName(className);

        return taskDao.findAllStudents().stream()
                .filter(student -> studentName.equals(student.getStudentName()))
                .filter(student -> normalizedClassName.equals(normalizeClassName(student.getClassName())))
                .findFirst()
                .orElse(null);
    }

    private void validateStudentAccessByTaskClass(String taskClassName, String studentName) {
        if (!isApprovedStudentInTaskClass(taskClassName, studentName)) {
            throw new RuntimeException("아직 승인 전 학생입니다. 학생 관리에서 승인 후 확인할 수 있습니다.");
        }
    }

    private boolean isApprovedStudentInTaskClass(String taskClassName, String studentName) {
        if (studentName == null || studentName.isBlank()) {
            return false;
        }

        StudentResponse student = findStudentByNameAndClassName(studentName, taskClassName);
        return student != null;
    }

    private TaskResponse getAccessibleTask(String loginId, Long taskId) {
        TaskResponse task = taskDao.findTaskById(taskId);

        if (task == null) {
            throw new RuntimeException("과제 정보를 찾을 수 없습니다.");
        }

        validateTeacherAccessToClass(loginId, task.getClassName());
        return task;
    }

    private Set<String> getManagedClassSet(String loginId) {
        if (loginId == null || loginId.isBlank()) {
            throw new RuntimeException("교사 로그인 아이디가 필요합니다.");
        }

        TeacherProfileResponse profile = teacherProfileDao.findTeacherProfile(loginId);
        if (profile == null) {
            throw new RuntimeException("교사 정보를 찾을 수 없습니다.");
        }

        String managedClasses = profile.getManagedClasses();
        if (managedClasses == null || managedClasses.isBlank()) {
            throw new RuntimeException("관리 반 정보가 없습니다.");
        }

        Set<String> managedClassSet = Arrays.stream(managedClasses.split(","))
                .map(this::normalizeClassName)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (managedClassSet.isEmpty()) {
            throw new RuntimeException("관리 반 정보가 없습니다.");
        }

        return managedClassSet;
    }

    private void validateTeacherAccessToClass(String loginId, String className) {
        Set<String> managedClasses = getManagedClassSet(loginId);
        String normalizedClassName = normalizeClassName(className);

        if (!managedClasses.contains(normalizedClassName)) {
            throw new RuntimeException("해당 반 정보에 접근할 수 없습니다.");
        }
    }

    private String normalizeClassName(String className) {
        if (className == null) {
            return "";
        }
        return className.trim().toUpperCase();
    }

    private int calculateSimilarity(String textA, String textB) {
        if (textA == null || textB == null || textA.isBlank() || textB.isBlank()) {
            return 0;
        }

        Set<String> setA = Arrays.stream(
                textA.replaceAll("[^가-힣a-zA-Z0-9 ]", " ")
                        .toLowerCase()
                        .split("\\s+")
        )
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());

        Set<String> setB = Arrays.stream(
                textB.replaceAll("[^가-힣a-zA-Z0-9 ]", " ")
                        .toLowerCase()
                        .split("\\s+")
        )
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());

        if (setA.isEmpty() || setB.isEmpty()) {
            return 0;
        }

        Set<String> intersection = new HashSet<>(setA);
        intersection.retainAll(setB);

        Set<String> union = new HashSet<>(setA);
        union.addAll(setB);

        double score = ((double) intersection.size() / union.size()) * 100;
        return (int) Math.round(score);
    }

    private String decideFinalSubmissionResult(List<SimilarityResponse> results) {
        if (results == null || results.isEmpty()) {
            return "자기화 수준 높음";
        }

        SimilarityResponse top = results.stream()
                .max(
                        Comparator.comparingInt((SimilarityResponse r) -> judgeWeight(r.getJudge()))
                                .thenComparingInt(r -> r.getSimilarity() == null ? 0 : r.getSimilarity())
                )
                .orElse(null);

        if (top == null) {
            return "자기화 수준 높음";
        }

        return switch (top.getJudge()) {
            case "위험" -> "복사 가능성 높음";
            case "주의" -> "일부 재구성";
            default -> "자기화 수준 높음";
        };
    }

    private int judgeWeight(String judge) {
        if ("위험".equals(judge)) {
            return 3;
        }
        if ("주의".equals(judge)) {
            return 2;
        }
        return 1;
    }
}