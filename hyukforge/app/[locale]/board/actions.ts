"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/queries/admin";
import { isBoard, type BoardSlug, type RequestState } from "@/lib/board";
import { locales } from "@/i18n/routing";

/**
 * 게시판 쓰기.
 *
 * RLS 가 이미 막고 있지만 여기서도 확인한다. 정책에만 기대면
 * 나중에 정책을 손댈 때 이 경로가 조용히 열린다.
 * (app/[locale]/admin/products/actions.ts 와 같은 이유)
 *
 * 오류는 번역된 문장이 아니라 코드로 돌려준다. 서버 액션은 요청 언어를
 * 알 수 없고, 화면에서 messages/*.json 을 쓰는 편이 언어가 어긋나지 않는다.
 */

export type Fail = { ok: false; code: "loginRequired" | "tooFast" | "failed" | "invalid" };
export type Ok = { ok: true; id?: string };
export type Result = Ok | Fail;

const TITLE_MAX = 120;
const BODY_MAX = 20000;
const COMMENT_MAX = 5000;

/**
 * 도배 제동(can_write_post)에 걸리면 insert 가 RLS 위반으로 떨어진다.
 * 로그인 여부는 미리 확인하므로, 남는 위반은 사실상 속도 제한이다.
 */
function readFail(message: string): Fail {
  if (message.includes("row-level security")) return { ok: false, code: "tooFast" };
  if (message.includes("posts_title_len") || message.includes("post_comments_body_len"))
    return { ok: false, code: "invalid" };
  if (message.includes("posts_body_len")) return { ok: false, code: "invalid" };
  return { ok: false, code: "failed" };
}

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** 목록·상세는 요청마다 렌더되지만, 홈의 통계처럼 정적인 곳은 아니다. */
function refresh(board: BoardSlug, id?: string) {
  for (const l of locales) {
    revalidatePath(`/${l}/board/${board}`);
    if (id) revalidatePath(`/${l}/board/${board}/${id}`);
  }
}

export async function createPost(input: {
  board: string;
  title: string;
  body: string;
  locale: string;
}): Promise<Result> {
  if (!isBoard(input.board)) return { ok: false, code: "invalid" };

  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 2 || title.length > TITLE_MAX) return { ok: false, code: "invalid" };
  if (body.length < 2 || body.length > BODY_MAX) return { ok: false, code: "invalid" };

  const { supabase, user } = await me();
  if (!user) return { ok: false, code: "loginRequired" };

  const { data, error } = await supabase
    .from("posts")
    .insert({
      board: input.board,
      author_id: user.id,
      title,
      body,
      locale: (locales as readonly string[]).includes(input.locale) ? input.locale : "ko",
      // status·is_pinned·request_state 는 건드리지 않는다.
      // insert 정책이 published/false 를 요구하고, 그게 컬럼 기본값이다.
    })
    .select("id")
    .maybeSingle();

  if (error) return readFail(error.message);
  const id = (data as { id: string } | null)?.id;
  if (!id) return { ok: false, code: "failed" };

  refresh(input.board);
  return { ok: true, id };
}

export async function deletePost(id: string, board: string): Promise<Result> {
  if (!isBoard(board)) return { ok: false, code: "invalid" };
  const { supabase, user } = await me();
  if (!user) return { ok: false, code: "loginRequired" };

  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) return readFail(error.message);

  refresh(board, id);
  return { ok: true };
}

export async function createComment(
  postId: string,
  board: string,
  body: string,
): Promise<Result> {
  if (!isBoard(board)) return { ok: false, code: "invalid" };
  const text = body.trim();
  if (text.length < 1 || text.length > COMMENT_MAX) return { ok: false, code: "invalid" };

  const { supabase, user } = await me();
  if (!user) return { ok: false, code: "loginRequired" };

  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: user.id, body: text });

  if (error) return readFail(error.message);

  refresh(board, postId);
  return { ok: true };
}

export async function deleteComment(
  id: string,
  postId: string,
  board: string,
): Promise<Result> {
  if (!isBoard(board)) return { ok: false, code: "invalid" };
  const { supabase, user } = await me();
  if (!user) return { ok: false, code: "loginRequired" };

  const { error } = await supabase.from("post_comments").delete().eq("id", id);
  if (error) return readFail(error.message);

  refresh(board, postId);
  return { ok: true };
}

/**
 * 공감 켜기·끄기.
 *
 * 이미 눌렀는지 확인하고 반대로 뒤집는다. post_votes 는 (post_id, user_id)
 * 기본키라서 두 번 넣으면 중복 오류가 난다 — 그걸 성공으로 오해하지 않도록
 * 결과를 되읽어 돌려준다.
 */
export async function toggleVote(
  postId: string,
  board: string,
): Promise<Result & { voted?: boolean }> {
  if (!isBoard(board)) return { ok: false, code: "invalid" };
  const { supabase, user } = await me();
  if (!user) return { ok: false, code: "loginRequired" };

  const { data: existing } = await supabase
    .from("post_votes")
    .select("post_id")
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("post_votes").delete().eq("post_id", postId);
    if (error) return readFail(error.message);
    refresh(board, postId);
    return { ok: true, voted: false };
  }

  const { error } = await supabase
    .from("post_votes")
    .insert({ post_id: postId, user_id: user.id });
  if (error) return readFail(error.message);

  refresh(board, postId);
  return { ok: true, voted: true };
}

/* ── 관리자 ──────────────────────────────────────────────────────
   화면 문구는 한국어로 박아둔다 — 쓰는 사람이 한 명이라 번역이 낭비다.
   관리자 전용 컬럼은 posts_protect_admin_fields 트리거가 한 번 더 막는다. */

export async function setRequestState(
  postId: string,
  state: RequestState,
  board: string,
): Promise<Result> {
  if (!isBoard(board)) return { ok: false, code: "invalid" };
  if (!(await isAdmin())) return { ok: false, code: "loginRequired" };

  const { supabase } = await me();
  const { data, error } = await supabase
    .from("posts")
    .update({ request_state: state })
    .eq("id", postId)
    .select("request_state")
    .maybeSingle();

  if (error) return readFail(error.message);
  // 트리거가 되돌렸으면 200 이어도 값이 그대로다. 되읽어서 확인한다.
  if ((data as { request_state?: string } | null)?.request_state !== state) {
    return { ok: false, code: "failed" };
  }

  refresh(board, postId);
  return { ok: true };
}

export async function setPostFlags(
  postId: string,
  flags: { status?: "published" | "hidden"; isPinned?: boolean },
  board: string,
): Promise<Result> {
  if (!isBoard(board)) return { ok: false, code: "invalid" };
  if (!(await isAdmin())) return { ok: false, code: "loginRequired" };

  const row: Record<string, unknown> = {};
  if (flags.status !== undefined) row.status = flags.status;
  if (flags.isPinned !== undefined) row.is_pinned = flags.isPinned;
  if (!Object.keys(row).length) return { ok: false, code: "invalid" };

  const { supabase } = await me();
  const { data, error } = await supabase
    .from("posts")
    .update(row)
    .eq("id", postId)
    .select("status, is_pinned")
    .maybeSingle();

  if (error) return readFail(error.message);

  const got = data as { status: string; is_pinned: boolean } | null;
  if (!got) return { ok: false, code: "failed" };
  if (flags.status !== undefined && got.status !== flags.status)
    return { ok: false, code: "failed" };
  if (flags.isPinned !== undefined && got.is_pinned !== flags.isPinned)
    return { ok: false, code: "failed" };

  refresh(board, postId);
  return { ok: true };
}
