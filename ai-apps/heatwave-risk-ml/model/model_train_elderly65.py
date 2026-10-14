import pandas as pd
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV

# 고령자 학습용 CSV 불러오기
df = pd.read_csv(
    "data/processed/train_dataset_elderly65_2022_2025.csv"
)

# print(df.head())
# print(df.shape) 

X = df.drop(columns=["elderly_patients", "일시", "year"])
y = df["elderly_patients"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42    
)

model = RandomForestRegressor(
    n_estimators=100,  
    random_state=42 
)

model.fit(X_train, y_train)

print("고령자 모델 학습 완료")

y_pred = model.predict(X_test)

mae = mean_absolute_error(y_test, y_pred)        
rmse = mean_squared_error(y_test, y_pred) ** 0.5  
r2 = r2_score(y_test, y_pred)                    

# print(f"MAE: {mae:.3f}")
# print(f"RMSE: {rmse:.3f}")
# print(f"R²: {r2:.3f}")

train_pred = model.predict(X_train)

train_r2 = r2_score(y_train, train_pred)

# 과적합 같은디??
# print(f"학습 R²: {train_r2:.3f}")
# print(f"테스트 R²: {r2:.3f}")


# 최적 찾기
forest_base = RandomForestRegressor(random_state=42)

param = {
    "n_estimators": [100, 200, 300],     # 트리 개수
    "max_depth": [10, 20, None],        # 깊이 제한 비교
    "min_samples_split": [2, 5],       # 분기하기 위한 최소 데이터 수
    "min_samples_leaf": [2, 3, 4],      # 이전에 선택된 3 주변 비교
    "max_features": [1.0, "sqrt"]       # 분기마다 고려할 기상 변수 수
}

grid_search = GridSearchCV(
    estimator=forest_base,
    param_grid=param,
    cv=5,
    n_jobs=-1
)

grid_search.fit(X_train, y_train)
model = grid_search.best_estimator_

# print("최적 설정:", grid_search.best_params_)
# print(f"교차검증 R²: {grid_search.best_score_:.3f}")

train_pred = model.predict(X_train)
y_pred = model.predict(X_test)

print(f"학습 R²: {r2_score(y_train, train_pred):.3f}")
print(f"테스트 R²: {r2_score(y_test, y_pred):.3f}")
print(f"테스트 MAE: {mean_absolute_error(y_test, y_pred):.3f}")
print(f"테스트 RMSE: {mean_squared_error(y_test, y_pred) ** 0.5:.3f}")

save_dir = Path("model/saved")
save_dir.mkdir(parents=True, exist_ok=True)

model_data = {
    "model": model,
    "weather_columns": X.columns.tolist()
}

joblib.dump(
    model_data,
    save_dir / "heat_patient_elderly65_model.pkl"
)

print("고령자 모델 저장 완료")