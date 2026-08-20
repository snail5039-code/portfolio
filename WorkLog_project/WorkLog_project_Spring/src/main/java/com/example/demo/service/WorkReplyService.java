package com.example.demo.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.example.demo.dao.WorkReplyDao;
import com.example.demo.dto.RePly;

@Service
public class WorkReplyService {
	
	private final WorkReplyDao workReplyDao; 
	
	public WorkReplyService(WorkReplyDao workReplyDao) {
		this.workReplyDao = workReplyDao;
	}

	public List<RePly> getRepliesByWorkLogId(int workLogId) {
		return this.workReplyDao.getRepliesByWorkLogId(workLogId);
	}

	public RePly findById(int replyId) {
		return this.workReplyDao.findById(replyId);
	}

	public void deleteById(int replyId) {
		this.workReplyDao.deleteById(replyId);
	}

	public void addReply(int memberId, int workLogId, String content) {
		this.workReplyDao.addReply(memberId, workLogId, content);
	}

	public void updateReply(int reply, String content) {
		this.workReplyDao.updateReply(reply, content);
	}

	/** 글이 지워질 때 그 글의 댓글을 전부 지운다. */
	public void deleteByWorkLogId(int workLogId) {
		this.workReplyDao.deleteByWorkLogId(workLogId);
	}

}
