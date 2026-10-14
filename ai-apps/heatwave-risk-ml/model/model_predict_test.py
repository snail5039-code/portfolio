from pathlib import Path
import joblib
import pandas as pd

# 현재 파일을 기준으로 프로젝트 최상위 폴더 위치 가져오기
BASE_DIR = Path(__file__).resolve().parent.parent

# 저장된 모델 파일 위치
model_file = (
    BASE_DIR
    / "model"
    / "saved"
    / "heat_patient_model.pkl"
)

# 저장된 모델 파일 불러오기
model_data = joblib.load(
    model_file
)

# 저장된 랜덤포레스트 모델 꺼내기
loaded_model = model_data["model"]

# 모델이 사용하는 기상 요소 목록 꺼내기
weather_columns = model_data["weather_columns"]

print("모델 불러오기 완료")
print("모델 종류:", type(loaded_model))
print("사용 기상 요소:", weather_columns)

# 모델 테스트에 사용할 하루의 기상 조건
test_weather = pd.DataFrame(
    [
        {
            "평균기온(°C)": 30.0,       # 하루 평균기온
            "최저기온(°C)": 26.0,       # 하루 최저기온
            "최고기온(°C)": 35.0,       # 하루 최고기온
            "일강수량(mm)": 0.0,        # 하루 강수량
            "평균 풍속(m/s)": 2.0,      # 하루 평균 풍속
            "평균 상대습도(%)": 70.0,   # 하루 평균 습도
            "합계 일조시간(hr)": 10.0,  # 하루 일조시간
            "합계 일사량(MJ/m2)": 25.0  # 하루 일사량
        }
    ],
    columns=weather_columns  # 모델 학습 당시와 동일한 열 순서 사용
)

# 저장된 모델로 전국 온열질환자 수 예측
prediction = loaded_model.predict(
    test_weather
)

# predict 결과는 배열이므로 첫 번째 예측값 사용
predicted_patients = prediction[0]

print("\n테스트 기상 조건")
print(test_weather)

print("\n예측 결과")
print(f"예상 온열질환자 수: {predicted_patients:.1f}명")