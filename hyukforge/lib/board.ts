/**
 * 게시판의 타입과 순수 함수.
 *
 * 여기에는 서버 전용 모듈을 들이지 않는다. 클라이언트 컴포넌트가
 * REQUEST_STATES 같은 값을 쓰는데, 이 파일이 lib/supabase/server.ts 를
 * 끌고 들어가면 next/headers 가 클라이언트 번들에 섞여 빌드가 깨진다.
 * DB 조회는 lib/queries/board.ts 에 있다.
 */

export const BOARDS = ["free", "request"] as const;
export type BoardSlug = (typeof BOARDS)[number];

export const REQUEST_STATES = [
  "open",
  "planned",
  "in_progress",
  "done",
  "declined",
] as const;
export type RequestState = (typeof REQUEST_STATES)[number];

export function isBoard(v: string): v is BoardSlug {
  return (BOARDS as readonly string[]).includes(v);
}

/** 요청 상태 → messages 의 board.state.* 키. DB 는 snake_case, 키는 camelCase다. */
export const STATE_KEY: Record<RequestState, string> = {
  open: "open",
  planned: "planned",
  in_progress: "inProgress",
  done: "done",
  declined: "declined",
};

export type Post = {
  id: string;
  board: BoardSlug;
  title: string;
  body: string;
  locale: string;
  status: "published" | "hidden";
  isPinned: boolean;
  requestState: RequestState | null;
  commentCount: number;
  voteCount: number;
  createdAt: string;
  /** 화면에 띄울 글쓴이 이름. 닉네임이 있으면 닉네임, 없으면 authorTag 의 결과 */
  author: string;
  isMine: boolean;
};

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: string;
  isMine: boolean;
};

/**
 * 닉네임을 아직 정하지 않은 사람에게 붙이는 이름.
 *
 * author_id 를 해시해 `#a3f19c` 로 만든다. 원래 id 를 되돌릴 수 없고,
 * 같은 사람의 글은 같은 값으로 묶이므로 대화를 따라갈 수 있다.
 * 언어에 의존하지 않아 번역도 필요 없다.
 *
 * 실명(profiles.display_name)은 어떤 경우에도 여기로 오지 않는다.
 * 공개되는 건 public_profiles 뷰의 nickname 뿐이다.
 * (supabase/migrations/20260819000001)
 */
export function authorTag(userId: string): string {
  // FNV-1a. 표시용이라 암호학적 강도는 필요 없다.
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `#${h.toString(16).padStart(8, "0").slice(0, 6)}`;
}

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

/**
 * 닉네임이 쓸 수 있는 모양인가.
 * DB 의 profiles_nickname_shape 제약과 같은 규칙이다 — 둘 중 하나만 고치지 말 것.
 */
export function isNicknameShape(v: string): boolean {
  if (v !== v.trim()) return false;
  if (v.length < NICKNAME_MIN || v.length > NICKNAME_MAX) return false;
  if (/\s\s/.test(v)) return false;
  if (/^#/.test(v)) return false;
  // 제어문자
  if (/[\u0000-\u001f\u007f]/u.test(v)) return false;
  return true;
}
