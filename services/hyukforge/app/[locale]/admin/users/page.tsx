import { createClient } from "@/lib/supabase/server";
import { getUserReport } from "@/lib/queries/admin-users";
import { UserRowActions } from "@/components/admin/UserRowActions";
import { shortDate } from "@/lib/format";

/**
 * 회원 목록. 관리자만 본다 —
 * 권한 검사는 /admin 레이아웃 한 곳에서 한다 (app/[locale]/admin/layout.tsx).
 *
 * 이름이 둘이라 두 줄로 나눠 적는다. 구글 실명(display_name)은 본인 확인용이고,
 * 게시판에 보이는 건 사용자가 직접 정한 닉네임이다. 둘을 한 칸에 합치면
 * "게시판에 뜨는 이름"을 못 찾는다 (20260819000001_profile_nicknames.sql).
 *
 * 계정 삭제 버튼은 두지 않는다. 글·댓글까지 함께 지워지는 작업이라
 * 목록에서 한 번 누르는 것으로 끝낼 일이 아니다.
 */
export const dynamic = "force-dynamic";

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const report = await getUserReport();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 검색은 서버에서 자른다. 회원 수가 적어 한 번에 다 읽어 오므로
  // 별도 질의 없이 걸러도 된다. 수천 명이 되면 함수에 조건을 넘긴다.
  const needle = q?.trim().toLowerCase() ?? "";
  const rows = needle
    ? report.users.filter((u) =>
        [u.email, u.nickname, u.displayName]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(needle)),
      )
    : report.users;

  return (
    <main className="pt-8">
      <div className="mb-6 flex flex-wrap items-baseline gap-4">
        <h2 className="text-[19px] font-semibold">회원 {report.total}명</h2>
        <span className="-translate-y-[3px] min-w-10 flex-1 border-t border-line" />
        <form className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="이메일 · 닉네임 · 이름"
            className="w-[200px] border border-edge bg-transparent px-3 py-[6px] font-mono text-[12px] text-ink placeholder:text-dim focus:border-amber focus:outline-none"
          />
          <button
            type="submit"
            className="border border-edge px-3 py-[6px] font-mono text-[11.5px] tracking-tag text-mute transition-colors hover:border-amber hover:text-amber"
          >
            찾기
          </button>
        </form>
      </div>

      {/* 요약 네 칸. 방문 화면과 같은 모양이라 읽는 법을 새로 배울 필요가 없다 */}
      <div className="mb-10 grid grid-cols-2 border-y border-line sm:grid-cols-4">
        {[
          ["전체", report.total, "가입한 계정"],
          ["관리자", report.admins, "role = admin"],
          ["닉네임 있음", report.named, "게시판에 글을 쓸 수 있는 상태"],
          ["최근 7일", report.fresh, "새로 가입"],
        ].map(([label, value, hint], i) => (
          <div
            key={String(label)}
            className={`py-5 sm:border-l sm:border-line sm:pl-6 ${
              i === 0 ? "sm:border-l-0 sm:pl-0" : ""
            } ${i >= 2 ? "border-t border-line sm:border-t-0" : ""}`}
          >
            <span className="u-label">{label}</span>
            <b className="mt-[6px] block font-mono text-[23px] font-medium tracking-[-0.01em] text-ink">
              {Number(value).toLocaleString()}
            </b>
            <small className="mt-1 block text-[12px] text-dim">{hint}</small>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="border-y border-line py-16 text-center text-[13.5px] text-dim">
          {needle
            ? `"${q}" 와 맞는 회원이 없습니다.`
            : "아직 가입한 회원이 없습니다."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                {["회원", "권한", "언어", "글", "댓글", "받은 수", "마지막 로그인", "가입", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className="border-b border-edge px-3 py-[10px] text-left font-mono text-[11px] font-normal uppercase tracking-label text-dim"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="group">
                  <td className="border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    <b className="text-[14.5px] font-semibold">
                      {u.nickname ?? (
                        <span className="font-normal text-dim">닉네임 없음</span>
                      )}
                    </b>
                    <small className="block font-mono text-[12px] text-dim">
                      {u.email}
                      {u.displayName && ` · ${u.displayName}`}
                    </small>
                  </td>
                  <td className="border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {u.role === "admin" ? (
                      <span className="border border-amber px-2 py-[3px] font-mono text-tag tracking-tag text-amber">
                        관리자
                      </span>
                    ) : (
                      <span className="font-mono text-[12px] text-dim">회원</span>
                    )}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {u.locale}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {u.postCount || "—"}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {u.commentCount || "—"}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {u.downloadCount || "—"}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {u.lastSignInAt ? shortDate(u.lastSignInAt) : "—"}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {shortDate(u.createdAt)}
                  </td>
                  <td className="border-b border-line px-3 py-[13px] text-right transition-colors group-hover:bg-panel">
                    <UserRowActions
                      userId={u.id}
                      role={u.role}
                      hasNickname={Boolean(u.nickname)}
                      isSelf={u.id === user?.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-line pt-5 text-[13px] text-dim">
        계정 삭제는 여기서 하지 않는다 — 글·댓글까지 함께 지워진다. 필요하면
        Supabase 대시보드에서 한다.
      </p>
    </main>
  );
}
