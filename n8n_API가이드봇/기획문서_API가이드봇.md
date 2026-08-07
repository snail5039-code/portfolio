# Public APIs 가이드 챗봇 (n8n + Telegram + Discord) 🤖📚

## 프로젝트 개요

사용자가 **Telegram**에서 질문을 하면, AI Agent가 **public-apis-4Kr 리스트**를 지식베이스로 삼아 관련 API를 추천하고, 필요시 실제 API를 호출해서 데이터를 가져온 뒤 결과를 **Telegram + Discord** 양쪽에 동시 전송하는 자동화 챗봇입니다.

## 목표 및 의도

- 📖 "어떤 API 써야 하는지 모르겠어" → 챗봇에 물어보면 즉시 추천
- 🔍 "포켓몬 리자몬 정보 알려줘" → 직접 API 호출해서 실시간 데이터 제공
- 💱 "달러 환율 얼마?" → 환율 API로 현재가 조회
- 💹 "비트코인 시세" → 업비트 API로 시세 조회
- 🤖 AI Agent의 Function Calling으로 자연스러운 대화 경험 제공
- 🔀 양쪽 메신저(Telegram + Discord)에 자동 동시 전송

## 워크플로우 구조

```
[Telegram Trigger (message)]
            │
            ▼
       [AI Agent] ──(Chat Model: Gemini/OpenAI)
            │        ──(Memory: Window Buffer, session=chat_id)
            │        ──(Tool 1: 포켓몬 도감 - HTTP Request)
            │        ──(Tool 2: 업비트 시세 - HTTP Request)
            │        ──(Tool 3: 환율 조회 - HTTP Request)
            │        ──(System Prompt: public-apis-4Kr 요약 내장)
            │
            ├──▶ [Telegram (reply, sendMessage)]
            └──▶ [Discord (send via Webhook)]
```

## 주요 구성 요소

### 1. Telegram Trigger
- 사용자가 Telegram에서 메시지 전송
- 메시지 텍스트, chat_id, user_id 등 메타데이터 추출

### 2. AI Agent (System Prompt 포함)

**역할**: Public APIs 가이드 챗봇

**System Prompt에 내장할 지식**:
- public-apis-4Kr에서 추출한 인기 API 목록 (카테고리별 20~30개)
  - 날씨: Open-Meteo, WeatherAPI, AccuWeather
  - 금융: Upbit, Coinbase, FinanceAPI
  - 게임/엔터: PokeAPI, IGDB, TMDB, Spotify
  - 번역: Google Translate API, Papago API
  - 이미지: Unsplash, Pexels, Pixabay
  - 뉴스: NewsAPI, Newsdata.io
  - 기타: IP geolocation, 약국 위치, 지하철 정보 등

**동작 로직**:
1. 사용자가 "포켓몬 리자몬 정보" 물으면 → Tool 1 (Pokemon API) 호출
2. "비트코인 시세" 물으면 → Tool 2 (Upbit API) 호출
3. "환율 알려줘" 물으면 → Tool 3 (Frankfurter API) 호출
4. "어떤 날씨 API 있어?" 물으면 → System Prompt의 지식으로만 답변 (Tool 호출 없음)
5. 최종 답변을 포맷된 텍스트로 생성

### 3. Tool 1: 포켓몬 도감 조회

**설정**:
```
Tool 이름: Pokemon Info Lookup
설명: 포켓몬 이름을 받으면 영어로 변환해서 도감 정보를 조회한다

HTTP Request:
  Method: GET
  URL: https://pokeapi.co/api/v2/pokemon/{{ $fromAI("pokemon_name", "포켓몬 영문 이름 소문자") }}
  
인증: 없음 (무료)

응답 처리:
  - name (이름)
  - height (높이)
  - weight (무게)
  - types (속성)
  - abilities (특성)
  - stats (능력치)
```

**예시 입력/출력**:
```
User: "리자몬 정보 알려줘"
AI: "리자몬"을 영문으로 변환 → "charizard"
URL: https://pokeapi.co/api/v2/pokemon/charizard
Response: {name: "charizard", height: 17, weight: 905, types: ["flying", "fire"], ...}
Output: "🔥 리자몬(Charizard)\n높이: 1.7m, 무게: 90.5kg\n속성: 불꽃/비행\n특성: ..."
```

### 4. Tool 2: 업비트 시세 조회

**설정**:
```
Tool 이름: Upbit Ticker
설명: 사용자가 코인 시세를 물으면 현재가를 조회한다

HTTP Request:
  Method: GET
  URL: https://api.upbit.com/v1/ticker?markets={{ $fromAI("market_code", "예: KRW-BTC, KRW-ETH (쉼표 구분)") }}
  
인증: 없음 (시세 조회는 공개 API)

응답 처리:
  - market (마켓코드)
  - trade_price (현재가)
  - change_rate (변동률)
  - signed_change_price (변동액)
```

**예시 입력/출력**:
```
User: "비트코인 시세 얼마야?"
AI: 코인명 → 마켓코드 변환 → "KRW-BTC"
URL: https://api.upbit.com/v1/ticker?markets=KRW-BTC
Response: [{market: "KRW-BTC", trade_price: 45000000, change_rate: 0.023, ...}]
Output: "₿ 비트코인 (BTC)\n현재가: ₩45,000,000\n변동률: +2.3% ↑"
```

### 5. Tool 3: 환율 조회

**설정**:
```
Tool 이름: Exchange Rate Lookup
설명: 사용자가 환율을 물으면 현재 환율을 조회한다

HTTP Request:
  Method: GET
  URL: https://api.frankfurter.app/latest?from={{ $fromAI("from_currency", "예: USD, JPY, CNY (대문자)") }}&to=KRW
  
인증: 없음 (무료)

응답 처리:
  - from (기준 통화)
  - to (대상 통화)
  - rates (환율)
```

**예시 입력/출력**:
```
User: "달러 환율 얼마?"
AI: 달러 → "USD"로 변환
URL: https://api.frankfurter.app/latest?from=USD&to=KRW
Response: {from: "USD", to: "KRW", rates: {KRW: 1305.50}}
Output: "💵 USD → KRW\n1 달러 = ₩1,305.50"
```

### 6. Telegram Reply 노드

AI Agent의 결과를 사용자가 질문한 Telegram 채널에 reply로 전송

### 7. Discord Webhook

같은 결과를 Discord의 지정된 채널로 Webhook을 통해 동시 전송

## AI 프롬프트 설계

### System Message 템플릿

```
당신은 개발자들을 위한 "Public APIs 가이드 챗봇"입니다.

【역할】
사용자가 API와 관련된 질문을 하면:
1. 질문에 맞는 무료/공개 API 추천
2. 필요시 실제 API 호출해서 데이터 제공

【내장 API 지식】(public-apis-4Kr 기반)
[카테고리별 API 목록 - 20~30개 요약]
- 게임/엔터: PokeAPI(포켓몬), IGDB(게임), TMDB(영화), Spotify(음악)
- 금융: Upbit(암호화폐), Frankfurter(환율), AlphaVantage(주식)
- 날씨: Open-Meteo, WeatherAPI, AccuWeather
- 이미지: Unsplash, Pexels, Pixabay
- 번역: Papago, Google Translate API
- 뉴스: NewsAPI, Newsdata.io
- [기타 카테고리...]

【활용 가능한 Tool】
1. Pokemon Info Lookup: 포켓몬 도감 정보
2. Upbit Ticker: 암호화폐 시세
3. Exchange Rate Lookup: 실시간 환율

【동작 규칙】
- 사용자가 "포켓몬", "역할", "능력치" → Tool 1 호출
- 사용자가 "시세", "가격", "BTC", "ETH" → Tool 2 호출
- 사용자가 "환율", "달러", "엔화", "환전" → Tool 3 호출
- 단순 추천/설명 질문은 Tool 없이 System Prompt 지식으로 답변

【출력 형식】
- 짧고 간결 (2~4문장 + 데이터)
- 이모지 활용해서 가독성 향상
- 필요시 마크다운 표 사용
- 불확실한 정보는 생성하지 말 것
- 추천할 때는 "왜 이 API인지" 짧게 설명

【예시】
Q: "포켓몬 피카츄 정보 알려줘"
A: 🔌 **피카츄(Pikachu)**
높이: 0.4m | 무게: 6kg | 속성: 전기
특성: 정적기 | 숨겨진 특성: 번개피뢰침

Q: "어떤 날씨 API 있어?"
A: 🌤️ 날씨 API 추천:
• **Open-Meteo** - 무료, 가장 가볍고 빠름
• **WeatherAPI** - 더 상세한 데이터 (일부 유료)
• **AccuWeather** - 정확도 높음 (인증키 필요)

Q: "비트코인 가격?"
A: ₿ **BTC (비트코인)**
현재가: ₩47,500,000
변동률: +3.2% ↑ (24h)
```

## 기술 스택

| 구성 요소 | 사용 기술 |
|---|---|
| 자동화 플랫폼 | n8n |
| 메신저 (입력) | Telegram Bot API |
| 메신저 (출력) | Telegram + Discord Webhook |
| AI 모델 | Google Gemini Chat Model (Function Calling) |
| API 호출 | HTTP Request Tool (n8n) |
| 데이터 소스 | PokeAPI, Upbit API, Frankfurter API (모두 무인증) |
| 메모리 | Window Buffer (session=chat_id) |
| 스케줄링 | Trigger 기반 실시간 응답 |

## 필수 설정 단계

### 1. Telegram Bot 생성
- BotFather와 대화해서 Bot Token 발급
- 봇 username 등록 (예: @MyAPIsGuideBot)

### 2. Discord Webhook 생성
- 디스코드 서버 → 채널 설정 → Webhook 추가
- Webhook URL 복사 (n8n Credentials로 저장)

### 3. n8n Credentials 등록
- Telegram Credentials: Bot Token
- Discord Credentials: Webhook URL
- Gemini API 키 (또는 OpenAI API 키)

### 4. n8n 워크플로우 구성
1. Telegram Trigger 노드
2. AI Agent 노드 (+ 3개 Tool 등록)
3. Telegram Send Message 노드
4. Discord Webhook 노드

## 확장 가능성

- 📊 **더 많은 Tool 추가**: NASA API(우주), IGDB(게임), Spotify(음악) 등
- 🌍 **여러 언어 지원**: 사용자 언어 자동 감지해서 다국어 응답
- 📝 **API 비교 기능**: "날씨 API 추천 비교표" 같은 고급 기능
- 🔗 **하이퍼링크**: 추천된 API의 공식 문서 링크 자동 포함
- 📊 **사용 통계**: 자주 조회되는 API, 사용자 질문 패턴 분석
- 🔔 **조건부 알림**: 특정 조건(BTC >50M 등)에서 자동 알림

## 주의사항

- ⚠️ Telegram Bot Token, Discord Webhook URL은 n8n Credentials로 관리 (공개 금지)
- ⚠️ Gemini/OpenAI API 키도 환경변수로 관리
- ⚠️ Tool의 `$fromAI()` 표현식에서 AI가 잘못된 파라미터를 전달할 수 있으니, 필요시 Validate 노드로 체크
- ⚠️ 각 API의 Rate Limit 고려 (PokeAPI는 낉낑, Frankfurter는 충분함)
- ⚠️ 메모리 노드 (Window Buffer)로 대화 기록을 유지하되, 민감 정보는 로그에 남지 않도록 주의

---

**Public APIs 가이드 챗봇** — 개발자들의 "API 질문 AI"가 되어보자! 🚀
