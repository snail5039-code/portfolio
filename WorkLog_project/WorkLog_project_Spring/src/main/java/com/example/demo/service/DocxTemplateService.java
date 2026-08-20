package com.example.demo.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFFooter;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.xmlbeans.XmlCursor;
import org.apache.xmlbeans.XmlObject;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRPr;
import org.springframework.stereotype.Service;

@Service
public class DocxTemplateService {

	// `${...}` 를 한 번에 훑어서 치환한다.
	// 예전에는 values(HashMap)를 순회하며 replace 를 반복했다. 순서가 정해져 있지 않아서,
	// 치환한 값 안에 또 다른 플레이스홀더 문자열이 들어 있으면 그것까지 2차로 치환됐다
	// (사용자가 본문에 `${from_name}` 이라고 적는 경우).
	private static final Pattern PLACEHOLDER = Pattern.compile("\\$\\{[^}]*\\}");

	private static final String W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
	private static final String TXBX_PATH = "declare namespace w='" + W_NS + "' .//w:txbxContent";
	private static final String P_PATH = "declare namespace w='" + W_NS + "' .//w:p";

	// 최종 완성된 docx 파일을 바이트 형태로 돌려주는 메서드임
	public byte[] fileTemplate(String templateFileName, Map<String, String> values) throws IOException {
		// classpath에서 템플릿 파일 열기, 즉 경로에서 여는 것
		String path = "templates/" + templateFileName;
		try (InputStream in = getClass().getClassLoader().getResourceAsStream(path)) {
			if (in == null) {
				throw new IllegalArgumentException("템플릿 파일을 찾을 수 없습니다." + path);
			}
			// XWPFDocument 도 try-with-resources 로 묶는다. 안에 OPCPackage 를 들고 있어
			// 닫지 않으면 다운로드 한 번마다 압축 해제된 XML 트리가 그대로 남는다.
			try (XWPFDocument doc = new XWPFDocument(in)) {
				// 본문 문단 · 표 · 머리글 · 바닥글 · 텍스트박스를 모두 훑는다.
				// 예전에는 본문 문단과 표 한 겹만 봤다. 양식4·6 은 텍스트박스를 쓰기 때문에
				// 그 안의 플레이스홀더가 `${...}` 문자열 그대로 인쇄됐다.
				replaceInParagraphs(doc.getParagraphs(), values);
				replaceInTables(doc.getTables(), values);

				for (XWPFHeader header : doc.getHeaderList()) {
					replaceInParagraphs(header.getParagraphs(), values);
					replaceInTables(header.getTables(), values);
				}
				for (XWPFFooter footer : doc.getFooterList()) {
					replaceInParagraphs(footer.getParagraphs(), values);
					replaceInTables(footer.getTables(), values);
				}

				replaceInTextBoxes(doc, values);

				// 메모리 저장 후 바이트 반환, 즉 word 파일 데이터를 메모리 저장
				ByteArrayOutputStream out = new ByteArrayOutputStream();
				doc.write(out);
				return out.toByteArray();
			}
		}
	}

	private void replaceInParagraphs(List<XWPFParagraph> paragraphs, Map<String, String> values) {
		for (XWPFParagraph p : paragraphs) {
			replaceInParagraph(p, values);
		}
	}

	// 표 안에는 표가 또 들어갈 수 있어서 셀마다 재귀로 내려간다.
	private void replaceInTables(List<XWPFTable> tables, Map<String, String> values) {
		for (XWPFTable table : tables) {
			for (XWPFTableRow row : table.getRows()) {
				for (XWPFTableCell cell : row.getTableCells()) {
					replaceInParagraphs(cell.getParagraphs(), values);
					replaceInTables(cell.getTables(), values);
				}
			}
		}
	}

	/**
	 * 텍스트박스(`w:txbxContent`) 안의 문단을 치환한다.
	 *
	 * POI 의 getParagraphs() 는 텍스트박스 안을 보여주지 않아서 XML 을 직접 훑는다.
	 * 커서를 열어둔 채로 문서를 고치면 위험하니 대상을 먼저 모아둔 뒤에 손댄다.
	 */
	private void replaceInTextBoxes(XWPFDocument doc, Map<String, String> values) {
		List<XmlObject> textBoxes = new ArrayList<>();

		XmlCursor boxCursor = doc.getDocument().newCursor();
		try {
			boxCursor.selectPath(TXBX_PATH);
			while (boxCursor.toNextSelection()) {
				textBoxes.add(boxCursor.getObject());
			}
		} finally {
			boxCursor.dispose();
		}

		for (XmlObject textBox : textBoxes) {
			List<CTP> paragraphs = new ArrayList<>();

			XmlCursor pCursor = textBox.newCursor();
			try {
				pCursor.selectPath(P_PATH);
				while (pCursor.toNextSelection()) {
					XmlObject object = pCursor.getObject();
					if (object instanceof CTP) {
						paragraphs.add((CTP) object);
					}
				}
			} finally {
				pCursor.dispose();
			}

			for (CTP ctp : paragraphs) {
				replaceInParagraph(new XWPFParagraph(ctp, doc), values);
			}
		}
	}

	/**
	 * 문단 하나를 치환한다.
	 *
	 * 문단은 `${업무` / `일자}` 처럼 run 여러 개로 쪼개져 있을 수 있어서, 텍스트를 전부
	 * 이어붙여 판단한 뒤 run 을 다시 만든다. 그때 첫 run 의 서식(rPr)을 물려준다 —
	 * 예전에는 서식 없이 createRun() 만 해서 템플릿에 지정된 10pt 가 날아가고
	 * 글자가 표를 넘쳤다.
	 */
	private void replaceInParagraph(XWPFParagraph p, Map<String, String> values) {
		List<XWPFRun> runs = p.getRuns();
		if (runs.isEmpty()) {
			return;
		}

		StringBuilder sb = new StringBuilder();
		for (XWPFRun run : runs) {
			// run.getText(0) 은 run 안의 첫 <w:t> 만 읽는다. 뒤쪽 <w:t> 는 읽지 못한 채
			// run 을 통째로 지우므로 그 글자들이 문서에서 사라졌다. text() 는 run 전체를 준다.
			String text = run.text();
			if (text != null) {
				sb.append(text);
			}
		}

		String original = sb.toString();
		if (original.isEmpty()) {
			return;
		}

		String replaced = replaceAllPlaceholders(original, values);
		if (original.equals(replaced)) {
			return;
		}

		// 새 run 에 물려줄 서식은 지우기 전에 챙겨둔다.
		CTRPr firstRunProperties = runs.get(0).getCTR().getRPr();
		CTRPr copiedProperties = firstRunProperties == null ? null : (CTRPr) firstRunProperties.copy();

		for (int i = runs.size() - 1; i >= 0; i--) {
			p.removeRun(i); // 기존에 있는 텍스트 조각들은 없애주는 것임!
		}

		setParagraphTextWithNewlines(p, replaced, copiedProperties);
	}

	// 줄 바꿈 메서드 안그러면 인수인계서 이상하게 나옴
	private void setParagraphTextWithNewlines(XWPFParagraph p, String text, CTRPr runProperties) {
		if (text == null)
			return;

		// 1) 줄바꿈 통일 (\r\n, \r -> \n)
		String normalized = text.replace("\r\n", "\n").replace("\r", "\n");

		// 2) 너무 많은 연속 줄바꿈은 줄이기
		// \n\n\n 이상 -> \n\n 으로 압축 (즉, "한 줄 띄움" 효과만 남김)
		normalized = normalized.replaceAll("\n{3,}", "\n\n");

		// 3) 줄 단위로 나눠서 워드에 넣기
		String[] lines = normalized.split("\n", -1);

		for (int i = 0; i < lines.length; i++) {
			XWPFRun r = p.createRun();

			if (runProperties != null) {
				// 서식은 run 마다 따로 들고 있어야 하므로 매번 복사해서 넣는다.
				r.getCTR().setRPr((CTRPr) runProperties.copy());
			}

			r.setText(lines[i]); // 내용이 빈 문자열("")이면 "빈 줄" 역할

			// 마지막 줄이 아니면 줄바꿈 추가
			if (i < lines.length - 1) {
				r.addBreak();
			}
		}
	}

	// 플레이스홀더를 실제값으로 바꿔주는 메서드임.
	// values 에 없는 플레이스홀더는 건드리지 않고 그대로 남긴다.
	private String replaceAllPlaceholders(String text, Map<String, String> values) {
		Matcher matcher = PLACEHOLDER.matcher(text);
		StringBuilder result = new StringBuilder();

		while (matcher.find()) {
			String placeholder = matcher.group();
			String value = values.get(placeholder);

			matcher.appendReplacement(result, Matcher.quoteReplacement(value != null ? value : placeholder));
		}
		matcher.appendTail(result);

		return result.toString();
	}
}
