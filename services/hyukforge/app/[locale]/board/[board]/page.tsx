import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BoardPage } from "@/components/board/BoardPage";
import { isBoard } from "@/lib/board";
import { listPosts } from "@/lib/queries/board";
import { orEmpty } from "@/lib/queries/safe";

/**
 * 세션에 따라 내용이 달라진다 (내 글 표시, 숨겨진 내 글).
 * 정적으로 만들 수 없고 만들어서도 안 된다.
 */
export const dynamic = "force-dynamic";

type Params = { locale: string; board: string };
type Search = { page?: string; q?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, board } = await params;
  if (!isBoard(board)) return {};
  const t = await getTranslations({ locale });
  return { title: t(`board.${board}`) };
}

export default async function Board({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { locale, board } = await params;
  const { page, q } = await searchParams;
  setRequestLocale(locale);
  if (!isBoard(board)) notFound();

  const parsed = Number(page);
  const wanted = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;

  const term = (q ?? "").slice(0, 100);

  const result = await listPosts(board, wanted, undefined, term).catch(
    orEmpty({ posts: [], total: 0, page: 1, pageCount: 1, search: term }, "board"),
  );
  return <BoardPage board={board} result={result} />;
}
