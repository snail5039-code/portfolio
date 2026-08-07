package com.jetrace.backend.studentDao;

import java.util.List;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.jetrace.backend.studentDto.StudentMyPageSummaryResponse;
import com.jetrace.backend.studentDto.StudentTaskDetailResponse;
import com.jetrace.backend.studentDto.StudentTaskLogResponse;
import com.jetrace.backend.studentDto.StudentTaskResponse;

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
            t.description,
            t.dueDate,
            t.aiAllowed,
            ts.id AS submissionId,
            COALESCE(ts.submitted, FALSE) AS submitted,
            ts.submittedAt,
            COALESCE(ts.aiUsed, FALSE) AS aiUsed,
            ts.content,
            ts.score,
            ts.teacherComment
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
        SET submitted = TRUE,
            submittedAt = NOW(),
            aiUsed = #{aiUsed},
            content = #{content},
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
