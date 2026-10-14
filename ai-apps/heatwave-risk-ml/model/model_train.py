from pathlib import Path
from pprint import pprint
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.tree import DecisionTreeRegressor # 의사결정 나무 회귀 모델
from sklearn.ensemble import RandomForestRegressor # 랜덤 포레스트 회귀 모델
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import pandas as pd
import numpy as np
import joblib


# record_type: 데이터 유형
# daily_national: 날짜별 전국 데이터
# date: 날짜
# region: 지역
# district: 시군구
# age_group: 연령대
# time_range: 발생 시간대
# total_patients: 전체 온열질환자 수
# estimated_deaths: 추정 사망자 수
# heatstroke: 열사병
# heat_exhaustion: 열탈진
# heat_cramp: 열경련
# heat_syncope: 열실신
# heat_edema: 열부종
# other: 기타 온열질환
# male: 남성
# female: 여성
# source_file: 출처 파일
# source_sheet: 출처 시트

# 상위 폴더 위치 가져오기
BASE_DIR = Path(__file__).resolve().parent.parent 


# 온열환자 날짜별 전국 환자수
heat_file = BASE_DIR / "data" / "processed" / "heat_illness_daily_2022_2025.csv"

heat_data = pd.read_csv(
    heat_file,
    encoding="utf-8-sig",
    low_memory=False
)

# print(heat_data.head())

heat_daily = heat_data[
    ["date", "total_patients"]
].copy()

# print(heat_daily.head())
# print(heat_daily.shape)

# print("시작 날짜:", heat_daily["date"].min())
# print("종료 날짜:", heat_daily["date"].max())

# print(f"전체 환자 수 : {heat_daily['total_patients'].sum()}")
# pprint(f"결측치 : {heat_daily.isnull().sum()}")


# 기상 데이터

weather_files = [
    BASE_DIR / "data" / "raw" / "2022" / "OBS_ASOS_DD_20260831142714.csv",
    BASE_DIR / "data" / "raw" / "2023" / "OBS_ASOS_DD_20260831142744.csv",
    BASE_DIR / "data" / "raw" / "2024" / "OBS_ASOS_DD_20260831142808.csv",
    BASE_DIR / "data" / "raw" / "2025" / "OBS_ASOS_DD_20260830192528.csv"
]


weather_data_list = []

for weather_file in weather_files:
    weather_year_data = pd.read_csv(
        weather_file,
        encoding="cp949" # 기상청 csv 한글 인코딩 방식
    )

    weather_data_list.append(weather_year_data)
# pprint(weather_data.head())

weather_data = pd.concat(
    weather_data_list,
    ignore_index=True  # 행 번호를 0부터 다시 정리
)

# 날짜 데이트 타임으로 변경
heat_daily['date'] = pd.to_datetime(heat_daily['date'])
weather_data['일시'] = pd.to_datetime(weather_data['일시'])

# print(f"온열환자 날짜 자료형 : {heat_daily['date'].dtype}")
# print(f"기상 날짜 자료형 : {weather_data['일시'].dtype}")

start_date = heat_daily["date"].min()
end_date = heat_daily["date"].max()

weather_period = weather_data[(weather_data['일시'] >= start_date) & (weather_data['일시'] <= end_date)]

# print(f"기상 데이터 시작 날짜 : {weather_period['일시'].min()}")
# print(f"기상 데이터 종료 날짜 : {weather_period['일시'].max()}")
# print(f"기상 데이터 크기 : {weather_period.head()}")


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


weather_period["일강수량(mm)"] = weather_period['일강수량(mm)'].fillna(0)
weather_daily = weather_period.groupby("일시")[weather_columns].mean()
weather_daily = weather_daily.reset_index()

# print(weather_daily.head())
# print(weather_daily.shape)    
# print(weather_daily[weather_columns].isnull().sum())

# 이름 통일
heat_daily.columns = ["일시", "total_patients"]
# print(heat_daily.columns)

# 데이터 병합
train_dataset = pd.merge(
    heat_daily,
    weather_daily,
    on="일시",
    how="inner"
)
train_dataset["year"] = train_dataset["일시"].dt.year

# # 병합 결과 확인
# print("데이터 크기:", train_dataset.shape)
# print("중복 날짜 수:", train_dataset["일시"].duplicated().sum())
# print("전체 결측치 수:", train_dataset.isnull().sum().sum())

# # 연도별 날짜 개수와 전체 환자 수 확인
# print(
#     train_dataset.groupby("year")["total_patients"]
#     .agg(["count", "sum"])
# )

processed_file = BASE_DIR / "data" / "processed" / "train_dataset.csv"

train_dataset.to_csv(
    processed_file,
    index=False,
    encoding="utf-8-sig"
)
# print(f"학습 데이터 저장 완료 : {processed_file}")

X = train_dataset[weather_columns]
y = train_dataset['total_patients']

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

tree_model = DecisionTreeRegressor(random_state=42)

tree_model.fit(X_train, y_train)

tree_pred = tree_model.predict(X_test)
# print(f"예측 결과 개수 : {len(tree_pred)}")
# print(f"예측값 : {tree_pred[:5]}")

# 실제값과 예측값의 평균 절대 오차
tree_mae = mean_absolute_error(y_test, tree_pred)
# 큰 오차를 제곱해서 계산한 평균 제곱 오차
tree_mse = mean_squared_error(y_test, tree_pred)
# MSE에 제곱근을 적용한 환자 수 단위의 오차
tree_rmse = np.sqrt(tree_mse)
# 모델이 환자 수 변화를 설명하는 정도
tree_r2 = r2_score(y_test, tree_pred)

# print("Decision Tree 평가결과")
# print(f"MAE : {tree_mae : .3f}") # 예측 값이 16.7명 차이
# print(f"MSE : {tree_mse : .3f}") # 오차가 큰 예측에 더 강한 벌점을 주는 지표
# print(f"RMSE : {tree_rmse : .3f}") # 큰 오차를 중요하게 반영하면 33.9명 차이
# print(f"R2 : {tree_r2 : .3f}") # 모델 성능이 좋지 않음!

forest_model = RandomForestRegressor(
    n_estimators=100,
    random_state=42
)
forest_model.fit(X_train, y_train)
forest_pred = forest_model.predict(X_test)
# print(f"예측 결과 개수 : {len(forest_pred)}")
# print(f"예측값 : {forest_pred[:5]}")

# 실제값과 예측값의 평균 절대 오차
forest_mae = mean_absolute_error(y_test, forest_pred)
# 큰 오차를 제곱해서 계산한 평균 제곱 오차
forest_mse = mean_squared_error(y_test, forest_pred)
# MSE에 제곱근을 적용한 환자 수 단위의 오차
forest_rmse = np.sqrt(forest_mse)
# 모델이 환자 수 변화를 설명하는 정도
forest_r2 = r2_score(y_test, forest_pred)

print("Random forrest 평가결과")
print(f"MAE : {forest_mae : .3f}") # 예측 값이 16.7명 차이
print(f"MSE : {forest_mse : .3f}") # 오차가 큰 예측에 더 강한 벌점을 주는 지표
print(f"RMSE : {forest_rmse : .3f}") # 큰 오차를 중요하게 반영하면 33.9명 차이
print(f"R2 : {forest_r2 : .3f}") # 모델 성능이 좋지 않음!

# 학습 데이터에 대한 Random Forest 예측값
forest_train_pred = forest_model.predict(X_train)

# 학습 데이터와 테스트 데이터의 R² 비교
forest_train_r2 = r2_score(y_train, forest_train_pred)

# print(f"학습 데이터 R²: {forest_train_r2:.3f}")  # 학습한 데이터를 얼마나 잘 맞히는지
# print(f"테스트 데이터 R²: {forest_r2:.3f}")     # 처음 보는 데이터를 얼마나 잘 맞히는지

param = {
    "n_estimators" : [100, 150, 200],
    "max_depth" : [6, 7, 8],
    "min_samples_split": [8, 10, 12],
    "min_samples_leaf" : [3, 4, 5],
    "max_features" : ["sqrt", 0.6]
}

forest_base = RandomForestRegressor(random_state=42)

grid_search = GridSearchCV(
    estimator=forest_base,
    param_grid=param,
    cv=5,
    n_jobs=-1
)

grid_search.fit(X_train, y_train)

print("\nGridSearchCV 결과")
print(f"최적 설정 : {grid_search.best_params_}")
print(f"최적 교차 검증 R2 : {grid_search.best_score_ : .3f}")

best_forest_model = grid_search.best_estimator_
best_forest_pred = best_forest_model.predict(X_test)
best_forest_mae = mean_absolute_error(y_test, best_forest_pred)
best_forest_mse = mean_squared_error(y_test, best_forest_pred)
best_forest_rmse = np.sqrt(best_forest_mse)
best_forest_r2 = r2_score(y_test, best_forest_pred)


print("Best Random forrest 평가결과")
print(f"MAE : {best_forest_mae : .3f}")
print(f"MSE : {best_forest_mse : .3f}") 
print(f"RMSE : {best_forest_rmse : .3f}") 
print(f"R2 : {best_forest_r2 : .3f}") 

# 최적 모델로 학습 데이터 예측
best_forest_train_pred = best_forest_model.predict(X_train)

# 최적 모델의 학습 데이터 R² 계산
best_forest_train_r2 = r2_score(y_train, best_forest_train_pred)

print(f"최적 모델 학습 R²: {best_forest_train_r2:.3f}")
print(f"최적 모델 테스트 R²: {best_forest_r2:.3f}")


# 학습 모델 저장
model_save_dir = BASE_DIR / "model" / "saved"

# saved 폴더가 없으면 새로 생성
model_save_dir.mkdir(
    parents=True,
    exist_ok=True
)

# 저장할 모델 파일 위치
model_file = (
    model_save_dir
    / "heat_patient_model.pkl"
)

# 모델과 입력 기상 요소 이름을 함께 저장
model_data = {
    "model": best_forest_model,
    "weather_columns": weather_columns
}

# 학습된 모델을 파일로 저장
joblib.dump(
    model_data,
    model_file
)

print(f"최종 모델 저장 완료: {model_file}")
