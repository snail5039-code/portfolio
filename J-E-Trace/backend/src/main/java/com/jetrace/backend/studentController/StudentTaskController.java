package com.jetrace.backend.studentController;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.jetrace.backend.studentDto.ChatResponseDto;
import com.jetrace.backend.studentDto.StudentMyPageSummaryResponse;
import com.jetrace.backend.studentDto.StudentTaskChatRequest;
import com.jetrace.backend.studentDto.StudentTaskDetailResponse;
import com.jetrace.backend.studentDto.StudentTaskResponse;
import com.jetrace.backend.studentDto.StudentTaskSubmitRequest;
import com.jetrace.backend.studentService.StudentTaskService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping("/student/tasks")
public class StudentTaskController {

    private final StudentTaskService studentTaskService;

    @GetMapping
    public List<StudentTaskResponse> getTasks(@RequestParam String loginId) {
        return studentTaskService.getTasks(loginId);
    }

    @GetMapping("/summary")
    public StudentMyPageSummaryResponse getMyPageSummary(@RequestParam String loginId) {
        return studentTaskService.getMyPageSummary(loginId);
    }

    @GetMapping("/{taskId}")
    public StudentTaskDetailResponse getTaskDetail(
            @PathVariable Long taskId,
            @RequestParam String loginId
    ) {
        return studentTaskService.getTaskDetail(taskId, loginId);
    }

    @PostMapping("/{taskId}/chat")
    public ChatResponseDto chat(
            @PathVariable Long taskId,
            @RequestBody StudentTaskChatRequest request
    ) {
        return studentTaskService.askTaskAi(taskId, request.getLoginId(), request.getQuestion());
    }

    @PutMapping("/{taskId}/submit")
    public String submit(
            @PathVariable Long taskId,
            @RequestBody StudentTaskSubmitRequest request
    ) {
        studentTaskService.submitTask(taskId, request.getLoginId(), request.getContent(), request.getAiUsed());
        return "ok";
    }
}