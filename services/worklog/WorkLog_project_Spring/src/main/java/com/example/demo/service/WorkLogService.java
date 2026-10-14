package com.example.demo.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.demo.dao.WorkLogDao;
import com.example.demo.dao.WorkLogCollaboratorDao;
import com.example.demo.dao.MemberDao;
import com.example.demo.dao.ProjectDao;
import com.example.demo.dao.TeamDao;
import com.example.demo.dto.FileAttach;
import com.example.demo.dto.TemplateUsageDto;
import com.example.demo.dto.WorkLog;

@Service
public class WorkLogService {
	
	private WorkLogDao workLogDao;
	private FileAttachService fileAttachService;
	private WorkReplyService workReplyService;
	private WorkLogCollaboratorDao workLogCollaboratorDao;
	private ProjectDao projectDao;
	private MemberDao memberDao;
	private TeamDao teamDao;
	private WorkspacePermissionService workspacePermissionService;
	// 의존성 주입
	public WorkLogService(WorkLogDao workLogDao, FileAttachService fileAttachService,
			WorkReplyService workReplyService, WorkLogCollaboratorDao workLogCollaboratorDao,
			ProjectDao projectDao, MemberDao memberDao, TeamDao teamDao,
			WorkspacePermissionService workspacePermissionService) {
		this.workLogDao = workLogDao;
		this.fileAttachService = fileAttachService;
		this.workReplyService = workReplyService;
		this.workLogCollaboratorDao = workLogCollaboratorDao;
		this.projectDao = projectDao;
		this.memberDao = memberDao;
		this.teamDao = teamDao;
		this.workspacePermissionService = workspacePermissionService;
	}
	
	/** 글을 넣고 새로 만들어진 id 를 돌려준다. */
	public int writeWorkLog(WorkLog workLogData, int memberId, int boardId) {
		this.workLogDao.writeWorkLog(workLogData, memberId, boardId);
		return workLogData.getId();
	}

	/**
	 * 글과 첨부파일을 한 트랜잭션으로 넣는다.
	 *
	 * 예전에는 컨트롤러가 글을 넣고, 별도 쿼리로 id 를 읽고, 첨부를 붙였다.
	 * 트랜잭션이 없으니 세 단계가 서로 다른 커넥션에서 돌 수 있었고,
	 * 첨부 저장이 실패해도 글만 남아 사용자에게는 "등록 완료" 로 보였다.
	 * 지금은 첨부가 하나라도 실패하면 글까지 함께 되돌린다.
	 */
	@Transactional
	public int writeWorkLogWithFiles(WorkLog workLogData, int memberId, int boardId, List<MultipartFile> files) {
		int workLogId = this.writeWorkLog(workLogData, memberId, boardId);

		if (files != null) {
			for (MultipartFile file : files) {
				if (file != null && !file.isEmpty()) {
					this.fileAttachService.fileInsert(workLogId, file);
				}
			}
		}
		replaceCollaborators(workLogId, workLogData.getCollaboratorMemberIds());

		return workLogId;
	}

	public List<WorkLog> showList() {
		return this.workLogDao.showList();
	}
	
	public List<WorkLog> showListByBoardId(Integer boardId) {
		return this.workLogDao.showListByBoardId(boardId);
	}

	public WorkLog showDetail(int id) {
		WorkLog workLog = this.workLogDao.showDetail(id); 
	    
	    if (workLog != null) {
	        List<FileAttach> fileAttaches = fileAttachService.getFilesByWorkLogId(id);
	        workLog.setFileAttaches(fileAttaches);  // 그래서 요거 worklog에 만들어줬음 리스트로 받을 수 있게!
	        workLog.setCollaboratorMemberIds(workLogCollaboratorDao.findMemberIdsByWorkLogId(id));
	    }
	    
	    return workLog;
	}

	@Transactional
	public int doModify(int id, int memberId, WorkLog modifyData) {
		int updated = this.workLogDao.doModify(id, memberId, modifyData);
		if (updated > 0 && modifyData.getCollaboratorMemberIds() != null) {
			replaceCollaborators(id, modifyData.getCollaboratorMemberIds());
		}
		return updated;
	}

	public boolean isOwnedDailyWorkLog(int workLogId, int memberId) {
		return workLogDao.countOwnedDailyWorkLog(workLogId, memberId) > 0;
	}

	public void validateStructuredFields(WorkLog data, int memberId, Integer currentWorkLogId) {
		validateSharing(data, memberId);
		if (data.getProjectId() != null && projectDao.countOwnedActiveProject(data.getProjectId(), memberId) == 0) {
			throw new IllegalArgumentException("본인이 소유한 활성 프로젝트만 연결할 수 있습니다.");
		}

		Set<String> statuses = Set.of("PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED");
		if (data.getWorkStatus() != null && !statuses.contains(data.getWorkStatus())) {
			throw new IllegalArgumentException("지원하지 않는 업무 상태입니다.");
		}

		Set<String> priorities = Set.of("HIGH", "NORMAL", "LOW");
		if (data.getPriority() != null && !priorities.contains(data.getPriority())) {
			throw new IllegalArgumentException("지원하지 않는 우선순위입니다.");
		}

		LocalDate start = parseDate(data.getStartDate(), "시작일");
		LocalDate due = parseDate(data.getDueDate(), "마감일");
		if (start != null && due != null && due.isBefore(start)) {
			throw new IllegalArgumentException("마감일은 시작일보다 빠를 수 없습니다.");
		}

		if (data.getPreviousWorkLogId() != null) {
			if (data.getPreviousWorkLogId().equals(currentWorkLogId)) {
				throw new IllegalArgumentException("자기 자신을 이전 기록으로 연결할 수 없습니다.");
			}
			if (!isOwnedDailyWorkLog(data.getPreviousWorkLogId(), memberId)) {
				throw new IllegalArgumentException("본인의 일일 업무일지만 이전 기록으로 연결할 수 있습니다.");
			}
		}

		if (data.getCollaboratorMemberIds() != null) {
			for (Integer collaboratorId : data.getCollaboratorMemberIds().stream().distinct().toList()) {
				if (collaboratorId == null || collaboratorId == memberId) {
					throw new IllegalArgumentException("작성자 본인은 협업자로 중복 지정할 수 없습니다.");
				}
				if (memberDao.countById(collaboratorId) == 0) {
					throw new IllegalArgumentException("존재하지 않는 협업자가 포함되어 있습니다.");
				}
			}
		}
	}

	private void validateSharing(WorkLog data, int memberId) {
		String visibility = data.getVisibility() == null ? "PRIVATE" : data.getVisibility().trim().toUpperCase();
		if (!Set.of("PRIVATE", "WORKSPACE", "TEAM").contains(visibility)) {
			throw new IllegalArgumentException("지원하지 않는 공개 범위입니다.");
		}
		if (data.getWorkspaceId() == null) {
			if (!"PRIVATE".equals(visibility) || data.getTeamId() != null) {
				throw new IllegalArgumentException("개인 공간 기록은 비공개로만 저장할 수 있습니다.");
			}
		} else {
			workspacePermissionService.requireActiveMember(data.getWorkspaceId(), memberId);
			if ("TEAM".equals(visibility)) {
				if (data.getTeamId() == null || teamDao.countInWorkspace(data.getTeamId(), data.getWorkspaceId()) == 0
						|| teamDao.countMember(data.getTeamId(), memberId) == 0) {
					throw new IllegalArgumentException("소속 팀을 선택해주세요.");
				}
			} else if (data.getTeamId() != null) {
				throw new IllegalArgumentException("팀 공개 기록에서만 팀을 선택할 수 있습니다.");
			}
		}
		data.setVisibility(visibility);
	}

	private LocalDate parseDate(String value, String label) {
		if (value == null || value.isBlank()) return null;
		try {
			return LocalDate.parse(value);
		} catch (DateTimeParseException e) {
			throw new IllegalArgumentException(label + "은 YYYY-MM-DD 형식이어야 합니다.");
		}
	}

	private void replaceCollaborators(int workLogId, List<Integer> memberIds) {
		if (memberIds == null) return;
		workLogCollaboratorDao.deleteByWorkLogId(workLogId);
		memberIds.stream().distinct().forEach(memberId -> workLogCollaboratorDao.insert(workLogId, memberId));
	}

	public int getMyWorkLogsCount(int memberId) {
		return this.workLogDao.getMyWorkLogsCount(memberId);
	}

	public int getThisMonthCount(int memberId) {
		return this.workLogDao.getThisMonthCount(memberId);
	}

	public LocalDateTime getLastWrittenDate(int memberId) {
		return this.workLogDao.getLastWrittenDate(memberId);
	}

	public List<TemplateUsageDto> getTopTemplates(int memberId) {
		return this.workLogDao.getTopTemplates(memberId);
	}

	public List<WorkLog> getMyWorkLogsPaged(int memberId, int page, int size) {
		int offset = (page - 1) * size; 
		return workLogDao.getMyWorkLogsPaged(memberId, offset, size);
	}

	public List<WorkLog> getBoardListPaged(Integer boardId, int page, int size) {
		int offset = (page - 1) * size;
		if(boardId == null || boardId == 0) {
			 return workLogDao.getBoardListPagedAll(offset, size);
	    } else {
	        // 특정 게시판만
	        return workLogDao.getBoardListPagedByBoard(boardId, offset, size);
	    }
	}

	public int getBoardListCount(Integer boardId) {
		if (boardId == null || boardId == 0) {
	        return workLogDao.getBoardListCountAll();      // 전체 카운트
	    } else {
	        return workLogDao.getBoardListCountByBoard(boardId); // 해당 boardId 카운트
	    }
	}

	public List<WorkLog> getBoardListPaged(Integer boardId, Integer projectId, String workStatus,
			String priority, String keyword, int page, int size) {
		int offset = (page - 1) * size;
		return workLogDao.getBoardListPagedFiltered(boardId, projectId, workStatus, priority, keyword, offset, size);
	}

	public int getBoardListCount(Integer boardId, Integer projectId, String workStatus,
			String priority, String keyword) {
		return workLogDao.getBoardListCountFiltered(boardId, projectId, workStatus, priority, keyword);
	}

	public List<WorkLog> getLogsByDateRange(int memberId, LocalDate s, LocalDate e) {
		return this.workLogDao.getLogsByDateRange(memberId, s, e);
	}

	/** 인수인계서 재료. 기간을 비우면 전체 기간이다. */
	public List<WorkLog> getDailyLogsForHandover(int memberId, LocalDate s, LocalDate e) {
		return this.workLogDao.getDailyLogsForHandover(memberId, s, e);
	}

	public int writeWorkLogToBoard(WorkLog weeklyLog, int memberId, int boardId) {
		this.workLogDao.writeWorkLogToBoard(weeklyLog, memberId, boardId);
		return weeklyLog.getId();
	}

	/**
	 * 글과 딸린 것들을 함께 지운다.
	 *
	 * 스키마에 FK 도 CASCADE 도 없어서 예전에는 댓글 · 첨부 메타 · 디스크 파일이
	 * 전부 고아로 남았다. 자식부터 지우고 마지막에 글을 지운다.
	 */
	@Transactional
	public void deleteWorkLog(int id) {
		this.workReplyService.deleteByWorkLogId(id);
		this.fileAttachService.deleteFilesByWorkLogId(id);
		this.workLogDao.deleteWorkLog(id);
	}

	
}
