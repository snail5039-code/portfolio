from pathlib import Path
import pandas as pd
import numpy as np

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

# 현재 파일을 기준으로 프로젝트 최상위 폴더 위치 가져오기
BASE_DIR = Path(__file__).resolve().parent.parent

# 기존 코드에서 만들어 놓은 최종 학습 데이터 위치
dataset_file = (
    BASE_DIR
    / "data"
    / "processed"
    / "train_dataset.csv"
)

# 환자 수와 기상 데이터가 합쳐진 CSV 불러오기
train_dataset = pd.read_csv(
    dataset_file,
    encoding="utf-8-sig"
)

# 날짜를 날짜 자료형으로 변경
train_dataset["일시"] = pd.to_datetime(
    train_dataset["일시"]
)

# 모델이 입력값으로 사용할 기상 요소
weather_columns = [
    "평균기온(°C)",
    "최저기온(°C)",
    "최고기온(°C)",
    "일강수량(mm)",
    "평균 풍속(m/s)",
    "평균 상대습도(%)",
    "합계 일조시간(hr)",
    "합계 일사량(MJ/m2)"
]

# 2022~2024년은 모델 학습용 데이터
train_data = train_dataset[
    train_dataset["year"] < 2025
]

# 2025년은 모델 테스트용 데이터
test_data = train_dataset[
    train_dataset["year"] == 2025
]

# 학습용 입력 기상 데이터
X_train = train_data[weather_columns]

# 학습용 정답 환자 수
y_train = train_data["total_patients"]

# 테스트용 입력 기상 데이터
X_test = test_data[weather_columns]

# 테스트용 정답 환자 수
y_test = test_data["total_patients"]

# print("학습 기간:", train_data["일시"].min(), "~", train_data["일시"].max())
# print("테스트 기간:", test_data["일시"].min(), "~", test_data["일시"].max())
# print("학습 데이터:", X_train.shape)
# print("테스트 데이터:", X_test.shape)


year_model = RandomForestRegressor(
    n_estimators=100,       
    max_depth=7,            
    min_samples_split=8,    
    min_samples_leaf=5,   
    max_features="sqrt",  
    random_state=42        
)

year_model.fit(X_train, y_train)

year_pred = year_model.predict(X_test)
year_mae = mean_absolute_error(y_test, year_pred)
year_mse = mean_squared_error(y_test, year_pred)
year_rmse = np.sqrt(year_mse)
year_r2 = r2_score(y_test, year_pred)

print("\n2025년 예측 평가 결과")
print(f"MAE : {year_mae:.3f}")
print(f"MSE : {year_mse:.3f}")
print(f"RMSE : {year_rmse:.3f}")
print(f"R² : {year_r2:.3f}")