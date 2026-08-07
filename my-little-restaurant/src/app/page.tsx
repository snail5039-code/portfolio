import Link from "next/link";
import { BookmarkPlus, NotebookPen, MapPinned, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { supabase, type Restaurant } from "@/lib/supabase";
import OAuthLoginButton from "@/components/OAuthLoginButton";
import RestaurantCard from "@/components/RestaurantCard";

const STEPS = [
  {
    icon: BookmarkPlus,
    title: "저장",
    desc: "가고 싶은 가게를 주소만 넣어 저장해두세요. 좌표는 자동으로 찾아둡니다.",
  },
  {
    icon: NotebookPen,
    title: "기록",
    desc: "다녀온 곳은 방문 체크. 별점과 한 줄 메모로 그날의 기억을 남겨요.",
  },
  {
    icon: MapPinned,
    title: "지도",
    desc: "저장한 가게가 지도 위에 핀으로 모입니다. 근처에 뭐가 있는지 한눈에.",
  },
];

export default async function Home() {
  const supabaseServer = await createClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  const nickname =
    (user?.user_metadata?.nickname as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    null;

  // 리스트 미리보기는 로그인한 사용자 본인의 데이터만, 최대 3개까지 보여준다.
  // 즐겨찾기한 곳을 먼저 채우고, 3개가 안 되면 직접 등록한 곳(중복 제외)으로
  // 채운다. 둘 다 없으면(신규 유저·비로그인) 미리보기 자체를 숨긴다.
  const PREVIEW_COUNT = 3;
  let previewRestaurants: Restaurant[] = [];
  let categories: { id: number; name: string }[] = [];
  if (user) {
    const [{ data: favRows }, { data: categoryRows }] = await Promise.all([
      supabase
        .from("favorites")
        .select("restaurants(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(PREVIEW_COUNT),
      supabase.from("categories").select("id, name").order("id"),
    ]);
    categories = categoryRows ?? [];
    previewRestaurants = (favRows ?? [])
      .map((row) => row.restaurants as unknown as Restaurant | null)
      .filter((r): r is Restaurant => r !== null);

    const remaining = PREVIEW_COUNT - previewRestaurants.length;
    if (remaining > 0) {
      const excludeIds = previewRestaurants.map((r) => r.id);
      let ownQuery = supabase
        .from("restaurants")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(remaining);
      if (excludeIds.length > 0) {
        ownQuery = ownQuery.not("id", "in", `(${excludeIds.join(",")})`);
      }
      const { data: ownRows } = await ownQuery;
      previewRestaurants = [...previewRestaurants, ...(ownRows ?? [])];
    }
  }

  const previewCards = previewRestaurants.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.food,
    categoryId: r.category_id,
    address: r.address ?? undefined,
    rating: r.rating ?? undefined,
    aloneOk: r.alone_ok ?? undefined,
    memo: r.memo,
    visited: r.visited,
    ownerId: r.user_id,
    imageUrl: r.image_url,
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 md:px-8 md:py-16">
      {/* 히어로 */}
      <section className="max-w-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold tracking-wide text-brand">
          나만의 작은 맛집
        </span>

        <h1 className="mt-5 text-[30px] font-bold leading-[1.25] tracking-tight text-foreground sm:text-[42px] sm:leading-[1.2]">
          혼밥도, 같이도 좋았던 가게를
          <br />
          <span className="text-brand">나만의 목록</span>으로 남겨두세요.
        </h1>

        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          저장해둔 가게에 다녀오면 체크하고 별점과 메모를 남깁니다. 남이 만든
          랭킹이 아니라, 내가 직접 채워가는 맛집 기록장.
        </p>

        {user ? (
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/restaurants"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
            >
              맛집 리스트로 이동
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-sm text-muted">
              {nickname ? `${nickname}님, 환영해요.` : "환영해요."}
            </span>
          </div>
        ) : (
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <OAuthLoginButton provider="kakao" />
            <OAuthLoginButton provider="google" />
          </div>
        )}
      </section>

      {/* 카드 미리보기 — 내가 즐겨찾기했거나 등록한 가게로 리스트가 어떻게 보이는지 보여준다 */}
      {previewCards.length > 0 && (
        <section className="mt-14 rounded-lg border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
              내 리스트 미리보기
            </p>
            <Link
              href="/restaurants"
              className="text-[11px] font-semibold text-brand hover:underline"
            >
              전체 리스트 보기
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {previewCards.map((card) => (
              <RestaurantCard
                key={card.id}
                {...card}
                categories={categories ?? []}
                isLoggedIn={!!user}
                isOwner={!!user && card.ownerId === user.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* 사용 흐름 — 카드 3장 대신 구분선으로 나눈 한 덩어리 */}
      <section className="mt-10 grid grid-cols-1 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex flex-col gap-2 p-5">
            <div className="flex items-center gap-2">
              <step.icon className="h-4 w-4 text-brand" strokeWidth={2} />
              <span className="tnum text-[11px] font-bold text-muted">
                0{i + 1}
              </span>
            </div>
            <h2 className="text-[15px] font-bold text-foreground">
              {step.title}
            </h2>
            <p className="text-[13px] leading-relaxed text-muted">
              {step.desc}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
