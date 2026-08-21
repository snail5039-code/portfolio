package com.jetrace.backend.adminService;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.jetrace.backend.adminDao.AdminDao;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {
    @Mock private AdminDao adminDao;
    private AdminService service;

    @BeforeEach
    void setUp() { service = new AdminService(adminDao); }

    @Test
    void approvingDeletionRequestDeletesLearningRecordsBeforeClosingRequest() {
        when(adminDao.countPendingDataDeletionRequestById(3L)).thenReturn(1);
        when(adminDao.findDeletionRequestStudentName(3L)).thenReturn("학생1");

        service.approveDataDeletionRequest(3L);

        InOrder order = inOrder(adminDao);
        order.verify(adminDao).deleteSimilarityRecords("학생1");
        order.verify(adminDao).deleteReflectionRecords("학생1");
        order.verify(adminDao).deleteAiLogRecords("학생1");
        order.verify(adminDao).deleteSubmissionRecords("학생1");
        order.verify(adminDao).approveDataDeletionRequest(3L);
    }

    @Test
    void refusesAlreadyProcessedDeletionRequest() {
        when(adminDao.countPendingDataDeletionRequestById(3L)).thenReturn(0);

        assertThrows(RuntimeException.class, () -> service.approveDataDeletionRequest(3L));

        verify(adminDao, never()).deleteAiLogRecords("학생1");
    }
}
