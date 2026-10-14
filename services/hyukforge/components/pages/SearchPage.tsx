import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SearchBox } from "@/components/search/SearchBox";
import { Label } from "@/components/ui";
import { shortDate } from "@/lib/format";
import type { Hit, HitKind, SearchResult } from "@/lib/queries/search";

/**
 * 사이트 전체 검색 결과.
 *
 * 한 줄로 섞어 내지 않고 종류로 묶는다. 제품과 게시글은 찾는 이유가 다르다 —
 * 제품을 찾는 사람에게 남의 게시글이 위에 오면 방해가 된다.
 * 종류 안에서는 최신순이고, 순서는 제품 → 공지 → 개발 기록 → 게시글로 고정한다.
 * 관련도 점수를 매기지 않는다. 매길 근거가 없는데 매기면 순서가 임의로 흔들린다.
 */
const ORDER: HitKind[] = ["product", "notice", "changelog", "post"];

export async function SearchPage({ result }: { result: SearchResult }) {
  const t = await getTranslations();
  const { term, hits } = result;

  const groups = ORDER.map((kind) => ({
    kind,
    hits: hits.filter((h) => h.kind === kind),
  })).filter((g) => g.hits.length > 0);

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <header className="border-b border-line pb-7 pt-[68px]">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">
          {t("search.title")}
        </h1>
        <p className="mt-2 max-w-[62ch] text-[14px] text-mute">
          {t("search.lead")}
        </p>
        <div className="mt-6">
          <SearchBox path="/search" initial={term} variant="page" />
        </div>
      </header>

      {/* 검색어가 없을 때는 "없습니다" 가 아니라 안내를 낸다 — 아직 찾지 않았다 */}
      {!term ? (
        <p className="border-b border-line py-16 text-center text-[13.5px] text-dim">
          {t("search.prompt")}
        </p>
      ) : groups.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-[13.5px] text-dim">
          {t("search.none", { term })}
        </p>
      ) : (
        <>
          <p className="border-b border-line py-4 font-mono text-[12px] text-dim">
            {t("search.found", { term, count: hits.length })}
          </p>

          {groups.map((g) => (
            <section key={g.kind} className="pt-12">
              <div className="mb-5 flex items-baseline gap-4">
                <h2 className="font-mono text-[13px] text-amber">
                  {t(`search.kind.${g.kind}`)}
                </h2>
                <span className="-translate-y-[3px] flex-1 border-t border-line" />
                <Label>{t("search.count", { count: g.hits.length })}</Label>
              </div>

              <div className="border-t border-edge">
                {g.hits.map((hit, i) => (
                  <Row key={`${hit.kind}-${hit.href}-${i}`} hit={hit} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}

async function Row({ hit }: { hit: Hit }) {
  const t = await getTranslations();

  // 게시글의 meta 는 게시판 slug 다. 그대로 쓰면 'free' 가 화면에 나온다.
  const meta =
    hit.kind === "post" && hit.meta ? t(`board.${hit.meta}`) : hit.meta;

  return (
    <Link
      href={hit.href}
      className="group grid items-baseline gap-x-[18px] gap-y-1 border-b border-line py-[13px] md:grid-cols-[104px_1fr]"
    >
      <time
        dateTime={hit.date ?? undefined}
        className="font-mono text-data text-dim"
      >
        {shortDate(hit.date)}
      </time>

      <span>
        <span className="text-[14.5px] font-semibold text-ink transition-colors group-hover:text-amber">
          {hit.title}
        </span>
        {meta && (
          <span className="ml-[10px] font-mono text-data text-dim">{meta}</span>
        )}
        {hit.snippet && (
          <span className="mt-1 block max-w-[76ch] text-[13.5px] text-mute">
            {hit.snippet}
          </span>
        )}
      </span>
    </Link>
  );
}
