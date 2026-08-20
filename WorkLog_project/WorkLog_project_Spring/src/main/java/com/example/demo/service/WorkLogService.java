package com.example.demo.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.demo.dao.WorkLogDao;
import com.example.demo.dto.FileAttach;
import com.example.demo.dto.TemplateUsageDto;
import com.example.demo.dto.WorkLog;

@Service
public class WorkLogService {
	
	private WorkLogDao workLogDao;
	private FileAttachService fileAttachService;
	private WorkReplyService workReplyService;
	// 의존성 주입
	public WorkLogService(WorkLogDao workLogDao, FileAttachService fileAttachService,
			WorkReplyService workReplyService) {
		this.workLogDao = workLogDao;
		this.fileAttachService = fileAttachService;
		this.workReplyService = workReplyService;
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
	    }
	    
	    return workLog;
	}

	public int doModify(int id, int memberId, WorkLog modifyData) {
		return this.workLogDao.doModify(id, memberId, modifyData);
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