import pandas as pd
import matplotlib.pyplot as plt
import joblib

# 한글과 음수 기호 표시
plt.rcParams["font.family"] = "Malgun Gothic"
plt.rcParams["axes.unicode_minus"] = False

# 고령자 학습용 데이터 불러오기
df = pd.read_csv(
    "data/processed/train_dataset_elderly65_2022_2025.csv"
)

# 날짜 형식으로 변환하고 날짜순 정렬
df["일시"] = pd.to_datetime(df["일시"])
df = df.sort_values("일시")

plt.figure(figsize=(12, 5))

# 연도별로 따로 그려 감시기간 사이의 빈 기간을 연결하지 않기
for year in [2022, 2023, 2024, 2025]:
    year_df = df[df["year"] == year]

    plt.plot(
        year_df["일시"],
        year_df["elderly_patients"],
        label=f"{year}년"
    )

plt.title("2022~2025년 고령자 온열질환 신고 건수 변화")
plt.xlabel("날짜")
plt.ylabel("65세 이상 신고 건수")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()

# 점 하나가 하루: 최고기온과 고령자 신고 건수 비교
plt.figure(figsize=(8, 5))

plt.scatter(
    df["최고기온(°C)"],        # x축: 하루 전국 평균 최고기온
    df["elderly_patients"],   # y축: 그날 고령자 신고 건수
    color="tomato",
    alpha=0.6                 # 겹친 점이 보이도록 투명도 설정
)

plt.title("최고기온과 고령자 온열질환 신고 건수의 관계")
plt.xlabel("전국 평균 최고기온(°C)")
plt.ylabel("65세 이상 신고 건수")
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()

# 날짜와 연도를 제외하고 숫자 변수들의 상관계수 계산
correlation = df.drop(columns=["일시", "year"]).corr()

# 고령자 신고 건수와 각 기상 변수의 상관계수만 선택
patient_correlation = correlation["elderly_patients"].drop(
    "elderly_patients"  # 자기 자신과의 상관계수 1은 제외
)

# 가로 막대그래프에서 큰 값이 위에 오도록 정렬
patient_correlation = patient_correlation.sort_values(
    ascending=True
)

plt.figure(figsize=(9, 5))

plt.barh(
    patient_correlation.index,   # y축: 기상 변수 이름
    patient_correlation.values,  # x축: 상관계수
    color="skyblue"
)

plt.axvline(x=0, color="black", linewidth=1)
plt.title("기상 변수와 고령자 신고 건수의 상관관계")
plt.xlabel("상관계수")
plt.ylabel("기상 변수")
plt.tight_layout()
plt.show()

# 하루 고령자 신고 건수의 분포 확인
plt.figure(figsize=(8, 5))

plt.hist(
    df["elderly_patients"],
    bins=20,            # 신고 건수를 20개 구간으로 나누기
    color="tomato",
    edgecolor="black"
)

plt.title("일일 고령자 온열질환 신고 건수 분포")
plt.xlabel("하루 65세 이상 신고 건수")
plt.ylabel("해당 구간에 포함된 날짜 수")
plt.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.show()

# 저장한 고령자 모델과 기상 컬럼 목록 불러오기
model_data = joblib.load(
    "model/saved/heat_patient_elderly65_model.pkl"
)

loaded_model = model_data["model"]
weather_columns = model_data["weather_columns"]

# 모델의 기상 변수별 중요도를 표로 만들기
importance_df = pd.DataFrame({
    "기상 변수": weather_columns,
    "중요도": loaded_model.feature_importances_
})

# 큰 값이 그래프 위에 오도록 정렬
importance_df = importance_df.sort_values(
    by="중요도",
    ascending=True
)

plt.figure(figsize=(9, 5))

plt.barh(
    importance_df["기상 변수"],
    importance_df["중요도"],
    color="orange"
)

plt.title("고령자 랜덤포레스트 모델의 기상 변수 중요도")
plt.xlabel("중요도")
plt.ylabel("기상 변수")
plt.grid(axis="x", alpha=0.3)
plt.tight_layout()
plt.show()