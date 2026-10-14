import streamlit as st
import joblib
import pandas as pd
from weather_api import (
    LOCATIONS,
    get_national_weather,
    get_city_outing_weather,
    get_heatwave_warning
)
from model.risk_level import (get_all_age_level, get_elderly_level, get_outdoor_guidance)

st.set_page_config(layout="wide")
st.title("온열질환자 수 예측")
st.write("기상 정보를 입력하면 예상 환자 수를 확인할 수 있습니다.")



with st.sidebar:
    st.header("예측 정보 입력")

    target = st.selectbox(
        "예측 대상",
        ["전체 연령", "65세 이상"]
    )

    date = st.date_input("예측 날짜")

    city_names = [location["name"] for location in LOCATIONS]

    selected_city = st.selectbox(
        "외출 지역",
        city_names
    )
    
    start_hour = st.selectbox(
        "외출 시작 시각",
        range(24),
        index=9,
        format_func=lambda hour: f"{hour}시"
    )

    duration_minutes = st.number_input(
        "야외 체류시간(분)",
        min_value=0,
        max_value=1440,
        value=60,
        step=10
    )

    predict_button = st.button(
        "예측하기",
        type="primary",
        use_container_width=True
    )

# 모델 불러오기
if target == "전체 연령":
    model_data = joblib.load("model/saved/heat_patient_model.pkl")
else:
    model_data = joblib.load("model/saved/heat_patient_elderly65_model.pkl")

model = model_data["model"]
weather_columns = model_data["weather_columns"]

tab1, tab2, tab3 = st.tabs(["예측 결과", "모델 정보", "데이터 분석"])

with tab1:
    st.subheader("예측 결과")

    # 예측하기 버튼을 눌렀을 때만 실행
    if predict_button:
        with st.spinner("기상정보를 불러오는 중입니다..."):

            # 선택 날짜의 전국 평균 기상정보 받기
            national_weather = get_national_weather(date)

            # 선택 도시와 외출 시간대의 기상정보 받기
            city_weather = get_city_outing_weather(
                date,
                selected_city,
                start_hour,
                duration_minutes
            )

            # 선택 지역의 기상청 공식 폭염특보 조회
            heatwave_warning = get_heatwave_warning(
                st.secrets.get("KMA_API_KEY", "").strip(),
                selected_city,
                date
            )

            # 딕셔너리를 모델 입력용 표로 변환
            # 학습 당시 기상 컬럼 순서로 정확하게 정렬
            national_input = pd.DataFrame(
                [national_weather]
            )[weather_columns]

            city_input = pd.DataFrame(
                [city_weather]
            )[weather_columns]

            # 두 기상 조건으로 모델 예측
            national_prediction = model.predict(
                national_input
            )[0]

            city_prediction = model.predict(
                city_input
            )[0]

            # 선택 대상에 맞는 등급 기준 적용
            if target == "전체 연령":
                national_level = get_all_age_level(
                    national_prediction
                )
                city_level = get_all_age_level(
                    city_prediction
                )
            else:
                national_level = get_elderly_level(
                    national_prediction
                )
                city_level = get_elderly_level(
                    city_prediction
                )

            # 선택 도시의 예측 등급과 외출 조건으로 안내 생성
            guidance = get_outdoor_guidance(
                target,
                city_level,
                start_hour,
                duration_minutes
            )


        # 예측 결과를 좌우 카드로 표시
        today_col, outing_col = st.columns(2)

        with today_col:
            with st.container(border=True):
                st.markdown("### 전국 평균 예측")
                st.write(f"{date} 하루 평균 기상정보 기준")
                st.metric(
                    "전국 예상 환자 수",
                    f"{national_prediction:.0f}명"
                )
                st.write(f"예측 등급 : **{national_level}**")
                st.write(
                    f"전국 평균기온: "
                    f"{national_weather['평균기온(°C)']:.1f}℃"
                )

        with outing_col:
            with st.container(border=True):
                st.markdown(
                    f"### {selected_city} 외출 시간대 참고 예측"
                )
                st.write(
                    f"{start_hour}시부터 "
                    f"{duration_minutes}분 기준"
                )
                st.metric(
                    "예상 환자 수",
                    f"{city_prediction:.0f}명"
                )
                st.write(f"예측 등급 : **{city_level}**")

                st.write(
                    f"외출 시간대 평균기온: "
                    f"{city_weather['평균기온(°C)']:.1f}℃"
                )

        st.subheader("외출 안내")
        # 선택 지역의 기본 기상정보
        with st.expander(
            f"🌤️ {selected_city} 기상정보 자세히 보기",
            expanded=False
        ):
            # 기상청 공식 폭염특보 표시
            if heatwave_warning["status"] == "active":
                if heatwave_warning["level"] == "폭염경보":
                    st.error(heatwave_warning["message"], icon="🚨")
                else:
                    st.warning(heatwave_warning["message"], icon="⚠️")
            elif heatwave_warning["status"] == "none":
                st.success(heatwave_warning["message"], icon="✅")
            else:
                st.info(heatwave_warning["message"], icon="ℹ️")

            weather_col1, weather_col2, weather_col3 = st.columns(3)

            with weather_col1:
                st.metric(
                    "외출 시간대 평균기온",
                    f"{city_weather['평균기온(°C)']:.1f}℃"
                )
                st.metric(
                    "하루 최저기온",
                    f"{city_weather['최저기온(°C)']:.1f}℃"
                )

            with weather_col2:
                st.metric(
                    "외출 시간대 평균습도",
                    f"{city_weather['평균 상대습도(%)']:.0f}%"
                )
                st.metric(
                    "하루 최고기온",
                    f"{city_weather['최고기온(°C)']:.1f}℃"
                )

            with weather_col3:
                st.metric(
                    "외출 시간대 평균풍속",
                    f"{city_weather['평균 풍속(m/s)']:.1f}m/s"
                )
                st.metric(
                    "하루 예상 강수량",
                    f"{city_weather['일강수량(mm)']:.1f}mm"
                )

        # 현재 등급을 색이 있는 안내 상자로 강조
        if city_level in ("높음", "매우 높음"):
            st.warning(
                guidance[0],
                icon="⚠️"
            )
        else:
            st.info(
                guidance[0],
                icon="ℹ️"
            )

        # 나머지 외출 안내를 굵게 표시
        with st.container(border=True):
            for message in guidance[1:]:
                st.markdown(f"- **{message}**")

    # 버튼을 누르기 전 안내
    else:
        st.info(
            "사이드바에서 조건을 선택한 후 "
            "'예측하기' 버튼을 눌러주세요."
        )

with tab2:
    st.subheader("모델 정보")

    # 두 모델 정보를 항상 좌우로 표시
    all_age_col, elderly_col = st.columns(2)

    # 전체 연령 모델
    with all_age_col:
        with st.container(border=True):
            st.markdown("### 👥 전체 연령 모델")
            st.write("사용 모델: Random Forest")
            st.write("전체 데이터: 536일")
            st.write("모델 학습: 428일")
            st.write("모델 테스트: 108일")

            st.metric("테스트 R²", "0.846")
            st.write("MAE: **9.700명**")
            st.write("RMSE: **14.871명**")
            st.write("2025년 보조 평가 R²: **0.686**")

    # 65세 이상 모델
    with elderly_col:
        with st.container(border=True):
            st.markdown("### 👴 65세 이상 모델")
            st.write("사용 모델: Random Forest")
            st.write("전체 데이터: 536일")
            st.write("모델 학습: 428일")
            st.write("모델 테스트: 108일")

            st.metric("테스트 R²", "0.837")
            st.write("MAE: **3.209명**")
            st.write("RMSE: **4.917명**")
            st.write("2025년 보조 평가 R²: **0.687**")

    st.caption(
        "테스트 결과는 데이터를 무작위로 80:20 분리한 평가입니다. "
        "2025년 평가는 연도 분리 보조 실험이며, 테스트 결과와 조건이 다릅니다. "
        "R²는 정확도 퍼센트가 아닙니다."
    )

    # 두 모델이 공통으로 사용하는 입력 변수
    st.markdown("### 모델 입력 정보")

    input_col, meaning_col = st.columns(2)

    with input_col:
        with st.container(border=True):
            st.markdown("#### 🌤️ 입력 기상 변수 8개")

            for column in weather_columns:
                st.markdown(f"- {column}")

    with meaning_col:
        with st.container(border=True):
            st.markdown("#### 📌 예측값의 의미")
            st.write("전체 연령 모델: 전국 하루 전체 연령 예상 환자 수")
            st.write("65세 이상 모델: 전국 하루 65세 이상 예상 환자 수")
            st.write("두 모델은 서로 별도로 학습된 Random Forest 모델입니다.")

    st.warning(
        "모델 결과는 전국 하루 예상 신고 환자 수입니다. "
        "특정 지역의 실제 환자 수나 개인의 발병 확률을 의미하지 않습니다.",
        icon="⚠️"
    )

with tab3:

    # 선택한 대상의 학습 데이터 읽기
    if target == "전체 연령":
        data = pd.read_csv("data/processed/train_dataset.csv")
        patient_column = "total_patients"
    else:
        data = pd.read_csv("data/processed/train_dataset_elderly65_2022_2025.csv")
        patient_column = "elderly_patients"

    chart_data = data.rename(columns={patient_column: "총 환자수"})

    # 윗줄: 기본 데이터 / 날짜별 환자 수
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("기본 데이터")
        st.dataframe(data.head())
        st.write("전체 데이터 수:", len(data), "일")
        st.write("수집 연도: 2022~2025년")

    with col2:
        st.subheader("날짜별 환자 수")
        st.caption("2022~2025년 여름철 감시기간 자료입니다.")
        st.line_chart(chart_data, x="일시", y="총 환자수")

    # 아랫줄: 산점도 / 기상 변수 중요도
    col3, col4 = st.columns(2)

    with col3:
        st.subheader("전국 평균 최고기온과 총 환자수")
        st.scatter_chart(
            chart_data,
            x="최고기온(°C)",
            y="총 환자수",
            height=350
        )

    with col4:
        st.subheader("기상 변수 중요도")

        importance_data = pd.DataFrame({
            "기상 변수": weather_columns,
            "중요도": model.feature_importances_
        })

        st.bar_chart(
            importance_data,
            x="기상 변수",
            y="중요도",
            height=350
        )
    st.divider()
    st.subheader("분석 결과 해석")

    insight1, insight2 = st.columns(2)

    with insight1:
        with st.container(border=True):
            st.markdown("#### 🌡️ 높은 기온에서 환자 수 증가")
            st.write(
                "전국 평균 최고기온이 높은 구간에서 "
                "환자가 많이 발생한 날들이 관찰됩니다."
            )
            st.markdown("**더운 날일수록 환자 발생 규모가 커지는 경향이 있습니다.**")

    with insight2:
        with st.container(border=True):
            st.markdown("#### 📊 같은 기온에서도 발생 규모 차이")
            st.write(
                "비슷한 최고기온에서도 "
                "날짜에 따라 환자 수가 크게 달라집니다."
            )
            st.markdown("**최고기온만으로 하루 환자 수를 설명하기는 어렵습니다.**")

    st.caption(
        "분석 범위: 전국 단위의 여름철 감시자료 · "
        "특정 지역이나 개인의 위험을 직접 나타내지는 않습니다."
    )

    st.write(
        "이러한 특성을 반영하기 위해 기온·습도·풍속 등 "
        "8개 기상 변수를 함께 사용하는 Random Forest 모델을 적용했습니다. "
        "변수 중요도는 이 모델이 어떤 기상 정보를 예측에 주로 "
        "활용했는지 해석하는 데 사용했습니다."
    )

    st.caption(
        "전국 평균을 이용한 분석이므로 특정 지역의 극단적인 더위나 "
        "개인의 온열질환 위험을 그대로 나타내지는 않습니다."
    )

