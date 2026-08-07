export const CATEGORIES = [
  { value: "notice", label: "공지사항" },
  { value: "free", label: "자유게시판" },
  { value: "feedback", label: "의견수렴" },
] as const;

export type PostCategory = (typeof CATEGORIES)[number]["value"];
