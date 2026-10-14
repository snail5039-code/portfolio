package com.example.demo.controller;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.dto.FirebaseLoginRequest;
import com.example.demo.dto.Member;
import com.example.demo.dto.VerifyFindIdRequest;
import com.example.demo.service.EmailService;
import com.example.demo.service.MemberService;
import com.example.demo.util.SHA256Util;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;

import jakarta.mail.Session;
import jakarta.servlet.http.HttpSession;

@RestController
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" }, allowCredentials = "true") // 쿠키 설정
@RequestMapping("/api")
public class MemberController {

	// 인증번호를 몇 번까지 틀릴 수 있는지. 넘으면 코드를 폐기하고 다시 받게 한다.
	// 상한이 없으면 6자리 숫자를 그냥 다 넣어볼 수 있다.
	private static final int MAX_CODE_TRIES = 5;

	private MemberService memberService;
	private EmailService emailService;

	// 의존성 주입
	public MemberController(MemberService memberService, EmailService emailService) {
		this.memberService = memberService;
		this.emailService = emailService;
	}

	@PostMapping("/usr/member/join")
	public String join(@RequestBody Member memberJoin) {
		System.out.println("--- 리액트 요청 데이터 ---");
		System.out.println("Title: " + memberJoin);
		System.out.println("--------------------------");

		this.memberService.memberJoin(memberJoin);
		return "데이터 입력 완료";
	}

	@PostMapping("/usr/member/login")
	public int login(@RequestBody Member loginData, HttpSession session) {

		Member member = this.memberService.getMemberLoginId(loginData);

		if (member == null) {
			String message = String.format("%s는 존재하지 않는 아이디 입니다.", loginData.getLoginId());
			return 0;
		}
		String encInputPw = SHA256Util.encrypt(loginData.getLoginPw());
		
		if (!member.getLoginPw().equals(encInputPw)) {
			return 0;
		}

		session.setAttribute("logindeMemberId", member.getId());

		return member.getId();
	}

	// ==================== 아이디 찿기 1. 인증번호, 2. 아이디 알려주기 ===================
	@PostMapping("/usr/member/findMyLoginId/sendCode")
	public ResponseEntity<?> sendFindIdCode(@RequestBody VerifyFindIdRequest request, HttpSession session) {

		Member member = memberService.findByNameAndEmail(request.getName(), request.getEmail());

		if (member == null) {
			return ResponseEntity.status(404).body("일치하는 회원이 없습니다.");
		}

		String code = emailService.generateVerificationCode();

		session.setAttribute("FIND_ID_CODE", code);
		session.setAttribute("FIND_ID_EMAIL", request.getEmail());
		session.setAttribute("FIND_ID_EXPIRES", Instant.now().plusSeconds(300)); // 300초 뒤 만료

		String subject = "[업무일지 서비스] 아이디 찾기 인증번호";
		String text = "아이디 찾기를 위한 인증번호는 [" + code + "] 입니다.\n 5분 이내에 입력해주세요.";
		emailService.sendMail(request.getEmail(), subject, text);

		return ResponseEntity.ok("인증번호를 이메일로 전송했습니다.");
	}

	// 인증번호 확인 후 아이디 알려주기, verifyFindIdCode 코드 확인
	@PostMapping("/usr/member/findMyLoginId/verifyFindIdCode")
	public ResponseEntity<?> verifyCode(@RequestBody VerifyFindIdRequest request, HttpSession session) {

		String saveCode = (String) session.getAttribute("FIND_ID_CODE");
		String saveEmail = (String) session.getAttribute("FIND_ID_EMAIL");
		Instant expires = (Instant) session.getAttribute("FIND_ID_EXPIRES");

		if (saveCode == null || saveEmail == null || expires == null) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "인증번호를 다시 요청해주세요"));
		}

		// 만료 시각을 세션에 넣어두고 정작 비교하지 않았다. 그래서 아이디 찾기
		// 인증번호는 5분이 지나도, 하루가 지나도 계속 통했다.
		// 비밀번호 찾기 쪽에는 이 검사가 처음부터 있었다 — 한쪽만 빠진 것이다.
		if (Instant.now().isAfter(expires)) {
			clearFindIdSession(session);
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body(Map.of("message", "인증번호가 만료되었습니다. 다시 요청해주세요."));
		}

		if (!saveEmail.equals(request.getEmail()) || !saveCode.equals(request.getCode())) {
			if (countFailure(session, "FIND_ID_TRIES") >= MAX_CODE_TRIES) {
				clearFindIdSession(session);
				return ResponseEntity.status(HttpStatus.BAD_REQUEST)
						.body(Map.of("message", "인증번호를 여러 번 틀렸습니다. 다시 요청해주세요."));
			}
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "인증번호를 일치하지 않습니다."));
		}

		Member member = memberService.findByNameAndEmail(request.getName(), request.getEmail());

		if (member == null) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "일치하는 회원이 없습니다."));
		}
		String loginId = member.getLoginId(); // 네 Member DTO 필드명에 맞게 변경!

		clearFindIdSession(session);

		return ResponseEntity.ok(loginId);
	}

	/** 인증번호 실패 횟수를 세고 누적값을 돌려준다. */
	private int countFailure(HttpSession session, String key) {
		Integer tries = (Integer) session.getAttribute(key);
		int next = (tries == null ? 0 : tries) + 1;

		session.setAttribute(key, next);

		return next;
	}

	private void clearFindIdSession(HttpSession session) {
		session.removeAttribute("FIND_ID_CODE");
		session.removeAttribute("FIND_ID_EMAIL");
		session.removeAttribute("FIND_ID_EXPIRES");
		session.removeAttribute("FIND_ID_TRIES");
	}

	private void clearResetPwSession(HttpSession session) {
		session.removeAttribute("RESET_PW_CODE");
		session.removeAttribute("RESET_PW_EMAIL");
		session.removeAttribute("RESET_PW_LOGIN_ID");
		session.removeAttribute("RESET_PW_EXPIRES");
		session.removeAttribute("RESET_PW_TRIES");
	}

	// ==================== 비밀번호 찿기 1. 인증번호, 2. 비밀번호 변경 ===================

	@PostMapping("/usr/member/findMyLoginPw/sendCode")
	public ResponseEntity<String> sendFindPwCode(@RequestBody VerifyFindIdRequest request, HttpSession session) {
		Member member = memberService.findByLoginIdAndEmail(request.getLoginId(), request.getEmail());
		if (member == null) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body("일치하는 회원이 없습니다.");
		}

		String code = emailService.generateVerificationCode();

		session.setAttribute("RESET_PW_CODE", code);
		session.setAttribute("RESET_PW_EMAIL", request.getEmail());
		session.setAttribute("RESET_PW_LOGIN_ID", request.getLoginId());
		session.setAttribute("RESET_PW_EXPIRES", Instant.now().plusSeconds(300));

		String subject = "[업무일지 서비스] 비밀번호 재설정 인증번호";
		String text = "비밀번호 재설정을 위한 인증번호는 [" + code + "] 입니다.\n 5분 이내에 입력해주세요.";
		emailService.sendMail(request.getEmail(), subject, text);

		return ResponseEntity.ok("인증번호를 이메일로 전송했습니다.");
	}

	@PostMapping("/usr/member/findMyLoginPw/verifyCode")
	public ResponseEntity<String> verifyFindPwCode(@RequestBody VerifyFindIdRequest request, HttpSession session) {
		String saveCode = (String) session.getAttribute("RESET_PW_CODE");
		String saveEmail = (String) session.getAttribute("RESET_PW_EMAIL");
		String saveLoginId = (String) session.getAttribute("RESET_PW_LOGIN_ID");
		Instant expires = (Instant) session.getAttribute("RESET_PW_EXPIRES");

		if (saveCode == null || saveEmail == null || saveLoginId == null || expires == null) {
			return ResponseEntity.badRequest().body("인증번호를 다시 요청해주세요.");
		}

		if (Instant.now().isAfter(expires)) {
			clearResetPwSession(session);
			return ResponseEntity.badRequest().body("인증번호가 만료되었습니다. 다시 요청해주세요.");
		}

		if (!saveEmail.equals(request.getEmail()) || !saveLoginId.equals(request.getLoginId())
				|| !saveCode.equals(request.getCode())) {
			if (countFailure(session, "RESET_PW_TRIES") >= MAX_CODE_TRIES) {
				clearResetPwSession(session);
				return ResponseEntity.badRequest().body("인증번호를 여러 번 틀렸습니다. 다시 요청해주세요.");
			}
			return ResponseEntity.badRequest().body("인증 정보가 일치하지 않습니다.");
		}

		if (request.getNewPassword() == null || !request.getNewPassword().equals(request.getConfirmPassword())) {
			return ResponseEntity.badRequest().body("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
		}

		Member member = memberService.findByLoginIdAndEmail(request.getLoginId(), request.getEmail());
		if (member == null) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body("일치하는 회원이 없습니다.");
		}

		this.memberService.changePassword(member.getId(), request.getNewPassword());

		clearResetPwSession(session);

		return ResponseEntity.ok("비밀번호가 변경되었습니다.");
	}

	@GetMapping("/usr/member/session")
	public int addSession(HttpSession session) {
		// null 포인터 땜에 인티져로
		// 이게 지속적으로 상태 보는 거임!
		Integer isLoginedId = (Integer) session.getAttribute("logindeMemberId");

		return isLoginedId != null ? isLoginedId : 0;
	}

	@PostMapping("/usr/member/logout")
	public int logout(HttpSession session) {

		session.invalidate();

		return 0;
	}

	@GetMapping("/usr/member/checkLoginId")
	public int checkLoginId(String loginId) {
		int isIdDupChek = this.memberService.checkLoginId(loginId);
		// 굳이 다른거 할 필요 없으니 인트로 반환 있으면 1, 없으면 0으로 그래서 쿼리 날릴때도 카운트로 함!
		return isIdDupChek;
	}

	// Firebase 토큰 검증 테스트용
	@PostMapping("/auth/firebase-login")
	public ResponseEntity<?> firebaseLogin(@RequestBody FirebaseLoginRequest request, HttpSession session) {
		String idToken = request.getIdToken();
		String provider = request.getProvider();

		if (idToken == null || idToken.isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "idToken is required"));
		}

		// provider 가 없으면 loginId 규칙을 만들 수 없다. 예전에는 여기서 NPE 로 500 이 났다.
		if (provider == null || provider.isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "provider is required"));
		}

		try {
			// 1) Firebase 토큰 검증
			FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);

			String uid = decodedToken.getUid();
			String email = decodedToken.getEmail();
			String name = (String) decodedToken.getClaims().get("name");

			System.out.println(">>> Firebase LOGIN: provider=" + provider + ", uid=" + uid + ", email=" + email);

			// 2) loginId 규칙: GOOGLE_xxx, GITHUB_xxx 이런 식으로
			String loginId = provider.toUpperCase() + "_" + uid;

			Member member = this.memberService.findByLoginIdAndEmail(loginId, email);

			// 이메일만 같으면 기존 계정을 내주던 분기를 없앴다.
			// 공급자에 따라 검증되지 않은 이메일도 토큰에 실려 오기 때문에,
			// 남의 이메일을 자기 소셜 계정에 적어두는 것만으로 그 계정을 가져갈 수 있었다.
			// 소셜 계정은 provider + uid 로만 식별한다.
			
			if (member == null) {
				Member newMember = new Member();
				newMember.setLoginId(loginId);
				newMember.setLoginPw("SOCIAL_LOGIN_" + provider.toUpperCase());
				newMember.setName(name != null ? name : email);
				newMember.setEmail(email); 
				newMember.setSex("N");
				newMember.setAddress("소셜로그인");
				this.memberService.memberJoin(newMember);
				member = memberService.findByLoginIdAndEmail(loginId, email);
			}

			if (member == null) {
				return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
						.body(Map.of("error", "소셜 로그인으로 회원을 생성/조회할 수 없습니다."));
			}
			session.setAttribute("logindeMemberId", member.getId());

			return ResponseEntity.ok(member.getId());

		} catch (FirebaseAuthException e) {
			e.printStackTrace();
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid Firebase ID token"));
		} catch (Exception e) {
			e.printStackTrace();
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error"));
		}
	}

}