package com.jetrace.backend.teacherService;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jetrace.backend.teacherDao.TeacherProfileDao;
import com.jetrace.backend.teacherDto.TeacherProfileResponse;
import com.jetrace.backend.teacherDto.TeacherProfileUpdateRequest;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TeacherProfileService {

    private final TeacherProfileDao teacherProfileDao;

    private static final List<String> ALLOWED_CLASSES = List.of("A", "B", "C", "D");
    private static final List<String> ALLOWED_SUBJECTS = List.of("정보처리", "국어", "영어", "수학", "사회", "과학");

    public TeacherProfileResponse getProfile(String loginId) {
        if (loginId == null || loginId.isBlank()) {
            throw new RuntimeException("교사 로그인 아이디가 필요합니다.");
        }

        TeacherProfileResponse profile = teacherProfileDao.findTeacherProfile(loginId);
        if (profile == null) {
            throw new RuntimeException("교사 정보를 찾을 수 없습니다.");
        }

        return profile;
    }

    @Transactional
    public void requestProfileChange(TeacherProfileUpdateRequest request) {
        if (request.getLoginId() == null || request.getLoginId().isBlank()) {
            throw new RuntimeException("교사 로그인 아이디가 필요합니다.");
        }

        if (request.getName() == null || request.getName().isBlank()) {
            throw new RuntimeException("이름은 필수입니다.");
        }

        if (request.getSubject() == null || request.getSubject().isBlank()) {
            throw new RuntimeException("담당 과목 선택은 필수입니다.");
        }

        if (request.getSubject() == null || request.getSubject().isBlank()) {
            throw new RuntimeException("담당 과목 입력은 필수입니다.");
        }

        String managedClasses = normalizeManagedClasses(request.getManagedClasses());
        if (managedClasses.isBlank()) {
            throw new RuntimeException("관리 반 선택은 필수입니다.");
        }

        for (String className : managedClasses.split(",")) {
            if (!ALLOWED_CLASSES.contains(className)) {
                throw new RuntimeException("허용되지 않은 관리 반 정보입니다.");
            }
        }

        TeacherProfileResponse currentProfile = teacherProfileDao.findTeacherProfile(request.getLoginId());
        if (currentProfile == null) {
            throw new RuntimeException("교사 정보를 찾을 수 없습니다.");
        }

        if (teacherProfileDao.countPendingChangeRequest(request.getLoginId()) > 0) {
            throw new RuntimeException("이미 승인 대기 중인 정보 수정 요청이 있습니다.");
        }

        teacherProfileDao.insertChangeRequest(
                request.getLoginId(),
                request.getName().trim(),
                request.getSubject().trim(),
                managedClasses
        );
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
