# 아침 날씨·운세 알리미 (n8n + Discord)

매일 아침 정해진 시간에 오늘의 날씨와 개인화된 오늘의 운세를 정리해서 Discord로 자동 전송하는 n8n 워크플로우입니다.

## 핵심 아이디어

- 날씨는 Open-Meteo API에서 실측 데이터를 가져와 요약
- 운세는 생년월일 등 개인정보를 참고해 Google Gemini가 생성
- 매일 아침 9시 20분 Schedule Trigger로 완전 자동화

## 기술 스택

n8n, Google Gemini, Open-Meteo API, Discord Webhook

## 문서

- [기획문서](./n8n_날씨운세봇_기획문서.md)
