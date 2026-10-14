package com.example.demo.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.demo.dao.MemberDao;
import com.example.demo.dao.ProjectDao;
import com.example.demo.dao.WorkLogCollaboratorDao;
import com.example.demo.dao.WorkLogDao;
import com.example.demo.dao.TeamDao;
import com.example.demo.dto.WorkLog;

@ExtendWith(MockitoExtension.class)
class WorkLogServiceValidationTest {

    @Mock WorkLogDao workLogDao;
    @Mock FileAttachService fileAttachService;
    @Mock WorkReplyService workReplyService;
    @Mock WorkLogCollaboratorDao collaboratorDao;
    @Mock ProjectDao projectDao;
    @Mock MemberDao memberDao;
    @Mock TeamDao teamDao;
    @Mock WorkspacePermissionService workspacePermissionService;

    private WorkLogService service;

    @BeforeEach
    void setUp() {
        service = new WorkLogService(workLogDao, fileAttachService, workReplyService,
                collaboratorDao, projectDao, memberDao, teamDao, workspacePermissionService);
    }

    @Test
    void acceptsValidStructuredFields() {
        WorkLog data = new WorkLog();
        data.setProjectId(10);
        data.setWorkStatus("IN_PROGRESS");
        data.setPriority("HIGH");
        data.setStartDate("2026-08-24");
        data.setDueDate("2026-08-30");
        data.setPreviousWorkLogId(20);
        data.setCollaboratorMemberIds(List.of(2, 2));

        when(projectDao.countOwnedActiveProject(10, 1)).thenReturn(1);
        when(workLogDao.countOwnedDailyWorkLog(20, 1)).thenReturn(1);
        when(memberDao.countById(2)).thenReturn(1);

        assertDoesNotThrow(() -> service.validateStructuredFields(data, 1, null));
    }

    @Test
    void rejectsTeamVisibilityWithoutTeam() {
        WorkLog data = new WorkLog();
        data.setWorkspaceId(3);
        data.setVisibility("TEAM");
        assertThrows(IllegalArgumentException.class, () -> service.validateStructuredFields(data, 1, null));
    }

    @Test
    void rejectsWorkspaceVisibilityInPersonalSpace() {
        WorkLog data = new WorkLog();
        data.setVisibility("WORKSPACE");
        assertThrows(IllegalArgumentException.class, () -> service.validateStructuredFields(data, 1, null));
    }

    @Test
    void rejectsUnsupportedStatusAndPriority() {
        WorkLog invalidStatus = new WorkLog();
        invalidStatus.setWorkStatus("UNKNOWN");
        assertThrows(IllegalArgumentException.class,
                () -> service.validateStructuredFields(invalidStatus, 1, null));

        WorkLog invalidPriority = new WorkLog();
        invalidPriority.setPriority("URGENT");
        assertThrows(IllegalArgumentException.class,
                () -> service.validateStructuredFields(invalidPriority, 1, null));
    }

    @Test
    void rejectsInvalidDateRangeAndFormat() {
        WorkLog reversed = new WorkLog();
        reversed.setStartDate("2026-08-30");
        reversed.setDueDate("2026-08-20");
        assertThrows(IllegalArgumentException.class,
                () -> service.validateStructuredFields(reversed, 1, null));

        WorkLog malformed = new WorkLog();
        malformed.setStartDate("08/24/2026");
        assertThrows(IllegalArgumentException.class,
                () -> service.validateStructuredFields(malformed, 1, null));
    }

    @Test
    void rejectsForeignProjectAndPreviousRecord() {
        WorkLog foreignProject = new WorkLog();
        foreignProject.setProjectId(99);
        when(projectDao.countOwnedActiveProject(99, 1)).thenReturn(0);
        assertThrows(IllegalArgumentException.class,
                () -> service.validateStructuredFields(foreignProject, 1, null));

        WorkLog foreignRecord = new WorkLog();
        foreignRecord.setPreviousWorkLogId(88);
        when(workLogDao.countOwnedDailyWorkLog(88, 1)).thenReturn(0);
        assertThrows(IllegalArgumentException.class,
                () -> service.validateStructuredFields(foreignRecord, 1, null));
    }

    @Test
    void rejectsSelfReferenceAndAuthorAsCollaborator() {
        WorkLog selfReference = new WorkLog();
        selfReference.setPreviousWorkLogId(7);
        assertThrows(IllegalArgumentException.class,
                () -> service.validateStructuredFields(selfReference, 1, 7));

        WorkLog duplicatedAuthor = new WorkLog();
        duplicatedAuthor.setCollaboratorMemberIds(List.of(1));
        assertThrows(IllegalArgumentException.class,
                () -> service.validateStructuredFields(duplicatedAuthor, 1, null));
    }
}
