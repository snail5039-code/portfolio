package com.example.demo.service;

import org.springframework.stereotype.Service;

import com.example.demo.dao.MemberDao;
import com.example.demo.dto.Member;
import com.example.demo.util.SHA256Util;

@Service
public class MemberService {
	
	private MemberDao memberDao;
	// 의존성 주입
	public MemberService(MemberDao memberDao) {
		this.memberDao = memberDao;
	}
	public void memberJoin(Member memberJoin) {
		String rawPw = memberJoin.getLoginPw();
		// sha-256 암호화
		String encPw = SHA256Util.encrypt(rawPw);
		memberJoin.setLoginPw(encPw);
		
		this.memberDao.memberJoin(memberJoin);
	}
	public Member getMemberLoginId(Member loginData) {
		return this.memberDao.getMemberLoginId(loginData);
	}
	public int checkLoginId(String loginId) {
		return this.memberDao.checkLoginId(loginId);
	}
	public Member getMemberById(int memberId) {
		return this.memberDao.getMemberById(memberId);
	}
	public int updateMyInfo(Member member) {
		// 비밀번호를 비워서 보내면 기존 것을 그대로 둔다.
		// 값이 있으면 반드시 암호화해서 저장한다 — 예전에는 평문이 그대로 들어갔고,
		// 로그인은 해시로 대조하므로 비밀번호를 바꾸면 본인도 다시 로그인할 수 없었다.
		if (member.getLoginPw() == null || member.getLoginPw().isBlank()) {
			Member dbMember = this.memberDao.getMemberById(member.getId());
			member.setLoginPw(dbMember.getLoginPw());
		} else {
			member.setLoginPw(SHA256Util.encrypt(member.getLoginPw()));
		}

		return this.memberDao.updateMyInfo(member);
	}
	public Member findByNameAndEmail(String name, String email) {
		return this.memberDao.findByNameAndEmail(name, email);
	}
	public void changePassword(int id, String newPassword) {
		String encPw = SHA256Util.encrypt(newPassword);
				
		this.memberDao.changePassword(id, encPw);
	}
	public Member findByLoginIdAndEmail(String loginId, String email) {
		return this.memberDao.findByLoginIdAndEmail(loginId, email);
	}
	public Member findEmail(String email) {
		return this.memberDao.findEmail(email);
	}
	
}