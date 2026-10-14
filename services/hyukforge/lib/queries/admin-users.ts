import { createClient } from "@/lib/supabase/server";

/**
 * 회원 조회.
 *
 * 테이블을 직접 읽지 않고 admin_list_users() 를 부른다 — 이메일이
 * auth.users 에 있어서 PostgREST 로는 닿지 않는다. 권한 검사는 함수 안에서
 * 하고, 관리자가 아니면 0행이 온다
 * (supabase/migrations/20260921000001_admin_users.sql).
 */

export type AdminUserRow = {
  id: string;
  email: string;
  /** 구글에서 받아온 실명. 본인 확인용이고 게시판에는 쓰지 않는다 */
  displayName: string | null;
  /** 사용자가 직접 정한 이름. 게시판에 보이는 값 */
  nickname: string | null;
  role: "user" | "admin";
  locale: string;
  notifyUpdates: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  downloadCount: number;
  postCount: number;
  commentCount: number;
};

export type UserReport = {
  users: AdminUserRow[];
  total: number;
  admins: number;
  /** 닉네임을 정한 사람 — 게시판에 글을 쓸 수 있는 상태다 */
  named: number;
  /** 최근 7일 가입 */
  fresh: number;
};

type Raw = {
  id: string;
  email: string | null;
  display_name: string | null;
  nickname: string | null;
  role: string;
  locale: string;
  notify_updates: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  download_count: number;
  post_count: number;
  comment_count: number;
};

export async function getUserReport(): Promise<UserReport> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_list_users");

  // 권한 거부는 빈 목록으로 받는다.
  //
  // 레이아웃이 관리자가 아닌 사람을 이미 막지만(notFound), Next 는 레이아웃과
  // 페이지를 나란히 렌더한다 — 로그인하지 않은 사람이 주소를 직접 치면
  // 리다이렉트가 끝나기 전에 이 조회가 먼저 돌아 42501 로 터진다. 화면에는
  // 로그인 페이지가 뜨지만 서버 로그에는 에러가 남는다.
  //
  // 다른 관리자 조회(방문·게시판)는 RLS 가 0행을 돌려주므로 조용하다.
  // 함수 경로만 예외를 던져서 여기서 맞춰 준다. 진짜 권한 문제는 레이아웃이
  // 잡는다 — 여기까지 온 사람에게 빈 목록을 보여도 새는 것이 없다.
  if (error) {
    if (error.code === "42501") return empty();
    throw error;
  }

  const users: AdminUserRow[] = ((data ?? []) as Raw[]).map((r) => ({
    id: r.id,
    // 이메일이 빈 계정은 없지만(구글 로그인만 받는다) 타입상 null 이 온다
    email: r.email ?? "—",
    displayName: r.display_name,
    nickname: r.nickname,
    role: r.role === "admin" ? "admin" : "user",
    locale: r.locale,
    notifyUpdates: r.notify_updates,
    createdAt: r.created_at,
    lastSignInAt: r.last_sign_in_at,
    // count(*) 는 bigint 라 문자열로 올 수 있다
    downloadCount: Number(r.download_count ?? 0),
    postCount: Number(r.post_count ?? 0),
    commentCount: Number(r.comment_count ?? 0),
  }));

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return {
    users,
    total: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    named: users.filter((u) => u.nickname).length,
    fresh: users.filter((u) => new Date(u.createdAt).getTime() >= weekAgo).length,
  };
}

function empty(): UserReport {
  return { users: [], total: 0, admins: 0, named: 0, fresh: 0 };
}
