import { Lock } from "lucide-react";
import { supabase, type Restaurant } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import RestaurantsView from "@/components/RestaurantsView";
import OAuthLoginButton from "@/components/OAuthLoginButton";

export default async function RestaurantsPage() {
  const supabaseServer = await createClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-muted text-brand">
          <Lock className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <h1 className="text-lg font-bold text-foreground">
          로그인 후 맛집 리스트를 볼 수 있어요
        </h1>
        <p className="max-w-sm text-[13px] leading-relaxed text-muted">
          다른 사람이 저장한 가게와 내 기록을 함께 보려면 먼저 로그인해주세요.
        </p>
        <div className="flex w-full max-w-[18rem] flex-col gap-2">
          <OAuthLoginButton provider="kakao" fullWidth />
          <OAuthLoginButton provider="google" fullWidth />
        </div>
      </main>
    );
  }

  const [{ data: restaurants, error }, { data: categories }] =
    await Promise.all([
      supabase.from("restaurants").select("*").order("id"),
      supabase.from("categories").select("id, name").order("id"),
    ]);

  const { data: myFavorites } = await supabaseServer
    .from("favorites")
    .select("restaurant_id")
    .eq("user_id", user.id);
  const favoritedIds = new Set((myFavorites ?? []).map((f) => f.restaurant_id));

  const cards = (restaurants ?? []).map((restaurant: Restaurant) => ({
    id: restaurant.id,
    name: restaurant.name,
    category: restaurant.food,
    categoryId: restaurant.category_id,
    address: restaurant.address ?? undefined,
    rating: restaurant.rating ?? undefined,
    aloneOk: restaurant.alone_ok ?? undefined,
    memo: restaurant.memo,
    visited: restaurant.visited,
    lat: restaurant.latitude ?? undefined,
    lng: restaurant.longitude ?? undefined,
    ownerId: restaurant.user_id,
    imageUrl: restaurant.image_url,
    isFavorited: favoritedIds.has(restaurant.id),
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">
          맛집 리스트
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          저장한 가게를 카드와 지도로 확인하고, 메모를 남겨보세요.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          목록을 불러오지 못했습니다: {error.message}
        </p>
      )}

      <RestaurantsView
        restaurants={cards}
        categories={categories ?? []}
        isLoggedIn={!!user}
        currentUserId={user?.id ?? null}
      />
    </main>
  );
}
