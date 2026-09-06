# 모델별 예측 환자 수의 등급 변환과 외출 조건별 안내 함수 모음
# 전체 연령 기준: 3명 미만 / 3~9명 미만 / 9~30명 미만 / 30명 이상
# 65세 이상 기준: 1명 미만 / 1~3명 미만 / 3~8명 미만 / 8명 이상
# 등급 순서: 낮음 → 보통 → 높음 → 매우 높음
# 프로젝트 데이터에 따른 상대적 등급이며 공식 위험 기준은 아님

# isfinite(): 숫자가 무한대나 NaN(유효한 숫자가 아닌 값)이 아닌지 확인
from math import isfinite

# 전체 연령 예측값의 등급 변환
# prediction에 모델의 예측 환자 수를 전달하면 등급 문자열 하나를 반환
# 조건은 위에서부터 확인하고, return을 만나면 함수가 바로 끝남
def get_all_age_level(prediction):
    if prediction < 3:         # 3명 미만
        return "낮음"
    elif prediction < 9:      # 앞 조건을 통과했으므로 3명 이상 ~ 9명 미만
        return "보통"
    elif prediction < 30:     # 9명 이상 ~ 30명 미만
        return "높음"
    else:                     # 나머지: 30명 이상
        return "매우 높음"

# 65세 이상 예측값의 등급 변환
def get_elderly_level(prediction):
    if prediction < 1:        # 1명 미만
        return "낮음"
    elif prediction < 3:      # 1명 이상 ~ 3명 미만
        return "보통"
    elif prediction < 8:      # 3명 이상 ~ 8명 미만
        return "높음"
    else:                     # 나머지: 8명 이상
        return "매우 높음"





## 여긴 어려워서 계산 법 ai 한테 받아옴!!!!!!!!!!!!!!

# 대상과 외출 조건을 받아 안내 문구 목록을 반환
# target: "전체 연령" 또는 "65세 이상"
# level: 해당 모델의 등급 함수가 반환한 값
# start_hour: 0 이상 24 미만의 시작 시각 (13.5는 오후 1시 30분)
# duration_minutes: 야외 체류시간, 분 단위 (0~1440분)
# 시작부터 종료까지 계속 야외에 머무는 일정으로 계산
# 안내 근거: 질병관리청 온열질환 예방수칙 (12~17시 야외활동 자제)
# https://kdca.go.kr/bbs/kdca/46/306747/download.do
# 시간대 겹침 계산은 프로젝트 구현이며, 체류시간별 의학적 위험도 계산이 아님
def get_outdoor_guidance(target, level, start_hour, duration_minutes):
    # 잘못된 입력을 받으면 이유를 알려주고 중단
    # not in: 괄호 안에 나열한 값들에 포함되지 않는지 확인
    # raise ValueError: 잘못된 입력이라는 오류를 발생시켜 함수 실행을 중단
    if target not in ("전체 연령", "65세 이상"):
        raise ValueError("대상은 '전체 연령' 또는 '65세 이상'이어야 합니다.")
    if level not in ("낮음", "보통", "높음", "매우 높음"):
        raise ValueError("올바른 예측 등급을 입력해 주세요.")

    # 시작 시각과 체류시간을 차례로 value에 넣어 같은 검사를 두 번 수행
    for value in (start_hour, duration_minutes):
        # isinstance(): 값의 자료형 확인. int는 정수, float는 소수
        # bool(True/False)은 파이썬에서 int로도 판정되므로 따로 제외
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("시작 시각과 체류시간은 숫자로 입력해 주세요.")
        if not isfinite(value):  # 무한대와 NaN은 시간 계산에 쓸 수 없으므로 제외
            raise ValueError("시작 시각과 체류시간은 유한한 숫자여야 합니다.")

    # 숫자여도 허용 범위를 벗어나면 중단
    if not 0 <= start_hour < 24:
        raise ValueError("시작 시각은 0 이상 24 미만이어야 합니다.")
    # 1440분 = 24시간. 이 함수는 최대 하루 길이의 외출을 지원
    if not 0 <= duration_minutes <= 1440:
        raise ValueError("야외 체류시간은 0~1440분 사이로 입력해 주세요.")

    # 안내 문장을 하나씩 담을 목록
    # f"...{변수}..."는 문장 안에 실제 변수 값을 넣는 방법
    # 괄호 안에서 문자열을 쉼표 없이 나란히 쓰면 한 문장으로 이어짐
    guidance = [
        f"{target} 예측 환자 수의 상대적 수준은 '{level}'입니다. "
        "개인의 발병 확률이나 외출 안전 판정은 아닙니다."
    ]

    # in: 나열한 등급 중 하나인지 확인
    # append(): 기존 목록의 맨 뒤에 안내 문장 하나를 추가
    if level in ("높음", "매우 높음"):
        guidance.append(
            "과거 데이터 기준으로 예상 환자 수가 많은 구간입니다. "
            "외출 전 지역의 실제 기온과 폭염특보를 확인해 주세요."
        )
    else:
        guidance.append(
            "예측 등급이 낮음 또는 보통이어도 더위에 주의해야 합니다. "
            "외출 전 지역의 실제 기온과 폭염특보를 확인해 주세요."
        )

    # 독립된 if이므로 등급 안내를 추가한 뒤에도 이 조건을 확인
    # 대상이 고령자라면 고령자 안내를 추가로 넣음
    if target == "65세 이상":
        guidance.append(
            "고령자는 더위에 취약할 수 있으므로 무리한 야외활동을 피하고, "
            "가족이나 주변 사람과 건강 상태를 수시로 확인해 주세요."
        )

    # 외출 계획이 없으면 지금까지 만든 안내만 반환하고 시간 계산은 생략
    if duration_minutes == 0:
        guidance.append("예정된 야외 체류시간이 0분이므로 외출 시간대 안내는 생략합니다.")
        return guidance

    # 분 단위로 통일하여 외출 전체 구간과 12~17시의 겹침을 계산
    start_minutes = start_hour * 60  # 예: 11.5시 → 자정부터 690분
    end_minutes = start_minutes + duration_minutes  # 690 + 120 = 810분(13시 30분)
    overlap_minutes = 0  # 12~17시와 겹치는 시간을 여기에 누적

    # 자정을 넘는 외출은 다음 날 12~17시도 확인
    # day_offset=0은 오늘, 1440은 다음 날의 시작 위치(분)
    # 최대 24시간 외출이므로 오늘과 다음 날만 확인하면 됨
    for day_offset in (0, 1440):
        hot_start = day_offset + 12 * 60
        hot_end = day_offset + 17 * 60
        # 겹침 시작: 두 시작 시각 중 더 늦은 시각 → max()
        # 겹침 종료: 두 종료 시각 중 더 이른 시각 → min()
        # 종료 - 시작이 음수라면 겹치지 않으므로 바깥 max(0, ...)로 0 처리
        # 예: 11:30~13:30과 12:00~17:00 → 810 - 720 = 90분
        # +=는 이번에 계산한 겹침 시간을 기존 합계에 더한다는 뜻
        overlap_minutes += max(
            0,
            min(end_minutes, hot_end) - max(start_minutes, hot_start)
        )

    # 12~17시와 조금이라도 겹치면 일정 조정 안내 추가
    # :g는 120.0처럼 불필요한 .0을 붙이지 않고 120으로 표시하는 형식
    if overlap_minutes > 0:
        guidance.append(
            f"예정된 야외 체류 {duration_minutes:g}분 중 "
            f"{overlap_minutes:g}분이 12~17시와 겹칩니다. "
            "더운 날에는 이 시간대의 야외활동을 줄이거나 일정을 조정해 주세요."
        )
    else:
        guidance.append(
            "예정된 외출은 12~17시와 겹치지 않습니다. "
            "다른 시간대에도 온열질환이 발생할 수 있으므로 더위에 주의해 주세요."
        )

    # 외출 시간이 0분보다 크면 시간대와 관계없이 휴식 안내 추가
    guidance.append(
        f"야외에 머무는 {duration_minutes:g}분 동안 "
        "시원한 곳에서 주기적으로 쉬고, 무더운 날에는 체류시간을 줄여 주세요."
    )
    # 문장 하나가 아니라 안내 문장 여러 개가 담긴 리스트를 반환
    # Streamlit에서는 이 목록을 반복문으로 꺼내 화면에 표시할 수 있음
    return guidance


# 이 파일을 직접 실행할 때만 확인용 코드를 실행
# 나중에 Streamlit에서 함수를 불러올 때는 실행되지 않음
if __name__ == "__main__":
    # 경계 바로 아래 값과 경계값을 넣어 등급이 바뀌는 지점 확인
    print("전체 연령 등급 확인")
    print(get_all_age_level(2.9))   # 낮음
    print(get_all_age_level(3))     # 보통
    print(get_all_age_level(8.9))   # 보통
    print(get_all_age_level(9))     # 높음
    print(get_all_age_level(29.9))  # 높음
    print(get_all_age_level(30))    # 매우 높음

    print("65세 이상 등급 확인")
    print(get_elderly_level(0.9))   # 낮음
    print(get_elderly_level(1))     # 보통
    print(get_elderly_level(2.9))   # 보통
    print(get_elderly_level(3))     # 높음
    print(get_elderly_level(7.9))   # 높음
    print(get_elderly_level(8))     # 매우 높음

    print("65세 이상 외출 안내 확인: 11시 30분부터 120분")
    # 1. 예측값 8명을 고령자 기준으로 변환 → "매우 높음"
    elderly_level = get_elderly_level(8)
    # 2. 대상, 등급, 시작 시각(시간 단위), 체류시간(분 단위)을 전달
    # 함수는 직접 출력하지 않고 안내 목록을 돌려주며, messages에 저장
    messages = get_outdoor_guidance("65세 이상", elderly_level, 11.5, 120)
    # 3. 목록에서 문장을 하나씩 꺼내 한 줄씩 출력
    for message in messages:
        print(message)
