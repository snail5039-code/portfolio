package com.example.demo.controller;

import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataAccessException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.dto.Member;
import com.example.demo.service.MemberService;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/dev")
@ConditionalOnProperty(name = "worklog.developer-mode.enabled", havingValue = "true")
public class DeveloperModeController {

    private final MemberService memberService;
    private final int memberId;

    public DeveloperModeController(MemberService memberService,
            @Value("${worklog.developer-mode.member-id:1}") int memberId) {
        this.memberService = memberService;
        this.memberId = memberId;
    }

    @PostMapping("/session")
    public ResponseEntity<?> enter(HttpSession session) {
        Member member;
        try {
            member = memberService.getMemberById(memberId);
        } catch (DataAccessException exception) {
            return ResponseEntity.status(503).body(Map.of(
                    "message", "로컬 데이터베이스에 연결할 수 없습니다. MySQL 실행 상태를 확인해주세요."));
        }
        if (member == null) {
            return ResponseEntity.unprocessableEntity().body(Map.of(
                    "message", "개발자 모드 회원을 찾을 수 없습니다.",
                    "memberId", memberId));
        }
        session.setAttribute("logindeMemberId", memberId);
        session.setAttribute("developerMode", true);
        return ResponseEntity.ok(Map.of("memberId", memberId, "name", member.getName()));
    }

    @DeleteMapping("/session")
    public Map<String, Boolean> exit(HttpSession session) {
        session.invalidate();
        return Map.of("success", true);
    }
}
