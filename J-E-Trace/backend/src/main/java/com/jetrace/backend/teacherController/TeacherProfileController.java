package com.jetrace.backend.teacherController;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.SessionAttribute;
import org.springframework.web.bind.annotation.RestController;

import com.jetrace.backend.teacherDto.TeacherProfileResponse;
import com.jetrace.backend.teacherDto.TeacherProfileUpdateRequest;
import com.jetrace.backend.teacherService.TeacherProfileService;
import com.jetrace.backend.config.SessionAuthInterceptor;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/teacher/profile")
public class TeacherProfileController {

    private final TeacherProfileService teacherProfileService;

    @GetMapping
    public TeacherProfileResponse getProfile(
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId) {
        return teacherProfileService.getProfile(loginId);
    }

    @PostMapping("/change-request")
    public String requestProfileChange(
            @RequestBody TeacherProfileUpdateRequest request,
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId) {
        request.setLoginId(loginId);
        teacherProfileService.requestProfileChange(request);
        return "ok";
    }
}
