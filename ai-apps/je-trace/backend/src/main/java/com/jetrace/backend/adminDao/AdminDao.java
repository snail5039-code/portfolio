package com.jetrace.backend.adminDao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.jetrace.backend.adminDto.PendingTeacherResponse;
import com.jetrace.backend.adminDto.TeacherProfileChangeRequestResponse;
import com.jetrace.backend.adminDto.DataDeletionRequestResponse;

@Mapper
public interface AdminDao {

    @Select("""
        SELECT
            login_id AS loginId,
            email,
            name,
            approved,
            subject,
            managed_classes AS managedClasses,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
        FROM users
        WHERE role = 'TEACHER'
          AND approved = FALSE
        ORDER BY created_at ASC
    """)
    List<PendingTeacherResponse> findPendingTeachers();

    @Select("""
        SELECT COUNT(*)
        FROM users
        WHERE login_id = #{loginId}
          AND role = 'TEACHER'
    """)
    int countTeacherByLoginId(@Param("loginId") String loginId);

    @Update("""
        UPDATE users
        SET approved = TRUE
        WHERE login_id = #{loginId}
          AND role = 'TEACHER'
    """)
    void approveTeacher(@Param("loginId") String loginId);

    @Select("""
        SELECT
            id,
            loginId,
            name,
            subject,
            managedClasses,
            status,
            DATE_FORMAT(requestedAt, '%Y-%m-%d %H:%i:%s') AS requestedAt
        FROM teacherProfileChangeRequest
        WHERE status = 'PENDING'
        ORDER BY requestedAt ASC
    """)
    List<TeacherProfileChangeRequestResponse> findPendingTeacherProfileChanges();

    @Select("""
        SELECT COUNT(*)
        FROM teacherProfileChangeRequest
        WHERE id = #{id}
          AND status = 'PENDING'
    """)
    int countPendingTeacherProfileChangeById(@Param("id") Long id);

    @Update("""
        UPDATE users u
        JOIN teacherProfileChangeRequest r
          ON u.login_id = r.loginId
        SET
          u.name = r.name,
          u.subject = r.subject,
          u.managed_classes = r.managedClasses
        WHERE r.id = #{id}
          AND r.status = 'PENDING'
          AND u.role = 'TEACHER'
    """)
    void applyTeacherProfileChange(@Param("id") Long id);

    @Update("""
        UPDATE teacherProfileChangeRequest
        SET status = 'APPROVED',
            processedAt = NOW()
        WHERE id = #{id}
          AND status = 'PENDING'
    """)
    void approveTeacherProfileChange(@Param("id") Long id);

    @Update("""
        UPDATE teacherProfileChangeRequest
        SET status = 'REJECTED',
            processedAt = NOW()
        WHERE id = #{id}
          AND status = 'PENDING'
    """)
    void rejectTeacherProfileChange(@Param("id") Long id);

    @Select("SELECT id, loginId, studentName, reason, status, DATE_FORMAT(requestedAt, '%Y-%m-%d %H:%i:%s') AS requestedAt FROM dataDeletionRequest WHERE status = 'PENDING' ORDER BY requestedAt ASC")
    List<DataDeletionRequestResponse> findPendingDataDeletionRequests();

    @Select("SELECT COUNT(*) FROM dataDeletionRequest WHERE id = #{id} AND status = 'PENDING'")
    int countPendingDataDeletionRequestById(@Param("id") Long id);

    @Select("SELECT studentName FROM dataDeletionRequest WHERE id = #{id} AND status = 'PENDING'")
    String findDeletionRequestStudentName(@Param("id") Long id);

    @org.apache.ibatis.annotations.Delete("DELETE FROM similarityResult WHERE studentName = #{studentName} OR targetName = #{studentName}")
    void deleteSimilarityRecords(@Param("studentName") String studentName);

    @org.apache.ibatis.annotations.Delete("DELETE FROM taskReflection WHERE studentName = #{studentName}")
    void deleteReflectionRecords(@Param("studentName") String studentName);

    @org.apache.ibatis.annotations.Delete("DELETE FROM taskAiLog WHERE studentName = #{studentName}")
    void deleteAiLogRecords(@Param("studentName") String studentName);

    @org.apache.ibatis.annotations.Delete("DELETE FROM taskSubmission WHERE studentName = #{studentName}")
    void deleteSubmissionRecords(@Param("studentName") String studentName);

    @Update("UPDATE dataDeletionRequest SET status = 'APPROVED', processedAt = NOW() WHERE id = #{id} AND status = 'PENDING'")
    void approveDataDeletionRequest(@Param("id") Long id);

    @Update("UPDATE dataDeletionRequest SET status = 'REJECTED', processedAt = NOW() WHERE id = #{id} AND status = 'PENDING'")
    void rejectDataDeletionRequest(@Param("id") Long id);
}
