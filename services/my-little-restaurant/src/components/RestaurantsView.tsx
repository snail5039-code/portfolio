"use client";

import { useMemo, useRef, useState } from "react";
import { Map as MapIcon, LayoutGrid, Search, SearchX, ChevronLeft, ChevronRight } from "lucide-react";
import RestaurantCard, { type RestaurantCardData } from "./RestaurantCard";
import KakaoMap, { type CertifiedMapMarker } from "./KakaoMap";
import RegisterRestaurantModal, {
  type RegisterRestaurantModalHandle,
} from "./RegisterRestaurantModal";
import RecommendModal from "./RecommendModal";
import AIRecommendModal from "./AIRecommendModal";
import NearbyModelRestaurantSearch from "./NearbyModelRestaurantSearch";
import { extractDistrict } from "@/lib/address";

type View = "card" | "map";
type MapFilter = "both" | "mine" | "certified";

const VIEW_OPTIONS = [
  { key: "card", label: "카드", icon: LayoutGrid },
  { key: "map", label: "지도", icon: MapIcon },
] as const;

const MAP_FILTER_OPTIONS = [
  { key: "both", label: "전체" },
  { key: "mine", label: "내 맛집만" },
  { key: "certified", label: "모범업소만" },
] as const;

const PAGE_SIZE = 12;

export default function RestaurantsView({
  restaurants,
  categories,
  isLoggedIn,
  currentUserId,
}: {
  restaurants: RestaurantCardData[];
  categories: { id: number; name: string }[];
  isLoggedIn: boolean;
  currentUserId: string | null;
}) {
  const [view, setView] = useState<View>("card");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<MapFilter>("both");
  const [page, setPage] = useState(1);
  const [certifiedMarkers, setCertifiedMarkers] = useState<CertifiedMapMarker[]>(
    []
  );
  const registerModalRef = useRef<RegisterRestaurantModalHandle>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return restaurants.filter((r) => {
      const matchesQuery =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.address ?? "").toLowerCase().includes(q);
      const matchesCategory = !activeCategory || r.category === activeCategory;
      const matchesDistrict =
        !activeDistrict || extractDistrict(r.address ?? "") === activeDistrict;
      return matchesQuery && matchesCategory && matchesDistrict;
    });
  }, [restaurants, query, activeCategory, activeDistrict]);

  // 검색어/카테고리/지역이 바뀌면 이전 페이지에 머물러 있지 않도록 1페이지로 리셋.
  // useEffect 대신 렌더 중 파생 상태로 처리 (React가 권장하는 패턴).
  const filterKey = `${query}|${activeCategory ?? ""}|${activeDistrict ?? ""}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const markers = useMemo(
    () =>
      filtered
        .filter((r) => r.lat !== undefined && r.lng !== undefined)
        .map((r) => ({
          id: r.id,
          name: r.name,
          lat: r.lat!,
          lng: r.lng!,
          category: r.category,
          memo: r.memo,
        })),
    [filtered]
  );

  // 실제로 등록된 가게가 있는 카테고리만 필터로 노출
  const usedCategories = useMemo(() => {
    const names = new Set(restaurants.map((r) => r.category).filter(Boolean));
    return categories.filter((c) => names.has(c.name));
  }, [restaurants, categories]);

  // 주소에서 구/군/시를 뽑아 실제로 등록된 지역만 필터로 노출 (가게 수 많은 순)
  const usedDistricts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of restaurants) {
      const district = extractDistrict(r.address ?? "");
      if (!district) continue;
      counts.set(district, (counts.get(district) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [restaurants]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* 검색 + 등록 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="가게 이름 · 지역 검색"
            className="w-full rounded-md border border-line bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-brand"
          />
        </div>
        <RecommendModal
          restaurants={restaurants}
          categories={categories}
          currentUserId={currentUserId}
          isLoggedIn={isLoggedIn}
        />
        <AIRecommendModal
          restaurants={restaurants}
          categories={categories}
          currentUserId={currentUserId}
          isLoggedIn={isLoggedIn}
        />
        <RegisterRestaurantModal
          ref={registerModalRef}
          categories={categories}
          isLoggedIn={isLoggedIn}
          userId={currentUserId}
        />
      </div>

      {/* 카테고리 칩 */}
      {usedCategories.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === null
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-muted hover:text-foreground"
            }`}
          >
            전체
          </button>
          {usedCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.name)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === c.name
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-muted hover:text-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* 지역 칩 */}
      {usedDistricts.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <button
            onClick={() => setActiveDistrict(null)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeDistrict === null
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-muted hover:text-foreground"
            }`}
          >
            전지역
          </button>
          {usedDistricts.map((district) => (
            <button
              key={district}
              onClick={() => setActiveDistrict(district)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeDistrict === district
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-muted hover:text-foreground"
              }`}
            >
              {district}
            </button>
          ))}
        </div>
      )}

      {/* 결과 수 + 뷰 전환 */}
      <div className="flex items-center justify-between gap-3 border-b border-line pb-2.5">
        <p className="text-[13px] text-muted">
          <span className="tnum font-bold text-foreground">
            {filtered.length}
          </span>
          곳
          {filtered.length !== restaurants.length && (
            <span className="tnum text-muted"> / 전체 {restaurants.length}곳</span>
          )}
        </p>

        <div className="flex rounded-md border border-line bg-surface p-0.5">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setView(option.key)}
              aria-pressed={view === option.key}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                view === option.key
                  ? "bg-brand text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <option.icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {view === "card" ? (
        filtered.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {paginated.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  {...restaurant}
                  isOwner={!!currentUserId && restaurant.ownerId === currentUserId}
                  isLoggedIn={isLoggedIn}
                  categories={categories}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="이전 페이지"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    aria-current={p === page}
                    className={`tnum inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors ${
                      p === page
                        ? "bg-brand text-white"
                        : "text-muted hover:bg-surface-muted hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="다음 페이지"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line py-20 text-center">
            <SearchX className="h-6 w-6 text-muted" strokeWidth={1.6} />
            <p className="text-sm font-medium text-foreground">
              {restaurants.length === 0
                ? "아직 등록된 맛집이 없어요"
                : "조건에 맞는 맛집이 없어요"}
            </p>
            <p className="text-xs text-muted">
              {restaurants.length === 0
                ? "오른쪽 위 맛집 등록으로 첫 가게를 추가해보세요."
                : "검색어나 카테고리를 바꿔보세요."}
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <NearbyModelRestaurantSearch onResults={setCertifiedMarkers} />

          {/* 지도에 무엇을 표시할지: 내 맛집/모범업소가 겹쳐서 안 보이는 문제 때문에 필터 추가 */}
          <div className="flex gap-1.5">
            {MAP_FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setMapFilter(option.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  mapFilter === option.key
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <KakaoMap
              markers={mapFilter === "certified" ? [] : markers}
              certifiedMarkers={mapFilter === "mine" ? [] : certifiedMarkers}
              onRegisterCertified={(marker) =>
                registerModalRef.current?.openWithPrefill({
                  name: marker.name,
                  address: marker.address,
                  foodType: marker.foodType,
                  lat: marker.lat,
                  lng: marker.lng,
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
