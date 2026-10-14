import Link from "next/link";
import { Megaphone, MessagesSquare, Lightbulb, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type PostCategory } from "./constants";
import NewPostButton from "@/components/NewPostButton";

const CATEGORY_ICON: Record<PostCategory, typeof Megaphone> = {
  notice: Megaphone,
  free: MessagesSquare,
  feedback: Lightbulb,
};

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const activeCategory: PostCategory | "all" = CATEGORIES.some(
    (c) => c.value === categoryParam
  )
    ? (categoryParam as PostCategory)
    : "all";

  const supabaseServer = await createClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  let query = supabase
    .from("posts")
    .select("id, category, title, user_id, created_at, profiles(nickname)")
    .order("created_at", { ascending: false });
  if (activeCategory !== "all") {
    query = query.eq("category", activeCategory);
  }
  const { data: posts, error } = await query;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">
            커뮤니티
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            공지사항, 자유게시판, 의견수렴을 한곳에서 확인하세요.
          </p>
        </div>
        <NewPostButton isLoggedIn={!!user} />
      </header>

      <div className="flex gap-1.5 overflow-x-auto">
        <Link
          href="/board"
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            activeCategory === "all"
              ? "border-brand bg-brand text-white"
              : "border-line bg-surface text-muted hover:text-foreground"
          }`}
        >
          전체
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.value}
            href={`/board?category=${c.value}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === c.value
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-muted hover:text-foreground"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          목록을 불러오지 못했습니다: {error.message}
        </p>
      )}

      <div className="rounded-lg border border-line bg-surface">
        {posts && posts.length > 0 ? (
          <ul className="divide-y divide-line">
            {posts.map((post) => {
              const Icon = CATEGORY_ICON[post.category as PostCategory];
              const categoryLabel = CATEGORIES.find(
                (c) => c.value === post.category
              )?.label;
              return (
                <li key={post.id}>
                  <Link
                    href={`/board/${post.id}`}
                    className="group flex items-center gap-3 px-5 py-3.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted">
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-foreground group-hover:text-brand">
                        {post.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <span>{categoryLabel}</span>
                        <span className="text-line">·</span>
                        <span>
                          {(post as unknown as { profiles?: { nickname: string } })
                            .profiles?.nickname ?? "익명"}
                        </span>
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-16 text-center text-[13px] text-muted">
            아직 게시글이 없어요.
          </p>
        )}
      </div>
    </main>
  );
}
