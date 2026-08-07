"use client";

import { useMemo, useState, useTransition } from "react";
import { Bot, X, Loader2, RotateCw, MessageCircleHeart } from "lucide-react";
import RestaurantCard, { type RestaurantCardData } from "./RestaurantCard";
import { recommendWithAi } from "@/app/restaurants/aiActions";

const SUGGESTIONS = [
  "기분이 꿀꿀해서 위로되는 음식 먹고 싶어",
  "비 오는 날 따뜻한 국물 먹고 싶어",
  "더워서 시원하고 매콤한 게 먹고 싶어",
  "혼자 편하게 먹을 수 있는 곳",
  "오늘 기념일이라 근사한 곳 가고 싶어",
];

export default function AIRecommendModal({
  restaurants,
  currentUserId,
  isLoggedIn,
  categories,
}: {
  restaurants: RestaurantCardData[];
  currentUserId: string | null;
  isLoggedIn: boolean;
  categories: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pickedIds, setPickedIds] = useState<(number | string)[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const picked = useMemo(() => {
    if (!pickedIds) return null;
    const byId = new Map(restaurants.map((r) => [String(r.id), r]));
    return pickedIds.map((id) => byId.get(String(id))).filter(Boolean) as RestaurantCardData[];
  }, [pickedIds, restaurants]);

  const ask = () => {
    setError(null);
    startTransition(async () => {
      const pool = restaurants.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        memo: r.memo,
        aloneOk: r.aloneOk,
        visited: r.visited,
      }));
      const result = await recommendWithAi(input, pool);
      if (result.error) {
        setError(result.error);
        setPickedIds(null);
        setMessage(null);
        return;
      }
      setMessage(result.message ?? null);
      setReasons(result.reasons ?? {});
      setPickedIds(result.restaurantIds ?? []);
    });
  };

  const close = () => {
    setOpen(false);
    setInput("");
    setError(null);
    setMessage(null);
    setPickedIds(null);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
      >
        <Bot className="h-4 w-4" strokeWidth={2.2} />
        AI 맛집 추천
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-foreground">
                <Bot className="h-4 w-4 text-brand" />
                AI 맛집 추천
              </h2>
              <button
                onClick={close}
                aria-label="닫기"
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <p className="text-[13px] text-muted">
                지금 기분이나 날씨, 먹고 싶은 걸 자유롭게 적어주세요. 저장된 맛집 중에서 AI가 골라드려요.
              </p>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
                placeholder="예: 스트레스 받아서 매운 게 당겨"
                className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-brand"
              />

              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button
                onClick={ask}
                disabled={isPending || restaurants.length === 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI가 고민 중...
                  </>
                ) : picked ? (
                  <>
                    <RotateCw className="h-4 w-4" />
                    다시 물어보기
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" />
                    AI에게 추천받기
                  </>
                )}
              </button>

              {restaurants.length === 0 && (
                <p className="text-center text-[13px] text-muted">
                  아직 저장된 맛집이 없어요. 먼저 맛집을 등록해보세요.
                </p>
              )}

              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </p>
              )}

              {message && (
                <div className="flex items-start gap-2 rounded-md border border-brand/30 bg-brand/5 px-3 py-2.5">
                  <MessageCircleHeart className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <p className="text-[13px] leading-relaxed text-foreground">{message}</p>
                </div>
              )}

              {picked && picked.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  {picked.map((restaurant) => (
                    <div key={restaurant.id} className="flex flex-col gap-1.5">
                      {reasons[String(restaurant.id)] && (
                        <p className="px-1 text-xs font-medium text-brand">
                          {reasons[String(restaurant.id)]}
                        </p>
                      )}
                      <RestaurantCard
                        {...restaurant}
                        isOwner={
                          !!currentUserId && restaurant.ownerId === currentUserId
                        }
                        isLoggedIn={isLoggedIn}
                        categories={categories}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
