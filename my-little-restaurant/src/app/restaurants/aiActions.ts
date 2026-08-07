"use server";

import { createClient } from "@/lib/supabase/server";
import { getAiRecommendation, type AiRestaurantInput } from "@/lib/gemini";

export type AiRecommendState = {
  error?: string;
  message?: string;
  reasons?: Record<string, string>;
  restaurantIds?: (number | string)[];
};

export async function recommendWithAi(
  userInput: string,
  pool: AiRestaurantInput[]
): Promise<AiRecommendState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const trimmed = userInput.trim();
  if (!trimmed) {
    return { error: "기분이나 먹고 싶은 걸 적어주세요." };
  }
  if (pool.length === 0) {
    return { error: "추천할 맛집이 없어요. 먼저 맛집을 등록해보세요." };
  }

  try {
    const result = await getAiRecommendation(trimmed, pool);
    const reasons: Record<string, string> = {};
    const restaurantIds: (number | string)[] = [];

    for (const pick of result.picks) {
      const match = pool.find((r) => String(r.id) === String(pick.id));
      if (match && !restaurantIds.includes(match.id)) {
        restaurantIds.push(match.id);
        reasons[String(match.id)] = pick.reason;
      }
    }

    if (restaurantIds.length === 0) {
      return { error: "AI가 조건에 맞는 가게를 찾지 못했어요. 다르게 말해보세요." };
    }

    return { message: result.message, restaurantIds, reasons };
  } catch (err) {
    console.error("AI 추천 실패:", err);
    return { error: "AI 추천을 가져오지 못했어요. 잠시 후 다시 시도해주세요." };
  }
}
