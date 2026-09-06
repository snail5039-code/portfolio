import pandas as pd
import matplotlib.pyplot as plt
import joblib

plt.rcParams["font.family"] = "Malgun Gothic"
plt.rcParams["axes.unicode_minus"] = False

df = pd.read_csv("data/processed/train_dataset.csv")

df['일시'] = pd.to_datetime(df['일시'])
# print(df.head())

# 일일 온열질환자 통계량
# print("\n일일 온열질환자 수 통계")
# print(df['total_patients'].describe())

# 환자 수가 가장 많았던 날 10개
sorted_df = df.sort_values(
    by="total_patients",
    ascending=False
)

top_10_days = sorted_df[["일시", "total_patients", "최고기온(°C)"]].head(10)

# print("\n환자 수가 가장 많았던 날짜 10개")
# print(top_10_days)

# 날짜별 환자 수 그래프
# df_2022 = df[df["year"] == 2022]
# df_2023 = df[df["year"] == 2023]
# df_2024 = df[df["year"] == 2024]
# df_2025 = df[df["year"] == 2025]

# plt.figure(figsize=(12, 5))

# plt.plot(
#     range(1, len(df_2022) + 1),
#     df_2022["total_patients"],
#     label="2022년"
# )

# plt.plot(
#     range(1, len(df_2023) + 1),
#     df_2023["total_patients"],
#     label="2023년"
# )

# plt.plot(
#     range(1, len(df_2024) + 1),
#     df_2024["total_patients"],
#     label="2024년"
# )

# plt.plot(
#     range(1, len(df_2025) + 1),
#     df_2025["total_patients"],
#     label="2025년"
# )

# plt.title("연도별 온열질환자 수 변화")
# plt.xlabel("감시기간 시작 후 일수")
# plt.ylabel("온열질환자 수")

# plt.legend()

# plt.grid(alpha=0.3)

# plt.show()


# 최고 기온과 환자 수 관계 확인(산점도)
# plt.figure(figsize=(8,5))
# plt.scatter(
#     df['최고기온(°C)'],
#     df["total_patients"],
#     color="tomato",
#     alpha=0.6
# )
# plt.title("최고기온과 온열질환자 수의 관계")
# plt.xlabel("최고기온(°C)")
# plt.ylabel("온열질환자 수")
# plt.grid(alpha=0.3)
# plt.show()

# 날짜 제외 데이터 상관계수
correlation = df.drop(
    columns=['일시','year']
).corr()

# 환자 수랑 비교하는거라 굳이 필요 없어서 뺀다
patient_correlation = correlation["total_patients"].drop(
    "total_patients"
)

patient_correlation = patient_correlation.sort_values(
    ascending=False
)
# print("\n기상 변수와 온열질환자 수의 상관계수")
# print(patient_correlation)

# 상관계수 막대 그래프
chart_correlation = patient_correlation.sort_values(
    ascending=True
)

# plt.figure(figsize=(9, 5))

# plt.barh(
#     chart_correlation.index,
#     chart_correlation.values,
#     color='skyblue'
# )
# plt.axvline(
#     x=0,
#     color="black",
#     linewidth=1
# )

# plt.title("기상 변수와 온열질환자 수의 상관계수")
# plt.xlabel("상관계수")
# plt.ylabel("기상 변수")
# plt.show()

# 일일 환자 수 히스토그램
# plt.figure(figsize=(8, 5))

# plt.hist(
#     df["total_patients"],
#     bins=20,
#     color="tomato",
#     edgecolor="black"
# )

# plt.title("일일 온열질환자 수 분포")
# plt.xlabel("일일 온열질환자 수")
# plt.ylabel("해당 구간에 포함된 날짜 수")

# plt.grid(
#     axis="y",
#     alpha=0.3
# )

# plt.show()


model_data = joblib.load(
    "model/saved/heat_patient_model.pkl"
)

loaded_model = model_data["model"]

weather_columns = model_data["weather_columns"]

feature_importances = loaded_model.feature_importances_

importance_df = pd.DataFrame(
    {
        "기상 변수": weather_columns,
        "중요도": feature_importances
    }
)

importance_df = importance_df.sort_values(
    by="중요도",       
    ascending=False  
)

# print("\n랜덤포레스트 기상 변수 중요도:")
# print(importance_df)

# 중요도 막대 그래프
# chart_importance = importance_df.sort_values(
#     by="중요도",
#     ascending=True
# )

# plt.figure(figsize=(9, 5))
# plt.barh(
#     chart_importance["기상 변수"],  # y축: 기상 변수 이름
#     chart_importance["중요도"],     # x축: 변수 중요도
#     color="orange"                  # 막대 색상
# )

# plt.title("랜덤포레스트 기상 변수 중요도")
# plt.xlabel("중요도")
# plt.ylabel("기상 변수")
# plt.grid(
#     axis="x",
#     alpha=0.3
# )
# plt.show()

patient_quantiles = df["total_patients"].quantile(
    [0.25, 0.50, 0.75] 
)

# print("\n일일 온열질환자 수 분위수")
# print(patient_quantiles) 