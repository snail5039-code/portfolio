import analysisAllAges from "@/data/analysis-all-ages.json";
import analysisElderly from "@/data/analysis-elderly.json";
import { isTarget } from "@/lib/targets";

// 학습 데이터는 2022~2025년으로 고정되어 있어 요청마다 다시 계산하지 않고
// web/scripts/export_static_data.py가 미리 만들어 둔 정적 JSON을 그대로 반환한다.
// (예전에는 매 요청마다 Python을 실행했는데, Vercel 서버리스에는 .venv가 없어 항상 실패했다.)
const ANALYSIS_BY_TARGET = {
  "전체 연령": analysisAllAges,
  "65세 이상": analysisElderly,
} as const;

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("target") ?? "전체 연령";
  if (!isTarget(target)) {
    return Response.json({ message: "예측 대상이 올바르지 않습니다." }, { status: 400 });
  }

  return Response.json(ANALYSIS_BY_TARGET[target]);
}
