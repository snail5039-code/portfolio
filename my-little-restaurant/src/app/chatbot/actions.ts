'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage } from '@/lib/stores/chatbot';
import { supabase, type Restaurant } from '@/lib/supabase';
import { extractDistrict } from '@/lib/address';
import { searchModelRestaurantsByRegion } from '@/lib/modelRestaurant';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const systemPrompt = `You are a friendly assistant for "My Little Restaurant" (나만의 작은 맛집) app. Help users with:
- Casual daily chat about food and restaurants
- General food recommendations based on mood/weather/situation
- App feature explanations

SECURITY RULES - STRICTLY ENFORCE:
- NEVER show code, database structures, or internal implementation details
- NEVER mention admin functions, user permissions, or system architecture
- NEVER discuss data storage, API details, or backend infrastructure
- NEVER ask for or process configuration information
- Keep all responses about general food topics only

You will receive a [내 맛집 목록] context with user-saved restaurants. Use it ONLY for friendly recommendations - never expose the data structure itself.

How to respond:
- Be friendly and concise (short paragraphs)
- Keep conversations casual and light-hearted
- For app questions, explain features simply without technical jargon
- If users ask about code/settings/admin - politely decline and redirect to casual chat
- Avoid long markdown headers or complex formatting

Do NOT:
- Explain code or Python examples
- Show configuration, database queries, or internal processes
- Discuss app permissions, security settings, or admin access
- Invent restaurant details not provided in context
- Answer technical/backend questions`;

const MAX_LIST_ITEMS = 150;

function buildRestaurantListContext(restaurants: Restaurant[]): string {
  if (restaurants.length === 0) {
    return '(아직 등록된 맛집이 없습니다)';
  }

  return restaurants
    .slice(0, MAX_LIST_ITEMS)
    .map((r) => {
      const district = r.address ? extractDistrict(r.address) : null;
      const parts = [
        `id=${r.id}`,
        r.name,
        r.food || '기타',
        district ? `지역: ${district}` : null,
        r.alone_ok ? `혼밥난이도 ${r.alone_ok}/5` : null,
        r.visited ? '방문함' : '아직 안 가봄',
        r.rating ? `별점 ${r.rating}` : null,
        r.memo ? `메모: ${r.memo.slice(0, 40)}` : null,
      ].filter(Boolean);
      return '- ' + parts.join(' / ');
    })
    .join('\n');
}

// 사용자 메시지에 저장된 맛집들의 지역(구/군/시) 이름이 언급됐는지 확인해서
// 언급된 경우에만 공공데이터 모범음식점을 조회한다 (매번 호출하면 느리고 API 낭비)
async function findMentionedRegionContext(
  userMessage: string,
  restaurants: Restaurant[],
): Promise<string | null> {
  const districts = new Set<string>();
  for (const r of restaurants) {
    if (!r.address) continue;
    const d = extractDistrict(r.address);
    if (d) districts.add(d);
  }

  const mentioned = [...districts].find((d) => userMessage.includes(d));
  if (!mentioned) return null;

  try {
    const result = await searchModelRestaurantsByRegion(mentioned);
    if (result.items.length === 0) return null;

    const lines = result.items
      .slice(0, 5)
      .map((item) => `- ${item.name} (${item.foodType || '기타'}) / ${item.address}`)
      .join('\n');

    return `[${mentioned} 지역 모범음식점 인증 업소]\n${lines}`;
  } catch {
    return null;
  }
}

export async function sendChatbotMessage(
  previousMessages: ChatMessage[],
  userMessage: string,
  clickCount: number = 0,
): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('*')
      .order('id');
    const restaurantList = (restaurants ?? []) as Restaurant[];

    const listContext = buildRestaurantListContext(restaurantList);
    const regionContext = await findMentionedRegionContext(userMessage, restaurantList);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      systemInstruction: systemPrompt,
    });

    // 이전 메시지들을 history 형식으로 변환
    const history = previousMessages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Add context based on click count
    let contextSuffix = '';
    if (clickCount > 0) {
      if (clickCount < 3) {
        contextSuffix = '\n[User clicked character 1-2 times - stay friendly and helpful]';
      } else if (clickCount < 5) {
        contextSuffix = '\n[User clicked character 3-4 times - you can be playful!]';
      } else {
        contextSuffix = '\n[User clicked character 5+ times - be funny and witty! You can be a bit dramatic, like "Okay okay, enough poking!" but stay helpful]';
      }
    }

    // startChat으로 대화 세션 시작
    const chat = model.startChat({
      history: history.length > 0 ? history : undefined,
    });

    const contextBlock = [
      `[내 맛집 목록]\n${listContext}`,
      regionContext,
    ]
      .filter(Boolean)
      .join('\n\n');

    // 메시지 전송 (맛집 목록 + 지역 모범음식점 context + click count context 포함)
    const fullMessage = `${contextBlock}\n\n[사용자 질문]\n${userMessage}${contextSuffix}`;
    const result = await chat.sendMessage(fullMessage);
    const responseText = result.response.text();

    return responseText;
  } catch (error) {
    console.error('Chatbot error details:', error instanceof Error ? error.message : error);
    throw error;
  }
}
