package com.jetrace.backend.studentService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyString;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.jetrace.backend.studentDao.StudentDao;
import com.jetrace.backend.studentDto.ChatResponseDto;
import com.jetrace.backend.studentDto.StudentMyPageSummaryResponse;
import com.jetrace.backend.studentDto.StudentTaskLogResponse;
import com.jetrace.backend.studentDto.StudentTaskResponse;
import com.jetrace.backend.studentDto.UpcomingTaskResponse;
import com.jetrace.backend.studentDto.StudentReflectionResponse;
import com.jetrace.backend.studentDto.WeeklyLearningResponse;

@ExtendWith(MockitoExtension.class)
class StudentTaskServiceTest {

    @Mock
    private StudentDao studentDao;

    private StudentTaskService service;

    @BeforeEach
    void setUp() {
        service = spy(new StudentTaskService(studentDao));
    }

    @Test
    void listsOnlyTasksForAuthenticatedStudentsClass() {
        approveStudent("student1", "A", "학생1");
        List<StudentTaskResponse> expected = List.of(task(1L, true));
        when(studentDao.findTasksByClassNameAndStudentName("A", "학생1"))
                .thenReturn(expected);

        assertSame(expected, service.getTasks("student1"));
        verify(studentDao).findTasksByClassNameAndStudentName("A", "학생1");
    }

    @Test
    void includesUpcomingTasksInStudentSummary() {
        approveStudent("student1", "A", "학생1");
        StudentMyPageSummaryResponse summary = new StudentMyPageSummaryResponse();
        UpcomingTaskResponse upcoming = new UpcomingTaskResponse(
                1L, "마감 과제", "A", "2026-08-24T18:00:00", false, 50);
        upcoming.setCurrentStep("FIRST_QUESTION");
        upcoming.setNextAction("질문을 확장해 추가 탐색하기");
        upcoming.setQuestionCount(1);
        when(studentDao.findStudentMyPageSummary("A", "학생1")).thenReturn(summary);
        when(studentDao.findRecentTaskLogsByStudentName("학생1")).thenReturn(List.of());
        when(studentDao.findUpcomingTasks("A", "학생1")).thenReturn(List.of(upcoming));

        StudentMyPageSummaryResponse result = service.getMyPageSummary("student1");

        assertEquals(1, result.getUpcomingTasks().size());
        assertSame(upcoming, result.getUpcomingTasks().get(0));
        assertEquals("FIRST_QUESTION", result.getUpcomingTasks().get(0).getCurrentStep());
        assertEquals(1, result.getUpcomingTasks().get(0).getQuestionCount());
    }

    @Test
    void summarizesWeeklyLearningUsingMondayBoundaries() {
        LocalDateTime currentFrom = LocalDateTime.of(2026, 8, 17, 0, 0);
        LocalDateTime currentTo = LocalDateTime.of(2026, 8, 24, 0, 0);
        LocalDateTime previousFrom = LocalDateTime.of(2026, 8, 10, 0, 0);
        when(studentDao.countQuestionsInPeriod("학생1", currentFrom, currentTo)).thenReturn(4);
        when(studentDao.countRevisionsInPeriod("학생1", currentFrom, currentTo)).thenReturn(2);
        when(studentDao.countReflectionsInPeriod("학생1", currentFrom, currentTo)).thenReturn(1);
        when(studentDao.countFeedbackAppliedInPeriod("학생1", currentFrom, currentTo)).thenReturn(1);
        when(studentDao.countFeedbackRequestsInPeriod("학생1", currentFrom, currentTo)).thenReturn(2);
        when(studentDao.countQuestionsInPeriod("학생1", previousFrom, currentFrom)).thenReturn(2);
        when(studentDao.countRevisionsInPeriod("학생1", previousFrom, currentFrom)).thenReturn(1);
        when(studentDao.countReflectionsInPeriod("학생1", previousFrom, currentFrom)).thenReturn(0);
        when(studentDao.countFeedbackAppliedInPeriod("학생1", previousFrom, currentFrom)).thenReturn(0);
        when(studentDao.countFeedbackRequestsInPeriod("학생1", previousFrom, currentFrom)).thenReturn(1);
        when(studentDao.findUnresolvedQuestionsInPeriod("학생1", currentFrom, currentTo))
                .thenReturn(List.of("재귀 호출 이해가 어렵다", "재귀 종료 조건"));

        WeeklyLearningResponse result = service.buildWeeklyLearning("학생1", LocalDate.of(2026, 8, 23));

        assertEquals(4, result.getQuestionCount());
        assertEquals(50, result.getFeedbackApplicationRate());
        assertEquals(0, result.getPreviousFeedbackApplicationRate());
        assertEquals("재귀", result.getFrequentBlockedKeyword());
        assertEquals("지난주보다 질문과 수정·성찰 활동이 늘었어요.", result.getSummaryMessage());
    }

    @Test
    void savesCompletedReflectionForAuthenticatedStudent() {
        approveStudent("student1", "A", "학생1");
        when(studentDao.countTaskInStudentClass(1L, "A")).thenReturn(1);
        StudentReflectionResponse reflection = reflection(true, 4);
        when(studentDao.findReflection(1L, "학생1")).thenReturn(reflection);

        StudentReflectionResponse result = service.saveReflection(1L, "student1", reflection);

        assertSame(reflection, result);
        verify(studentDao).upsertReflection("학생1", reflection);
    }

    @Test
    void rejectsIncompleteFinalReflection() {
        approveStudent("student1", "A", "학생1");
        when(studentDao.countTaskInStudentClass(1L, "A")).thenReturn(1);
        StudentReflectionResponse reflection = reflection(true, 4);
        reflection.setRetryApproach(" ");

        assertThrows(RuntimeException.class, () -> service.saveReflection(1L, "student1", reflection));
        verify(studentDao, never()).upsertReflection(anyString(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void marksOnlyAuthenticatedStudentsFeedbackAsRead() {
        when(studentDao.findStudentNameByLoginId("student1")).thenReturn("학생1");
        when(studentDao.markFeedbackRead(10L, "학생1")).thenReturn(1);

        service.markFeedbackRead(10L, "student1");

        verify(studentDao).markFeedbackRead(10L, "학생1");
    }

    @Test
    void rejectsTaskFromAnotherClass() {
        approveStudent("student1", "A", "학생1");
        when(studentDao.countTaskInStudentClass(20L, "A")).thenReturn(0);

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> service.getTaskDetail(20L, "student1"));

        assertEquals("해당 과제에 접근할 수 없습니다.", exception.getMessage());
        verify(studentDao, never()).insertTaskSubmissionIfNotExists(20L, "학생1");
    }

    @Test
    void answersAiQuestionWhenTaskAllowsAiAndStoresOwnLog() {
        approveStudent("student1", "A", "학생1");
        StudentTaskResponse task = task(1L, true);
        task.setDescription("인공지능의 활용 사례");
        when(studentDao.findTaskById(1L)).thenReturn(task);
        when(studentDao.countTaskInStudentClass(1L, "A")).thenReturn(1);
        ChatResponseDto expected = new ChatResponseDto(true, 90, "답변", "정상");
        doReturn(expected).when(service).callOpenAi("질문", "인공지능의 활용 사례");

        assertSame(expected, service.askTaskAi(1L, "student1", " 질문 "));

        ArgumentCaptor<StudentTaskLogResponse> captor =
                ArgumentCaptor.forClass(StudentTaskLogResponse.class);
        verify(studentDao).insertTaskAiLog(captor.capture());
        assertEquals("학생1", captor.getValue().getStudentName());
        assertEquals("질문", captor.getValue().getQuestion());
    }

    @Test
    void rejectsAiQuestionWhenTaskDisallowsAi() {
        approveStudent("student1", "A", "학생1");
        StudentTaskResponse task = task(1L, false);
        when(studentDao.findTaskById(1L)).thenReturn(task);
        when(studentDao.countTaskInStudentClass(1L, "A")).thenReturn(1);

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> service.askTaskAi(1L, "student1", "질문"));

        assertEquals("이 과제는 AI 사용이 허용되지 않았습니다.", exception.getMessage());
        verify(studentDao, never()).insertTaskAiLog(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void submitsTaskAndCreatesSubmissionRecordWhenMissing() {
        approveStudent("student1", "A", "학생1");
        when(studentDao.countTaskInStudentClass(1L, "A")).thenReturn(1);
        when(studentDao.countTaskSubmission(1L, "학생1")).thenReturn(0);

        service.submitTask(1L, "student1", " 제출 내용 ", true);

        verify(studentDao).insertTaskSubmissionIfNotExists(1L, "학생1");
        verify(studentDao).updateTaskSubmission(1L, "학생1", "제출 내용", true);
    }

    @Test
    void resubmissionOverwritesExistingSubmissionWithoutDuplicateRecord() {
        approveStudent("student1", "A", "학생1");
        when(studentDao.countTaskInStudentClass(1L, "A")).thenReturn(1);
        when(studentDao.countTaskSubmission(1L, "학생1")).thenReturn(1);

        service.submitTask(1L, "student1", "수정한 제출 내용", false);

        verify(studentDao, never()).insertTaskSubmissionIfNotExists(1L, "학생1");
        verify(studentDao).updateTaskSubmission(1L, "학생1", "수정한 제출 내용", false);
    }

    @Test
    void derivesStudentIdentityFromSessionLoginInsteadOfRequestData() {
        approveStudent("student1", "A", "학생1");
        when(studentDao.countTaskInStudentClass(1L, "A")).thenReturn(1);
        when(studentDao.countTaskSubmission(1L, "학생1")).thenReturn(1);

        service.submitTask(1L, "student1", "내 제출", false);

        verify(studentDao).updateTaskSubmission(1L, "학생1", "내 제출", false);
        verify(studentDao, never()).updateTaskSubmission(1L, "학생2", "내 제출", false);
    }

    @Test
    void exportsOnlyAuthenticatedStudentsOwnRecords() {
        when(studentDao.findStudentNameByLoginId("student1")).thenReturn("학생1");
        when(studentDao.exportAiLogs("학생1")).thenReturn(List.of());
        when(studentDao.exportSubmissions("학생1")).thenReturn(List.of());
        when(studentDao.exportReflections("학생1")).thenReturn(List.of());

        var result = service.exportMyRecords("student1");

        assertEquals("학생1", result.get("studentName"));
        verify(studentDao).exportAiLogs("학생1");
        verify(studentDao, never()).exportAiLogs("학생2");
    }

    @Test
    void preventsDuplicatePendingDeletionRequests() {
        when(studentDao.findStudentNameByLoginId("student1")).thenReturn("학생1");
        when(studentDao.countPendingDataDeletionRequest("student1")).thenReturn(1);

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> service.requestDataDeletion("student1", "삭제 요청"));

        assertEquals("이미 처리 대기 중인 삭제 요청이 있습니다.", exception.getMessage());
        verify(studentDao, never()).insertDataDeletionRequest(anyString(), anyString(), anyString());
    }

    private void approveStudent(String loginId, String className, String studentName) {
        when(studentDao.findApprovedClassNameByLoginId(loginId)).thenReturn(className);
        when(studentDao.findStudentNameByLoginId(loginId)).thenReturn(studentName);
    }

    private StudentTaskResponse task(Long id, boolean aiAllowed) {
        return new StudentTaskResponse(id, "과제", "설명", "2026-08-31", false, aiAllowed, null);
    }

    private StudentReflectionResponse reflection(boolean submitted, int level) {
        StudentReflectionResponse reflection = new StudentReflectionResponse();
        reflection.setInitialChange("접근 방법이 달라졌다");
        reflection.setVerifiedContent("공식 문서로 확인했다");
        reflection.setUnresolvedQuestion("복잡도 증명이 어렵다");
        reflection.setRetryApproach("작은 입력부터 검증한다");
        reflection.setUnderstandingLevel(level);
        reflection.setSubmitted(submitted);
        return reflection;
    }
}
