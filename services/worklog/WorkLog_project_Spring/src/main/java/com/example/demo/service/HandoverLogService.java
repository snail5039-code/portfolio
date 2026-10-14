package com.example.demo.service;

import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;

import com.example.demo.dao.HandoverLogDao;
import com.example.demo.dto.HandoverLog;

@Service
public class HandoverLogService {
	
	private final HandoverLogDao handoverLogDao;
	
	public HandoverLogService(HandoverLogDao handoverLogDao) {
		this.handoverLogDao = handoverLogDao;
	}

	public List<HandoverLog> getMyHandoverLog(Integer memberId, String memberName, int offset, int size) {
		return this.handoverLogDao.getMyHandoverLog(memberId, memberName, offset, size);
	}

	public int getMyHandoverLogCount(Integer memberId, String memberName) {
		return this.handoverLogDao.getMyHandoverLogCount(memberId, memberName);
	}

	// 인자 순서는 HandoverLogDao.saveHandoverLog 와 반드시 같아야 한다.
	// 예전에는 여기서 title 이 앞으로 끼어들어 name 부터 뒤로 한 칸씩 밀렸고,
	// 그 결과 writerName·toName·toJob·fromJob·title 이 전부 뒤섞여 저장됐다.
	public void saveHandoverLog(Integer memberId, String name, String toName, String toJob, String fromJob,
			String title, LocalDate fromDate, LocalDate toDate, String content) {
		this.handoverLogDao.saveHandoverLog(memberId, name, toName, toJob, fromJob, title, fromDate, toDate, content);
	}

	public HandoverLog findById(int id) {
		return this.handoverLogDao.findById(id);
	}

	public boolean markDelivered(int id, int memberId) {
		return handoverLogDao.markDelivered(id, memberId) == 1;
	}

	public boolean markConfirmed(int id, int memberId, String memberName) {
		return handoverLogDao.markConfirmed(id, memberId, memberName) == 1;
	}

	public boolean markCompleted(int id, int memberId) {
		return handoverLogDao.markCompleted(id, memberId) == 1;
	}


}
