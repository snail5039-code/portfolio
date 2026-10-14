import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import GridSearchCV
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


## 22~24년 값으로 25년 예측

df = pd.read_csv(
    "data/processed/train_dataset_elderly65_2022_2025.csv"
)

train_df = df[df["year"] < 2025]
test_df = df[df["year"] == 2025]

X_train = train_df.drop(columns=["elderly_patients", "일시", "year"])
y_train = train_df["elderly_patients"]

X_test = test_df.drop(columns=["elderly_patients", "일시", "year"])
y_test = test_df["elderly_patients"]

forest_base = RandomForestRegressor(random_state=42)

param = {
    "n_estimators": [200, 300],
    "max_depth": [10, 15, 20],
    "min_samples_split": [2, 3, 5],
    "min_samples_leaf": [1, 2, 3],
    "max_features": ["sqrt", 0.5]
}

grid_search = GridSearchCV(
    estimator=forest_base,
    param_grid=param,
    cv=5,
    n_jobs=-1
)

grid_search.fit(X_train, y_train)

model = grid_search.best_estimator_



y_pred = model.predict(X_test)
train_pred = model.predict(X_train)

print(f"학습 R²: {r2_score(y_train, train_pred):.3f}")
print(f"학습 MAE: {mean_absolute_error(y_train, train_pred):.3f}")
print()
print("------------------------------------------------")
print(f"2025년 R²: {r2_score(y_test, y_pred):.3f}")
print(f"2025년 MAE: {mean_absolute_error(y_test, y_pred):.3f}")
print(f"2025년 RMSE: {mean_squared_error(y_test, y_pred) ** 0.5:.3f}")
print()
print("------------------------------------------------")
print("최적 설정:", grid_search.best_params_)
print(f"교차검증 R²: {grid_search.best_score_:.3f}")


# 그래프로 비교해서 튜닝 설정 하자
plt.rcParams["font.family"] = "Malgun Gothic"
plt.rcParams["axes.unicode_minus"] = False

dates = pd.to_datetime(test_df["일시"])

plt.figure(figsize=(12, 5))
plt.plot(dates, y_test, label="실제값", color="blue")

plt.plot(dates, y_pred, label="예측값", color="orange")

plt.title("2025년 고령자 온열질환 실제값과 예측값")
plt.xlabel("날짜")
plt.ylabel("65세 이상 신고 건수")

plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()


# 표 확인해서 오차 보기
# 날짜별 실제값과 예측값을 표로 정리
result_df = pd.DataFrame({
    "날짜": test_df["일시"].to_numpy(),
    "실제값": y_test.to_numpy(),
    "예측값": y_pred
})

# 오차가 양수면 과대 예측, 음수면 과소 예측
result_df["오차"] = result_df["예측값"] - result_df["실제값"]

# 방향과 관계없이 얼마나 틀렸는지 계산
result_df["절대오차"] = result_df["오차"].abs()

# 가장 크게 틀린 날짜 10개 확인
top_errors = result_df.sort_values(
    by="절대오차",
    ascending=False
).head(10)

# print(top_errors.round(2))


# 부스팅 모델로 비교 

boost_base = GradientBoostingRegressor(random_state=42)

boost_param = {
    "n_estimators": [100, 200],     
    "learning_rate": [0.05, 0.1],  
    "max_depth": [2, 3, 5],       
    "min_samples_leaf": [3, 5, 10]  
}

boost_grid = GridSearchCV(
    estimator=boost_base,
    param_grid=boost_param,
    cv=5,
    n_jobs=-1
)

boost_grid.fit(X_train, y_train)

boost_model = boost_grid.best_estimator_

print("부스팅 최적 설정:", boost_grid.best_params_)
print(f"부스팅 교차검증 R²: {boost_grid.best_score_:.3f}")