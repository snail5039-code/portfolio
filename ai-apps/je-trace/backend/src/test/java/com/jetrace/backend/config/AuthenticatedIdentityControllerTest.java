package com.jetrace.backend.config;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;

import com.jetrace.backend.studentController.StudentTaskController;
import com.jetrace.backend.studentDto.StudentTaskChatRequest;
import com.jetrace.backend.studentDto.StudentTaskSubmitRequest;
import com.jetrace.backend.studentService.StudentTaskService;
import com.jetrace.backend.teacherController.TaskController;
import com.jetrace.backend.teacherController.TeacherProfileController;
import com.jetrace.backend.teacherDto.TaskCreateRequest;
import com.jetrace.backend.teacherDto.TeacherProfileUpdateRequest;
import com.jetrace.backend.teacherService.TaskService;
import com.jetrace.backend.teacherService.TeacherProfileService;

class AuthenticatedIdentityControllerTest {

    @Test
    void studentChatIgnoresLoginIdInRequestBody() {
        StudentTaskService service = mock(StudentTaskService.class);
        StudentTaskController controller = new StudentTaskController(service);
        StudentTaskChatRequest request = mock(StudentTaskChatRequest.class);
        org.mockito.Mockito.when(request.getQuestion()).thenReturn("질문");

        controller.chat(1L, request, "authenticated-student");

        verify(service).askTaskAi(1L, "authenticated-student", "질문");
    }

    @Test
    void studentSubmissionIgnoresLoginIdInRequestBody() {
        StudentTaskService service = mock(StudentTaskService.class);
        StudentTaskController controller = new StudentTaskController(service);
        StudentTaskSubmitRequest request = mock(StudentTaskSubmitRequest.class);
        org.mockito.Mockito.when(request.getContent()).thenReturn("제출 내용");
        org.mockito.Mockito.when(request.getAiUsed()).thenReturn(true);

        controller.submit(2L, request, "authenticated-student");

        verify(service).submitTask(2L, "authenticated-student", "제출 내용", true);
    }

    @Test
    void taskCreationOverwritesLoginIdWithSessionIdentity() {
        TaskService service = mock(TaskService.class);
        TaskController controller = new TaskController(service);
        TaskCreateRequest request = new TaskCreateRequest();
        request.setLoginId("other-teacher");

        controller.createTask(request, "authenticated-teacher");

        verify(service).createTask(request);
        org.junit.jupiter.api.Assertions.assertEquals("authenticated-teacher", request.getLoginId());
    }

    @Test
    void profileChangeOverwritesLoginIdWithSessionIdentity() {
        TeacherProfileService service = mock(TeacherProfileService.class);
        TeacherProfileController controller = new TeacherProfileController(service);
        TeacherProfileUpdateRequest request = new TeacherProfileUpdateRequest();
        request.setLoginId("other-teacher");

        controller.requestProfileChange(request, "authenticated-teacher");

        verify(service).requestProfileChange(request);
        org.junit.jupiter.api.Assertions.assertEquals("authenticated-teacher", request.getLoginId());
    }
}
