import Link from "next/link";
import { notFound } from "next/navigation";
import {
  UtensilsCrossed,
  Coffee,
  UserRound,
  ChevronLeft,
  MapPin,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import Rating from "@/components/Rating";
import FavoriteButton from "@/components/FavoriteButton";
import VisitedToggle from "@/components/VisitedToggle";
import ReviewForm from "@/components/ReviewForm";
import CommentSection from "@/components/CommentSection";
import MenuSection from "@/components/MenuSection";
import ModelRestaurantBadge from "@/components/ModelRestaurantBadge";
import EditRestaurantModal from "@/components/EditRestaurantModal";
import DeleteRestaurantButton from "@/components/DeleteRestaurantButton";
import { checkModelRestaurant } from "@/lib/modelRestaurant";

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabaseServer = await createClient();

  const [
    { data: restaurant },
    { data: menu },
    { data: reviews },
    { data: comments },
    { count: favoriteCount },
    { data: categories },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("restaurants")
      .select("*, categories(name)")
      .eq("id", id)
      .single(),
    supabase
      .from("menu")
      .select("*")
      .eq("restaurant_id", id)
      .order("is_representative", { ascending: false }),
    supabase
      .from("reviews")
      .select("*, profiles(nickname)")
      .eq("restaurant_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("comments")
      .select("*, profiles(nickname)")
      .eq("restaurant_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", id),
    supabase.from("categories").select("id, name").order("id"),
    supabaseServer.auth.getUser(),
  ]);

  if (!restaurant) {
    notFound();
  }

  const isOwner = !!user && user.id === restaurant.user_id;
  const isLoggedIn = !!user;

  const modelRestaurantMatch = await checkModelRestaurant(
    restaurant.name,
    restaurant.address
  );

  let isFavorited = false;
  if (user) {
    const { data: fav } = await supabaseServer
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("restaurant_id", id)
      .maybeSingle();
    isFavorited = !!fav;
  }

  const categoryName =
    (restaurant as { categories?: { name: string } | null }).categories?.name ??
    restaurant.food;
  const CategoryIcon = categoryName === "카페" ? Coffee : UtensilsCrossed;

  const chipClass =
    "inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium text-muted";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/restaurants"
        className="inline-flex w-fit items-center gap-1 text-[13px] text-muted transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        맛집 리스트
      </Link>

      {/* 헤더 */}
      <header className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="relative flex h-40 items-center justify-center overflow-hidden border-b border-line bg-surface-muted sm:h-52">
          {restaurant.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 공개 URL
            <img
              src={restaurant.image_url}
              alt={restaurant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <CategoryIcon className="h-12 w-12 text-muted" strokeWidth={1.2} />
          )}
          <div className="absolute right-3 top-3 flex items-center gap-2">
            {isOwner && (
              <VisitedToggle restaurantId={restaurant.id} initialVisited={restaurant.visited} />
            )}
            {isOwner && (
              <EditRestaurantModal
                size="md"
                restaurant={{
                  id: restaurant.id,
                  name: restaurant.name,
                  categoryId: restaurant.category_id,
                  address: restaurant.address,
                  aloneOk: restaurant.alone_ok,
                  memo: restaurant.memo,
                  lat: restaurant.latitude,
                  lng: restaurant.longitude,
                  imageUrl: restaurant.image_url,
                  ownerId: restaurant.user_id,
                }}
                categories={categories ?? []}
              />
            )}
            {isOwner && (
              <DeleteRestaurantButton
                restaurantId={restaurant.id}
                redirectTo="/restaurants"
                size="md"
              />
            )}
            <FavoriteButton
              restaurantId={restaurant.id}
              initialFavorited={isFavorited}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {restaurant.name}
              </h1>
              {categoryName && (
                <span className="rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                  {categoryName}
                </span>
              )}
              {modelRestaurantMatch && (
                <ModelRestaurantBadge info={modelRestaurantMatch} />
              )}
            </div>
            {restaurant.address && (
              <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed text-muted">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                {restaurant.address}
              </p>
            )}
            {restaurant.memo && (
              <p className="mt-3 border-l-2 border-brand/40 pl-3 text-[13px] leading-relaxed text-muted">
                {restaurant.memo}
              </p>
            )}
          </div>

          {/* 평점 요약 */}
          <div className="flex shrink-0 flex-col items-center gap-1 rounded-lg border border-line bg-surface-muted px-5 py-3">
            <span className="tnum text-[28px] font-bold leading-none text-brand">
              {restaurant.rating !== null ? restaurant.rating.toFixed(2) : "–"}
            </span>
            <Rating value={restaurant.rating} showNumber={false} size={12} />
            <span className="tnum text-[11px] text-muted">
              리뷰 {reviews?.length ?? 0}
            </span>
          </div>
        </div>

        {/* 기본 정보 */}
        <dl className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
          <span className={chipClass}>
            {restaurant.visited ? "✅ 방문 완료" : "🕓 아직 안 가봤어요"}
          </span>
          <span className={chipClass}>❤️ 좋아요 {favoriteCount ?? 0}명</span>
          {restaurant.alone_ok !== null && (
            <span className={chipClass}>
              <UserRound className="h-3.5 w-3.5" strokeWidth={2} />
              혼밥 난이도 {restaurant.alone_ok} / 5
            </span>
          )}
        </dl>
      </header>

      <MenuSection
        restaurantId={restaurant.id}
        menu={menu ?? []}
        isOwner={isOwner}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 리뷰 */}
        <section className="flex flex-col rounded-lg border border-line bg-surface">
          <h2 className="flex items-baseline gap-1.5 border-b border-line px-5 py-3 text-sm font-bold text-foreground">
            리뷰
            <span className="tnum text-xs font-normal text-muted">
              {reviews?.length ?? 0}
            </span>
          </h2>
          {reviews && reviews.length > 0 ? (
            <ul className="divide-y divide-line">
              {reviews.map((review) => (
                <li key={review.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {review.rating !== null && <Rating value={review.rating} size={12} />}
                    <span className="text-xs text-muted">
                      {(review as unknown as { profiles?: { nickname: string } }).profiles
                        ?.nickname ?? "익명"}
                    </span>
                  </div>
                  {review.content && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                      {review.content}
                    </p>
                  )}
                  {review.image_urls && review.image_urls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {review.image_urls.map((url: string) => (
                        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 공개 URL
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="h-16 w-16 rounded-md border border-line object-cover"
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-[13px] text-muted">
              아직 리뷰가 없어요.
            </p>
          )}
          <ReviewForm
            restaurantId={restaurant.id}
            isLoggedIn={isLoggedIn}
            userId={user?.id}
          />
        </section>

        {/* 댓글 */}
        <CommentSection
          restaurantId={restaurant.id}
          comments={(comments ?? []) as unknown as {
            id: number;
            content: string;
            created_at: string;
            profiles?: { nickname: string } | null;
          }[]}
          isLoggedIn={isLoggedIn}
        />
      </div>
    </main>
  );
}
