package com.jetrace.backend.adminController;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.jetrace.backend.adminDto.PendingTeacherResponse;
import com.jetrace.backend.adminDto.TeacherProfileChangeRequestResponse;
import com.jetrace.backend.adminDto.DataDeletionRequestResponse;
import com.jetrace.backend.adminService.AdminService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/teachers/pending")
    public List<PendingTeacherResponse> getPendingTeachers() {
        return adminService.getPendingTeachers();
    }

    @PostMapping("/teachers/{loginId}/approve")
    public String approveTeacher(@PathVariable String loginId) {
        adminService.approveTeacher(loginId);
        return "ok";
    }

    @GetMapping("/teacher-profile-changes/pending")
    public List<TeacherProfileChangeRequestResponse> getPendingTeacherProfileChanges() {
        return adminService.getPendingTeacherProfileChanges();
    }

    @PostMapping("/teacher-profile-changes/{id}/approve")
    public String approveTeacherProfileChange(@PathVariable Long id) {
        adminService.approveTeacherProfileChange(id);
        return "ok";
    }

    @PostMapping("/teacher-profile-changes/{id}/reject")
    public String rejectTeacherProfileChange(@PathVariable Long id) {
        adminService.rejectTeacherProfileChange(id);
        return "ok";
    }

    @GetMapping("/data-deletion-requests/pending")
    public List<DataDeletionRequestResponse> getPendingDataDeletionRequests() {
        return adminService.getPendingDataDeletionRequests();
    }

    @PostMapping("/data-deletion-requests/{id}/approve")
    public String approveDataDeletionRequest(@PathVariable Long id) {
        adminService.approveDataDeletionRequest(id);
        return "ok";
    }

    @PostMapping("/data-deletion-requests/{id}/reject")
    public String rejectDataDeletionRequest(@PathVariable Long id) {
        adminService.rejectDataDeletionRequest(id);
        return "ok";
    }
}
