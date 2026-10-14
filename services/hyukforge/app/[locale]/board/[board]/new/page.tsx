import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PostForm } from "@/components/board/PostForm";
import { createClient } from "@/lib/supabase/server";
import { isBoard } from "@/lib/board";

export const dynamic = "force-dynamic";

type Params = { locale: string; board: string };

export default async function NewPost({ params }: { params: Promise<Params> }) {
  const { locale, board } = await params;
  setRequestLocale(locale);
  if (!isBoard(board)) notFound();

  const t = await getTranslations();

  // 로그인하지 않았으면 폼 대신 안내를 보여준다.
  // 로그인 화면으로 튕기지 않는 이유는, 무엇을 쓰려던 화면인지 잃지 않게 하려는 것이다.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <nav className="pb-6 pt-[52px] font-mono text-[12px] text-dim">
        <Link
          href={`/board/${board}`}
          className="transition-colors hover:text-amber"
        >
          ← {t(`board.${board}`)}
        </Link>
      </nav>

      <header className="border-b border-line pb-7">
        <h1 className="text-[24px] font-bold tracking-[-0.02em]">
          {t("board.write")}
        </h1>
      </header>

      <div className="pt-8">
        <PostForm board={board} locale={locale} signedIn={user != null} />
      </div>
    </main>
  );
}
