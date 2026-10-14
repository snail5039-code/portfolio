"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/**
 * 검색 입력창. 검색 화면·제품·다운로드·게시판이 모두 이것을 쓴다.
 *
 * form 으로 내고 엔터 한 번에 간다. 타이핑마다 서버를 때리면 결과가 깜빡이고,
 * 열 글자를 치는 동안 조회가 열 번 나간다.
 *
 * 엔터 말고 **눌러서 보낼 단추도 둔다.** 입력창 하나뿐인 form 은 엔터로도
 * 보내지지만, 그건 아는 사람만 아는 방법이다. 전에 있던 게시판 검색창에는
 * 단추가 없어서 검색할 수 있다는 것 자체가 잘 안 보였다.
 *
 * `keep` 은 검색해도 풀리면 안 되는 조건이다. 제품 목록에서 분류를 고른 채
 * 검색하면 그 분류 안에서 찾아야 한다 — 검색이 분류를 지워버리면
 * 방금 누른 것이 되돌려지는 셈이다.
 */
export function SearchBox({
  path,
  initial,
  variant = "inline",
  keep,
}: {
  /** 검색 결과를 보여줄 주소. 언어 접두사는 i18n 의 router 가 붙인다. */
  path: string;
  initial: string;
  /** page — 검색 화면의 주인공. inline — 목록 위에 얹는 작은 상자 */
  variant?: "page" | "inline";
  keep?: Record<string, string | undefined>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const big = variant === "page";

  function go(term: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(keep ?? {})) if (v) params.set(k, v);

    const q = term.trim();
    if (q) params.set("q", q);

    const qs = params.toString();
    router.push(qs ? `${path}?${qs}` : path);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className="flex flex-wrap items-center gap-2"
      role="search"
    >
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={big ? t("search.placeholder") : t("search.title")}
        aria-label={t("search.title")}
        className={
          big
            ? "min-w-0 flex-1 border border-edge bg-panel px-4 py-[10px] text-[14px] text-ink placeholder:text-dim focus:border-amber focus:outline-none sm:max-w-[420px]"
            : "w-[150px] border border-edge bg-panel px-3 py-[7px] font-mono text-[12px] text-ink placeholder:text-dim focus:border-amber focus:outline-none sm:w-[200px]"
        }
        autoFocus={big}
      />

      {/* 검색 화면에서는 앰버(ui.tsx 의 Btn primary 와 같은 값),
          목록 위에서는 테두리만. 필터 줄에 앰버가 하나 더 붙으면
          분류 선택보다 세게 들어온다 (docs/DESIGN.md — 강조색은 하나뿐이다) */}
      <button
        type="submit"
        className={
          big
            ? "border border-amber bg-amber px-5 py-[11px] font-mono text-[12px] font-semibold tracking-btn text-on-amber transition-colors hover:border-amber-hi hover:bg-amber-hi"
            : "border border-edge px-3 py-[7px] font-mono text-[12px] text-ink transition-colors hover:border-ink"
        }
      >
        {t("search.title")}
      </button>

      {initial && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            go("");
          }}
          className="font-mono text-[12px] text-dim transition-colors hover:text-ink"
        >
          {t("search.clear")}
        </button>
      )}
    </form>
  );
}
