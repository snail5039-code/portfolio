package com.jetrace.backend.studentDao;

import java.util.List;
import java.time.LocalDateTime;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.jetrace.backend.studentDto.StudentMyPageSummaryResponse;
import com.jetrace.backend.studentDto.StudentTaskDetailResponse;
import com.jetrace.backend.studentDto.StudentTaskLogResponse;
import com.jetrace.backend.studentDto.StudentTaskResponse;
import com.jetrace.backend.studentDto.UpcomingTaskResponse;
import com.jetrace.backend.studentDto.StudentReflectionResponse;
import com.jetrace.backend.studentDto.StudentFeedbackResponse;

@Mapper
public interface StudentDao {

    @Select("""
        SELECT class_name
        FROM users
        WHERE login_id = #{loginId}
          AND role = 'STUDENT'
          AND approved = TRUE
        LIMIT 1
    """)
    String findApprovedClassNameByLoginId(String loginId);

    @Select("""
        SELECT name
        FROM users
        WHERE login_id = #{loginId}
          AND role = 'STUDENT'
          AND approved = TRUE
        LIMIT 1
    """)
    String findStudentNameByLoginId(String loginId);

    @Select("""
        SELECT
            t.id,
            t.title,
            t.className,
            t.description,
            t.dueDate,
            t.aiAllowed,
            COALESCE(ts.submitted, FALSE) AS submitted,
            ts.submittedAt,
            ts.score
        FROM task t
        LEFT JOIN taskSubmission ts
        ON ts.taskId = t.id
        AND ts.studentName = #{studentName}
        WHERE t.className = #{className}
        ORDER BY t.id DESC
    """)
    List<StudentTaskResponse> findTasksByClassNameAndStudentName(
            @Param("className") String className,
            @Param("studentName") String studentName
    );

    @Select("""
        SELECT
            SUM(CASE WHEN COALESCE(ts.submitted, FALSE) = TRUE THEN 1 ELSE 0 END) AS submittedCount,
            SUM(CASE WHEN COALESCE(ts.submitted, FALSE) = TRUE THEN 0 ELSE 1 END) AS notSubmittedCount
        FROM task t
        LEFT JOIN taskSubmission ts
          ON ts.taskId = t.id
         AND ts.studentName = #{studentName}
        WHERE t.className = #{className}
    """)
    StudentMyPageSummaryResponse findStudentMyPageSummary(
            @Param("className") String className,
            @Param("studentName") String studentName
    );

    @Select("""
        SELECT
            id,
            taskId,
            studentName,
            question,
            answer,
            createdAt,
            STATUS AS status
        FROM taskAiLog
        WHERE studentName = #{studentName}
        ORDER BY id DESC
        LIMIT 3
    """)
    List<StudentTaskLogResponse> findRecentTaskLogsByStudentName(
            @Param("studentName") String studentName
    );

    @Select("""
        SELECT
            t.id,
            t.title,
            t.className,
            t.dueDate,
            COALESCE(ts.submitted, FALSE) AS submitted,
            (SELECT COUNT(*) FROM taskAiLog log WHERE log.taskId = t.id AND log.studentName = #{studentName}) AS questionCount,
            CASE
                WHEN COALESCE(ts.submitted, FALSE) = TRUE THEN 100
                WHEN EXISTS (SELECT 1 FROM taskReflection reflection WHERE reflection.taskId = t.id AND reflection.studentName = #{studentName} AND reflection.submitted = TRUE) THEN 90
                WHEN ts.content IS NOT NULL AND TRIM(ts.content) <> '' THEN 80
                WHEN EXISTS (
                    SELECT 1
                    FROM taskAiLog log
                    WHERE log.taskId = t.id
                      AND log.studentName = #{studentName}
                ) THEN CASE WHEN (SELECT COUNT(*) FROM taskAiLog log WHERE log.taskId = t.id AND log.studentName = #{studentName}) >= 2 THEN 60 ELSE 40 END
                ELSE 0
            END AS progress,
            CASE
                WHEN COALESCE(ts.submitted, FALSE) = TRUE THEN 'SUBMITTED'
                WHEN EXISTS (SELECT 1 FROM taskReflection reflection WHERE reflection.taskId = t.id AND reflection.studentName = #{studentName} AND reflection.submitted = TRUE) THEN 'REFLECTED'
                WHEN ts.content IS NOT NULL AND TRIM(ts.content) <> '' THEN 'DRAFT_WRITTEN'
                WHEN (SELECT COUNT(*) FROM taskAiLog log WHERE log.taskId = t.id AND log.studentName = #{studentName}) >= 2 THEN 'EXPLORING'
                WHEN EXISTS (SELECT 1 FROM taskAiLog log WHERE log.taskId = t.id AND log.studentName = #{studentName}) THEN 'FIRST_QUESTION'
                ELSE 'NOT_STARTED'
            END AS currentStep,
            CASE
                WHEN COALESCE(ts.submitted, FALSE) = TRUE THEN '제출한 과정 돌아보기'
                WHEN EXISTS (SELECT 1 FROM taskReflection reflection WHERE reflection.taskId = t.id AND reflection.studentName = #{studentName} AND reflection.submitted = TRUE) THEN '성찰을 반영해 최종 제출하기'
                WHEN ts.content IS NOT NULL AND TRIM(ts.content) <> '' THEN '풀이를 검토하고 제출하기'
                WHEN (SELECT COUNT(*) FROM taskAiLog log WHERE log.taskId = t.id AND log.studentName = #{studentName}) >= 2 THEN '탐색을 정리해 풀이 작성하기'
                WHEN EXISTS (SELECT 1 FROM taskAiLog log WHERE log.taskId = t.id AND log.studentName = #{studentName}) THEN '질문을 확장해 추가 탐색하기'
                ELSE '과제를 열고 첫 질문 남기기'
            END AS nextAction
        FROM task t
        LEFT JOIN taskSubmission ts
          ON ts.taskId = t.id
         AND ts.studentName = #{studentName}
        WHERE t.className = #{className}
          AND t.dueDate >= CURRENT_TIMESTAMP
          AND t.dueDate < DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY)
        ORDER BY t.dueDate ASC, t.id ASC
        LIMIT 5
    """)
    List<UpcomingTaskResponse> findUpcomingTasks(
            @Param("className") String className,
            @Param("studentName") String studentName
    );

    @Select("""
        SELECT taskId, initialChange, verifiedContent, unresolvedQuestion,
               retryApproach, understandingLevel, submitted, updatedAt
        FROM taskReflection
        WHERE taskId = #{taskId} AND studentName = #{studentName}
        LIMIT 1
    """)
    StudentReflectionResponse findReflection(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName
    );

    @Insert("""
        INSERT INTO taskReflection (
            taskId, studentName, initialChange, verifiedContent,
            unresolvedQuestion, retryApproach, understandingLevel, submitted
        ) VALUES (
            #{reflection.taskId}, #{studentName}, #{reflection.initialChange},
            #{reflection.verifiedContent}, #{reflection.unresolvedQuestion},
            #{reflection.retryApproach}, #{reflection.understandingLevel}, #{reflection.submitted}
        )
        ON DUPLICATE KEY UPDATE
            initialChange = VALUES(initialChange),
            verifiedContent = VALUES(verifiedContent),
            unresolvedQuestion = VALUES(unresolvedQuestion),
            retryApproach = VALUES(retryApproach),
            understandingLevel = VALUES(understandingLevel),
            submitted = VALUES(submitted),
            updatedAt = CURRENT_TIMESTAMP
    """)
    void upsertReflection(
            @Param("studentName") String studentName,
            @Param("reflection") StudentReflectionResponse reflection
    );

    @Select("""
        SELECT ts.id AS submissionId, ts.taskId, t.title AS taskTitle,
               ts.teacherComment, ts.feedbackStatus, ts.feedbackCreatedAt, ts.feedbackReadAt
        FROM taskSubmission ts
        JOIN task t ON t.id = ts.taskId
        WHERE ts.studentName = #{studentName}
          AND ts.teacherComment IS NOT NULL
          AND TRIM(ts.teacherComment) <> ''
        ORDER BY ts.feedbackCreatedAt DESC, ts.updatedAt DESC
        LIMIT 5
    """)
    List<StudentFeedbackResponse> findFeedbacksByStudentName(@Param("studentName") String studentName);

    @Update("""
        UPDATE taskSubmission
        SET feedbackReadAt = CURRENT_TIMESTAMP
        WHERE id = #{submissionId} AND studentName = #{studentName}
    """)
    int markFeedbackRead(@Param("submissionId") Long submissionId, @Param("studentName") String studentName);

    @Select("SELECT COUNT(*) FROM taskAiLog WHERE studentName = #{studentName} AND createdAt >= #{from} AND createdAt < #{to}")
    int countQuestionsInPeriod(@Param("studentName") String studentName, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Select("SELECT COUNT(*) FROM taskSubmission WHERE studentName = #{studentName} AND previousContent IS NOT NULL AND updatedAt >= #{from} AND updatedAt < #{to}")
    int countRevisionsInPeriod(@Param("studentName") String studentName, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Select("SELECT COUNT(*) FROM taskReflection WHERE studentName = #{studentName} AND submitted = TRUE AND updatedAt >= #{from} AND updatedAt < #{to}")
    int countReflectionsInPeriod(@Param("studentName") String studentName, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Select("SELECT COUNT(*) FROM taskSubmission WHERE studentName = #{studentName} AND feedbackStatus = 'REVISION_SUBMITTED' AND feedbackCreatedAt >= #{from} AND feedbackCreatedAt < #{to}")
    int countFeedbackAppliedInPeriod(@Param("studentName") String studentName, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Select("SELECT COUNT(*) FROM taskSubmission WHERE studentName = #{studentName} AND feedbackStatus IN ('REVISION_REQUESTED', 'REVISION_SUBMITTED') AND feedbackCreatedAt >= #{from} AND feedbackCreatedAt < #{to}")
    int countFeedbackRequestsInPeriod(@Param("studentName") String studentName, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Select("SELECT unresolvedQuestion FROM taskReflection WHERE studentName = #{studentName} AND submitted = TRUE AND updatedAt >= #{from} AND updatedAt < #{to} AND unresolvedQuestion IS NOT NULL")
    List<String> findUnresolvedQuestionsInPeriod(@Param("studentName") String studentName, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Select("SELECT COUNT(*) FROM dataDeletionRequest WHERE loginId = #{loginId} AND status = 'PENDING'")
    int countPendingDataDeletionRequest(@Param("loginId") String loginId);

    @Insert("INSERT INTO dataDeletionRequest (loginId, studentName, reason) VALUES (#{loginId}, #{studentName}, #{reason})")
    void insertDataDeletionRequest(@Param("loginId") String loginId, @Param("studentName") String studentName, @Param("reason") String reason);

    @Select("SELECT taskId, studentName, question, answer, createdAt, status FROM taskAiLog WHERE studentName = #{studentName} ORDER BY createdAt ASC")
    List<java.util.Map<String, Object>> exportAiLogs(@Param("studentName") String studentName);

    @Select("SELECT taskId, studentName, content, previousContent, submitted, submittedAt, teacherComment, feedbackStatus, updatedAt FROM taskSubmission WHERE studentName = #{studentName} ORDER BY updatedAt ASC")
    List<java.util.Map<String, Object>> exportSubmissions(@Param("studentName") String studentName);

    @Select("SELECT taskId, initialChange, verifiedContent, unresolvedQuestion, retryApproach, understandingLevel, submitted, updatedAt FROM taskReflection WHERE studentName = #{studentName} ORDER BY updatedAt ASC")
    List<java.util.Map<String, Object>> exportReflections(@Param("studentName") String studentName);

    @Select("""
        SELECT
            t.id,
            t.title,
            t.className,
            t.description,
            t.dueDate,
            t.aiAllowed,
            ts.id AS submissionId,
            COALESCE(ts.submitted, FALSE) AS submitted,
            ts.submittedAt,
            COALESCE(ts.aiUsed, FALSE) AS aiUsed,
            ts.content,
            ts.previousContent,
            ts.score,
            ts.teacherComment,
            ts.feedbackStatus,
            ts.feedbackReadAt,
            ts.feedbackCreatedAt
        FROM task t
        LEFT JOIN taskSubmission ts
          ON ts.taskId = t.id
         AND ts.studentName = #{studentName}
        WHERE t.id = #{taskId}
          AND t.className = #{className}
        LIMIT 1
    """)
    StudentTaskDetailResponse findTaskDetailByTaskIdAndStudentName(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName,
            @Param("className") String className
    );

    @Select("""
        SELECT
            id,
            taskId,
            studentName,
            question,
            answer,
            createdAt,
            STATUS AS status
        FROM taskAiLog
        WHERE taskId = #{taskId}
          AND studentName = #{studentName}
        ORDER BY id DESC
    """)
    List<StudentTaskLogResponse> findTaskLogsByTaskIdAndStudentName(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName
    );

    @Select("""
        SELECT COUNT(*)
        FROM taskSubmission
        WHERE taskId = #{taskId}
          AND studentName = #{studentName}
    """)
    int countTaskSubmission(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName
    );

    @Insert("""
        INSERT INTO taskSubmission (
            taskId,
            studentName,
            submitted,
            aiUsed,
            score,
            content
        ) VALUES (
            #{taskId},
            #{studentName},
            FALSE,
            FALSE,
            0,
            NULL
        )
    """)
    void insertTaskSubmissionIfNotExists(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName
    );

    @Update("""
        UPDATE taskSubmission
        SET previousContent = CASE
                WHEN content IS NOT NULL AND TRIM(content) <> '' AND content <> #{content} THEN content
                ELSE previousContent
            END,
            submitted = TRUE,
            submittedAt = NOW(),
            aiUsed = #{aiUsed},
            content = #{content},
            feedbackStatus = CASE WHEN feedbackStatus = 'REVISION_REQUESTED' THEN 'REVISION_SUBMITTED' ELSE feedbackStatus END,
            updatedAt = NOW()
        WHERE taskId = #{taskId}
          AND studentName = #{studentName}
    """)
    void updateTaskSubmission(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName,
            @Param("content") String content,
            @Param("aiUsed") Boolean aiUsed
    );

    @Insert("""
        INSERT INTO taskAiLog (
            taskId,
            studentName,
            question,
            answer,
            STATUS
        ) VALUES (
            #{taskId},
            #{studentName},
            #{question},
            #{answer},
            #{status}
        )
    """)
    void insertTaskAiLog(StudentTaskLogResponse log);

    @Select("""
        SELECT
            id,
            title,
            className,
            description,
            dueDate,
            aiAllowed
        FROM task
        WHERE id = #{taskId}
        LIMIT 1
    """)
    StudentTaskResponse findTaskById(Long taskId);

    @Select("""
        SELECT COUNT(*)
        FROM task
        WHERE id = #{taskId}
          AND className = #{className}
    """)
    int countTaskInStudentClass(
            @Param("taskId") Long taskId,
            @Param("className") String className
    );
}
