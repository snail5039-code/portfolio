import requests
import csv
from datetime import datetime, timedelta

# 전국 대표 지역 좌표
LOCATIONS = [
    {"name": "서울", "latitude": 37.5665, "longitude": 126.9780},
    {"name": "부산", "latitude": 35.1796, "longitude": 129.0756},
    {"name": "대구", "latitude": 35.8714, "longitude": 128.6014},
    {"name": "인천", "latitude": 37.4563, "longitude": 126.7052},
    {"name": "광주", "latitude": 35.1595, "longitude": 126.8526},
    {"name": "대전", "latitude": 36.3504, "longitude": 127.3845},
    {"name": "울산", "latitude": 35.5384, "longitude": 129.3114},
    {"name": "세종", "latitude": 36.4800, "longitude": 127.2890},
    {"name": "수원", "latitude": 37.2636, "longitude": 127.0286},
    {"name": "춘천", "latitude": 37.8813, "longitude": 127.7298},
    {"name": "청주", "latitude": 36.6424, "longitude": 127.4890},
    {"name": "전주", "latitude": 35.8242, "longitude": 127.1480},
    {"name": "목포", "latitude": 34.8118, "longitude": 126.3922},
    {"name": "안동", "latitude": 36.5684, "longitude": 128.7294},
    {"name": "창원", "latitude": 35.2285, "longitude": 128.6811},
    {"name": "제주", "latitude": 33.4996, "longitude": 126.5312}
]

# 지역 하나의 일별·시간별 기상 예보 가져오기
def get_location_weather(location, date, end_date=None):
    url = "https://api.open-meteo.com/v1/forecast"

    if end_date is None:
        end_date = date

    params = {
        "latitude": location["latitude"],
        "longitude": location["longitude"],

        # 하루 단위 기상정보
        "daily": [
            "temperature_2m_mean",
            "temperature_2m_min",
            "temperature_2m_max",
            "precipitation_sum",
            "wind_speed_10m_mean",
            "relative_humidity_2m_mean",
            "sunshine_duration",
            "shortwave_radiation_sum"
        ],

        # 시간 단위 기상정보
        "hourly": [
            "temperature_2m",
            "wind_speed_10m",
            "relative_humidity_2m"
        ],

        "wind_speed_unit": "ms",
        "timezone": "Asia/Seoul",
        "start_date": str(date),
        "end_date": str(end_date)
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    return response.json()

# 전국 대표 지역의 하루 평균 기상정보 계산
def get_national_weather(date):
    daily_results = []

    # 모든 지역의 하루 기상정보 가져오기
    for location in LOCATIONS:
        weather = get_location_weather(location, date)
        daily_results.append(weather["daily"])

    location_count = len(daily_results)

    # 지역별 기상값을 모두 더한 뒤 지역 수로 나누기
    national_weather = {
        "평균기온(°C)": sum(
            result["temperature_2m_mean"][0]
            for result in daily_results
        ) / location_count,

        "최저기온(°C)": sum(
            result["temperature_2m_min"][0]
            for result in daily_results
        ) / location_count,

        "최고기온(°C)": sum(
            result["temperature_2m_max"][0]
            for result in daily_results
        ) / location_count,

        "일강수량(mm)": sum(
            result["precipitation_sum"][0]
            for result in daily_results
        ) / location_count,

        "평균 풍속(m/s)": sum(
            result["wind_speed_10m_mean"][0]
            for result in daily_results
        ) / location_count,

        "평균 상대습도(%)": sum(
            result["relative_humidity_2m_mean"][0]
            for result in daily_results
        ) / location_count,

        # Open-Meteo 일조시간은 초 단위이므로 시간으로 변환
        "합계 일조시간(hr)": (
            sum(
                result["sunshine_duration"][0]
                for result in daily_results
            ) / location_count
        ) / 3600,

        "합계 일사량(MJ/m2)": sum(
            result["shortwave_radiation_sum"][0]
            for result in daily_results
        ) / location_count
    }

    return national_weather


## 이건 모르겠어서 ai 계산 붙임
# 선택 도시의 외출 시간대 기상정보 계산
def get_city_outing_weather(
    date,
    selected_city,
    start_hour,
    duration_minutes
):
    # LOCATIONS에서 사용자가 선택한 도시 찾기
    location = next(
        location
        for location in LOCATIONS
        if location["name"] == selected_city
    )

    # 선택 날짜와 외출 시작 시각 합치기
    # 예: 2026-09-06 + 14시
    start_time = datetime.combine(
        date,
        datetime.min.time()
    ).replace(hour=start_hour)

    # 체류시간이 0분이면 시작 시각의 1시간 예보를 사용
    if duration_minutes == 0:
        end_time = start_time + timedelta(hours=1)
    else:
        end_time = start_time + timedelta(
            minutes=duration_minutes
        )

    # 외출 종료일이 다음 날이면 다음 날 예보까지 요청
    weather = get_location_weather(
        location,
        date,
        end_time.date()
    )

    hourly = weather["hourly"]
    daily = weather["daily"]

    # 가중평균 계산에 사용할 변수
    total_minutes = 0
    temperature_sum = 0
    wind_speed_sum = 0
    humidity_sum = 0

    # 시간별 예보를 하나씩 확인
    for index, time_text in enumerate(hourly["time"]):
        hour_start = datetime.fromisoformat(time_text)
        hour_end = hour_start + timedelta(hours=1)

        # 현재 예보 시간과 실제 외출 시간이 겹치는 구간 계산
        overlap_start = max(start_time, hour_start)
        overlap_end = min(end_time, hour_end)

        overlap_minutes = max(
            0,
            (overlap_end - overlap_start).total_seconds() / 60
        )

        # 외출 시간과 겹치는 예보만 계산에 사용
        if overlap_minutes > 0:
            total_minutes += overlap_minutes

            temperature_sum += (
                hourly["temperature_2m"][index]
                * overlap_minutes
            )

            wind_speed_sum += (
                hourly["wind_speed_10m"][index]
                * overlap_minutes
            )

            humidity_sum += (
                hourly["relative_humidity_2m"][index]
                * overlap_minutes
            )

    # 외출 시간에 비례한 평균값 계산
    outing_temperature = temperature_sum / total_minutes
    outing_wind_speed = wind_speed_sum / total_minutes
    outing_humidity = humidity_sum / total_minutes

    # 모델이 사용하는 기상 변수 8개 형태로 반환
    return {
        # 외출 시간대의 시간별 예보 평균 사용
        "평균기온(°C)": outing_temperature,
        "평균 풍속(m/s)": outing_wind_speed,
        "평균 상대습도(%)": outing_humidity,

        # 나머지는 선택 날짜의 하루 예보 사용
        "최저기온(°C)": daily["temperature_2m_min"][0],
        "최고기온(°C)": daily["temperature_2m_max"][0],
        "일강수량(mm)": daily["precipitation_sum"][0],
        "합계 일조시간(hr)": daily["sunshine_duration"][0] / 3600,
        "합계 일사량(MJ/m2)": daily[
            "shortwave_radiation_sum"
        ][0]
    }


# 기상청 API허브 응답의 한글 인코딩 처리
def _decode_kma_response(content):
    for encoding in ("utf-8", "euc-kr"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue

    return content.decode("utf-8", errors="replace")


# 선택 지역의 현재 폭염특보 조회
def get_heatwave_warning(auth_key, selected_city, date):
    # 인증키를 아직 입력하지 않았을 때 앱이 중단되지 않도록 상태만 반환
    if not auth_key:
        return {
            "status": "no_key",
            "message": "기상청 API 인증키를 입력하면 공식 폭염특보가 표시됩니다."
        }

    # 미래 날짜의 특보는 아직 발표되지 않았으므로 API를 호출하지 않음
    if date > datetime.now().date():
        return {
            "status": "not_announced",
            "message": "선택한 미래 날짜의 공식 폭염특보는 아직 발표되지 않았습니다."
        }

    url = "https://apihub.kma.go.kr/api/typ01/url/wrn_now_data_new.php"
    params = {
        "fe": "e",       # 발효시간 기준
        "tm": date.strftime("%Y%m%d%H%M") if isinstance(date, datetime) else date.strftime("%Y%m%d") + "2359",
        "disp": "1",     # 쉼표로 구분된 응답
        "help": "1",     # 응답 컬럼명 포함
        "authKey": auth_key
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
    except requests.RequestException:
        return {
            "status": "error",
            "message": "기상청 폭염특보 정보를 불러오지 못했습니다."
        }

    response_text = _decode_kma_response(response.content)

    # 주석 기호와 빈 줄을 제외하고 CSV 형태로 읽기
    cleaned_lines = []
    for line in response_text.splitlines():
        line = line.strip()
        if not line:
            continue

        cleaned_lines.append(line.lstrip("#").strip())

    header_index = next(
        (
            index
            for index, line in enumerate(cleaned_lines)
            if "REG_UP" in line and "WRN" in line and "LVL" in line
        ),
        None
    )

    if header_index is None:
        return {
            "status": "error",
            "message": "기상청 특보 응답 형식을 확인하지 못했습니다."
        }

    rows = csv.DictReader(cleaned_lines[header_index:])
    heatwave_rows = []

    for row in rows:
        warning_type = (row.get("WRN") or "").strip()
        region_text = " ".join([
            (row.get("REG_UP_KO") or "").strip(),
            (row.get("REG_KO") or "").strip()
        ])

        # H는 기상청 특보 코드에서 폭염을 의미함
        if warning_type == "H" and selected_city in region_text:
            heatwave_rows.append(row)

    if not heatwave_rows:
        return {
            "status": "none",
            "message": f"{selected_city}에 현재 발효 중인 폭염특보가 없습니다."
        }

    # 여러 구역이 조회되면 가장 높은 특보 수준을 표시
    level_order = {"1": 1, "2": 2, "3": 3}
    warning = max(
        heatwave_rows,
        key=lambda row: level_order.get((row.get("LVL") or "").strip(), 0)
    )

    level_code = (warning.get("LVL") or "").strip()
    level_name = {
        "2": "폭염주의보",
        "3": "폭염경보"
    }.get(level_code, "폭염특보")

    return {
        "status": "active",
        "level": level_name,
        "region": (warning.get("REG_KO") or selected_city).strip(),
        "announced_at": (warning.get("TM_FC") or "").strip(),
        "effective_at": (warning.get("TM_EF") or "").strip(),
        "message": f"{selected_city}에 {level_name}가 발효 중입니다."
    }
