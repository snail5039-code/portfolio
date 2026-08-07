import os
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory

load_dotenv()

API_KEY = os.environ.get("GEMINI_API_KEY")
MODEL = "gemini-3.5-flash"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

app = Flask(__name__)


@app.route("/")
def index():
    return send_from_directory(".", "saju.html")


@app.route("/api/saju", methods=["POST"])
def saju():
    data = request.get_json()

    if not data.get("name") or not data.get("birthDate"):
        return jsonify({"result": "이름과 생년월일을 입력해주세요."}), 400

    prompt = build_saju_prompt(data)

    result_text = ask_gemini(prompt)
    return jsonify({"result": result_text})


@app.route("/study")
def study():
    return send_from_directory(".", "study.html")


@app.route("/api/fortune", methods=["POST"])
def fortune():
    data = request.get_json()

    deadline = data.get("deadline")
    progress = data.get("progress")
    mood = data.get("mood")
    additional_info = data.get("additionalInfo", "")
    is_custom_deadline = data.get("isCustomDeadline", False)
    is_custom_mood = data.get("isCustomMood", False)

    if not all([deadline, progress, mood]):
        return jsonify({"error": "모든 항목을 선택해주세요"}), 400

    prompt = build_fortune_prompt(deadline, progress, mood, additional_info, is_custom_deadline, is_custom_mood)
    result = ask_gemini(prompt)

    return jsonify({"result": result})


def build_fortune_prompt(deadline: str, progress: str, mood: str, additional_info: str = "", is_custom_deadline: bool = False, is_custom_mood: bool = False) -> str:
    deadline_map = {
        "today": "오늘",
        "tomorrow": "내일",
        "within3days": "3일 이내",
        "week": "일주일 이상"
    }
    progress_map = {
        "zero": "0%",
        "little": "조금",
        "half": "절반",
        "almost": "거의 끝남"
    }
    mood_map = {
        "okay": "아직 할 만함",
        "tired": "피곤함",
        "verytired": "매우 피곤함",
        "youtube": "유튜브 보는 중"
    }

    deadline_text = deadline if is_custom_deadline else deadline_map.get(deadline, deadline)
    progress_text = progress_map.get(progress, progress)
    mood_text = mood if is_custom_mood else mood_map.get(mood, mood)

    additional_info_text = f"\n- 과제 주제/종류: {additional_info}" if additional_info else ""

    return f"""당신은 매우 재미있고 창의적인 운세 전문가입니다. 과제 미루기에 대한 운세를 봐주세요.

사용자의 상황:
- 마감까지 남은 시간: {deadline_text}
- 현재 진행률: {progress_text}
- 현재 상태: {mood_text}{additional_info_text}

다음 형식으로 정확히 응답해주세요:

미루기 위험도: [0~100 사이의 숫자]%
제출 성공률: [0~100 사이의 숫자]%
밤샘 가능성: [매우 높음/높음/중간/낮음 중 하나]
교수님 자비운: [3-4줄의 자세한 재미있는 코멘트, 상황을 고려한 구체적인 내용]
지금 당장 할 일: [구체적이고 재미있는 한 가지 조언]
교수님의 한마디: [5-10자 정도의 재미있고 신랄한 한마디, 예: "자네는 F네", "참... 나 때는 말이야"]
한 줄 운세: [사용자의 상황을 반영한 창의적이고 재미있는 한 줄의 운세]

각 항목 앞에 정확히 이 텍스트를 포함해야 합니다."""


def build_saju_prompt(data: dict) -> str:
    name = data.get("name", "")
    birth_date = data.get("birthDate", "")
    birth_time = data.get("birthTime") or "모름"
    gender_map = {"male": "남성", "female": "여성"}
    gender = gender_map.get(data.get("gender"), "미상")
    current_year = datetime.now().year

    return f"""당신은 사주명리학 전문가입니다. 아래 사람의 사주를 봐주세요.

이름: {name}
생년월일(양력): {birth_date}
태어난 시간: {birth_time}
성별: {gender}
현재 년도: {current_year}년

생년월일을 기준으로 사주팔자(년주/월주/일주/시주, 천간지지)를 계산하고,
1. 타고난 성격과 기질
2. 전반적인 운세(재물운, 애정운, 건강운 등)
3. {current_year}년 현재 올해 특히 주의하거나 기대해볼 만한 점

이렇게 세 부분으로 나누어 친근한 말투로 설명해주세요. 시간을 모른다면 시주는 생략하고 안내해주세요."""


def ask_gemini(prompt: str) -> str:
    import requests

    response = requests.post(
        GEMINI_URL,
        headers={
            "x-goog-api-key": API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL,
            "input": prompt,
        },
    )
    response.raise_for_status()
    resp_data = response.json()

    for step in resp_data.get("steps", []):
        if step.get("type") == "model_output":
            for content in step.get("content", []):
                if content.get("type") == "text":
                    return content["text"]
    return "(응답에서 텍스트를 찾지 못했습니다)"


if __name__ == "__main__":
    app.run(debug=True)
