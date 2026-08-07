package com.jetrace.backend.teacherDao;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.jetrace.backend.teacherDto.SimilarityResponse;
import com.jetrace.backend.teacherDto.StudentRequestResponse;
import com.jetrace.backend.teacherDto.StudentResponse;
import com.jetrace.backend.teacherDto.StudentTaskScoreResponse;
import com.jetrace.backend.teacherDto.TaskAiLogResponse;
import com.jetrace.backend.teacherDto.TaskCreateRequest;
import com.jetrace.backend.teacherDto.TaskResponse;
import com.jetrace.backend.teacherDto.TaskSubmissionResponse;

@Mapper
public interface TaskDao {

    @Options(useGeneratedKeys = true, keyProperty = "id")
    @Insert("""
            INSERT INTO task (
                title,
                className,
                description,
                dueDate,
                aiAllowed,
                createdAt,
                updatedAt
            ) VALUES (
                #{title},
                #{className},
                #{description},
                #{dueDate},
                #{aiAllowed},
                NOW(),
                NOW()
            )
            """)
    void insertTask(TaskCreateRequest request);

    @Select("""
            SELECT studentName
            FROM student
            WHERE className = #{className}
            ORDER BY id ASC
            """)
    List<String> findStudentNamesByClassName(String className);

    @Select("""
            SELECT id
            FROM task
            WHERE className = #{className}
            ORDER BY id ASC
            """)
    List<Long> findTaskIdsByClassName(String className);

    @Insert("""
            INSERT INTO taskSubmission (
                taskId,
                studentName,
                submitted,
                submittedAt,
                aiUsed,
                result,
                score,
                content,
                teacherComment,
                createdAt,
                updatedAt
            )
            SELECT
                #{taskId},
                #{studentName},
                FALSE,
                NULL,
                FALSE,
                NULL,
                0,
                NULL,
                NULL,
                NOW(),
                NOW()
            FROM dual
            WHERE NOT EXISTS (
                SELECT 1
                FROM taskSubmission
                WHERE taskId = #{taskId}
                  AND studentName = #{studentName}
            )
            """)
    void insertTaskSubmissionIfNotExists(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName
    );

    @Select("""
            SELECT COUNT(*)
            FROM student
            WHERE studentName = #{studentName}
              AND className = #{className}
            """)
    int countStudentByNameAndClassName(
            @Param("studentName") String studentName,
            @Param("className") String className
    );

    @Select("""
            SELECT COUNT(*)
            FROM student
            WHERE studentName = #{studentName}
              AND className = #{className}
              AND id <> #{studentId}
            """)
    int countOtherStudentByNameAndClassName(
            @Param("studentId") Long studentId,
            @Param("studentName") String studentName,
            @Param("className") String className
    );

    @Select("""
        SELECT
            t.id,
            t.title,
            t.className,
            t.description,
            t.dueDate,
            t.aiAllowed,
            t.createdAt,
            (
                SELECT COUNT(*)
                FROM student s
                WHERE s.className = t.className
            ) AS totalStudentCount,
            (
                SELECT COUNT(*)
                FROM taskSubmission ts
                WHERE ts.taskId = t.id
                  AND ts.submitted = TRUE
            ) AS submittedCount,
            (
                SELECT COUNT(*)
                FROM student s
                WHERE s.className = t.className
            ) -
            (
                SELECT COUNT(*)
                FROM taskSubmission ts
                WHERE ts.taskId = t.id
                  AND ts.submitted = TRUE
            ) AS notSubmittedCount
        FROM task t
        ORDER BY t.id DESC
        """)
    List<TaskResponse> findAllTasks();

    @Select("""
            SELECT
                id,
                title,
                className,
                description,
                dueDate,
                aiAllowed,
                createdAt
            FROM task
            WHERE id = #{taskId}
            """)
    TaskResponse findTaskById(Long taskId);

    @Select("""
            SELECT
                ts.id,
                ts.taskId,
                ts.studentName,
                ts.submitted,
                ts.submittedAt,
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM taskAiLog al
                        WHERE al.taskId = ts.taskId
                          AND al.studentName = ts.studentName
                    ) THEN TRUE
                    ELSE FALSE
                END AS aiUsed,
                ts.result,
                ts.content,
                ts.score,
                ts.teacherComment,
                ts.createdAt,
                ts.updatedAt
            FROM taskSubmission ts
            WHERE ts.taskId = #{taskId}
            ORDER BY ts.id ASC
            """)
    List<TaskSubmissionResponse> findTaskSubmissionsByTaskId(Long taskId);

    @Select("""
            SELECT
                id,
                taskId,
                studentName,
                question,
                answer,
                createdAt,
                status
            FROM taskAiLog
            WHERE taskId = #{taskId}
              AND studentName = #{studentName}
            ORDER BY id DESC
            """)
    List<TaskAiLogResponse> findTaskAiLogsByTaskIdAndStudentName(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName
    );

    @Select("""
            SELECT
                id,
                studentName,
                className,
                status,
                requestedAt,
                processedAt
            FROM studentRequest
            WHERE status = 'PENDING'
            ORDER BY id DESC
            """)
    List<StudentRequestResponse> findPendingStudentRequests();

    @Select("""
            SELECT
                id,
                studentName,
                className,
                status,
                requestedAt,
                processedAt
            FROM studentRequest
            WHERE id = #{requestId}
            """)
    StudentRequestResponse findStudentRequestById(Long requestId);

    @Update("""
            UPDATE studentRequest
            SET status = 'APPROVED',
                processedAt = NOW()
            WHERE id = #{requestId}
            """)
    void approveStudentRequest(Long requestId);

    @Update("""
        UPDATE users
        SET approved = TRUE
        WHERE name = #{studentName}
          AND UPPER(class_name) = UPPER(#{className})
          AND role = 'STUDENT'
        """)
    void approveStudentUser(
            @Param("studentName") String studentName,
            @Param("className") String className
    );

    @Update("""
            UPDATE studentRequest
            SET status = 'REJECTED',
                processedAt = NOW()
            WHERE id = #{requestId}
            """)
    void rejectStudentRequest(Long requestId);

    @Insert("""
            INSERT INTO student (
                studentName,
                className,
                finalScore,
                approvedAt
            ) VALUES (
                #{studentName},
                #{className},
                0,
                NOW()
            )
            """)
    void insertApprovedStudent(StudentRequestResponse request);

    @Select("""
            SELECT
                s.id,
                s.studentName,
                s.className,
                COALESCE((
                    SELECT ROUND(AVG(ts.score))
                    FROM taskSubmission ts
                    WHERE ts.studentName = s.studentName
                ), 0) AS finalScore,
                (
                    SELECT COUNT(*)
                    FROM task t
                    WHERE t.className = s.className
                ) AS totalTasks,
                (
                    SELECT COUNT(*)
                    FROM taskSubmission ts
                    WHERE ts.studentName = s.studentName
                      AND ts.submitted = TRUE
                ) AS submittedTasks,
                (
                    SELECT COUNT(*)
                    FROM task t
                    WHERE t.className = s.className
                ) -
                (
                    SELECT COUNT(*)
                    FROM taskSubmission ts
                    WHERE ts.studentName = s.studentName
                      AND ts.submitted = TRUE
                ) AS notSubmittedTasks,
                (
                    SELECT COUNT(*)
                    FROM taskAiLog al
                    WHERE al.studentName = s.studentName
                ) AS aiLogCount,
                (
                    SELECT COUNT(*)
                    FROM taskAiLog al
                    WHERE al.studentName = s.studentName
                      AND al.status = '주의'
                ) AS cautionLogCount,
                s.approvedAt
            FROM student s
            ORDER BY s.id DESC
            """)
    List<StudentResponse> findAllStudents();

    @Select("""
            SELECT
                s.id,
                s.studentName,
                s.className,
                COALESCE((
                    SELECT ROUND(AVG(ts.score))
                    FROM taskSubmission ts
                    WHERE ts.studentName = s.studentName
                ), 0) AS finalScore,
                (
                    SELECT COUNT(*)
                    FROM task t
                    WHERE t.className = s.className
                ) AS totalTasks,
                (
                    SELECT COUNT(*)
                    FROM taskSubmission ts
                    WHERE ts.studentName = s.studentName
                      AND ts.submitted = TRUE
                ) AS submittedTasks,
                (
                    SELECT COUNT(*)
                    FROM task t
                    WHERE t.className = s.className
                ) -
                (
                    SELECT COUNT(*)
                    FROM taskSubmission ts
                    WHERE ts.studentName = s.studentName
                      AND ts.submitted = TRUE
                ) AS notSubmittedTasks,
                (
                    SELECT COUNT(*)
                    FROM taskAiLog al
                    WHERE al.studentName = s.studentName
                ) AS aiLogCount,
                (
                    SELECT COUNT(*)
                    FROM taskAiLog al
                    WHERE al.studentName = s.studentName
                      AND al.status = '주의'
                ) AS cautionLogCount,
                s.approvedAt
            FROM student s
            WHERE s.id = #{studentId}
            """)
    StudentResponse findStudentById(Long studentId);

    @Update("""
            UPDATE student
            SET
                studentName = #{studentName},
                className = #{className}
            WHERE id = #{id}
            """)
    void updateStudentInfo(StudentResponse request);

    @Update("""
            UPDATE taskSubmission
            SET studentName = #{newStudentName}
            WHERE studentName = #{oldStudentName}
            """)
    void updateTaskSubmissionStudentName(
            @Param("oldStudentName") String oldStudentName,
            @Param("newStudentName") String newStudentName
    );

    @Update("""
            UPDATE taskAiLog
            SET studentName = #{newStudentName}
            WHERE studentName = #{oldStudentName}
            """)
    void updateTaskAiLogStudentName(
            @Param("oldStudentName") String oldStudentName,
            @Param("newStudentName") String newStudentName
    );

    @Update("""
            UPDATE similarityResult
            SET studentName = #{newStudentName}
            WHERE studentName = #{oldStudentName}
            """)
    void updateSimilarityStudentName(
            @Param("oldStudentName") String oldStudentName,
            @Param("newStudentName") String newStudentName
    );

    @Update("""
            UPDATE similarityResult
            SET targetName = #{newStudentName}
            WHERE targetName = #{oldStudentName}
            """)
    void updateSimilarityTargetName(
            @Param("oldStudentName") String oldStudentName,
            @Param("newStudentName") String newStudentName
    );

    @Update("""
            UPDATE studentRequest
            SET studentName = #{newStudentName}
            WHERE studentName = #{oldStudentName}
            """)
    void updateStudentRequestStudentName(
            @Param("oldStudentName") String oldStudentName,
            @Param("newStudentName") String newStudentName
    );

    @Update("""
            UPDATE student
            SET finalScore = COALESCE((
                SELECT ROUND(AVG(ts.score))
                FROM taskSubmission ts
                WHERE ts.studentName = student.studentName
            ), 0)
            WHERE id = #{studentId}
            """)
    void syncStudentFinalScore(Long studentId);

    @Select("""
            SELECT
                ts.id,
                ts.taskId,
                t.title AS taskTitle,
                t.className,
                ts.submitted,
                ts.submittedAt,
                ts.score
            FROM taskSubmission ts
            JOIN task t ON ts.taskId = t.id
            WHERE ts.studentName = #{studentName}
            ORDER BY ts.taskId ASC
            """)
    List<StudentTaskScoreResponse> findStudentTaskScoresByStudentName(
            @Param("studentName") String studentName
    );

    @Select("""
            SELECT
                ts.id,
                ts.taskId,
                ts.studentName,
                ts.submitted,
                ts.submittedAt,
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM taskAiLog al
                        WHERE al.taskId = ts.taskId
                          AND al.studentName = ts.studentName
                    ) THEN TRUE
                    ELSE FALSE
                END AS aiUsed,
                ts.result,
                ts.content,
                ts.score,
                ts.teacherComment,
                ts.createdAt,
                ts.updatedAt
            FROM taskSubmission ts
            WHERE ts.id = #{submissionId}
            """)
    TaskSubmissionResponse findTaskSubmissionDetailById(Long submissionId);

    @Update("""
            UPDATE taskSubmission
            SET score = #{score},
                updatedAt = NOW()
            WHERE id = #{submissionId}
            """)
    void updateTaskSubmissionScore(
            @Param("submissionId") Long submissionId,
            @Param("score") Integer score
    );

    @Update("""
            UPDATE taskSubmission
            SET
                score = #{score},
                teacherComment = #{teacherComment},
                updatedAt = NOW()
            WHERE id = #{submissionId}
            """)
    void updateTaskSubmissionEvaluation(
            @Param("submissionId") Long submissionId,
            @Param("score") Integer score,
            @Param("teacherComment") String teacherComment
    );

    @Delete("""
            DELETE FROM similarityResult
            WHERE taskId = #{taskId}
            """)
    void deleteSimilarityResultsByTaskId(Long taskId);

    @Insert("""
            INSERT INTO similarityResult (
                taskId,
                studentName,
                targetName,
                comparisonType,
                similarity,
                judge,
                reason,
                studentContent,
                targetContent,
                checkedAt
            ) VALUES (
                #{taskId},
                #{studentName},
                #{targetName},
                #{comparisonType},
                #{similarity},
                #{judge},
                #{reason},
                #{studentContent},
                #{targetContent},
                NOW()
            )
            """)
    void insertSimilarityResult(SimilarityResponse request);

    @Select("""
            SELECT
                sr.id,
                sr.taskId,
                t.title AS taskTitle,
                sr.studentName,
                sr.targetName,
                sr.comparisonType,
                sr.similarity,
                sr.judge,
                sr.reason,
                sr.studentContent,
                sr.targetContent,
                DATE_FORMAT(sr.checkedAt, '%Y-%m-%d %H:%i:%s') AS checkedAt
            FROM similarityResult sr
            JOIN task t ON sr.taskId = t.id
            ORDER BY sr.id DESC
            """)
    List<SimilarityResponse> findAllSimilarityResults();

    @Select("""
            SELECT
                sr.id,
                sr.taskId,
                t.title AS taskTitle,
                sr.studentName,
                sr.targetName,
                sr.comparisonType,
                sr.similarity,
                sr.judge,
                sr.reason,
                sr.studentContent,
                sr.targetContent,
                DATE_FORMAT(sr.checkedAt, '%Y-%m-%d %H:%i:%s') AS checkedAt
            FROM similarityResult sr
            JOIN task t ON sr.taskId = t.id
            WHERE sr.id = #{similarityId}
            """)
    SimilarityResponse findSimilarityResultById(Long similarityId);

    @Update("""
            UPDATE taskSubmission
            SET result = NULL
            WHERE taskId = #{taskId}
            """)
    void clearTaskSubmissionResults(Long taskId);

    @Update("""
            UPDATE taskSubmission
            SET result = #{result},
                updatedAt = NOW()
            WHERE taskId = #{taskId}
              AND studentName = #{studentName}
            """)
    void updateTaskSubmissionResult(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName,
            @Param("result") String result
    );

    @Select("""
            SELECT
                sr.id,
                sr.taskId,
                t.title AS taskTitle,
                sr.studentName,
                sr.targetName,
                sr.comparisonType,
                sr.similarity,
                sr.judge,
                sr.reason,
                sr.studentContent,
                sr.targetContent,
                DATE_FORMAT(sr.checkedAt, '%Y-%m-%d %H:%i:%s') AS checkedAt
            FROM similarityResult sr
            JOIN task t ON sr.taskId = t.id
            WHERE sr.taskId = #{taskId}
              AND sr.studentName = #{studentName}
              AND sr.comparisonType = 'STUDENT_TO_STUDENT'
            ORDER BY sr.similarity DESC, sr.id DESC
            LIMIT 1
            """)
    SimilarityResponse findTopStudentSimilarity(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName
    );

    @Select("""
            SELECT
                sr.id,
                sr.taskId,
                t.title AS taskTitle,
                sr.studentName,
                sr.targetName,
                sr.comparisonType,
                sr.similarity,
                sr.judge,
                sr.reason,
                sr.studentContent,
                sr.targetContent,
                DATE_FORMAT(sr.checkedAt, '%Y-%m-%d %H:%i:%s') AS checkedAt
            FROM similarityResult sr
            JOIN task t ON sr.taskId = t.id
            WHERE sr.taskId = #{taskId}
              AND sr.studentName = #{studentName}
              AND sr.comparisonType = 'STUDENT_TO_AI_LOG'
            ORDER BY sr.similarity DESC, sr.id DESC
            LIMIT 1
            """)
    SimilarityResponse findAiLogSimilarity(
            @Param("taskId") Long taskId,
            @Param("studentName") String studentName
    );

    @Insert("""
            INSERT INTO taskSubmission (
                taskId,
                studentName,
                submitted,
                submittedAt,
                aiUsed,
                result,
                score,
                content,
                teacherComment,
                createdAt,
                updatedAt
            )
            SELECT
                t.id,
                s.studentName,
                FALSE,
                NULL,
                FALSE,
                NULL,
                0,
                NULL,
                NULL,
                NOW(),
                NOW()
            FROM task t
            JOIN student s
              ON t.className = s.className
            LEFT JOIN taskSubmission ts
              ON ts.taskId = t.id
             AND ts.studentName = s.studentName
            WHERE ts.id IS NULL
            """)
    void backfillMissingTaskSubmissions();

    @Update("""
            UPDATE taskSubmission ts
            SET aiUsed = TRUE
            WHERE EXISTS (
                SELECT 1
                FROM taskAiLog al
                WHERE al.taskId = ts.taskId
                  AND al.studentName = ts.studentName
            )
            """)
    void syncAiUsedByLogs();

    @Select("""
        SELECT managed_classes
        FROM users
        WHERE login_id = #{loginId}
          AND role = 'TEACHER'
          AND approved = TRUE
        LIMIT 1
        """)
    String findManagedClassesByLoginId(@Param("loginId") String loginId);
}
