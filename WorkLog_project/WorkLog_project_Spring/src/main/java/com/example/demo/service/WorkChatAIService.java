package com.example.demo.service;

import java.time.LocalDate;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.example.demo.util.FileTextExtractor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

@Service
public class WorkChatAIService {

	// final로 생성자 주입
	private final ChatClient chatClient;
	private final ObjectMapper objectMapper;
	private final TemplateMetaService templateMetaService;

	// AI는 빌더로 주입
	public WorkChatAIService(ChatClient.Builder chatClientBuilder, TemplateMetaService templateMetaService) {
		this.chatClient = chatClientBuilder.build();
		this.templateMetaService = templateMetaService;
		this.objectMapper = new ObjectMapper();
	}

	/** 지정하지 않으면 TPL1 이다. 아래 날짜 필드 이름을 만들 때 쓴다. */
	private String resolveTemplateId(String templateId) {
		return (templateId == null || templateId.isBlank()) ? "TPL1" : templateId.toUpperCase();
	}

	// 최종 생성보고서라는 뜻
	public String generateFinalReport(String templateId, String newContent) throws Exception {
		System.out.println("[AI] generateFinalReport templateId = " + templateId);
		String systemPrompt = templateMetaService.buildSystemPrompt(templateId);

		// 2) 유저 프롬프트: 사용자가 쓴 업무일지 원문 전달
		String userPrompt = """
				다음은 사용자가 작성한 업무일지 원문입니다.
				이 내용을 바탕으로 위 템플릿 JSON의 각 필드 값을 채워 주세요.

				---
				%s
				---
				""".formatted(newContent);

		// 3) AI 호출
		String rawAiResponse = chatClient.prompt().system(systemPrompt).user(userPrompt).call().content();

		// ⭐️ [로그 추가] AI 응답 원본 로그 (디버깅용)
		System.out.println("--- AI 응답 원본 (RAW) ---");
		System.out.println(rawAiResponse);
		System.out.println("--------------------------");

		// 응답이 비거나 null이면 바로 fallback JSON
		if (rawAiResponse == null || rawAiResponse.isBlank()) {
			return buildFallbackJson(templateId, "");
		}

		// A. 마크다운 백틱 제거
		String cleanJson = rawAiResponse.trim().replaceAll("```json", "").replaceAll("```", "").trim();

		// B. JSON 시작 위치 찾기 ({ 또는 [)
		int jsonStartIndex = -1;
		int braceIndex = cleanJson.indexOf('{');
		int bracketIndex = cleanJson.indexOf('[');

		if (braceIndex != -1 && (bracketIndex == -1 || braceIndex < bracketIndex)) {
			jsonStartIndex = braceIndex; // { 가 먼저
		} else if (bracketIndex != -1) {
			jsonStartIndex = bracketIndex; // [ 가 먼저
		}

		if (jsonStartIndex == -1) {
			// JSON 시작 자체를 못 찾으면 → 공통 fallback JSON
			System.out.println("[AI] JSON 시작 문자({ 또는 [)를 찾지 못했습니다. fallback 반환");
			return buildFallbackJson(templateId, rawAiResponse);
		}

		cleanJson = cleanJson.substring(jsonStartIndex).trim();

		// C. JSON 끝 위치 찾기 (마지막 } 또는 ])
		int lastBrace = cleanJson.lastIndexOf('}');
		int lastBracket = cleanJson.lastIndexOf(']');
		int endIndex = Math.max(lastBrace, lastBracket);

		if (endIndex == -1) {
			// 닫는 괄호 못 찾으면 → 공통 fallback JSON
			System.out.println("[AI] JSON 닫는 문자(} 또는 ])를 찾지 못했습니다. fallback 반환");
			return buildFallbackJson(templateId, rawAiResponse);
		}

		cleanJson = cleanJson.substring(0, endIndex + 1).trim();

		// 3. 최종 JSON 검증 + (필요하면 날짜 필드 주입)
		try {
			JsonNode root = objectMapper.readTree(cleanJson);

			if (root.isObject()) {
				ObjectNode obj = (ObjectNode) root;

				// 날짜는 AI 에게 맡기지 않고 서버 날짜를 넣는다.
				// 예전에는 어떤 템플릿이든 TPL1_DATE 만 넣었다. TPL3~6 은 TPL3_DATE …
				// 를 쓰므로 주입값은 버려지고 AI 가 지어낸 날짜가 문서에 들어갔다.
				// 날짜 필드가 없는 템플릿(TPL7)에는 넣지 않는다.
				String dateKey = resolveTemplateId(templateId) + "_DATE";

				boolean hasDateField = templateMetaService.getFields(templateId).stream()
						.anyMatch(field -> field.getKey().equals(dateKey));

				if (hasDateField) {
					obj.put(dateKey, LocalDate.now().toString());
				}

				cleanJson = objectMapper.writeValueAsString(obj);
			}

			System.out.println("--- AI 최종 반환 값 (CLEAN JSON) ---");
			System.out.println(cleanJson);
			System.out.println("-----------------------------------");

			return cleanJson;
		} catch (Exception jsonError) {
			System.err.println("[AI] 최종 AI 응답이 유효한 JSON 형식이 아닙니다. fallback JSON 반환.");
			jsonError.printStackTrace();
			return buildFallbackJson(templateId, rawAiResponse);
		}
	}

	/** 사용자가 미리보기에서 편집한 요약이 문서 생성에 쓸 수 있는 JSON 객체인지 확인한다. */
	public String validateEditedSummary(String summaryContent) {
		if (summaryContent == null || summaryContent.isBlank()) {
			return null;
		}
		try {
			JsonNode root = objectMapper.readTree(summaryContent);
			if (!root.isObject()) {
				throw new IllegalArgumentException("AI 요약은 JSON 객체 형식이어야 합니다.");
			}
			return objectMapper.writeValueAsString(root);
		} catch (IllegalArgumentException e) {
			throw e;
		} catch (Exception e) {
			throw new IllegalArgumentException("AI 요약 JSON 형식이 올바르지 않습니다.");
		}
	}

	public String generateHandoverSummary(String worklogListText) {
		// 1) AI한테 역할 알려주는 시스템 프롬프트
		String systemPrompt = """
				당신은 업무 인수인계서를 작성하는 한국어 보조자입니다.
				         사용자가 넘겨주는 텍스트는 일정 기간 동안 작성한 업무일지 목록입니다.

				         이 내용을 바탕으로 인수인계서의 "인수인계 사항"에 들어갈 내용을 작성하세요.

				         출력 형식(예시 구조):
				         1. 현재 담당 중인 주요 업무
				            - ...
				            - ...

				         2. 후임자가 이어서 해야 할 작업
				            - ...
				            - ...

				         3. 주의해야 할 이슈 / 위험 요소
				            - ...
				            - ...

				         4. 참고해야 할 시스템 / 문서 / 계정 정보
				            - ...
				            - ...

				         작성 규칙:
				         1. 각 번호(1,2,3,4)는 반드시 줄의 맨 앞에서 시작합니다.
				         2. 각 번호 아래 내용은 여러 개의 '- ' 불릿으로 작성합니다.
				         3. 각 번호 블록 사이에는 반드시 빈 줄(\\n\\n)을 한 줄 넣습니다.
				         4. 한 문단이 너무 길어지지 않게 2~3문장 정도로 나누세요.
				         5. "###" 같은 마크다운 제목은 사용하지 마세요.
				         6. 전체 분량은 A4 1페이지 안에 들어갈 정도로 적당히 요약합니다.
				         """;

		// 2) 실제 업무일지 목록을 포함하는 유저 프롬프트
		String userPrompt = """
				아래는 사용자가 선택한 기간 동안 작성한 업무일지 목록입니다.

				이 목록을 보고, 위 규칙에 맞게
				"인수인계 사항"에 들어갈 내용을 한국어로 정리해 주세요.

				----- 업무일지 목록 시작 -----
				%s
				----- 업무일지 목록 끝 -----
				""".formatted(worklogListText);

		String result = chatClient.prompt().system(systemPrompt).user(userPrompt).call().content();

		// 🔻🔻🔻 여기부터 "후처리" 추가한 부분 🔻🔻🔻
		if (result != null) {
			// 혹시 제목 같은 거 붙어오면 제거
			result = result.replace("### 인수인계 사항", "");
			// 필요하면 모든 ###제목 날려버리기
			result = result.replaceAll("###.*\\n", "");

			// 줄바꿈 정리 (윈도우/리눅스 섞여도 안전하게)
			result = result.replace("\r\n", "\n");

			// 너무 많은 개행 줄이기
			result = result.replaceAll("\n{3,}", "\n\n");

			// 문단 사이를 벌리려고 모든 개행을 두 배로 늘렸던 적이 있는데,
			// 그러면 불릿(`- `) 사이까지 빈 줄이 생겨 인수인계서 줄 간격이 전부 벌어졌다.
			// 번호 블록(1. 2. 3. 4.) 앞에만 빈 줄을 넣는다.
			result = result.replaceAll("\n(?=[1-9]\\. )", "\n\n");
			result = result.replaceAll("\n{3,}", "\n\n");
		}

		if (result == null || result.isBlank()) {
			return worklogListText; // 그래도 실패하면 재료 텍스트라도 반환
		}
		return result.trim();
	}

	// ✨ 어떤 템플릿이든 공통으로 쓰는 fallback JSON
	private String buildFallbackJson(String templateId, String rawAiResponse) {
		try {
			ObjectNode root = objectMapper.createObjectNode();

			// 메타 정보 (어떤 템플릿에서 실패했는지)
			ObjectNode meta = objectMapper.createObjectNode();
			meta.put("templateId", templateId);
			meta.put("status", "ERROR");
			root.set("_meta", meta);

			// 사람이 읽을 수 있는 메시지
			root.put("message", "AI 요약 JSON 생성 실패");

			// AI가 실제로 뭐라고 했는지 전체 저장 (디버깅용, 화면 표시용)
			root.put("raw", rawAiResponse);

			return objectMapper.writeValueAsString(root);
		} catch (Exception e) {
			// 여기서까지 터질 일은 거의 없음. 그래도 최후의 수단으로 최소 JSON 반환
			return """
					{
					  "_meta": { "status": "ERROR", "templateId": "%s" },
					  "message": "AI 요약 JSON 생성 실패 (fallback 내부 에러)",
					  "raw": ""
					}
					""".formatted(templateId);
		}
	}
	// 주간
	public String generateWeeklySummary(String workLogListText) {
		// 1) AI 역할 설명 (주간 업무 요약용 시스템 프롬프트)
		String systemPrompt = """
				당신은 회사에서 사용하는 '주간 업무일지'를 작성하는 한국어 보조자입니다.
				사용자가 넘겨주는 텍스트는 특정 주(기간) 동안 작성한 여러 개의 일일 업무일지 목록입니다.

				아래 조건을 지켜서 '주간 업무 요약'을 작성하세요.

				[작성 목표]
				- 이 주에 했던 주요 업무들을 항목별로 정리합니다.
				- 중요한 이슈, 장애, 협업, 일정 변경 등이 있었다면 따로 강조합니다.
				- 다음 주에 이어서 해야 할 일(To-do)도 정리합니다.

				[형식 예시]
				1. 이번 주 주요 업무
				   - ...
				   - ...

				2. 이슈 / 위험 요소
				   - ...

				3. 협업 및 커뮤니케이션
				   - ...

				4. 다음 주 계획 / To-do
				   - ...

				[작성 규칙]
				- 한국어로 자연스럽게 작성합니다.
				- 번호(1,2,3,4)는 줄의 맨 앞에서 시작합니다.
				- 각 번호 아래는 '- ' 불릿으로 정리합니다.
				- 문단 사이에는 한 줄 정도의 여백이 있도록 개행을 적절히 넣습니다.
				- 불필요한 마크다운 제목(예: ### 제목)은 사용하지 않습니다.
				""";

		// 2) 실제 업무일지 목록이 들어가는 유저 프롬프트
		String userPrompt = """
				아래는 사용자가 선택한 기간(1주일) 동안 작성한 일일 업무일지 목록입니다.

				이 내용을 보고, 위의 규칙에 맞게
				'주간 업무 요약'을 한국어로 정리해 주세요.

				----- 업무일지 목록 시작 -----
				%s
				----- 업무일지 목록 끝 -----
				""".formatted(workLogListText);

		// 3) AI 호출
		String result = chatClient.prompt().system(systemPrompt).user(userPrompt).call().content();
		// 4) 후처리 & fallback
		if (result != null) {
			// 혹시 '### 제목' 같은 마크다운 헤더가 섞여 오면 제거
			result = result.replaceAll("###.*\\n", "");
			result = result.replace("\r\n", "\n");
			result = result.replace("\n\n\n", "\n\n");
		}

		if (result == null || result.isBlank()) {
			// 그래도 실패하면, 최소한 재료 텍스트라도 리턴
			return workLogListText;
		}

		return result.trim();
	}

	public String generateMonthlySummary(String workLogListText) {
		String systemPrompt = """
				당신은 회사에서 사용하는 '월간 업무보고서'를 작성하는 한국어 보조자입니다.
				사용자가 넘겨주는 텍스트는 특정 월 동안 작성한 여러 개의 일일 업무일지 목록입니다.

				다음 형식을 정확히 지켜 월간 관점으로 통합해 주세요.
				1. 이번 달 주요 업무와 성과
				   - ...

				2. 이슈 / 위험 요소
				   - ...

				3. 협업 및 주요 변화
				   - ...

				4. 다음 달 계획 / To-do
				   - ...

				한국어로 작성하고 번호는 줄 맨 앞에 두며 각 항목은 '- ' 불릿으로 정리하세요.
				'이번 주', '다음 주', 마크다운 제목(###) 표현은 사용하지 마세요.
				""";
		String userPrompt = """
				아래 월간 업무일지 목록을 바탕으로 월간 업무보고서를 작성해 주세요.

				----- 업무일지 목록 시작 -----
				%s
				----- 업무일지 목록 끝 -----
				""".formatted(workLogListText);
		String result = chatClient.prompt().system(systemPrompt).user(userPrompt).call().content();
		if (result != null) {
			result = result.replaceAll("###.*\\n", "").replace("\r\n", "\n").replaceAll("\n{3,}", "\n\n");
		}
		return result == null || result.isBlank() ? workLogListText : result.trim();
	}

}
