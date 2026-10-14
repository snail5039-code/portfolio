import modelAllAges from "@/data/model-all-ages.json";
import modelElderly from "@/data/model-elderly.json";
import { loadKmaKey } from "@/lib/kmaKey";
import { predict, type RandomForestModel } from "@/lib/randomForest";
import { getAllAgeLevel, getElderlyLevel, getOutdoorGuidance } from "@/lib/riskLevel";
import { isTarget } from "@/lib/targets";
import { getCityOutingWeather, getHeatwaveWarning, getNationalWeather } from "@/lib/weather";

export const runtime = "nodejs"; // kmaKey.ts가 로컬 secrets.toml을 읽을 때 fs가 필요하다

// 예전에는 이 API가 로컬 .venv Python을 execFile로 실행해 예측했는데,
// Vercel 서버리스 환경에는 .venv와 모델 파일이 없어 항상 실패했다.
// 지금은 모델을 트리 구조 그대로 JSON으로 내보내(web/scripts/export_static_data.py)
// web/src/lib/randomForest.ts에서 Node.js만으로 같은 값을 계산한다.
const MODEL_BY_TARGET: Record<"전체 연령" | "65세 이상", RandomForestModel> = {
  "전체 연령": modelAllAges as RandomForestModel,
  "65세 이상": modelElderly as RandomForestModel,
};

const ALLOWED_CITIES = new Set(["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "수원", "춘천", "청주", "전주", "목포", "안동", "창원", "제주"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const target = String(body.target ?? "");
    const date = String(body.date ?? "");
    const city = String(body.city ?? "");
    const startHour = Number(body.startHour);
    const durationMinutes = Number(body.durationMinutes);

    if (!isTarget(target) || !ALLOWED_CITIES.has(city)) {
      return Response.json({ message: "예측 대상 또는 지역이 올바르지 않습니다." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
      return Response.json({ message: "날짜 또는 외출 시각을 확인해 주세요." }, { status: 400 });
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 0 || durationMinutes > 1440) {
      return Response.json({ message: "체류시간은 0~1440분 사이여야 합니다." }, { status: 400 });
    }

    const model = MODEL_BY_TARGET[target];
    const levelFor = target === "전체 연령" ? getAllAgeLevel : getElderlyLevel;

    const [nationalWeather, cityWeather] = await Promise.all([
      getNationalWeather(date),
      getCityOutingWeather(date, city, startHour, durationMinutes),
    ]);

    const nationalPrediction = predict(model, nationalWeather);
    const cityPrediction = predict(model, cityWeather);
    const cityLevel = levelFor(cityPrediction);

    const [guidance, warning] = await Promise.all([
      Promise.resolve(getOutdoorGuidance(target, cityLevel, startHour, durationMinutes)),
      getHeatwaveWarning(loadKmaKey(), city, date),
    ]);

    return Response.json({
      target,
      date,
      city,
      startHour,
      durationMinutes,
      national: { prediction: nationalPrediction, level: levelFor(nationalPrediction), weather: nationalWeather },
      cityResult: { prediction: cityPrediction, level: cityLevel, weather: cityWeather },
      guidance,
      warning,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("Prediction failed:", detail);
    return Response.json({ message: "예측 정보를 불러오지 못했습니다. 날짜와 네트워크 상태를 확인해 주세요." }, { status: 500 });
  }
}
