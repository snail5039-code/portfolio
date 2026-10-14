package com.jetrace.backend.adminService;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jetrace.backend.adminDao.AdminDao;
import com.jetrace.backend.adminDto.PendingTeacherResponse;
import com.jetrace.backend.adminDto.TeacherProfileChangeRequestResponse;
import com.jetrace.backend.adminDto.DataDeletionRequestResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final AdminDao adminDao;

    public List<PendingTeacherResponse> getPendingTeachers() {
        return adminDao.findPendingTeachers();
    }

    public List<TeacherProfileChangeRequestResponse> getPendingTeacherProfileChanges() {
        return adminDao.findPendingTeacherProfileChanges();
    }

    public List<DataDeletionRequestResponse> getPendingDataDeletionRequests() {
        return adminDao.findPendingDataDeletionRequests();
    }

    @Transactional
    public void approveDataDeletionRequest(Long id) {
        requirePendingDeletionRequest(id);
        String studentName = adminDao.findDeletionRequestStudentName(id);
        adminDao.deleteSimilarityRecords(studentName);
        adminDao.deleteReflectionRecords(studentName);
        adminDao.deleteAiLogRecords(studentName);
        adminDao.deleteSubmissionRecords(studentName);
        adminDao.approveDataDeletionRequest(id);
    }

    @Transactional
    public void rejectDataDeletionRequest(Long id) {
        requirePendingDeletionRequest(id);
        adminDao.rejectDataDeletionRequest(id);
    }

    private void requirePendingDeletionRequest(Long id) {
        if (id == null || adminDao.countPendingDataDeletionRequestById(id) == 0) {
            throw new RuntimeException("처리 대기 중인 기록 삭제 요청을 찾을 수 없습니다.");
        }
    }

    @Transactional
    public void approveTeacher(String loginId) {
        if (loginId == null || loginId.isBlank()) {
            throw new RuntimeException("교사 로그인 아이디가 필요합니다.");
        }

        int count = adminDao.countTeacherByLoginId(loginId);
        if (count == 0) {
            throw new RuntimeException("해당 교사 계정을 찾을 수 없습니다.");
        }

        adminDao.approveTeacher(loginId);
    }

    @Transactional
    public void approveTeacherProfileChange(Long id) {
        if (id == null) {
            throw new RuntimeException("요청 ID가 필요합니다.");
        }

        int count = adminDao.countPendingTeacherProfileChangeById(id);
        if (count == 0) {
            throw new RuntimeException("승인 대기 중인 교사 정보 수정 요청을 찾을 수 없습니다.");
        }

        adminDao.applyTeacherProfileChange(id);
        adminDao.approveTeacherProfileChange(id);
    }

    @Transactional
    public void rejectTeacherProfileChange(Long id) {
        if (id == null) {
            throw new RuntimeException("요청 ID가 필요합니다.");
        }

        int count = adminDao.countPendingTeacherProfileChangeById(id);
        if (count == 0) {
            throw new RuntimeException("승인 대기 중인 교사 정보 수정 요청을 찾을 수 없습니다.");
        }

        adminDao.rejectTeacherProfileChange(id);
    }
    
}
