package com.jetrace.backend.teacherService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import com.jetrace.backend.teacherDao.TaskDao;
import com.jetrace.backend.teacherDao.TeacherProfileDao;
import com.jetrace.backend.teacherDto.StudentRequestResponse;
import com.jetrace.backend.teacherDto.StudentResponse;
import com.jetrace.backend.teacherDto.AiJudgeResult;
import com.jetrace.backend.teacherDto.SimilarityResponse;
import com.jetrace.backend.teacherDto.TaskAiLogResponse;
import com.jetrace.backend.teacherDto.TaskCreateRequest;
import com.jetrace.backend.teacherDto.TaskResponse;
import com.jetrace.backend.teacherDto.TaskSubmissionResponse;
import com.jetrace.backend.teacherDto.TeacherProfileResponse;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskDao taskDao;
    @Mock
    private TeacherProfileDao teacherProfileDao;
    @Mock
    private AiJudgeService aiJudgeService;

    private TaskService service;

    @BeforeEach
    void setUp() {
        service = new TaskService(taskDao, teacherProfileDao, aiJudgeService);
    }

    @Test
    void createsTaskForManagedClassAndInitializesStudentSubmissions() {
        manageClasses("teacher1", "A,B");
        TaskCreateRequest request = taskRequest("teacher1", "A");
        doAnswer(invocation -> {
            ((TaskCreateRequest) invocation.getArgument(0)).setId(10L);
            return null;
        }).when(taskDao).insertTask(request);
        when(taskDao.findStudentNamesByClassName("A")).thenReturn(List.of("학생1", "학생2"));

        service.createTask(request);

        verify(taskDao).insertTask(request);
        verify(taskDao).insertTaskSubmissionIfNotExists(10L, "학생1");
        verify(taskDao).insertTaskSubmissionIfNotExists(10L, "학생2");
        assertEquals("2026-08-31 18:00", request.getDueDate());
    }

    @Test
    void rejectsTaskCreationForUnmanagedClass() {
        manageClasses("teacher1", "A");
        TaskCreateRequest request = taskRequest("teacher1", "B");

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> service.createTask(request));

        assertEquals("해당 반 정보에 접근할 수 없습니다.", exception.getMessage());
        verify(taskDao, never()).insertTask(any());
    }

    @Test
    void approvesAndRejectsStudentRequestsInManagedClass() {
        manageClasses("teacher1", "A");
        StudentRequestResponse approve = request(1L, "학생1", "A");
        StudentRequestResponse reject = request(2L, "학생2", "A");
        when(taskDao.findStudentRequestById(1L)).thenReturn(approve);
        when(taskDao.findStudentRequestById(2L)).thenReturn(reject);
        when(taskDao.findTaskIdsByClassName("A")).thenReturn(List.of(10L));

        service.approveStudentRequest("teacher1", 1L);
        service.rejectStudentRequest("teacher1", 2L);

        verify(taskDao).approveStudentRequest(1L);
        verify(taskDao).insertApprovedStudent(approve);
        verify(taskDao).approveStudentUser("학생1", "A");
        verify(taskDao).insertTaskSubmissionIfNotExists(10L, "학생1");
        verify(taskDao).rejectStudentRequest(2L);
    }

    @Test
    void returnsSubmissionsOnlyAfterVerifyingTaskClassAccess() {
        manageClasses("teacher1", "A");
        when(taskDao.findTaskById(10L)).thenReturn(task(10L, "A"));
        TaskSubmissionResponse submission = submission(100L, 10L, "학생1");
        when(taskDao.findTaskSubmissionsByTaskId(10L)).thenReturn(List.of(submission));
        when(taskDao.findAllStudents()).thenReturn(List.of(student(1L, "학생1", "A")));

        List<TaskSubmissionResponse> result = service.getTaskSubmissions("teacher1", 10L);

        assertSame(submission, result.get(0));
        assertEquals(true, submission.getApprovedStudent());
    }

    @Test
    void rejectsEvaluationScoreOutsideZeroToOneHundred() {
        manageClasses("teacher1", "A");
        when(taskDao.findTaskSubmissionDetailById(100L))
                .thenReturn(submission(100L, 10L, "학생1"));
        when(taskDao.findTaskById(10L)).thenReturn(task(10L, "A"));
        when(taskDao.findAllStudents()).thenReturn(List.of(student(1L, "학생1", "A")));
        TaskSubmissionResponse evaluation = new TaskSubmissionResponse();
        evaluation.setScore(101);

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> service.updateTaskSubmissionEvaluation("teacher1", 100L, evaluation));

        assertEquals("점수는 0점 이상 100점 이하만 가능합니다.", exception.getMessage());
        verify(taskDao, never()).updateTaskSubmissionEvaluation(any(), any(), any(), any());
    }

    @Test
    void storesValidEvaluationAndFeedback() {
        manageClasses("teacher1", "A");
        when(taskDao.findTaskSubmissionDetailById(100L))
                .thenReturn(submission(100L, 10L, "학생1"));
        when(taskDao.findTaskById(10L)).thenReturn(task(10L, "A"));
        StudentResponse student = student(1L, "학생1", "A");
        when(taskDao.findAllStudents()).thenReturn(List.of(student));
        TaskSubmissionResponse evaluation = new TaskSubmissionResponse();
        evaluation.setScore(85);
        evaluation.setTeacherComment("잘했습니다.");
        evaluation.setFeedbackStatus("REVISION_REQUESTED");

        service.updateTaskSubmissionEvaluation("teacher1", 100L, evaluation);

        verify(taskDao).updateTaskSubmissionEvaluation(100L, 85, "잘했습니다.", "REVISION_REQUESTED");
        verify(taskDao).syncStudentFinalScore(1L);
    }

    @Test
    void rejectsAccessToTaskInUnmanagedClassBeforeReadingSubmissions() {
        manageClasses("teacher1", "A");
        when(taskDao.findTaskById(20L)).thenReturn(task(20L, "B"));

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> service.getTaskSubmissions("teacher1", 20L));

        assertEquals("해당 반 정보에 접근할 수 없습니다.", exception.getMessage());
        verify(taskDao, never()).findTaskSubmissionsByTaskId(20L);
    }

    @Test
    void identicalDocumentsProduceOneHundredPercentStudentSimilarity() {
        prepareSimilarityTask(
                submissionWithContent(100L, "학생1", "같은 핵심 문장입니다"),
                submissionWithContent(101L, "학생2", "같은 핵심 문장입니다")
        );

        service.runSimilarityAnalysis("teacher1", 10L);

        SimilarityResponse saved = capturedSimilarity("STUDENT_TO_STUDENT");
        assertEquals(100, saved.getSimilarity());
    }

    @Test
    void completelyDifferentDocumentsProduceZeroSimilarity() {
        prepareSimilarityTask(
                submissionWithContent(100L, "학생1", "사과 바나나"),
                submissionWithContent(101L, "학생2", "네트워크 보안")
        );

        service.runSimilarityAnalysis("teacher1", 10L);

        SimilarityResponse saved = capturedSimilarity("STUDENT_TO_STUDENT");
        assertEquals(0, saved.getSimilarity());
    }

    @Test
    void blankDocumentsAreExcludedFromSimilarityAnalysis() {
        prepareSimilarityTask(submissionWithContent(100L, "학생1", "   "));

        service.runSimilarityAnalysis("teacher1", 10L);

        verify(aiJudgeService, never()).judge(anyString(), anyString(), anyString(),
                anyString(), anyString(), anyInt(), anyList());
        verify(taskDao, never()).insertSimilarityResult(any());
    }

    @Test
    void storesComparisonAgainstStudentsOwnAiLog() {
        prepareSimilarityTask(submissionWithContent(100L, "학생1", "인공지능 활용 사례"));
        TaskAiLogResponse log = new TaskAiLogResponse();
        log.setAnswer("인공지능 활용 사례");
        when(taskDao.findTaskAiLogsByTaskIdAndStudentName(10L, "학생1"))
                .thenReturn(List.of(log));

        service.runSimilarityAnalysis("teacher1", 10L);

        SimilarityResponse saved = capturedSimilarity("STUDENT_TO_AI_LOG");
        assertEquals(100, saved.getSimilarity());
        assertEquals("AI 응답", saved.getTargetName());
    }

    private void manageClasses(String loginId, String classes) {
        when(teacherProfileDao.findTeacherProfile(loginId)).thenReturn(
                new TeacherProfileResponse(loginId, "교사", "teacher@example.com", "수학", classes)
        );
    }

    private TaskCreateRequest taskRequest(String loginId, String className) {
        return new TaskCreateRequest(
                null, loginId, "과제", className, "설명", "2026-08-31T18:00", true
        );
    }

    private TaskResponse task(Long id, String className) {
        return new TaskResponse(id, "과제", className, "설명", "2026-08-31", true,
                null, 1, 1, 0);
    }

    private StudentRequestResponse request(Long id, String name, String className) {
        return new StudentRequestResponse(id, name, className, "PENDING", null, null);
    }

    private StudentResponse student(Long id, String name, String className) {
        return new StudentResponse(id, name, className, 0, 1, 1, 0, 0, 0, null);
    }

    private TaskSubmissionResponse submission(Long id, Long taskId, String studentName) {
        TaskSubmissionResponse response = new TaskSubmissionResponse();
        response.setId(id);
        response.setTaskId(taskId);
        response.setStudentName(studentName);
        response.setSubmitted(true);
        return response;
    }

    private TaskSubmissionResponse submissionWithContent(Long id, String studentName, String content) {
        TaskSubmissionResponse response = submission(id, 10L, studentName);
        response.setContent(content);
        return response;
    }

    private void prepareSimilarityTask(TaskSubmissionResponse... submissions) {
        manageClasses("teacher1", "A");
        when(taskDao.findTaskById(10L)).thenReturn(task(10L, "A"));
        when(taskDao.findTaskSubmissionsByTaskId(10L)).thenReturn(List.of(submissions));
        boolean hasAnalyzableContent = java.util.Arrays.stream(submissions)
                .anyMatch(value -> value.getContent() != null && !value.getContent().isBlank());
        if (hasAnalyzableContent) {
            when(taskDao.findAllStudents()).thenReturn(
                    java.util.Arrays.stream(submissions)
                            .map(value -> student(value.getId(), value.getStudentName(), "A"))
                            .toList()
            );
            when(aiJudgeService.judge(anyString(), anyString(), anyString(), anyString(),
                    anyString(), anyInt(), anyList()))
                    .thenReturn(new AiJudgeResult("정상", "테스트 판정", "자기화 수준 높음"));
        }
    }

    private SimilarityResponse capturedSimilarity(String comparisonType) {
        ArgumentCaptor<SimilarityResponse> captor = ArgumentCaptor.forClass(SimilarityResponse.class);
        verify(taskDao, org.mockito.Mockito.atLeastOnce()).insertSimilarityResult(captor.capture());
        return captor.getAllValues().stream()
                .filter(value -> comparisonType.equals(value.getComparisonType()))
                .findFirst()
                .orElseThrow();
    }
}
