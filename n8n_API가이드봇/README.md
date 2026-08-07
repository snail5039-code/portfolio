# Public APIs 가이드 챗봇 (n8n + Telegram + Discord)

Telegram에서 질문을 하면 AI Agent가 public-apis 리스트를 지식베이스로 삼아 관련 API를 추천하고, 필요하면 실제 API를 호출해 데이터를 가져온 뒤 Telegram과 Discord 양쪽에 동시 전송하는 자동화 챗봇입니다.

## 핵심 아이디어

- "어떤 API를 써야 할지 모르겠어" → 챗봇이 즉시 추천
- 포켓몬 정보, 환율, 비트코인 시세 등 실시간 데이터를 Function Calling으로 직접 조회
- Telegram + Discord 양쪽 메신저로 동시 전송

## 기술 스택

n8n, Google Gemini / OpenAI, Telegram Bot API, Discord Webhook

## 문서

- [기획문서](./기획문서_API가이드봇.md)
