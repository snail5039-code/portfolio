"use client";

import { useMemo, useState } from "react";
import { Sparkles, X, RotateCw } from "lucide-react";
import RestaurantCard, { type RestaurantCardData } from "./RestaurantCard";

export default function RecommendModal({
  restaurants,
  categories,
  currentUserId,
  isLoggedIn,
}: {
  restaurants: RestaurantCardData[];
  categories: { id: number; name: string }[];
  currentUserId: string | null;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [unvisitedOnly, setUnvisitedOnly] = useState(false);
  const [aloneFriendly, setAloneFriendly] = useState(false);
  const [picked, setPicked] = useState<RestaurantCardData[] | null>(null);

  const pool = useMemo(
    () =>
      restaurants.filter((r) => {
        if (category && r.category !== category) return false;
        if (unvisitedOnly && r.visited) return false;
        if (aloneFriendly && (r.aloneOk === undefined || r.aloneOk > 2))
          return false;
        return true;
      }),
    [restaurants, category, unvisitedOnly, aloneFriendly]
  );

  const recommend = () => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const count =
      shuffled.length >= 5 ? 3 + Math.floor(Math.random() * 3) : shuffled.length;
    setPicked(shuffled.slice(0, count));
  };

  const close = () => {
    setOpen(false);
    setPicked(null);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
      >
        <Sparkles className="h-4 w-4" strokeWidth={2.2} />
        오늘 뭐 먹지?
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
                <Sparkles className="h-4 w-4 text-brand" />
                오늘 뭐 먹지?
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
              {categories.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    카테고리
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setCategory(null)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        category === null
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-surface text-muted hover:text-foreground"
                      }`}
                    >
                      전체
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCategory(c.name)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          category === c.name
                            ? "border-brand bg-brand text-white"
                            : "border-line bg-surface text-muted hover:text-foreground"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-[13px] text-foreground">
                  <input
                    type="checkbox"
                    checked={unvisitedOnly}
                    onChange={(e) => setUnvisitedOnly(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  아직 안 가본 곳만
                </label>
                <label className="flex items-center gap-1.5 text-[13px] text-foreground">
                  <input
                    type="checkbox"
                    checked={aloneFriendly}
                    onChange={(e) => setAloneFriendly(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  혼밥하기 편한 곳만
                </label>
              </div>

              <button
                onClick={recommend}
                disabled={pool.length === 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
              >
                {picked ? (
                  <>
                    <RotateCw className="h-4 w-4" />
                    다시 추천받기
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    추천받기 ({pool.length}곳 중에서)
                  </>
                )}
              </button>

              {pool.length === 0 && (
                <p className="text-center text-[13px] text-muted">
                  조건에 맞는 맛집이 없어요. 필터를 조금 풀어보세요.
                </p>
              )}

              {picked && picked.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  {picked.map((restaurant) => (
                    <RestaurantCard
                      key={restaurant.id}
                      {...restaurant}
                      isOwner={
                        !!currentUserId && restaurant.ownerId === currentUserId
                      }
                      isLoggedIn={isLoggedIn}
                      categories={categories}
                    />
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
