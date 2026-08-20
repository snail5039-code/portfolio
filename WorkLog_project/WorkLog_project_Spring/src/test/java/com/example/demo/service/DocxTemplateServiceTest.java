package com.example.demo.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.junit.jupiter.api.Test;

/**
 * 템플릿 치환이 문서의 모든 자리에 닿는지 확인한다.
 *
 * 치환 코드와 같은 방식으로 검사하면 못 닿는 자리를 못 닿는 채로 통과시키게 되므로,
 * docx 를 압축 파일로 열어 XML 을 직접 훑는 방식으로 따로 센다.
 * (머리글·바닥글·텍스트박스도 각각 별개의 XML 로 들어 있다.)
 */
class DocxTemplateServiceTest {

	private static final Pattern PLACEHOLDER = Pattern.compile("\\$\\{[^}]{1,100}\\}");

	private static final List<String> TEMPLATES = List.of("업무일지양식1.docx", "업무일지양식3.docx", "업무일지양식4.docx",
			"업무일지양식5.docx", "업무일지양식6.docx", "업무일지양식7.docx", "주간업무보고서.docx", "월간업무보고서.docx", "업무 인수인계서.docx");

	private final DocxTemplateService service = new DocxTemplateService();

	@Test
	void 템플릿에_남아있는_플레이스홀더가_없다() throws Exception {
		for (String templateName : TEMPLATES) {
			byte[] original = readTemplate(templateName);
			Set<String> placeholders = findPlaceholders(original);

			assertFalse(placeholders.isEmpty(), templateName + " 에서 플레이스홀더를 찾지 못했다");

			Map<String, String> values = new HashMap<>();
			for (String placeholder : placeholders) {
				values.put(placeholder, "치환된값");
			}

			byte[] filled = service.fileTemplate(templateName, values);
			Set<String> remaining = findPlaceholders(filled);

			assertTrue(remaining.isEmpty(), templateName + " 에 치환되지 않은 플레이스홀더가 남았다: " + remaining);
		}
	}

	private byte[] readTemplate(String templateName) throws Exception {
		try (InputStream in = getClass().getClassLoader().getResourceAsStream("templates/" + templateName)) {
			if (in == null) {
				throw new IllegalStateException("템플릿을 찾을 수 없다: " + templateName);
			}
			return in.readAllBytes();
		}
	}

	/** docx 안의 모든 XML 조각에서 `${...}` 를 찾는다. */
	private Set<String> findPlaceholders(byte[] docx) throws Exception {
		Set<String> found = new LinkedHashSet<>();

		try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(docx))) {
			ZipEntry entry;
			while ((entry = zip.getNextEntry()) != null) {
				if (!entry.getName().endsWith(".xml")) {
					continue;
				}

				ByteArrayOutputStream out = new ByteArrayOutputStream();
				zip.transferTo(out);

				// 워드는 `${업무` / `일자}` 처럼 한 낱말을 run 여러 개로 쪼개 저장한다.
				// 태그를 걷어내고 나서 찾아야 쪼개진 플레이스홀더도 보인다.
				String text = out.toString("UTF-8").replaceAll("<[^>]+>", "");

				Matcher matcher = PLACEHOLDER.matcher(text);
				while (matcher.find()) {
					found.add(matcher.group());
				}
			}
		}

		return found;
	}
}
