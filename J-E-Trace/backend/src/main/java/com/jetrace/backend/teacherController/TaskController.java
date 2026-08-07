package com.jetrace.backend.teacherController;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.jetrace.backend.teacherDto.SimilarityResponse;
import com.jetrace.backend.teacherDto.StudentRequestResponse;
import com.jetrace.backend.teacherDto.StudentResponse;
import com.jetrace.backend.teacherDto.StudentTaskScoreResponse;
import com.jetrace.backend.teacherDto.TaskAiLogResponse;
import com.jetrace.backend.teacherDto.TaskCreateRequest;
import com.jetrace.backend.teacherDto.TaskResponse;
import com.jetrace.backend.teacherDto.TaskSubmissionResponse;
import com.jetrace.backend.teacherService.TaskService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/teacher/tasks")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class TaskController {

    private final TaskService taskService;

    @PostMapping
    public String createTask(@RequestBody TaskCreateRequest request) {
        taskService.createTask(request);
        return "ok";
    }

    @GetMapping
    public List<TaskResponse> getTaskList(@RequestParam String loginId) {
        return taskService.getTaskList(loginId);
    }

    @GetMapping("/{taskId}")
    public TaskResponse getTaskDetail(
            @PathVariable Long taskId,
            @RequestParam String loginId) {
        return taskService.getTaskDetail(loginId, taskId);
    }

    @GetMapping("/{taskId}/taskSubmissions")
    public List<TaskSubmissionResponse> getTaskSubmissions(
            @PathVariable Long taskId,
            @RequestParam String loginId) {
        return taskService.getTaskSubmissions(loginId, taskId);
    }

    @GetMapping("/{taskId}/logs")
    public List<TaskAiLogResponse> getTaskAiLogs(
            @PathVariable Long taskId,
            @RequestParam String loginId,
            @RequestParam String studentName) {
        return taskService.getTaskAiLogs(loginId, taskId, studentName);
    }

    @GetMapping("/studentRequests")
    public List<StudentRequestResponse> getPendingStudentRequests(@RequestParam String loginId) {
        return taskService.getPendingStudentRequests(loginId);
    }

    @PostMapping("/studentRequests/{requestId}/approve")
    public String approveStudentRequest(
            @PathVariable Long requestId,
            @RequestParam String loginId) {
        taskService.approveStudentRequest(loginId, requestId);
        return "ok";
    }

    @PostMapping("/studentRequests/{requestId}/reject")
    public String rejectStudentRequest(
            @PathVariable Long requestId,
            @RequestParam String loginId) {
        taskService.rejectStudentRequest(loginId, requestId);
        return "ok";
    }

    @GetMapping("/students")
    public List<StudentResponse> getStudentList(@RequestParam String loginId) {
        return taskService.getStudentList(loginId);
    }

    @GetMapping("/students/{studentId}")
    public StudentResponse getStudentDetail(
            @PathVariable Long studentId,
            @RequestParam String loginId) {
        return taskService.getStudentDetail(loginId, studentId);
    }

    @PutMapping("/students/{studentId}")
    public String updateStudentInfo(
            @PathVariable Long studentId,
            @RequestParam String loginId,
            @RequestBody StudentResponse request) {
        taskService.updateStudentInfo(loginId, studentId, request);
        return "ok";
    }

    @GetMapping("/students/{studentId}/taskScores")
    public List<StudentTaskScoreResponse> getStudentTaskScores(
            @PathVariable Long studentId,
            @RequestParam String loginId) {
        return taskService.getStudentTaskScores(loginId, studentId);
    }

    @PutMapping("/students/{studentId}/taskScores/{submissionId}")
    public String updateStudentTaskScore(
            @PathVariable Long studentId,
            @PathVariable Long submissionId,
            @RequestParam String loginId,
            @RequestBody Map<String, Integer> request) {
        taskService.updateStudentTaskScore(loginId, studentId, submissionId, request.get("score"));
        return "ok";
    }

    @GetMapping("/submissions/{submissionId}")
    public TaskSubmissionResponse getTaskSubmissionDetail(
            @PathVariable Long submissionId,
            @RequestParam String loginId) {
        return taskService.getTaskSubmissionDetail(loginId, submissionId);
    }

    @PutMapping("/submissions/{submissionId}/evaluation")
    public String updateTaskSubmissionEvaluation(
            @PathVariable Long submissionId,
            @RequestParam String loginId,
            @RequestBody TaskSubmissionResponse request) {
        taskService.updateTaskSubmissionEvaluation(loginId, submissionId, request);
        return "ok";
    }

    @PostMapping("/{taskId}/similarity/run")
    public String runSimilarityAnalysis(
            @PathVariable Long taskId,
            @RequestParam String loginId) {
        taskService.runSimilarityAnalysis(loginId, taskId);
        return "ok";
    }

    @GetMapping("/similarity")
    public List<SimilarityResponse> getSimilarityResults(@RequestParam String loginId) {
        return taskService.getSimilarityResults(loginId);
    }

    @GetMapping("/similarity/{similarityId}")
    public SimilarityResponse getSimilarityResultDetail(
            @PathVariable Long similarityId,
            @RequestParam String loginId) {
        return taskService.getSimilarityResultDetail(loginId, similarityId);
    }

    @PostMapping("/maintenance/backfill")
    public String backfillSystemData() {
        taskService.backfillSystemData();
        return "ok";
    }
}