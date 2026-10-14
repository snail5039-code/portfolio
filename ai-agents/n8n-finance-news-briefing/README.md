# 금융 뉴스 브리핑 Agent

자산운용사 리서치팀의 일일 뉴스 수집 과정에서 겪는 매체 편향·신호 대 잡음·중복 처리 문제를 해결하기 위한 n8n 자동화 워크플로우입니다. 매일 아침 4개 매체의 뉴스 중 금융 관련 기사만 걸러 요약해 Discord로 발송합니다.

## 핵심 아이디어

- 매일 08:30(Asia/Seoul) 연합뉴스·한국경제·매일경제·뉴시스 RSS를 병렬 수집
- 오늘 날짜 기사만 필터링 후, 발송 이력(Google Sheets)과 대조해 중복 제거
- 키워드 정규식으로 1차 필터링한 뒤 Google Gemini AI Agent가 요약/중요도/카테고리를 구조화된 JSON으로 생성
- 중요도 4 이상만 Discord로 발송, 발송 이력은 Google Sheets에 누적 기록
- 별도 에러 알림 워크플로우로 장애 발생 시 Discord 경고 발송

## 기술 스택

n8n, RSS, Google Gemini, Google Sheets, Discord Webhook

## 문서

- [구현 문서](./미니프로젝트2_박의혁.md)
- [메인 워크플로우 JSON](./금융_뉴스_브리핑_Agent.json)
- [에러 알림 워크플로우 JSON](./금융브리핑_에러알림.json)
