"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  UtensilsCrossed,
  Coffee,
  Pencil,
  Check,
  X,
  MapPin,
  StickyNote,
  Heart,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  updateMemo,
  toggleFavorite,
  updateVisited,
} from "@/app/restaurants/actions";
import Rating from "./Rating";
import LoginRequiredModal from "./LoginRequiredModal";
import EditRestaurantModal from "./EditRestaurantModal";
import DeleteRestaurantButton from "./DeleteRestaurantButton";

export type RestaurantCardData = {
  id: number | string;
  name: string;
  category?: string;
  categoryId?: number | null;
  rating?: number;
  reviewCount?: number;
  address?: string;
  aloneOk?: number;
  memo?: string | null;
  visited?: boolean;
  isFavorited?: boolean;
  lat?: number;
  lng?: number;
  ownerId?: string | null;
  imageUrl?: string | null;
};

export default function RestaurantCard({
  id,
  name,
  category,
  categoryId,
  rating,
  reviewCount,
  address,
  aloneOk,
  memo,
  visited: visitedProp,
  isFavorited,
  lat,
  lng,
  ownerId,
  imageUrl,
  isOwner,
  isLoggedIn,
  categories,
}: RestaurantCardData & {
  isOwner?: boolean;
  isLoggedIn?: boolean;
  categories?: { id: number; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo ?? "");
  const [currentMemo, setCurrentMemo] = useState(memo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [favorited, setFavorited] = useState(!!isFavorited);
  const [favPending, startFavTransition] = useTransition();
  const [visited, setVisited] = useState(!!visitedProp);
  const [visitedPending, startVisitedTransition] = useTransition();
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const CategoryIcon = category === "카페" ? Coffee : UtensilsCrossed;

  const saveMemo = () => {
    startTransition(async () => {
      const result = await updateMemo(id, draft);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setCurrentMemo(draft);
      setError(null);
      setEditing(false);
    });
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      setLoginModalOpen(true);
      return;
    }
    setFavorited((v) => !v);
    startFavTransition(async () => {
      const result = await toggleFavorite(id);
      if (result?.error) {
        setFavorited((v) => !v);
      }
    });
  };

  const handleVisitedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !visited;
    setVisited(next);
    startVisitedTransition(async () => {
      const result = await updateVisited(id, next);
      if (result?.error) {
        setVisited(!next);
      }
    });
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-brand/40">
      <LoginRequiredModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        message="즐겨찾기는 로그인 후 이용할 수 있어요."
      />

      <Link href={`/restaurants/${id}`} className="flex gap-3.5 p-3.5">
        <div className="relative flex h-[86px] w-[86px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-muted text-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 공개 URL
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <CategoryIcon className="h-7 w-7" strokeWidth={1.4} />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-[15px] font-bold leading-snug text-foreground transition-colors group-hover:text-brand">
              {name}
            </h3>
            <div
              className="flex shrink-0 items-center gap-1"
              onClick={(e) => e.preventDefault()}
            >
              {isOwner && (
                <button
                  onClick={handleVisitedClick}
                  disabled={visitedPending}
                  title={visited ? "방문 완료 (클릭해서 취소)" : "방문 체크하기"}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                    visited
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-muted hover:text-brand"
                  }`}
                >
                  {visited ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {isOwner && categories && (
                <EditRestaurantModal
                  restaurant={{
                    id,
                    name,
                    categoryId,
                    address,
                    aloneOk,
                    memo,
                    lat,
                    lng,
                    imageUrl,
                    ownerId,
                  }}
                  categories={categories}
                />
              )}
              {isOwner && <DeleteRestaurantButton restaurantId={id} />}
              <button
                onClick={handleFavoriteClick}
                disabled={favPending}
                aria-label="즐겨찾기"
                title="즐겨찾기"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-red-500"
              >
                <Heart
                  className={`h-3.5 w-3.5 ${
                    favorited ? "fill-red-500 text-red-500" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-1">
            <Rating value={rating} reviewCount={reviewCount ?? 0} />
          </div>

          {/* 메타 정보는 가운뎃점으로 구분해 한 줄로 압축 */}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            {category && <span>{category}</span>}
            {category && aloneOk !== undefined && (
              <span className="text-line">·</span>
            )}
            {aloneOk !== undefined && <span>혼밥 {aloneOk}/5</span>}
          </p>

          {address && (
            <p className="mt-auto flex items-center gap-1 pt-1.5 text-xs text-muted">
              <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.8} />
              <span className="truncate">{address}</span>
            </p>
          )}
        </div>
      </Link>

      {/* 메모: 본인이 등록한 가게만 편집 가능 */}
      {(currentMemo || isOwner) && (
        <div className="border-t border-line bg-surface-muted px-3.5 py-2.5">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                autoFocus
                placeholder="예: 웨이팅 30분, 2인석 많음"
                className="w-full resize-none rounded-md border border-line bg-surface px-2.5 py-2 text-xs leading-relaxed text-foreground outline-none focus:border-brand"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => {
                    setDraft(currentMemo);
                    setError(null);
                    setEditing(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface"
                >
                  <X className="h-3.5 w-3.5" />
                  취소
                </button>
                <button
                  onClick={saveMemo}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <StickyNote
                className="mt-px h-3.5 w-3.5 shrink-0 text-muted"
                strokeWidth={1.8}
              />
              <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
                {currentMemo || "메모를 남겨보세요."}
              </p>
              {isOwner && (
                <button
                  onClick={() => setEditing(true)}
                  aria-label="메모 수정"
                  className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-brand focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
