import { createClient } from "@/lib/supabase/server";
import { likeSafe } from "./safe";
import { authorTag, type BoardSlug, type Comment, type Post, type RequestState } from "@/lib/board";

/**
 * 사용자 게시판 조회.
 *
 * 공개 화면(제품·공지)과 달리 쿠키를 읽는 클라이언트를 쓴다.
 * 내 글인지, 내가 공감했는지, 숨겨진 내 글이 있는지를 세션 없이는 알 수 없다.
 * 그래서 게시판 화면은 전부 요청마다 렌더된다 — 정적으로 만들 여지가 없다.
 * (lib/supabase/public.ts 주석의 반대 경우다)
 *
 * 사용자 글은 번역하지 않는다. 작성 언어 그대로 보여준다.
 * (supabase/migrations/20260818000002 주석)
 *
 * 타입과 순수 함수는 lib/board.ts 에 있다 — 클라이언트 컴포넌트가 그쪽만
 * 가져가야 next/headers 가 클라이언트 번들에 섞이지 않는다.
 */

type RawPost = {
  id: string;
  board: BoardSlug;
  author_id: string;
  title: string;
  body: string;
  locale: string;
  status: "published" | "hidden";
  is_pinned: boolean;
  request_state: RequestState | null;
  comment_count: number;
  vote_count: number;
  created_at: string;
};

const POST_COLUMNS =
  "id, board, author_id, title, body, locale, status, is_pinned, request_state, comment_count, vote_count, created_at";

function shapePost(r: RawPost, me: string | null, names: Map<string, string>): Post {
  return {
    id: r.id,
    board: r.board,
    title: r.title,
    body: r.body,
    locale: r.locale,
    status: r.status,
    isPinned: r.is_pinned,
    requestState: r.request_state,
    commentCount: r.comment_count,
    voteCount: r.vote_count,
    createdAt: r.created_at,
    author: names.get(r.author_id) ?? authorTag(r.author_id),
    isMine: me != null && r.author_id === me,
  };
}

/**
 * 글쓴이 이름을 한 번에 가져온다.
 *
 * posts 에서 곧바로 조인하지 않는다. public_profiles 는 뷰라서 PostgREST 가
 * 외래키를 추론하지 못해 embed 가 안정적이지 않다. 두 번 조회하는 편이 예측 가능하다.
 *
 * 닉네임을 정하지 않은 사람은 아예 행이 없다 (뷰가 nickname is not null 로 걸러둔다).
 * 그런 사람은 authorTag 로 떨어진다.
 */
async function nicknamesFor(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, nickname")
    .in("id", unique);

  // 이름을 못 읽어도 글은 보여야 한다. 그때는 전부 해시 별칭으로 떨어진다.
  if (error) return new Map();

  return new Map(
    (data as unknown as { id: string; nickname: string }[]).map((r) => [r.id, r.nickname]),
  );
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export const PAGE_SIZE = 20;

export type PostPage = {
  posts: Post[];
  /** RLS 를 통과한 전체 글 수. 검색 중이면 걸린 수다. */
  total: number;
  page: number;
  pageCount: number;
  /** 화면이 쪽 링크에 다시 실어야 해서 돌려준다 */
  search: string;
};

/**
 * 게시판 한 쪽.
 *
 * 전에는 limit 50 으로 자르고 끝이었다. 51번째 글부터는 볼 방법이 아예 없었다.
 * 글이 늘면 조용히 사라지는 종류의 문제라 눈에 띄지 않는다.
 *
 * count: "exact" 로 전체 수를 함께 받는다. RLS 가 적용된 뒤의 수라
 * 숨겨진 남의 글은 세지 않는다.
 */
export async function listPosts(
  board: BoardSlug,
  page = 1,
  pageSize = PAGE_SIZE,
  search = "",
): Promise<PostPage> {
  const supabase = await createClient();
  const me = await currentUserId();

  const current = Math.max(1, Math.floor(page));
  const from = (current - 1) * pageSize;
  const term = likeSafe(search);

  // RLS 가 발행된 글 + 내 숨겨진 글만 돌려준다.
  // 요청 게시판은 공감이 많은 것부터 — 그러라고 만든 게시판이다.
  let q = supabase
    .from("posts")
    .select(POST_COLUMNS, { count: "exact" })
    .eq("board", board);

  // 제목과 본문 둘 다 본다. 검색 결과도 RLS 를 그대로 타므로
  // 남의 숨겨진 글은 검색으로도 나오지 않는다.
  if (term) q = q.or(`title.ilike.%${term}%,body.ilike.%${term}%`);

  q =
    board === "request"
      ? q.order("is_pinned", { ascending: false }).order("vote_count", { ascending: false })
      : q.order("is_pinned", { ascending: false });

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    // 같은 시각에 들어온 글이 있으면 정렬이 흔들려 한 글이 두 쪽에 나오거나
    // 어느 쪽에도 안 나온다. id 로 마지막 순서를 못박는다.
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawPost[];
  const names = await nicknamesFor(rows.map((r) => r.author_id));
  const total = count ?? rows.length;

  return {
    posts: rows.map((r) => shapePost(r, me, names)),
    total,
    page: current,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    search: search.trim(),
  };
}

export async function getPost(id: string): Promise<Post | null> {
  const supabase = await createClient();
  const me = await currentUserId();

  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as RawPost;
  return shapePost(row, me, await nicknamesFor([row.author_id]));
}

export async function listComments(postId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const me = await currentUserId();

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, author_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = data as unknown as {
    id: string;
    author_id: string;
    body: string;
    created_at: string;
  }[];
  const names = await nicknamesFor(rows.map((c) => c.author_id));

  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.created_at,
    author: names.get(c.author_id) ?? authorTag(c.author_id),
    isMine: me != null && c.author_id === me,
  }));
}

/** 내가 이 글에 공감했는가. post_votes 는 본인 것만 조회된다. */
export async function hasVoted(postId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("post_votes")
    .select("post_id")
    .eq("post_id", postId)
    .maybeSingle();

  return data != null;
}
