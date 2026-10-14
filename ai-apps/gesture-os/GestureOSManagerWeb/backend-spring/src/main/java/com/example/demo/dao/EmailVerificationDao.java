package com.example.demo.dao;

import org.apache.ibatis.annotations.*;
import java.time.LocalDateTime;

@Mapper
public interface EmailVerificationDao {

    @Insert("""
            INSERT INTO email_verification (email, code, expired_at, regDate)
            VALUES (#{email}, #{code}, #{expiredAt}, NOW())
            """)
    void insertVerification(@Param("email") String email, @Param("code") String code, @Param("expiredAt") LocalDateTime expiredAt);

    @Select("""
            SELECT COUNT(*) > 0
            FROM email_verification
            WHERE email = #{email} AND code = #{code} AND expired_at > NOW() AND verified = FALSE
            """)
    boolean isValidCode(@Param("email") String email, @Param("code") String code);

    @Update("""
            UPDATE email_verification
            SET verified = TRUE
            WHERE email = #{email} AND code = #{code}
            """)
    void markAsVerified(@Param("email") String email, @Param("code") String code);

    @Select("""
            SELECT COUNT(*) > 0
            FROM email_verification
            WHERE email = #{email} AND verified = TRUE AND regDate > (NOW() - INTERVAL '1 hour')
            """)
    boolean isEmailVerified(@Param("email") String email);

    @Delete("""
            DELETE FROM email_verification
            WHERE email = #{email}
            """)
    void deleteByEmail(@Param("email") String email);
}
