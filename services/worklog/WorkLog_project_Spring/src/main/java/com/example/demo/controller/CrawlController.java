package com.example.demo.controller;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dto.PageContent;
import com.example.demo.service.PageContentService;

import jakarta.servlet.http.HttpSession;

@RestController
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174"}, allowCredentials = "true")
@RequestMapping("/api")
public class CrawlController {

	// 관리자 판정은 이 프로젝트의 다른 곳(공지사항 작성)과 같은 규칙을 쓴다.
	private static final int ADMIN_MEMBER_ID = 1;

	private final PageContentService pageContentService;

	public CrawlController(PageContentService pageContentService) {
		this.pageContentService = pageContentService;
	}

	// url 하나 받아서 크롤링 + 저장
    @PostMapping("/crawl")
    public ResponseEntity<?> crawl(@RequestParam String url, HttpSession session) {
        return doCrawl(url, session);
    }

    @GetMapping("/crawl")
    public ResponseEntity<?> testCrawl(@RequestParam String url, HttpSession session) {
        return doCrawl(url, session);
    }

    /**
     * 크롤링은 서버가 대신 요청을 보내는 일(SSRF)이다.
     *
     * 예전에는 인증도 검사도 없이 열려 있어서, 외부인이 내부 주소를 서버에게
     * 대신 요청시키고 그 결과를 `/api/pages` 로 읽어갈 수 있었다.
     * 크롤링해둔 내용은 챗봇 프롬프트에도 들어가므로 컨텍스트 오염 경로이기도 하다.
     */
    private ResponseEntity<?> doCrawl(String url, HttpSession session) {
        Integer memberId = (Integer) session.getAttribute("logindeMemberId");

        if (memberId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }
        if (memberId != ADMIN_MEMBER_ID) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "크롤링은 관리자만 할 수 있습니다.");
        }

        validatePublicHttpUrl(url);

        try {
            PageContent saved = pageContentService.crawlAndSave(url);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("크롤링 실패: " + e.getMessage());
        }
    }

    /** http(s) 이면서 내부망을 가리키지 않는 주소만 통과시킨다. */
    private void validatePublicHttpUrl(String url) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "주소 형식이 올바르지 않습니다.");
        }

        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "http 또는 https 주소만 크롤링할 수 있습니다.");
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "주소에 호스트가 없습니다.");
        }

        // 이름을 확인한 뒤 실제 요청까지 사이에 DNS 가 바뀌는 경우(rebinding)까지는
        // 막지 못한다. 그래서 관리자 확인을 함께 둔다.
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isLoopbackAddress() || address.isAnyLocalAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "내부망 주소는 크롤링할 수 없습니다.");
                }
            }
        } catch (UnknownHostException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "주소를 찾을 수 없습니다: " + host);
        }
    }
}
