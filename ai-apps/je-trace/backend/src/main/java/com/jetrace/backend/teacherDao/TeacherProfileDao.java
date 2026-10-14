package com.jetrace.backend.teacherDao;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.jetrace.backend.teacherDto.TeacherProfileResponse;

@Mapper
public interface TeacherProfileDao {

    @Select("""
        SELECT
            login_id AS loginId,
            name,
            email,
            subject,
            managed_classes AS managedClasses
        FROM users
        WHERE login_id = #{loginId}
          AND role = 'TEACHER'
        LIMIT 1
    """)
    TeacherProfileResponse findTeacherProfile(@Param("loginId") String loginId);

    @Select("""
        SELECT COUNT(*)
        FROM teacherProfileChangeRequest
        WHERE loginId = #{loginId}
          AND status = 'PENDING'
    """)
    int countPendingChangeRequest(@Param("loginId") String loginId);

    @Insert("""
        INSERT INTO teacherProfileChangeRequest (
            loginId,
            name,
            subject,
            managedClasses,
            status
        ) VALUES (
            #{loginId},
            #{name},
            #{subject},
            #{managedClasses},
            'PENDING'
        )
    """)
    void insertChangeRequest(
        @Param("loginId") String loginId,
        @Param("name") String name,
        @Param("subject") String subject,
        @Param("managedClasses") String managedClasses
    );
}