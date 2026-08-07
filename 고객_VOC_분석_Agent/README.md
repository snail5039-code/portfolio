# 고객 VOC 분석 Agent

종합 쇼핑몰의 고객 문의(VOC)를 자동으로 분류·처리하는 n8n 워크플로우 미니 프로젝트입니다. 담당자가 매번 문의를 직접 읽고 분류하지 않아도, 감정/긴급도를 자동 판정하고 긴급 건만 실시간으로 알림을 보내도록 만들었습니다.

## 핵심 아이디어

- Google Form으로 접수된 고객 문의를 Google Sheets에 저장
- n8n이 중복 확인 → LLM(Gemini) 분류 → 검증 → 결과 저장 → 긴급 여부 분기까지 자동 처리
- Structured Output Parser로 감정분석/긴급도/요약을 고정된 스키마로 강제
- 긴급 문의는 Discord Webhook으로 실시간 알림

## 기술 스택

n8n, Google Form/Sheets, Google Gemini(`gemini-3.5-flash`), Discord Webhook

## 문서

- [기획문서](./기획문서.md)
- [구현 보고서](./미니프로젝트1_박의혁.md)
- [n8n 워크플로우 JSON](<./[미니프로젝트1] 고객 VOC 분석.json>)
