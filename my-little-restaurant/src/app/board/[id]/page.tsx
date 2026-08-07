import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Megaphone, MessagesSquare, Lightbulb } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type PostCategory } from "../constants";
import DeletePostButton from "@/components/DeletePostButton";
import EditPostModal from "@/components/EditPostModal";

const CATEGORY_ICON: Record<PostCategory, typeof Megaphone> = {
  notice: Megaphone,
  free: MessagesSquare,
  feedback: Lightbulb,
};

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabaseServer = await createClient();

  const [{ data: post }, { data: { user } }] = await Promise.all([
    supabase
      .from("posts")
      .select("*, profiles(nickname)")
      .eq("id", id)
      .single(),
    supabaseServer.auth.getUser(),
  ]);

  if (!post) {
    notFound();
  }

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }
  const canDelete = !!user && (user.id === post.user_id || isAdmin);
  const canEdit = !!user && user.id === post.user_id;

  const category = post.category as PostCategory;
  const Icon = CATEGORY_ICON[category];
  const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <Link
        href="/board"
        className="inline-flex w-fit items-center gap-1 text-[13px] text-muted transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        커뮤니티
      </Link>

      <article className="rounded-lg border border-line bg-surface">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted">
              <Icon className="h-3 w-3" strokeWidth={2} />
              {categoryLabel}
            </span>
            <h1 className="mt-2 text-lg font-bold text-foreground">
              {post.title}
            </h1>
            <p className="mt-1 text-xs text-muted">
              {(post as unknown as { profiles?: { nickname: string } }).profiles
                ?.nickname ?? "익명"}{" "}
              ·{" "}
              {new Date(post.created_at).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            {canEdit && user && (
              <EditPostModal
                postId={post.id}
                userId={user.id}
                isAdmin={isAdmin}
                category={category}
                title={post.title}
                content={post.content}
                imageUrls={post.image_urls ?? []}
              />
            )}
            {canDelete && <DeletePostButton postId={post.id} />}
          </div>
        </div>

        <div className="whitespace-pre-wrap px-5 py-5 text-[14px] leading-relaxed text-foreground">
          {post.content}
        </div>

        {post.image_urls && post.image_urls.length > 0 && (
          <div className="grid grid-cols-2 gap-2 border-t border-line p-5 sm:grid-cols-3">
            {post.image_urls.map((url: string) => (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 공개 URL
              <img
                key={url}
                src={url}
                alt={post.title}
                className="aspect-square w-full rounded-md border border-line object-cover"
              />
            ))}
          </div>
        )}
      </article>
    </main>
  );
}
