package com.example.demo.controller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dto.HandoverLog;
import com.example.demo.dto.Member;
import com.example.demo.dto.RePly;
import com.example.demo.dto.TemplateUsageDto;
import com.example.demo.dto.WorkLog;
import com.example.demo.service.DocxTemplateService;
import com.example.demo.service.FileAttachService;
import com.example.demo.service.HandoverLogService;
import com.example.demo.service.HandoverTemplateService;
import com.example.demo.service.MemberService;
import com.example.demo.service.TemplateMetaService;
import com.example.demo.service.TemplateValueService;
import com.example.demo.service.WorkChatAIService;
import com.example.demo.service.WorkLogService;
import com.example.demo.service.WorkReplyService;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

@Slf4j // 로킹 어노테이션
@RestController
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" }, methods = { RequestMethod.GET,
		RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS }, allowCredentials = "true") // 쿠키
																															// 설정
@RequestMapping("/api")
public class WorkLogController {

	@Value("${file.upload-dir}")
	private String uploadDir;

	private final WorkChatAIService workChatAIService;
	private FileAttachService fileAttachService;
	private WorkLogService workLogService;
	private final TemplateValueService templateValueService;
	private final DocxTemplateService docxTemplateService;
	private final MemberService memberService;
	private final HandoverTemplateService handoverTemplateService;
	private final HandoverLogService handoverLogService;
	private final WorkReplyService workReplyService;
	private final TemplateMetaService templateMetaService;

	private static final int BOARD_ID_WEEKLY = 5;
	private static final int BOARD_ID_MONTHLY = 6;

	// 의존성 주입
	public WorkLogController(WorkLogService workLogService, FileAttachService fileAttachService,
			WorkChatAIService workChatAIService, TemplateValueService templateValueService,
			DocxTemplateService docxTemplateService, MemberService memberService,
			HandoverTemplateService handoverTemplateService, HandoverLogService handoverLogService,
			WorkReplyService workReplyService, TemplateMetaService templateMetaService) {
		this.workLogService = workLogService;
		this.fileAttachService = fileAttachService;
		this.workChatAIService = workChatAIService;
		this.templateValueService = templateValueService;
		this.docxTemplateService = docxTemplateService;
		this.memberService = memberService;
		this.handoverTemplateService = handoverTemplateService;
		this.handoverLogService = handoverLogService;
		this.workReplyService = workReplyService;
		this.templateMetaService = templateMetaService;
	}

	// 💡 실제로 쓸 엔드포인트
	@GetMapping("/worklogs/{id}/download/{templateId}")
	public ResponseEntity<byte[]> downloadTemplate(@PathVariable int id, @PathVariable String templateId)
			throws IOException {
		System.out.println(">>> /api/worklogs/" + id + "/download/template1 호출됨");
		// 디비에서 해당 업무일지 가져오는 것
		WorkLog log = workLogService.showDetail(id);
		if (log == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "업무일지를 찾을 수 없습니다.");
		}

		// 📌 1) 주간 템플릿(TPLW1) 이면 따로 처리
		if ("TPLW1".equalsIgnoreCase(templateId)) {
			return downloadWeeklyTemplate(log); // 아래에 메서드 하나 만들 거야
		}
		// 요건 월간
		if ("TPLM1".equalsIgnoreCase(templateId)) {
			return downloadMonthlyTemplate(log);
		}
		String summaryJson = log.getSummaryContent();
		if (summaryJson == null || summaryJson.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이 업무일지에는 템플릿 데이터를 위한 요약이 없습니다.");
		}
		// 나중에 양식 더 추가 시키기
		String docxFileName;

		switch (templateId.toUpperCase()) {
		case "TPL1":
			docxFileName = "업무일지양식1.docx";
			break;
		case "TPL3":
			docxFileName = "업무일지양식3.docx";
			break;
		case "TPL4":
			docxFileName = "업무일지양식4.docx";
			break;
		case "TPL5":
			docxFileName = "업무일지양식5.docx";
			break;
		case "TPL6":
			docxFileName = "업무일지양식6.docx";
			break;
		case "TPL7":
			docxFileName = "업무일지양식7.docx";
			break;
		default:
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "지원하지 않는 템플릿입니다." + templateId);
		}

		// 자동 치환 메서드 호출
		Map<String, String> values = templateValueService.buildValuesFromJson(summaryJson);

		// 3) 템플릿 적용
		byte[] fileBytes = docxTemplateService.fileTemplate(docxFileName, values);

		// 4) 응답 헤더 세팅
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(
				MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
		headers.setContentDisposition(ContentDisposition.attachment()
				.filename("worklog_" + id + "_" + templateId.toUpperCase() + ".docx", StandardCharsets.UTF_8).build());

		return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);
	}

	@PostMapping("/usr/work/workLog") // MultipartFile 이거는 스프링부트 내장이라서 바로 사용 가능함, 리액트에서 multiple를 받아온거!
	public String writeWorkLog(@RequestParam int boardId, String title, String mainContent, String sideContent,
			String templateId, List<MultipartFile> files, HttpSession session) {
		// 로그인 확인은 AI 호출보다 먼저 한다. 예전에는 이 검사가 AI 호출 뒤에 있어서,
		// 비로그인 요청도 매번 LLM 추론을 돌린 뒤에야 언박싱 NPE 로 500 이 났다.
		Integer memberIdObj = (Integer) session.getAttribute("logindeMemberId");

		if (memberIdObj == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}

		// 등록되지 않은 템플릿은 여기서 막는다. 아래 AI 호출은 예외를 전부 삼키고
		// TPL1 로 되돌리므로, 그 안쪽에서 거부해도 사용자에게는 전달되지 않는다.
		if (!this.templateMetaService.isSupported(templateId)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 템플릿입니다: " + templateId);
		}

		// 여기는 ai한테 입력된 값 넘기는 곳!
		String finalAiReport = null;
		String effectiveTemplateId = null;
		// ai 처리를 위해 템플릿 파일, 내용을 준비
		if (boardId == 7 || boardId == 8 || boardId == 9) {
			finalAiReport = "{}";
			effectiveTemplateId = null; // 템플릿ID 안 씀
		} else {
			String combinedNewContent = "제목: " + title + "\n\n" + mainContent + "\n\n보조 내용: " + sideContent;

			try {

				effectiveTemplateId = (templateId == null || templateId.isBlank()) ? "TPL1" : templateId;
				finalAiReport = this.workChatAIService.generateFinalReport(effectiveTemplateId, combinedNewContent);
			} catch (Exception e) {
				e.printStackTrace();
				System.err.println("AI 보고서 생성 중 오류 발생, 원본 내용 저장:" + e.getMessage());
				// DB에서 summaryContent NOT NULL 이라면 최소한 빈 JSON이라도 넣어주자
				finalAiReport = "{}";
				effectiveTemplateId = "TPL1";
			}
		}
		// MultipartFile 이거는 따로 테이블 만들어서 보관해야됌!
		WorkLog workLogData = new WorkLog();
		workLogData.setTitle(title);
		workLogData.setMainContent(mainContent);
		workLogData.setSideContent(sideContent);

		workLogData.setTemplateId(effectiveTemplateId);

		// ai가 생성한 최종 보고서 담기
		if (finalAiReport != null && !finalAiReport.trim().isEmpty()) {
			workLogData.setSummaryContent(finalAiReport);
		} else {
			workLogData.setSummaryContent("{}");
		}

		// 글과 첨부를 한 트랜잭션으로 넣는다. 첨부가 하나라도 실패하면 글도 남지 않고
		// 예외가 그대로 올라가므로, 사용자가 "완료" 를 보고 첨부만 사라지는 일은 없다.
		this.workLogService.writeWorkLogWithFiles(workLogData, memberIdObj, boardId, files);

		return "데이터 입력 완료";
	}

	@PostMapping("/usr/work/simplePost")
	public Map<String, Object> writeSimplePost(@RequestBody WorkLog body, HttpSession session) {
		Integer memberIdObj = (Integer) session.getAttribute("logindeMemberId");
		if (memberIdObj == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		int memberId = memberIdObj;
		int boardId = body.getBoardId();

		if (boardId == 1 && memberId != 1) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "공지사항은 관리자만 작성할 수 있습니다.");
		}

		if (boardId != 1 && boardId != 2 && boardId != 3) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "일반 게시판만 가능합니다.");
		}

		WorkLog log = new WorkLog();
		log.setTitle(body.getTitle());
		log.setMainContent(body.getMainContent());
		log.setSideContent(null);
		log.setTemplateId(null);
		log.setSummaryContent(null);

		int newId = this.workLogService.writeWorkLog(log, memberId, boardId);

		Map<String, Object> result = new HashMap<>();
		result.put("id", newId);
		result.put("message", "게시글이 등록되었습니다.");
		return result;
	}

	// 파일 다운로드 하게하기
	@GetMapping("/usr/work/download/{storedFilename}")
	public ResponseEntity<Resource> downloadFile(@PathVariable String storedFilename, HttpSession session) {
		Integer memberId = (Integer) session.getAttribute("logindeMemberId");

		if (memberId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}

		// db 저장된 파일명을 이용 원본 파일명 조회 하는 것!
		String originalFilename = fileAttachService.getOriginalFilename(storedFilename);

		// DB 에 없는 이름이면 여기서 끝낸다. 예전에는 로그만 찍고 그대로 내려가서,
		// 등록된 적 없는 파일도 그대로 서빙됐다.
		if (originalFilename == null) {
			log.error("등록되지 않은 파일 요청: {}", storedFilename);
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "파일을 찾을 수 없습니다.");
		}

		// 파일 경로 찾는 것임!
		Path baseDir = Paths.get(uploadDir).toAbsolutePath().normalize();
		Path filePath = baseDir.resolve(storedFilename).normalize();

		// normalize() 는 `..` 을 정리해줄 뿐 막아주지 않는다. 업로드 폴더 밖으로
		// 나가는 경로인지 여기서 직접 확인한다.
		if (!filePath.startsWith(baseDir)) {
			log.error("업로드 폴더를 벗어난 경로 요청: {}", storedFilename);
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 파일 경로입니다.");
		}
		log.info("시도된 파일 다운로드 경로: {}", filePath.toAbsolutePath()); // toAbsolutePath()를 사용해 절대 경로를 확인
		Resource resource;

		try {
			resource = new UrlResource(filePath.toUri());
		} catch (Exception e) {
			log.error("파일 경로가 올바르지 않음: {}", storedFilename, e);
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "파일 경로가 올바르지 않습니다.");
		}
		// exists 실제로 있는지 파일이, isReadable 권한이 있는지
		if (!resource.exists() || !resource.isReadable()) {
			log.error("파일을 찾을 수가 없음..");
			System.out.println("파일을 찾을 수 없음!");
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "파일을 찾을 수 없습니다.");
		}

		// 한글 파일명은 filename* 파라미터로 보내야 한다 (RFC 6266).
		// UTF-8 바이트를 ISO-8859-1 로 재해석하는 예전 방식은 브라우저가 다시
		// UTF-8 로 추측해줄 때만 우연히 맞았고, Firefox·Safari 에서는 깨졌다.
		String contentDisposition = ContentDisposition.attachment()
				.filename(originalFilename, StandardCharsets.UTF_8).build().toString();
		// contentType(MediaType.APPLICATION_OCTET_STREAM) 이거는 바이너리 파일임. 약속된거라서 그냥 쓰면 됌
		// HttpHeaders.CONTENT_DISPOSITION, contentDisposition 이것도 약속임 파일 이름 알려주는 거 위에
		// 다운로드 하라는 것도 같이 그래서 실제 데이터를 body(resource) 요기에 담는거!
		return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM)
				.header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition).body(resource);

	}

	// ⭐ 템플릿 게시판(예: boardId = 7)의 글에서 첨부파일 한 개 다운로드
	@GetMapping("/usr/work/{id}/template-download")
	public ResponseEntity<Resource> downloadTemplateFile(@PathVariable("id") int workLogId, HttpSession session) {

		if (session.getAttribute("logindeMemberId") == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}

		// 1) 글 존재하는지 확인 (없으면 404)
		WorkLog log = workLogService.showDetail(workLogId);
		if (log == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.");
		}

		// 2) 템플릿 게시판이 아니면 막기 (원하면 주석처리해도 됨)
		if (log.getBoardId() != 7) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "템플릿 게시판 글이 아닙니다.");
		}

		// 3) 첨부파일 중 첫 번째 파일의 storedFilename 가져오기
		// 👉 fileAttachService에 이 메서드를 하나 만들어야 함
		String storedFilename = fileAttachService.getFirstStoredFilenameByWorkLogId(workLogId);

		if (storedFilename == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "첨부된 템플릿 파일이 없습니다.");
		}

		// 4) 이미 있는 다운로드 로직 재사용
		return downloadFile(storedFilename, session);
	}

	@GetMapping("/usr/workLog/myPageSummary")
	public Map<String, Object> getMyPageSummary(HttpSession session, @RequestParam(defaultValue = "1") int page,
			@RequestParam(defaultValue = "10") int size) {
		Integer memberId = (Integer) session.getAttribute("logindeMemberId");
		if (memberId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}

		// 다른 목록(showList·getMyHandoverList)에는 있는 하한 검증이 여기만 빠져 있었다.
		// ?page=0 이면 offset 이 -10 이 되어 SQL 문법 오류로 500 이 났다.
		if (page < 1)
			page = 1;
		if (size <= 0 || size > 100)
			size = 10;

		List<WorkLog> myWorkLogs = workLogService.getMyWorkLogsPaged(memberId, page, size);

		int totalCount = workLogService.getMyWorkLogsCount(memberId); // 내가 쓴 총 게시글 갯수
		int thisMonthCount = workLogService.getThisMonthCount(memberId); // 이번달 게시글 갯수

		LocalDateTime lastWritten = workLogService.getLastWrittenDate(memberId);

		List<TemplateUsageDto> topTemplates = workLogService.getTopTemplates(memberId);

		Map<String, Object> summary = new HashMap<>();
		summary.put("totalCount", totalCount);
		summary.put("thisMonthCount", thisMonthCount);
		summary.put("lastWrittenDate", lastWritten);
		summary.put("topTemplates", topTemplates);

		// 회원정보도 같이 넘기기
		Member me = this.memberService.getMemberById(memberId);

		Map<String, Object> result = new HashMap<>();
		result.put("summary", summary);
		result.put("myWorkLogs", myWorkLogs);
		result.put("member", me);

		return result;
	}

	@PostMapping("/usr/workLog/updateMyInfo")
	public void updateMyInfo(@RequestBody Member modifyData, HttpSession session) {
		// Integer 로 받는다. int 로 바로 받으면 비로그인일 때 언박싱 NPE 가 나서
		// 401 대신 500 이 나갔고, 아래 검사는 아예 도달하지 못하는 죽은 코드였다.
		Integer memberId = (Integer) session.getAttribute("logindeMemberId");

		if (memberId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		modifyData.setId(memberId);
		// 비번을 비워서 보내면 기존 것을 유지한다. 암호화는 서비스가 맡는다.
		int affectedRows = this.memberService.updateMyInfo(modifyData);

		if (affectedRows == 0) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "개인정보 수정에 실패했습니다.");
		}
	}

	@GetMapping("/usr/work/list")
	// size 기본값은 10 이다. 예전 기본값은 1 이라 size 를 빼고 부르면 한 건만 왔다.
	public Map<String, Object> showList(@RequestParam(defaultValue = "1") int page,
			@RequestParam(defaultValue = "10") int size, @RequestParam(required = false) Integer boardId) {
		if (page < 1)
			page = 1;
		if (size <= 0 || size > 100)
			size = 10;

		List<WorkLog> items = workLogService.getBoardListPaged(boardId, page, size);
		int totalCount = workLogService.getBoardListCount(boardId);

		Map<String, Object> result = new HashMap<>();
		result.put("items", items);
		result.put("totalCount", totalCount);

		return result;
	}

	@GetMapping("/handover/list") // 페이징 처리도 같이함
	public Map<String, Object> getMyHandoverList(@RequestParam(defaultValue = "1") int page,
			@RequestParam(defaultValue = "10") int size, HttpSession session) {
		Integer memberId = (Integer) session.getAttribute("logindeMemberId");
		if (memberId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		if (page < 1)
			page = 1;
		if (size <= 0 || size > 100)
			size = 10;

		int offset = (page - 1) * size;

		List<HandoverLog> items = this.handoverLogService.getMyHandoverLog(memberId, offset, size);
		int totalCount = this.handoverLogService.getMyHandoverLogCount(memberId);

		Map<String, Object> result = new HashMap<>();
		result.put("items", items);
		result.put("totalCount", totalCount);
		return result;
	}

	@GetMapping("/usr/work/detail/{id}")
	public WorkLog showDetail(@PathVariable("id") int id) {
		return this.workLogService.showDetail(id);
	}

	// 댓글 기능 중 목록 조회
	@GetMapping("/usr/work/{id}/replies")
	public List<RePly> getReplies(@PathVariable("id") int workLogId) {
		return this.workReplyService.getRepliesByWorkLogId(workLogId);
	}

	// 댓글 작성
	@PostMapping("/usr/work/{id}/replies")
	public RePly writerReply(@PathVariable("id") int workLogId, @RequestBody Map<String, String> body,
			HttpSession session) {
		Integer memberIdObj = (Integer) session.getAttribute("logindeMemberId");
		if (memberIdObj == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		int memberId = memberIdObj;

		String content = body.get("content");
		if (content == null || content.isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "댓글 내용을 입력하세요.");
		}
		this.workReplyService.addReply(memberId, workLogId, content);

		List<RePly> replies = this.workReplyService.getRepliesByWorkLogId(workLogId);
		if (replies.isEmpty()) {
			return null;
		}
		return replies.get(replies.size() - 1);
	}

	// 댓글 삭제
	@DeleteMapping("/usr/work/replies/{replyId}")
	public ResponseEntity<?> deleteReply(@PathVariable("replyId") int replyId, HttpSession session) {
		Integer memberIdObj = (Integer) session.getAttribute("logindeMemberId");
		if (memberIdObj == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		int memberId = memberIdObj;

		// 댓글 존재 여부 확인
		RePly reply = this.workReplyService.findById(replyId);
		if (reply == null) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body("본인이 작성한 댓글만 삭제 할 수 있습니다.");
		}
		
		if (reply.getMemberId() != memberId) {
	        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("본인이 작성한 댓글만 삭제할 수 있습니다.");
	    }

		this.workReplyService.deleteById(replyId);
		return ResponseEntity.noContent().build();
	}

	@PutMapping("/usr/work/replies/{replyId}")
	public ResponseEntity<?> modifyReply(@PathVariable("replyId") int replyId, @RequestBody Map<String, String> body,
			HttpSession session) {
		Integer memberIdObj = (Integer) session.getAttribute("logindeMemberId");
		if (memberIdObj == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		int memberId = memberIdObj;

		String content = body.get("content");
		if (content == null || content.isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "댓글 내용을 입력하세요.");
		}

		// 본인 댓글인지 확인
		RePly reply = this.workReplyService.findById(replyId);
		if (reply == null) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body("댓글을 찾을 수 없습니다.");
		}
		if (reply.getMemberId() != memberId) {
			return ResponseEntity.status(HttpStatus.FORBIDDEN).body("본인이 작성한 댓글만 수정할 수 있습니다.");
		}
		this.workReplyService.updateReply(replyId, content);
		RePly updated = this.workReplyService.findById(replyId);
		return ResponseEntity.ok(updated);
	}

	@PostMapping("/usr/work/modify/{id}")
	public ResponseEntity<?> modify(@PathVariable("id") int id, @RequestBody WorkLog modifyData,
			HttpSession session) {
		Integer memberId = (Integer) session.getAttribute("logindeMemberId");

		if (memberId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}

		WorkLog workLog = this.workLogService.showDetail(id);

		if (workLog == null) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body("게시글을 찾을 수 없습니다.");
		}

		if (!memberId.equals(workLog.getMemberId())) {
			return ResponseEntity.status(HttpStatus.FORBIDDEN).body("본인이 작성한 글만 수정할 수 있습니다.");
		}

		// DAO 의 where 절에도 memberId 를 걸어둔다. 위 검사와 중복이지만,
		// 앞으로 호출 경로가 늘어도 남의 글이 바뀌는 일은 없게 한다.
		return ResponseEntity.ok(this.workLogService.doModify(id, memberId, modifyData));
	}

	@DeleteMapping("/usr/work/{id}")
	public ResponseEntity<?> deleteWorkLog(@PathVariable("id") int id, HttpSession session) {
		Integer memberId = (Integer) session.getAttribute("logindeMemberId");

		if (memberId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}

		WorkLog workLog = workLogService.showDetail(id);

		if (workLog == null) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body("게시글을 찾을 수 없습니다.");
		}

		if (!memberId.equals(workLog.getMemberId())) {
			return ResponseEntity.status(HttpStatus.FORBIDDEN).body("본인이 작성한 글만 삭제할 수 있습니다.");
		}

		this.workLogService.deleteWorkLog(id);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/handover/download") // 다운로드
	public ResponseEntity<byte[]> downloadHandover(HttpSession session, String title, String toName, String toJob,
			String fromJob, String fromDateStr, String toDateStr) throws IOException {

		Integer memberId = (Integer) session.getAttribute("logindeMemberId");

		if (memberId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}

		Member me = memberService.getMemberById(memberId);
		if (me == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "회원 정보를 찾을 수 없습니다.");
		}

		if (title == null || title.isBlank()) {
			title = "업무 인수인계";
		}
		if (toName == null)
			toName = "";
		if (toJob == null)
			toJob = "";
		if (fromJob == null)
			fromJob = "";

		LocalDate fromDate = null;
		LocalDate toDate = null;
		if (fromDateStr != null && !fromDateStr.isBlank()) {
			fromDate = LocalDate.parse(fromDateStr);
		}
		if (toDateStr != null && !toDateStr.isBlank()) {
			toDate = LocalDate.parse(toDateStr);
		}

		String content = buildHandoverContent(memberId, fromDate, toDate);
		String date = LocalDate.now().toString(); // "2025-12-09" 이런 형식

		Map<String, String> values = handoverTemplateService.buildBaseValues(me, toName, toJob, title, content, date,
				fromJob);

		this.handoverLogService.saveHandoverLog(memberId, me.getName(), toName, toJob, fromJob, title, fromDate, toDate,
				content);

		byte[] fileBytes = docxTemplateService.fileTemplate("업무 인수인계서.docx", values);

		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(
				MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));

		// setContentDispositionFormData 는 응답에 `form-data` 타입을 실어보낸다.
		// 다운로드 응답은 `attachment` 여야 하고, 한글 이름은 filename* 로 보낸다.
		String filename = "인수인계서.docx";
		headers.setContentDisposition(
				ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build());

		return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);

	}

	@GetMapping("/handover/download/{id}") // 여기는 목록에서 다운
	public ResponseEntity<byte[]> downloadHandoverById(@PathVariable int id, HttpSession session) throws IOException {
		Integer memberId = (Integer) session.getAttribute("logindeMemberId");

		if (memberId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}

		HandoverLog log = this.handoverLogService.findById(id);
		if (log == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "인수인계 내역을 찾을 수 없습니다.");
		}

		if (log.getMemberId() != memberId) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인의 인수인계 내역만 다운로드할 수 있습니다.");
		}

		Member me = memberService.getMemberById(memberId);
		if (me == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "회원 정보를 찾을 수 없습니다.");
		}

		String content = log.getContent();
		String dateStr = LocalDate.now().toString();

		Map<String, String> values = this.handoverTemplateService.buildBaseValues(me, log.getToName(), log.getToJob(),
				log.getTitle(), content, dateStr, log.getFromJob());

		byte[] fileBytes = this.docxTemplateService.fileTemplate("업무 인수인계서.docx", values);

		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(
				MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));

		String filename = ("인수인계서_" + log.getId() + ".docx");
		headers.setContentDisposition(
				ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build());

		return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);
	}

	private String buildHandoverContent(int memberId, LocalDate fromDate, LocalDate toDate) {
		// 기간·게시판 조건을 SQL 에서 건다. 예전에는 최근 200건만 가져와 자바에서
		// 걸렀기 때문에, 글이 200건을 넘으면 오래된 기간이 조용히 빠졌다.
		List<WorkLog> filtered = workLogService.getDailyLogsForHandover(memberId, fromDate, toDate);

		if (filtered == null || filtered.isEmpty()) {
			return "등록된 업무일지가 없습니다.";
		}

		StringBuilder sb = new StringBuilder();
		sb.append("아래는 선택한 기간 동안 작성한 업무일지 목록입니다.\n").append("각 항목은 제목, 작성일, 주요 내용 순으로 정리되어 있습니다.\n\n");

		int index = 1;
		int maxLogsForAi = Math.min(filtered.size(), 20); // AI에 너무 많이 안 넘기게 최대 20개

		// 잘라낸 사실을 로그로 남긴다. 조용히 자르면 "기간은 넓게 잡았는데 왜 내용이 적나" 를
		// 추적할 방법이 없다.
		if (filtered.size() > maxLogsForAi) {
			log.warn("인수인계 재료를 {}건 중 앞 {}건만 사용합니다. (memberId={}, {} ~ {})", filtered.size(), maxLogsForAi,
					memberId, fromDate, toDate);
		}

		for (int i = 0; i < maxLogsForAi; i++) {
			WorkLog log = filtered.get(i);

			String regDateStr = log.getRegDate();
			if (regDateStr != null && regDateStr.length() >= 10) {
				regDateStr = regDateStr.substring(0, 10); // yyyy-MM-dd
			}

			String title = (log.getTitle() != null && !log.getTitle().isBlank()) ? log.getTitle() : "(제목 없음)";

			String main = log.getMainContent();
			String mainSnippet = "";
			if (main != null && !main.isBlank()) {
				// 너무 길면 앞부분만 잘라서 재료로만 사용 (진짜 요약은 AI가 함)
				mainSnippet = main.length() > 400 ? main.substring(0, 400) + "..." : main;
			}

			sb.append(index++).append(". 제목: ").append(title).append("\n");
			if (regDateStr != null) {
				sb.append("   작성일: ").append(regDateStr).append("\n");
			}
			if (!mainSnippet.isBlank()) {
				sb.append("   내용: ").append(mainSnippet).append("\n");
			}
			sb.append("\n");
		}

		String worklogListText = sb.toString();

		// ✅ 3) 여기서 AI에게 "인수인계용 문단" 만들어달라고 요청
		String aiSummary = workChatAIService.generateHandoverSummary(worklogListText);

		// 혹시라도 AI가 빈 값 주면, 최소한 재료 텍스트라도 넣어주기
		if (aiSummary == null || aiSummary.isBlank()) {
			return worklogListText;
		}
		// 번호 블록 앞의 빈 줄은 generateHandoverSummary 가 이미 넣어준다.
		// 여기서 한 번 더 넣으면 줄이 세 개가 되어 다시 압축되는 왕복이 생긴다.
		// 👉 최종적으로 인수인계서 ${handover_content}에 들어갈 내용
		return aiSummary;
	}

	@GetMapping("/workLog/range")
	public List<WorkLog> getLogsByRange(@RequestParam String startDate, @RequestParam String endDate,
			HttpSession session) {
		Integer loginId = (Integer) session.getAttribute("logindeMemberId");
		if (loginId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		int memberId = loginId;
		LocalDate s = LocalDate.parse(startDate);
		LocalDate e = LocalDate.parse(endDate);
		// 해당 기간 업무 일지 목록 가져오기
		return this.workLogService.getLogsByDateRange(memberId, s, e);
	}

	@GetMapping("/workLog/weekly/summary")
	public Map<String, String> getWeeklySummary(@RequestParam String startDate, @RequestParam String endDate,
			HttpSession session) {
		Integer memberIdObj = (Integer) session.getAttribute("logindeMemberId");

		if (memberIdObj == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		int memberId = memberIdObj;

		LocalDate s = LocalDate.parse(startDate);
		LocalDate e = LocalDate.parse(endDate);

		List<WorkLog> logs = this.workLogService.getLogsByDateRange(memberId, s, e);

		if (logs == null || logs.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "해당 기간에 업무일지가 없습니다.");
		}

		StringBuilder sb = new StringBuilder();
		sb.append("아래는").append(s).append("부터").append(e).append("까지 작성한 업무일지 목록입니다.\n")
				.append("각 항목은 제목, 작성일, 주요 내용을 포함합니다.");

		int index = 1; // 카운터 변수
		for (WorkLog log : logs) {
			String regDateStr = log.getRegDate();
			if (regDateStr != null && regDateStr.length() >= 10) {
				regDateStr = regDateStr.substring(0, 10);
			}
			String title = (log.getTitle() != null && !log.getTitle().isBlank()) ? log.getTitle() : "(제목 없음)";

			String main = log.getMainContent();
			String mainSnippet = "";

			if (main != null && !main.isBlank()) {
				mainSnippet = main.length() > 400 ? main.substring(0, 400) + "..." : main;
			}

			sb.append(index++).append(". 제목: ").append(title).append("\n");
			if (regDateStr != null) {
				sb.append("   작성일: ").append(regDateStr).append("\n");
			}
			if (!mainSnippet.isBlank()) {
				sb.append("   내용: ").append(mainSnippet).append("\n");
			}
			sb.append("\n");
		}
		String workLogListText = sb.toString();

		String aiSummary = workChatAIService.generateWeeklySummary(workLogListText);

		if (aiSummary == null || aiSummary.isBlank()) {
			aiSummary = workLogListText;
		}
		Map<String, String> result = new HashMap<>();
		result.put("summary", aiSummary);
		return result;
	}

	@PostMapping("/usr/work/weekly/register") // 주간 요약 후 게시판 등록
	public Map<String, Object> registerWeeklySummary(@RequestBody Map<String, String> body, HttpSession session) {
		Integer loginId = (Integer) session.getAttribute("logindeMemberId");
		if (loginId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		int memberId = loginId;

		String startDateStr = body.get("startDate");
		String endDateStr = body.get("endDate");

		if (startDateStr == null || endDateStr == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "기간 정보가 없습니다.");
		}

		LocalDate s = LocalDate.parse(startDateStr);
		LocalDate e = LocalDate.parse(endDateStr);

		List<WorkLog> logs = this.workLogService.getLogsByDateRange(memberId, s, e);
		if (logs == null || logs.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "해당 기간에 업무일지가 없습니다.");
		}

		StringBuilder sb = new StringBuilder();
		sb.append("아래는 ").append(s).append("부터 ").append(e).append("까지 작성한 업무일지 목록입니다.\n")
				.append("각 항목은 제목, 작성일, 주요 내용을 포함합니다.\n\n");

		int index = 1; // 번호 매기기용 카운터
		for (WorkLog log : logs) {
			String regDateStr = log.getRegDate();
			if (regDateStr != null && regDateStr.length() >= 10) {
				regDateStr = regDateStr.substring(0, 10); // yyyy-MM-dd
			}

			String title = (log.getTitle() != null && !log.getTitle().isBlank()) ? log.getTitle() : "(제목 없음)";

			String main = log.getMainContent();
			String mainSnippet = "";
			if (main != null && !main.isBlank()) {
				// 너무 길면 앞부분만 잘라서 AI 재료로만 사용
				mainSnippet = main.length() > 400 ? main.substring(0, 400) + "..." : main;
			}

			sb.append(index++).append(". 제목: ").append(title).append("\n");
			if (regDateStr != null) {
				sb.append("   작성일: ").append(regDateStr).append("\n");
			}
			if (!mainSnippet.isBlank()) {
				sb.append("   내용: ").append(mainSnippet).append("\n");
			}
			sb.append("\n");
		}

		String worklogListText = sb.toString();

		// ai 주간 요약 생성 요청
		String aiSummary = workChatAIService.generateWeeklySummary(worklogListText);
		if (aiSummary == null || aiSummary.isBlank()) {
			aiSummary = worklogListText;
		}

		String title = String.format("주간 업무일지 (%s ~ %s)", s.toString(), e.toString());
		String periodText = String.format("%s ~ %s", s.toString(), e.toString());

		WorkLog weeklyLog = new WorkLog();
		weeklyLog.setTitle(title); // 제목: "주간 업무일지 (기간)"
		weeklyLog.setMainContent(aiSummary); // 본문: AI가 요약한 내용
		weeklyLog.setSideContent(periodText); // 보조내용: "2025-12-01 ~ 2025-12-07"
		weeklyLog.setTemplateId("TPLW1"); // 나중에 주간 DOCX 템플릿용 ID (그냥 약속)
		weeklyLog.setSummaryContent("{}"); // 주간은 JSON 요약 안 쓸 거라 일단 빈 값

		int newId = this.workLogService.writeWorkLogToBoard(weeklyLog, memberId, BOARD_ID_WEEKLY);

		Map<String, Object> result = new HashMap<>();
		result.put("id", newId);
		result.put("message", "주간 요약 게시글이 등록되었습니다.");
		return result;
	}

	// 주간 업무일지 다운로드 할 수 있게 따론 빼논 메서드
	private ResponseEntity<byte[]> downloadWeeklyTemplate(WorkLog log) throws IOException {
		// 1) 워드 파일 이름 (네가 저장한 이름으로 맞춰줘!)
		String docxFileName = "주간업무보고서.docx"; // 실제 파일명으로 수정

		// 2) 작성자 / 기간
		String writer = log.getWriterName(); // showDetail에서 join으로 가져온 loginId
		if (writer == null || writer.isBlank()) {
			writer = "작성자"; // 혹시 null이면 기본값
		}

		String period = log.getSideContent(); // "2025-11-30 ~ 2025-12-06" 이런 텍스트

		// 3) AI가 만든 전체 주간 요약
		String full = log.getMainContent();
		if (full == null)
			full = "";

		String mainText = full;
		String issueText = "";

		// 4) "2. 이슈 / 위험 요소" 부분만 잘라내기
		int idx2 = full.indexOf("2.");
		if (idx2 != -1) {
			int idx3 = full.indexOf("3.", idx2); // 3번 시작 위치 (없으면 끝까지)
			if (idx3 == -1) {
				idx3 = full.length();
			}

			issueText = full.substring(idx2, idx3).trim(); // 2번 블록만

			// 메인 텍스트에서는 2번 부분을 빼고 1,3,4만 남기기
			String before = full.substring(0, idx2);
			String after = full.substring(idx3);
			mainText = (before + "\n" + after).trim();
		}

		// 5) 워드 템플릿에 넘길 플레이스홀더 값 세팅
		Map<String, String> values = new HashMap<>();
		values.put("${TPLW1_WRITER}", writer);
		values.put("${TPLW1_PERIOD}", period != null ? period : "");
		values.put("${TPLW1_MAIN}", mainText);
		values.put("${TPLW1_ISSUE}", issueText);

		// 6) DOCX 생성
		byte[] fileBytes = docxTemplateService.fileTemplate(docxFileName, values);

		// 7) 헤더 세팅 & 응답
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(
				MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));

		String filename = "주간업무보고서_" + log.getId() + ".docx";
		headers.setContentDisposition(
				ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build());

		return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);
	}

	// 📌 월간 업무일지 DOCX 다운로드
	private ResponseEntity<byte[]> downloadMonthlyTemplate(WorkLog log) throws IOException {
		// 1) 워드 파일 이름 (resources/templates/ 안에 넣어둔 이름)
		String docxFileName = "월간업무보고서.docx"; // 네가 실제 저장한 파일명으로 맞추기!

		// 2) 작성자 / 기간
		String writer = log.getWriterName();
		if (writer == null || writer.isBlank()) {
			writer = "작성자";
		}

		String period = log.getSideContent(); // "2025-12-01 ~ 2025-12-31"

		String full = log.getMainContent();
		if (full == null)
			full = "";

		String mainText = full;
		String issueText = "";

		// 4) "2. 이슈 / 위험 요소" 부분만 잘라내기
		int idx2 = full.indexOf("2.");
		if (idx2 != -1) {
			int idx3 = full.indexOf("3.", idx2); // 3번 시작 위치 (없으면 끝까지)
			if (idx3 == -1) {
				idx3 = full.length();
			}

			issueText = full.substring(idx2, idx3).trim(); // 2번 블록만

			// 메인 텍스트에서는 2번 부분을 빼고 1,3,4만 남기기
			String before = full.substring(0, idx2);
			String after = full.substring(idx3);
			mainText = (before + "\n" + after).trim();
		}

		// 4) 템플릿 플레이스홀더 값 세팅
		Map<String, String> values = new HashMap<>();
		values.put("${TPLM1_WRITER}", writer);
		values.put("${TPLM1_PERIOD}", period != null ? period : "");
		// 이슈 블록을 걷어낸 mainText 를 넣는다. full 을 넣으면 본문 칸과 이슈 칸에
		// 같은 내용이 두 번 인쇄된다 (주간 쪽은 처음부터 mainText 를 쓰고 있었다).
		values.put("${TPLM1_MAIN}", mainText);
		values.put("${TPLM1_ISSUE}", issueText);

		// 5) DOCX 생성
		byte[] fileBytes = docxTemplateService.fileTemplate(docxFileName, values);

		// 6) 헤더 세팅 & 응답
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(
				MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));

		String filename = "월간업무보고서_" + log.getId() + ".docx";
		headers.setContentDisposition(
				ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build());

		return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);
	}

	// 월간, 주간이랑 로직은 동일하나 나중에 디버깅이나 할 때 편하라고 분리
	@GetMapping("/workLog/monthly/summary")
	public Map<String, String> getMonthlySummary(@RequestParam String startDate, @RequestParam String endDate,
			HttpSession session) {
		Integer memberIdObj = (Integer) session.getAttribute("logindeMemberId");

		if (memberIdObj == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		int memberId = memberIdObj;

		LocalDate s = LocalDate.parse(startDate);
		LocalDate e = LocalDate.parse(endDate);

		// ✅ 일일 업무일지들(예: boardId = 4)만 가져오도록 Dao에서 이미 처리해놨다는 전제
		List<WorkLog> logs = this.workLogService.getLogsByDateRange(memberId, s, e);

		if (logs == null || logs.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "해당 기간에 업무일지가 없습니다.");
		}

		StringBuilder sb = new StringBuilder();
		sb.append("아래는 ").append(s).append("부터 ").append(e).append("까지 작성한 업무일지 목록입니다.\n")
				.append("각 항목은 제목, 작성일, 주요 내용을 포함합니다.\n\n");

		int index = 1; // 번호 매기기용
		for (WorkLog log : logs) {
			String regDateStr = log.getRegDate();
			if (regDateStr != null && regDateStr.length() >= 10) {
				regDateStr = regDateStr.substring(0, 10); // yyyy-MM-dd
			}

			String title = (log.getTitle() != null && !log.getTitle().isBlank()) ? log.getTitle() : "(제목 없음)";

			String main = log.getMainContent();
			String mainSnippet = "";
			if (main != null && !main.isBlank()) {
				mainSnippet = main.length() > 400 ? main.substring(0, 400) + "..." : main;
			}

			sb.append(index++).append(". 제목: ").append(title).append("\n");
			if (regDateStr != null) {
				sb.append("   작성일: ").append(regDateStr).append("\n");
			}
			if (!mainSnippet.isBlank()) {
				sb.append("   내용: ").append(mainSnippet).append("\n");
			}
			sb.append("\n");
		}

		String worklogListText = sb.toString();

		// 👉 일단 주간이랑 같은 AI 메서드 재사용 (나중에 필요하면 generateMonthlySummary 따로 파도 됨)
		String aiSummary = workChatAIService.generateWeeklySummary(worklogListText);
		if (aiSummary == null || aiSummary.isBlank()) {
			aiSummary = worklogListText;
		}

		Map<String, String> result = new HashMap<>();
		result.put("summary", aiSummary);
		return result;
	}

	@PostMapping("/usr/work/monthly/register") // 월간 요약 후 게시판 등록
	public Map<String, Object> registerMonthlySummary(@RequestBody Map<String, String> body, HttpSession session) {
		Integer loginId = (Integer) session.getAttribute("logindeMemberId");
		if (loginId == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
		}
		int memberId = loginId;

		String startDateStr = body.get("startDate");
		String endDateStr = body.get("endDate");

		if (startDateStr == null || endDateStr == null) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "기간 정보가 없습니다.");
		}

		LocalDate s = LocalDate.parse(startDateStr);
		LocalDate e = LocalDate.parse(endDateStr);

		List<WorkLog> logs = this.workLogService.getLogsByDateRange(memberId, s, e);
		if (logs == null || logs.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "해당 기간에 업무일지가 없습니다.");
		}

		StringBuilder sb = new StringBuilder();
		sb.append("아래는 ").append(s).append("부터 ").append(e).append("까지 작성한 업무일지 목록입니다.\n")
				.append("각 항목은 제목, 작성일, 주요 내용을 포함합니다.\n\n");

		int index = 1;
		for (WorkLog log : logs) {
			String regDateStr = log.getRegDate();
			if (regDateStr != null && regDateStr.length() >= 10) {
				regDateStr = regDateStr.substring(0, 10); // yyyy-MM-dd
			}

			String title = (log.getTitle() != null && !log.getTitle().isBlank()) ? log.getTitle() : "(제목 없음)";

			String main = log.getMainContent();
			String mainSnippet = "";
			if (main != null && !main.isBlank()) {
				mainSnippet = main.length() > 400 ? main.substring(0, 400) + "..." : main;
			}

			sb.append(index++).append(". 제목: ").append(title).append("\n");
			if (regDateStr != null) {
				sb.append("   작성일: ").append(regDateStr).append("\n");
			}
			if (!mainSnippet.isBlank()) {
				sb.append("   내용: ").append(mainSnippet).append("\n");
			}
			sb.append("\n");
		}

		String worklogListText = sb.toString();

		// 👉 여기서도 일단 주간용 요약 메서드 재사용
		String aiSummary = workChatAIService.generateWeeklySummary(worklogListText);
		if (aiSummary == null || aiSummary.isBlank()) {
			aiSummary = worklogListText;
		}

		// 💡 월간 제목/기간 텍스트
		String title = String.format("월간 업무일지 (%s ~ %s)", s.toString(), e.toString());
		String periodText = String.format("%s ~ %s", s.toString(), e.toString());

		// 💾 DB에 저장할 WorkLog 객체 생성
		WorkLog monthlyLog = new WorkLog();
		monthlyLog.setTitle(title); // "월간 업무일지 (2025-12-01 ~ 2025-12-31)"
		monthlyLog.setMainContent(aiSummary); // 본문 = AI 요약
		monthlyLog.setSideContent(periodText); // 사이드 = 기간만 짧게
		monthlyLog.setTemplateId("TPLM1"); // 월간 전용 템플릿 ID (네가 그냥 약속한 값)
		monthlyLog.setSummaryContent("{}"); // 월간은 JSON 요약 안 쓰면 빈 객체

		// 📌 여기서 월간 게시판에 저장 (BOARD_ID_MONTHLY = 3 이라고 위에서 정의해둔 상수)
		int newId = this.workLogService.writeWorkLogToBoard(monthlyLog, memberId, BOARD_ID_MONTHLY);

		Map<String, Object> result = new HashMap<>();
		result.put("id", newId);
		result.put("message", "월간 요약 게시글이 등록되었습니다.");
		return result;
	}
}