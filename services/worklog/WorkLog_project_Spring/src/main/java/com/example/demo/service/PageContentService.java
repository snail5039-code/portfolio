package com.example.demo.service;

import java.io.IOException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.example.demo.dao.PageContentDao;
import com.example.demo.dto.PageContent;


@Service
public class PageContentService {

	// 어느 문서에나 걸리는 말들. 검색어에서 뺀다.
	private static final Set<String> STOP_WORDS = Set.of("어떻게", "무엇", "뭐야", "뭔가요", "어디", "언제", "누가", "왜", "알려줘",
			"알려주세요", "해줘", "해주세요", "하나요", "합니까", "인가요", "입니까", "있나요", "궁금해", "궁금합니다", "방법", "그리고", "그런데");

	private final PageContentDao pageContentDao;
	private final PageCrawlerService crawlerService;
	
	public PageContentService(PageContentDao pageContentDao, PageCrawlerService crawlerService) {
		this.pageContentDao = pageContentDao;
		this.crawlerService = crawlerService;
	}
	
	public PageContent crawlAndSave(String url) throws IOException {
		// 1. 먼저 Jsoup으로 해당 URL 페이지 긁어오기
        PageContent crawled = crawlerService.crawl(url);
        
     // 2. 이 URL이 DB에 이미 있는지 확인
        PageContent existing = pageContentDao.findByUrl(url);
        
        if (existing == null) {
            // 2-1. 없으면 새로 INSERT
            pageContentDao.insert(crawled);
            return crawled;
        } else {
            // 2-2. 있으면 내용만 업데이트
            existing.setTitle(crawled.getTitle());
            existing.setContent(crawled.getContent());
            existing.setCrawledAt(crawled.getCrawledAt());

            pageContentDao.update(existing);
            return existing;
        }
	}

	/**
	 * 챗봇용 검색.
	 *
	 * 예전에는 질문 문장을 그대로 LIKE 패턴으로 썼다. "인수인계서 어떻게 만들어요?" 라는
	 * 문장이 문서 본문에 통째로 들어 있을 일은 없으니 결과는 거의 항상 0건이었고,
	 * 크롤링해둔 내용이 챗봇 프롬프트에 실리지 않았다.
	 * 낱말로 쪼개 각각 찾고, 많이 걸린 문서를 앞에 둔다.
	 */
	public List<PageContent> searchForChat(String question) {
		if (question == null || question.isBlank()) {
			return List.of();
		}

		List<String> keywords = extractKeywords(question);

		if (keywords.isEmpty()) {
			return this.pageContentDao.searchByKeyword(question);
		}

		// 문서 id 별로 몇 개의 낱말이 걸렸는지 센다.
		Map<Long, PageContent> pages = new LinkedHashMap<>();
		Map<Long, Integer> hits = new HashMap<>();

		for (String keyword : keywords) {
			for (PageContent page : this.pageContentDao.searchByKeyword(keyword)) {
				pages.putIfAbsent(page.getId(), page);
				hits.merge(page.getId(), 1, Integer::sum);
			}
		}

		return pages.values().stream()
				.sorted(Comparator.comparingInt((PageContent page) -> hits.get(page.getId())).reversed())
				.toList();
	}

	/**
	 * 질문에서 찾을 낱말만 골라낸다.
	 *
	 * 한 글자 낱말과 흔한 의문사는 어느 문서에나 걸려서 순위를 흐리므로 뺀다.
	 * LIKE 와일드카드(% _)는 지운다.
	 */
	private List<String> extractKeywords(String question) {
		return Arrays.stream(question.split("[\\s?!.,~()\\[\\]\"']+"))
				.map(word -> word.replaceAll("[%_]", ""))
				.filter(word -> word.length() >= 2)
				.filter(word -> !STOP_WORDS.contains(word))
				.distinct()
				.limit(5)
				.toList();
	}

	public List<PageContent> searchByKeyword(String question) {
		// 키워드가 없으면 전체를 준다. 예전에는 null 을 그대로 넘겨서
		// LIKE CONCAT('%', NULL, '%') 가 되어 항상 빈 목록이 나왔다.
		if (question == null || question.isBlank()) {
			return this.pageContentDao.findAll();
		}

		return this.pageContentDao.searchByKeyword(question);
	}

}
