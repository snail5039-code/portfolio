package com.jetrace.backend.authDao;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.jetrace.backend.authDto.LoginResponseDto;

@Mapper
public interface AuthDao {

    @Select("""
        SELECT COUNT(*)
        FROM users
        WHERE login_id = #{loginId}
    """)
    int countByLoginId(String loginId);

    @Select("""
        SELECT COUNT(*)
        FROM users
        WHERE email = #{email}
    """)
    int countByEmail(String email);

    @Insert("""
        INSERT INTO users (
            login_id,
            email,
            password,
            name,
            role,
            approved,
            class_name,
            subject,
            managed_classes
        ) VALUES (
            #{loginId},
            #{email},
            #{password},
            #{name},
            #{role},
            #{approved},
            #{className},
            #{subject},
            #{managedClasses}
        )
    """)
    void insertUser(
            @Param("loginId") String loginId,
            @Param("email") String email,
            @Param("password") String password,
            @Param("name") String name,
            @Param("role") String role,
            @Param("approved") boolean approved,
            @Param("className") String className,
            @Param("subject") String subject,
            @Param("managedClasses") String managedClasses
    );

    @Select("""
        SELECT
            login_id AS loginId,
            name,
            role,
            approved,
            class_name AS className,
            subject,
            managed_classes AS managedClasses
        FROM users
        WHERE login_id = #{loginId}
          AND password = #{password}
        LIMIT 1
    """)
    LoginResponseDto findLoginUser(
            @Param("loginId") String loginId,
            @Param("password") String password
    );

    @Select("""
        SELECT COUNT(*)
        FROM studentRequest
        WHERE studentName = #{studentName}
          AND className = #{className}
          AND status = 'PENDING'
    """)
    int countPendingStudentRequest(
            @Param("studentName") String studentName,
            @Param("className") String className
    );

    @Insert("""
        INSERT INTO studentRequest (studentName, className, status)
        VALUES (#{studentName}, #{className}, 'PENDING')
    """)
    void insertStudentRequest(
            @Param("studentName") String studentName,
            @Param("className") String className
    );
}