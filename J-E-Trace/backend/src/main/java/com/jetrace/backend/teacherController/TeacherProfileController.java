package com.jetrace.backend.teacherController;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.jetrace.backend.teacherDto.TeacherProfileResponse;
import com.jetrace.backend.teacherDto.TeacherProfileUpdateRequest;
import com.jetrace.backend.teacherService.TeacherProfileService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/teacher/profile")
public class TeacherProfileController {

    private final TeacherProfileService teacherProfileService;

    @GetMapping
    public TeacherProfileResponse getProfile(@RequestParam String loginId) {
        return teacherProfileService.getProfile(loginId);
    }

    @PostMapping("/change-request")
    public String requestProfileChange(@RequestBody TeacherProfileUpdateRequest request) {
        teacherProfileService.requestProfileChange(request);
        return "ok";
    }
}