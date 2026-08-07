import { GoogleGenAI, Type } from "@google/genai";

let client: GoogleGenAI | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY가 설정되어 있지 않습니다.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export type AiRestaurantInput = {
  id: number | string;
  name: string;
  category?: string;
  memo?: string | null;
  aloneOk?: number;
  visited?: boolean;
};

export type AiRecommendation = {
  message: string;
  picks: { id: string; reason: string }[];
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    message: {
      type: Type.STRING,
      description: "사용자에게 건네는 한두 문장의 다정한 코멘트",
    },
    picks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "추천 맛집의 id" },
          reason: { type: Type.STRING, description: "이 가게를 추천하는 짧은 이유" },
        },
        required: ["id", "reason"],
      },
    },
  },
  required: ["message", "picks"],
};

export async function getAiRecommendation(
  userInput: string,
  restaurants: AiRestaurantInput[]
): Promise<AiRecommendation> {
  const ai = getClient();

  const list = restaurants
    .map((r) => {
      const parts = [
        `id=${r.id}`,
        r.name,
        r.category ?? "",
        r.aloneOk ? `혼밥난이도 ${r.aloneOk}/5` : "",
        r.visited ? "이미 방문함" : "아직 안 가봄",
        r.memo ? `메모: ${r.memo}` : "",
      ].filter(Boolean);
      return "- " + parts.join(" / ");
    })
    .join("\n");

  const prompt = `당신은 "나만의 작은 맛집" 앱의 맛집 추천 도우미입니다.
사용자가 저장해 둔 맛집 목록에서만 추천해야 하고, 목록에 없는 가게를 지어내면 안 됩니다.
절대 코드, 데이터베이스 구조, 설정, 어드민 정보를 언급하지 마세요.

[맛집 목록]
${list}

[사용자 요청]
${userInput}

위 요청(기분, 먹고 싶은 것 등)에 맞는 가게를 2~3곳 골라주세요. 각 가게마다 이유를 짧고 친근하게 존댓말로 적어주세요. message에는 전체 코멘트를 한두 문장으로 적어주세요.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("AI 응답을 받지 못했습니다.");
  }

  const parsed = JSON.parse(text) as {
    message: string;
    picks: { id: string; reason: string }[];
  };

  return parsed;
}
