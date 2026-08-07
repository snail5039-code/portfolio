package com.jetrace.backend.authService;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jetrace.backend.authDao.AuthDao;
import com.jetrace.backend.authDto.LoginRequestDto;
import com.jetrace.backend.authDto.LoginResponseDto;
import com.jetrace.backend.authDto.SignupRequestDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthDao authDao;

    private static final List<String> ALLOWED_CLASSES = List.of(
            "A",
            "B",
            "C",
            "D"
    );

    public boolean isAvailableLoginId(String loginId) {
        if (loginId == null || loginId.isBlank()) {
            throw new RuntimeException("아이디를 입력하세요.");
        }
        return authDao.countByLoginId(loginId.trim()) == 0;
    }

    @Transactional
    public void signup(SignupRequestDto dto) {
        validateSignup(dto);

        String loginId = dto.getLoginId().trim();
        String email = dto.getEmail().trim();
        String password = dto.getPassword().trim();
        String name = dto.getName().trim();
        String role = dto.getRole().trim();

        if (authDao.countByLoginId(loginId) > 0) {
            throw new RuntimeException("이미 존재하는 아이디입니다.");
        }

        if (authDao.countByEmail(email) > 0) {
            throw new RuntimeException("이미 존재하는 이메일입니다.");
        }

        // 학생/교사 모두 처음에는 승인 전 상태로 저장
        boolean approved = false;

        String className = "STUDENT".equals(role) ? dto.getClassName().trim() : null;
        String subject = "TEACHER".equals(role) ? dto.getSubject().trim() : null;
        String managedClasses = "TEACHER".equals(role)
                ? normalizeManagedClasses(dto.getManagedClasses())
                : null;

        authDao.insertUser(
                loginId,
                email,
                password,
                name,
                role,
                approved,
                className,
                subject,
                managedClasses
        );

        if ("STUDENT".equals(role)) {
            if (authDao.countPendingStudentRequest(name, className) == 0) {
                authDao.insertStudentRequest(name, className);
            }
        }
    }

    public LoginResponseDto login(LoginRequestDto dto) {
        if (dto.getLoginId() == null || dto.getLoginId().isBlank()) {
            throw new RuntimeException("아이디를 입력하세요.");
        }

        if (dto.getPassword() == null || dto.getPassword().isBlank()) {
            throw new RuntimeException("비밀번호를 입력하세요.");
        }

        LoginResponseDto user = authDao.findLoginUser(dto.getLoginId().trim(), dto.getPassword().trim());

        if (user == null) {
            return new LoginResponseDto(
                    false,
                    "아이디 또는 비밀번호가 올바르지 않습니다.",
                    null,
                    null,
                    null,
                    false,
                    null,
                    null,
                    null
            );
        }

        if (!user.isApproved()) {
            if ("TEACHER".equals(user.getRole())) {
                return new LoginResponseDto(
                        false,
                        "관리자 승인 후 교사 로그인이 가능합니다.",
                        null,
                        null,
                        null,
                        false,
                        null,
                        null,
                        null
                );
            }

            return new LoginResponseDto(
                    false,
                    "아직 승인되지 않은 계정입니다.",
                    null,
                    null,
                    null,
                    false,
                    null,
                    null,
                    null
            );
        }

        user.setSuccess(true);
        user.setMessage("로그인 성공");
        return user;
    }

    private void validateSignup(SignupRequestDto dto) {
        if (dto.getLoginId() == null || dto.getLoginId().isBlank()) {
            throw new RuntimeException("아이디는 필수입니다.");
        }

        if (dto.getEmail() == null || dto.getEmail().isBlank()) {
            throw new RuntimeException("이메일은 필수입니다.");
        }

        if (dto.getPassword() == null || dto.getPassword().isBlank()) {
            throw new RuntimeException("비밀번호는 필수입니다.");
        }

        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new RuntimeException("이름은 필수입니다.");
        }

        if (dto.getRole() == null || dto.getRole().isBlank()) {
            throw new RuntimeException("회원 유형은 필수입니다.");
        }

        String role = dto.getRole().trim();

        if (!"STUDENT".equals(role) && !"TEACHER".equals(role)) {
            throw new RuntimeException("잘못된 회원 유형입니다.");
        }

        if ("STUDENT".equals(role)) {
            if (dto.getClassName() == null || dto.getClassName().isBlank()) {
                throw new RuntimeException("반 선택은 필수입니다.");
            }

            String className = dto.getClassName().trim();

            if (!ALLOWED_CLASSES.contains(className)) {
                throw new RuntimeException("허용되지 않은 반 정보입니다.");
            }
        }

        if ("TEACHER".equals(role)) {
            if (dto.getSubject() == null || dto.getSubject().isBlank()) {
                throw new RuntimeException("담당 과목 입력은 필수입니다.");
            }

            String subject = dto.getSubject().trim();

            if (subject.length() > 50) {
                throw new RuntimeException("담당 과목은 50자 이내로 입력해주세요.");
            }

            String normalizedManagedClasses = normalizeManagedClasses(dto.getManagedClasses());
            if (normalizedManagedClasses.isBlank()) {
                throw new RuntimeException("관리 반 선택은 필수입니다.");
            }

            for (String className : normalizedManagedClasses.split(",")) {
                if (!ALLOWED_CLASSES.contains(className)) {
                    throw new RuntimeException("허용되지 않은 관리 반 정보입니다.");
                }
            }
        }
    }

    private String normalizeManagedClasses(String managedClasses) {
        if (managedClasses == null || managedClasses.isBlank()) {
            return "";
        }

        return Arrays.stream(managedClasses.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .collect(Collectors.joining(","));
    }
}