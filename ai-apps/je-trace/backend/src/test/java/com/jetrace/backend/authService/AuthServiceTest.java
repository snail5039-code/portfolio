package com.jetrace.backend.authService;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.jetrace.backend.authDao.AuthDao;
import com.jetrace.backend.authDto.LoginRequestDto;
import com.jetrace.backend.authDto.LoginResponseDto;
import com.jetrace.backend.authDto.PasswordChangeRequest;
import com.jetrace.backend.authDto.SignupRequestDto;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AuthDao authDao;

    private PasswordEncoder passwordEncoder;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder(4);
        authService = new AuthService(authDao, passwordEncoder);
    }

    @Test
    void signupStoresBcryptPasswordInsteadOfPlainText() {
        SignupRequestDto request = new SignupRequestDto(
                "student1", "student1@example.com", "secret123", "학생", "STUDENT", "A", null, null
        );
        ArgumentCaptor<String> passwordCaptor = ArgumentCaptor.forClass(String.class);

        authService.signup(request);

        verify(authDao).insertUser(
                eq("student1"),
                eq("student1@example.com"),
                passwordCaptor.capture(),
                eq("학생"),
                eq("STUDENT"),
                eq(false),
                eq("A"),
                isNull(),
                isNull()
        );
        String storedPassword = passwordCaptor.getValue();
        assertNotEquals("secret123", storedPassword);
        assertTrue(passwordEncoder.matches("secret123", storedPassword));
        verify(authDao).insertStudentRequest("학생", "A");
    }

    @Test
    void teacherSignupStoresTeacherFieldsAndNormalizesManagedClasses() {
        SignupRequestDto request = new SignupRequestDto(
                "teacher1", "teacher1@example.com", "secret123", "교사", "TEACHER",
                null, "수학", " A, B, A "
        );

        authService.signup(request);

        verify(authDao).insertUser(
                eq("teacher1"), eq("teacher1@example.com"), anyString(), eq("교사"),
                eq("TEACHER"), eq(false), isNull(), eq("수학"), eq("A,B")
        );
        verify(authDao, never()).insertStudentRequest(anyString(), anyString());
    }

    @Test
    void signupRejectsDuplicateLoginId() {
        SignupRequestDto request = studentSignup();
        when(authDao.countByLoginId("student1")).thenReturn(1);

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> authService.signup(request));

        assertEquals("이미 존재하는 아이디입니다.", exception.getMessage());
        verify(authDao, never()).insertUser(
                anyString(), anyString(), anyString(), anyString(), anyString(),
                eq(false), anyString(), anyString(), anyString()
        );
    }

    @Test
    void signupRejectsDuplicateEmail() {
        SignupRequestDto request = studentSignup();
        when(authDao.countByEmail("student1@example.com")).thenReturn(1);

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> authService.signup(request));

        assertEquals("이미 존재하는 이메일입니다.", exception.getMessage());
    }

    @Test
    void loginAcceptsCorrectBcryptPassword() {
        String hash = passwordEncoder.encode("secret123");
        when(authDao.findPasswordByLoginId("teacher1")).thenReturn(hash);
        when(authDao.findLoginUser("teacher1")).thenReturn(approvedTeacher());

        LoginResponseDto response = authService.login(new LoginRequestDto("teacher1", "secret123"));

        assertTrue(response.isSuccess());
        verify(authDao, never()).updatePassword(anyString(), anyString());
    }

    @Test
    void loginRejectsWrongPassword() {
        when(authDao.findPasswordByLoginId("teacher1")).thenReturn(passwordEncoder.encode("correct"));

        LoginResponseDto response = authService.login(new LoginRequestDto("teacher1", "wrong"));

        assertFalse(response.isSuccess());
        verify(authDao, never()).findLoginUser(anyString());
        verify(authDao, never()).updatePassword(anyString(), anyString());
    }

    @Test
    void loginRejectsStudentBeforeApproval() {
        when(authDao.findPasswordByLoginId("student1"))
                .thenReturn(passwordEncoder.encode("secret123"));
        when(authDao.findLoginUser("student1")).thenReturn(new LoginResponseDto(
                false, null, "student1", "학생", "STUDENT", false, "A", null, null
        ));

        LoginResponseDto response = authService.login(
                new LoginRequestDto("student1", "secret123")
        );

        assertFalse(response.isSuccess());
        assertEquals("아직 승인되지 않은 계정입니다.", response.getMessage());
    }

    @Test
    void loginRejectsTeacherBeforeAdministratorApproval() {
        when(authDao.findPasswordByLoginId("teacher1"))
                .thenReturn(passwordEncoder.encode("secret123"));
        when(authDao.findLoginUser("teacher1")).thenReturn(new LoginResponseDto(
                false, null, "teacher1", "교사", "TEACHER", false, null, "수학", "A"
        ));

        LoginResponseDto response = authService.login(
                new LoginRequestDto("teacher1", "secret123")
        );

        assertFalse(response.isSuccess());
        assertEquals("관리자 승인 후 교사 로그인이 가능합니다.", response.getMessage());
    }

    @Test
    void loginMigratesMatchingLegacyPlainTextPassword() {
        when(authDao.findPasswordByLoginId("legacy-user")).thenReturn("legacy-password");
        when(authDao.findLoginUser("legacy-user")).thenReturn(approvedTeacher());
        ArgumentCaptor<String> passwordCaptor = ArgumentCaptor.forClass(String.class);

        LoginResponseDto response = authService.login(
                new LoginRequestDto("legacy-user", "legacy-password")
        );

        assertTrue(response.isSuccess());
        verify(authDao).updatePassword(eq("legacy-user"), passwordCaptor.capture());
        assertTrue(passwordEncoder.matches("legacy-password", passwordCaptor.getValue()));
    }

    @Test
    void changePasswordVerifiesCurrentPasswordAndStoresNewHash() {
        when(authDao.findPasswordByLoginId("admin1"))
                .thenReturn(passwordEncoder.encode("current-password"));
        PasswordChangeRequest request = new PasswordChangeRequest();
        request.setCurrentPassword("current-password");
        request.setNewPassword("new-secure-password");
        ArgumentCaptor<String> passwordCaptor = ArgumentCaptor.forClass(String.class);

        authService.changePassword("admin1", request);

        verify(authDao).updatePassword(eq("admin1"), passwordCaptor.capture());
        assertTrue(passwordEncoder.matches("new-secure-password", passwordCaptor.getValue()));
    }

    @Test
    void changePasswordRejectsWrongCurrentPassword() {
        when(authDao.findPasswordByLoginId("admin1"))
                .thenReturn(passwordEncoder.encode("current-password"));
        PasswordChangeRequest request = new PasswordChangeRequest();
        request.setCurrentPassword("wrong-password");
        request.setNewPassword("new-secure-password");

        org.junit.jupiter.api.Assertions.assertThrows(
                RuntimeException.class,
                () -> authService.changePassword("admin1", request)
        );

        verify(authDao, never()).updatePassword(anyString(), anyString());
    }

    private LoginResponseDto approvedTeacher() {
        return new LoginResponseDto(
                false, null, "teacher1", "교사", "TEACHER", true, null, "수학", "A"
        );
    }

    private SignupRequestDto studentSignup() {
        return new SignupRequestDto(
                "student1", "student1@example.com", "secret123", "학생", "STUDENT",
                "A", null, null
        );
    }
}
