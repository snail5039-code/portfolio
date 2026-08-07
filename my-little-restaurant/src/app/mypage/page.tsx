import Link from "next/link";
import { CircleUserRound, CheckCircle2, Heart, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProfileEditForm from "@/components/ProfileEditForm";
import OAuthLoginButton from "@/components/OAuthLoginButton";

export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-muted">
          <CircleUserRound className="h-6 w-6" strokeWidth={1.6} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-foreground">
            로그인이 필요한 페이지예요
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            방문 기록과 즐겨찾기, 프로필 수정은 로그인 후 이용할 수 있어요.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <OAuthLoginButton provider="kakao" fullWidth />
          <OAuthLoginButton provider="google" fullWidth />
        </div>
      </main>
    );
  }

  const [
    { data: profile },
    { count: visitedCount },
    { count: favoriteCount },
    { data: favoriteRestaurants },
  ] = await Promise.all([
    supabase.from("profiles").select("nickname, phone").eq("id", user.id).single(),
    supabase
      .from("restaurants")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("visited", true),
    supabase
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("favorites")
      .select("restaurant_id, restaurants(name, food)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const favorites = (favoriteRestaurants ?? [])
    .map((f) => {
      const row = f as unknown as {
        restaurant_id: number;
        restaurants?: { name: string; food: string | null };
      };
      return row.restaurants
        ? {
            id: row.restaurant_id,
            name: row.restaurants.name,
            food: row.restaurants.food,
          }
        : null;
    })
    .filter((f): f is { id: number; name: string; food: string | null } =>
      Boolean(f)
    );

  const stats = [
    {
      label: "방문한 맛집",
      value: visitedCount ?? 0,
      icon: CheckCircle2,
    },
    {
      label: "즐겨찾기",
      value: favoriteCount ?? 0,
      icon: Heart,
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">
          마이페이지
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          {profile?.nickname ?? "회원"}님의 기록이에요.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          {/* 요약 */}
          <section className="grid grid-cols-2 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1.5 p-5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <stat.icon className="h-3.5 w-3.5" strokeWidth={2} />
                  {stat.label}
                </span>
                <span className="tnum text-[26px] font-bold leading-none text-foreground">
                  {stat.value}
                </span>
              </div>
            ))}
          </section>

          {/* 최애 맛집 */}
          <section className="flex flex-1 flex-col rounded-lg border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-3 text-sm font-bold text-foreground">
              최애 맛집
            </h2>
            {favorites.length > 0 ? (
              <ul className="divide-y divide-line">
                {favorites.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/restaurants/${f.id}`}
                      className="group flex items-center gap-2 px-5 py-3 transition-colors hover:bg-surface-muted"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground group-hover:text-brand">
                        {f.name}
                      </span>
                      {f.food && (
                        <span className="shrink-0 text-xs text-muted">
                          {f.food}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 px-5 py-10 text-center">
                <p className="text-[13px] text-muted">
                  아직 즐겨찾기한 맛집이 없어요.
                </p>
                <Link
                  href="/restaurants"
                  className="text-[13px] font-semibold text-brand underline-offset-4 hover:underline"
                >
                  맛집 둘러보기
                </Link>
              </div>
            )}
          </section>
        </div>

        <ProfileEditForm
          nickname={profile?.nickname ?? ""}
          phone={profile?.phone ?? ""}
          email={user.email ?? ""}
        />
      </div>
    </main>
  );
}
