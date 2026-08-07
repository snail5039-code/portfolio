# 과제 미루기 사주 / AI 사주 보기

Flask + Google Gemini API로 만든 미니 웹 앱입니다. 생년월일을 입력하면 AI가 사주를 봐주는 페이지와, 과제 마감·진행률·컨디션을 입력하면 재미있게 신랄한 "운세"를 봐주는 페이지 두 가지를 제공합니다.

## 기능

- **AI 사주 보기** (`/`): 이름, 생년월일, 태어난 시간, 성별을 입력하면 Gemini가 사주를 풀이
- **과제 미루기 사주** (`/study`): 마감 기한, 진행률, 컨디션을 선택(또는 직접 입력)하면 미루기 위험도·제출 성공률·밤샘 가능성 등을 재미있게 생성

## 기술 스택

Flask, Python, Google Gemini API, HTML/CSS/JS (바닐라)

## 실행 방법

```bash
pip install -r requirements.txt
```

`.env` 파일에 Gemini API 키를 설정합니다.

```
GEMINI_API_KEY=your_api_key
```

```bash
python app.py
```

기본적으로 `http://localhost:5000` 에서 확인할 수 있습니다.

## 문서

- [기획문서](./기획문서.md)
