package com.jetrace.backend.studentController;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.SessionAttribute;
import org.springframework.web.bind.annotation.RestController;

import com.jetrace.backend.studentDto.ChatResponseDto;
import com.jetrace.backend.studentDto.StudentMyPageSummaryResponse;
import com.jetrace.backend.studentDto.StudentTaskChatRequest;
import com.jetrace.backend.studentDto.StudentTaskDetailResponse;
import com.jetrace.backend.studentDto.StudentTaskResponse;
import com.jetrace.backend.studentDto.StudentTaskSubmitRequest;
import com.jetrace.backend.studentDto.StudentReflectionResponse;
import com.jetrace.backend.studentService.StudentTaskService;
import com.jetrace.backend.config.SessionAuthInterceptor;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/student/tasks")
public class StudentTaskController {

    private final StudentTaskService studentTaskService;

    @GetMapping
    public List<StudentTaskResponse> getTasks(
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId) {
        return studentTaskService.getTasks(loginId);
    }

    @GetMapping("/summary")
    public StudentMyPageSummaryResponse getMyPageSummary(
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId) {
        return studentTaskService.getMyPageSummary(loginId);
    }

    @GetMapping("/{taskId}")
    public StudentTaskDetailResponse getTaskDetail(
            @PathVariable Long taskId,
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId
    ) {
        return studentTaskService.getTaskDetail(taskId, loginId);
    }

    @PostMapping("/{taskId}/chat")
    public ChatResponseDto chat(
            @PathVariable Long taskId,
            @RequestBody StudentTaskChatRequest request,
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId
    ) {
        return studentTaskService.askTaskAi(taskId, loginId, request.getQuestion());
    }

    @PutMapping("/{taskId}/submit")
    public String submit(
            @PathVariable Long taskId,
            @RequestBody StudentTaskSubmitRequest request,
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId
    ) {
        studentTaskService.submitTask(taskId, loginId, request.getContent(), request.getAiUsed());
        return "ok";
    }

    @GetMapping("/{taskId}/reflection")
    public StudentReflectionResponse getReflection(
            @PathVariable Long taskId,
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId) {
        return studentTaskService.getReflection(taskId, loginId);
    }

    @PutMapping("/{taskId}/reflection")
    public StudentReflectionResponse saveReflection(
            @PathVariable Long taskId,
            @RequestBody StudentReflectionResponse reflection,
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId) {
        return studentTaskService.saveReflection(taskId, loginId, reflection);
    }

    @PutMapping("/feedback/{submissionId}/read")
    public String markFeedbackRead(
            @PathVariable Long submissionId,
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId) {
        studentTaskService.markFeedbackRead(submissionId, loginId);
        return "ok";
    }

    @GetMapping("/privacy/export")
    public Map<String, Object> exportMyRecords(
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId) {
        return studentTaskService.exportMyRecords(loginId);
    }

    @PostMapping("/privacy/deletion-request")
    public String requestDataDeletion(
            @RequestBody(required = false) Map<String, String> request,
            @SessionAttribute(SessionAuthInterceptor.LOGIN_ID) String loginId) {
        studentTaskService.requestDataDeletion(loginId, request == null ? null : request.get("reason"));
        return "ok";
    }
}
