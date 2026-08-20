package com.example.demo.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.example.demo.dao.PageContentDao;
import com.example.demo.dto.PageContent;

class PageContentServiceTest {

	private final PageContentDao pageContentDao = mock(PageContentDao.class);
	private final PageContentService service = new PageContentService(pageContentDao, mock(PageCrawlerService.class));

	@Test
	void 챗봇_검색은_질문을_낱말로_쪼갠다() {
		PageContent guide = page(1L, "인수인계 안내");
		when(pageContentDao.searchByKeyword("인수인계서")).thenReturn(List.of(guide));

		List<PageContent> found = service.searchForChat("인수인계서 어떻게 만들어요?");

		assertEquals(List.of(guide), found);
		// 문장 전체를 그대로 넘기면 본문에 그 문장이 통째로 있어야 걸린다 — 그게 예전 방식이다.
		verify(pageContentDao, never()).searchByKeyword("인수인계서 어떻게 만들어요?");
	}

	@Test
	void 많이_걸린_문서가_앞에_온다() {
		PageContent guide = page(1L, "업무일지 작성 안내");
		PageContent faq = page(2L, "자주 묻는 질문");

		when(pageContentDao.searchByKeyword("업무일지")).thenReturn(List.of(faq, guide));
		when(pageContentDao.searchByKeyword("작성")).thenReturn(List.of(guide));

		List<PageContent> found = service.searchForChat("업무일지 작성");

		assertEquals(List.of(guide, faq), found);
	}

	@Test
	void 검색어가_없으면_전체를_준다() {
		PageContent guide = page(1L, "안내");
		when(pageContentDao.findAll()).thenReturn(List.of(guide));

		assertEquals(List.of(guide), service.searchByKeyword(null));
		assertEquals(List.of(guide), service.searchByKeyword("  "));
		verify(pageContentDao, never()).searchByKeyword(anyString());
	}

	private PageContent page(Long id, String title) {
		PageContent page = new PageContent();
		page.setId(id);
		page.setTitle(title);
		return page;
	}
}
