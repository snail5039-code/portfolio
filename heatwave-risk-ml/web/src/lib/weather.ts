// weather_api.py의 TypeScript 이식본.
// Vercel 서버리스 환경에서 Python 없이 동일한 기상 조회·집계를 수행한다.

import iconv from "iconv-lite";
import { LOCATIONS, findLocation, type Location } from "./locations";

// AbortSignal.timeout()은 Node 17.3+에서만 지원돼 배포 환경에 따라 없을 수 있어 직접 구현한다.
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error(`요청이 ${ms}ms 안에 끝나지 않았습니다.`)), ms);
  return controller.signal;
}

type OpenMeteoDaily = {
  temperature_2m_mean: number[];
  temperature_2m_min: number[];
  temperature_2m_max: number[];
  precipitation_sum: number[];
  wind_speed_10m_mean: number[];
  relative_humidity_2m_mean: number[];
  sunshine_duration: number[];
  shortwave_radiation_sum: number[];
};

type OpenMeteoHourly = {
  time: string[];
  temperature_2m: number[];
  wind_speed_10m: number[];
  relative_humidity_2m: number[];
};

type OpenMeteoResponse = { daily: OpenMeteoDaily; hourly: OpenMeteoHourly };

// 서버 실행 위치(UTC 등)와 무관하게 항상 한국 시간 기준 날짜(YYYY-MM-DD)를 돌려준다.
// Date.toISOString()이나 setHours()는 로컬/UTC 기준이라 Vercel(UTC 서버)에서는
// 다른 날짜가 나올 수 있어 쓰지 않는다.
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function koreaDateString(date: Date): string {
  return KST_DATE_FORMATTER.format(date);
}

async function getLocationWeather(location: Location, date: string, endDate: string = date): Promise<OpenMeteoResponse> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set(
    "daily",
    [
      "temperature_2m_mean",
      "temperature_2m_min",
      "temperature_2m_max",
      "precipitation_sum",
      "wind_speed_10m_mean",
      "relative_humidity_2m_mean",
      "sunshine_duration",
      "shortwave_radiation_sum",
    ].join(","),
  );
  url.searchParams.set("hourly", ["temperature_2m", "wind_speed_10m", "relative_humidity_2m"].join(","));
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timezone", "Asia/Seoul");
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", endDate);

  const response = await fetch(url, { signal: timeoutSignal(10_000) });
  if (!response.ok) throw new Error(`Open-Meteo 요청 실패 (${response.status})`);
  return response.json();
}

export type NationalWeather = Record<string, number>;

// 전국 대표 지역의 하루 평균 기상정보 계산
export async function getNationalWeather(date: string): Promise<NationalWeather> {
  const results = await Promise.all(LOCATIONS.map((location) => getLocationWeather(location, date)));
  const count = results.length;
  const sum = (pick: (daily: OpenMeteoDaily) => number) => results.reduce((total, result) => total + pick(result.daily), 0) / count;

  return {
    "평균기온(°C)": sum((d) => d.temperature_2m_mean[0]),
    "최저기온(°C)": sum((d) => d.temperature_2m_min[0]),
    "최고기온(°C)": sum((d) => d.temperature_2m_max[0]),
    "일강수량(mm)": sum((d) => d.precipitation_sum[0]),
    "평균 풍속(m/s)": sum((d) => d.wind_speed_10m_mean[0]),
    "평균 상대습도(%)": sum((d) => d.relative_humidity_2m_mean[0]),
    "합계 일조시간(hr)": sum((d) => d.sunshine_duration[0]) / 3600,
    "합계 일사량(MJ/m2)": sum((d) => d.shortwave_radiation_sum[0]),
  };
}

// 선택 도시의 외출 시간대 기상정보 계산 (시간별 예보를 외출 구간과 겹치는 분 단위로 가중평균)
export async function getCityOutingWeather(
  date: string,
  selectedCity: string,
  startHour: number,
  durationMinutes: number,
): Promise<NationalWeather> {
  const location = findLocation(selectedCity);

  // setHours()는 서버의 로컬 타임존을 기준으로 시각을 바꾸기 때문에(UTC 서버에서는 KST와 어긋남)
  // 문자열에 +09:00을 직접 명시해 항상 한국 시간 기준 시작 시각을 만든다.
  const startTime = new Date(`${date}T${String(startHour).padStart(2, "0")}:00:00+09:00`);
  const endTime = new Date(startTime.getTime() + (durationMinutes === 0 ? 60 : durationMinutes) * 60_000);

  const weather = await getLocationWeather(location, date, koreaDateString(endTime));
  const { hourly, daily } = weather;

  let totalMinutes = 0;
  let temperatureSum = 0;
  let windSpeedSum = 0;
  let humiditySum = 0;

  hourly.time.forEach((timeText, index) => {
    const hourStart = new Date(timeText);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60_000);

    const overlapStart = Math.max(startTime.getTime(), hourStart.getTime());
    const overlapEnd = Math.min(endTime.getTime(), hourEnd.getTime());
    const overlapMinutes = Math.max(0, (overlapEnd - overlapStart) / 60_000);

    if (overlapMinutes > 0) {
      totalMinutes += overlapMinutes;
      temperatureSum += hourly.temperature_2m[index] * overlapMinutes;
      windSpeedSum += hourly.wind_speed_10m[index] * overlapMinutes;
      humiditySum += hourly.relative_humidity_2m[index] * overlapMinutes;
    }
  });

  if (totalMinutes === 0) throw new Error("선택한 외출 시간대의 기상 예보를 찾지 못했습니다.");

  return {
    "평균기온(°C)": temperatureSum / totalMinutes,
    "평균 풍속(m/s)": windSpeedSum / totalMinutes,
    "평균 상대습도(%)": humiditySum / totalMinutes,
    "최저기온(°C)": daily.temperature_2m_min[0],
    "최고기온(°C)": daily.temperature_2m_max[0],
    "일강수량(mm)": daily.precipitation_sum[0],
    "합계 일조시간(hr)": daily.sunshine_duration[0] / 3600,
    "합계 일사량(MJ/m2)": daily.shortwave_radiation_sum[0],
  };
}

export type HeatwaveWarning =
  | { status: "no_key" | "not_announced" | "error" | "none"; message: string }
  | { status: "active"; level: string; region: string; announced_at: string; effective_at: string; message: string };

function decodeKmaResponse(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return iconv.decode(Buffer.from(buffer), "euc-kr");
  }
}

// 아주 단순한 CSV 파서: 값에 쉼표가 포함되지 않는 기상청 응답 형식을 전제로 한다.
function parseCsv(lines: string[]): Record<string, string>[] {
  const header = lines[0].split(",").map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      row[key] = (cells[index] ?? "").trim();
    });
    return row;
  });
}

// 선택 지역의 현재 폭염특보 조회
export async function getHeatwaveWarning(authKey: string, selectedCity: string, date: string): Promise<HeatwaveWarning> {
  if (!authKey) {
    return { status: "no_key", message: "기상청 API 인증키를 입력하면 공식 폭염특보가 표시됩니다." };
  }

  const today = koreaDateString(new Date());
  if (date > today) {
    return { status: "not_announced", message: "선택한 미래 날짜의 공식 폭염특보는 아직 발표되지 않았습니다." };
  }

  const url = new URL("https://apihub.kma.go.kr/api/typ01/url/wrn_now_data_new.php");
  url.searchParams.set("fe", "e");
  url.searchParams.set("tm", `${date.replaceAll("-", "")}2359`);
  url.searchParams.set("disp", "1");
  url.searchParams.set("help", "1");
  url.searchParams.set("authKey", authKey);

  let responseText: string;
  try {
    const response = await fetch(url, { signal: timeoutSignal(10_000) });
    if (!response.ok) throw new Error(`기상청 응답 오류 (${response.status})`);
    responseText = decodeKmaResponse(await response.arrayBuffer());
  } catch {
    return { status: "error", message: "기상청 폭염특보 정보를 불러오지 못했습니다." };
  }

  const cleanedLines = responseText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^#+/, "").trim());

  const headerIndex = cleanedLines.findIndex((line) => line.includes("REG_UP") && line.includes("WRN") && line.includes("LVL"));
  if (headerIndex === -1) {
    return { status: "error", message: "기상청 특보 응답 형식을 확인하지 못했습니다." };
  }

  const rows = parseCsv(cleanedLines.slice(headerIndex));
  const heatwaveRows = rows.filter((row) => {
    const warningType = (row.WRN ?? "").trim();
    const regionText = `${(row.REG_UP_KO ?? "").trim()} ${(row.REG_KO ?? "").trim()}`;
    return warningType === "H" && regionText.includes(selectedCity);
  });

  if (heatwaveRows.length === 0) {
    return { status: "none", message: `${selectedCity}에 현재 발효 중인 폭염특보가 없습니다.` };
  }

  const levelOrder: Record<string, number> = { "1": 1, "2": 2, "3": 3 };
  const warning = heatwaveRows.reduce((best, row) => {
    const level = levelOrder[(row.LVL ?? "").trim()] ?? 0;
    const bestLevel = levelOrder[(best.LVL ?? "").trim()] ?? 0;
    return level > bestLevel ? row : best;
  });

  const levelCode = (warning.LVL ?? "").trim();
  const levelName = levelCode === "2" ? "폭염주의보" : levelCode === "3" ? "폭염경보" : "폭염특보";

  return {
    status: "active",
    level: levelName,
    region: (warning.REG_KO ?? selectedCity).trim(),
    announced_at: (warning.TM_FC ?? "").trim(),
    effective_at: (warning.TM_EF ?? "").trim(),
    message: `${selectedCity}에 ${levelName}가 발효 중입니다.`,
  };
}
