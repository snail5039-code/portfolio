import { createClient } from "@/lib/supabase/server";
import { authorTag, type BoardSlug } from "@/lib/board";

/**
 * 알림 조회.
 *
 * RLS 가 내 것만 돌려준다. 남의 알림은 조회 자체가 되지 않는다.
 * (supabase/migrations/20260819000005)
 */

export type NotificationKind = "comment_on_post" | "new_post" | "new_comment";

export type Notification = {
  id: string;
  kind: NotificationKind;
  /** 일으킨 사람. 닉네임이 있으면 닉네임, 없으면 해시 별칭, 계정이 사라졌으면 null */
  actor: string | null;
  postId: string | null;
  board: BoardSlug | null;
  postTitle: string | null;
  createdAt: string;
  read: boolean;
};

type Raw = {
  id: string;
  kind: NotificationKind;
  actor_id: string | null;
  post_id: string | null;
  created_at: string;
  read_at: string | null;
  posts: { board: BoardSlug; title: string } | null;
};

const SELECT = `
  id, kind, actor_id, post_id, created_at, read_at,
  posts ( board, title )
`;

export async function listNotifications(limit = 30): Promise<Notification[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = data as unknown as Raw[];

  // 닉네임을 한 번에 가져온다 (lib/queries/board.ts 의 nicknamesFor 와 같은 이유)
  const ids = [...new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("public_profiles")
      .select("id, nickname")
      .in("id", ids);
    for (const p of (profiles ?? []) as { id: string; nickname: string }[]) {
      names.set(p.id, p.nickname);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    actor: r.actor_id ? (names.get(r.actor_id) ?? authorTag(r.actor_id)) : null,
    postId: r.post_id,
    board: r.posts?.board ?? null,
    postTitle: r.posts?.title ?? null,
    createdAt: r.created_at,
    read: r.read_at !== null,
  }));
}
