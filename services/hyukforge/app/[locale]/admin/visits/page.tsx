import { getVisitReport } from "@/lib/queries/visits";
import { shortDate } from "@/lib/format";
import { KIND_LABELS } from "@/lib/referrers";

/**
 * 방문 통계. 관리자만 본다 —
 * 권한 검사는 /admin 레이아웃 한 곳에서 한다 (app/[locale]/admin/layout.tsx).
 *
 * 홈에 걸리는 "방문자"는 사람만 센 값이라 봇이 얼마나 훑고 갔는지는 보이지 않는다.
 * 여기서 그걸 가른다. 숫자 셋의 뜻이 다르므로 열을 나눠 둔다.
 *
 *   방문자   그날 처음 온 사람 (쿠키 기준). 홈에 나가는 값
 *   사람     서버가 받은 페이지 요청 중 브라우저로 판정된 것
 *   봇       같은 요청 중 크롤러·미리보기·계측 도구로 판정된 것
 *
 * 사람 열이 방문자보다 큰 것이 정상이다 — 한 사람이 여러 쪽을 본다.
 *
 * 그 아래는 "어디를 거쳐 왔나"다. 몇 명 왔는지만으로는 검색에 잡히기
 * 시작한 것인지 내가 뿌린 링크가 도는 것인지 알 수 없다 (lib/referrers.ts).
 */
export const dynamic = "force-dynamic";

const DAYS = 30;

export default async function AdminVisits() {
  const report = await getVisitReport(DAYS);
  const { total } = report;
  const hits = total.human + total.bot;
  const botShare = hits ? Math.round((total.bot / hits) * 100) : 0;

  return (
    <main className="pt-8">
      <div className="mb-6 flex flex-wrap items-baseline gap-4">
        <h2 className="text-[19px] font-semibold">방문 · 최근 {DAYS}일</h2>
        <span className="-translate-y-[3px] min-w-10 flex-1 border-t border-line" />
        <span className="font-mono text-[12px] text-dim">
          {report.since ? `${shortDate(report.since)} 부터` : "기록 없음"}
        </span>
      </div>

      {report.noHits && (
        <p className="mb-6 border border-amber px-4 py-3 text-[13.5px] text-amber">
          사람/봇 구분 기록이 아직 한 건도 없습니다. 마이그레이션
          (<span className="font-mono">20260918000002_site_hits</span>)을 올린 뒤
          페이지를 한 번 열어야 쌓이기 시작합니다.
        </p>
      )}

      {/* 요약 네 칸. 홈 통계와 같은 모양이라 읽는 법을 새로 배울 필요가 없다 */}
      <div className="mb-10 grid grid-cols-2 border-y border-line sm:grid-cols-4">
        {[
          ["방문자", total.visitors, "쿠키 기준 · 하루 1회"],
          ["사람 요청", total.human, "브라우저로 판정"],
          ["봇 요청", total.bot, `전체의 ${botShare}%`],
          ["열어본 횟수", total.views, "브라우저가 알린 값"],
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

      <Section title="날짜별">
        {report.days.length === 0 ? (
          <Empty>아직 기록이 없습니다.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse">
              <Head cols={["날짜", "방문자", "사람", "봇", "봇 비율", ""]} />
              <tbody>
                {report.days.map((d) => {
                  const dayHits = d.human + d.bot;
                  const share = dayHits ? Math.round((d.bot / dayHits) * 100) : 0;
                  return (
                    <tr key={d.day} className="group">
                      <Cell mono>{shortDate(`${d.day}T00:00:00+09:00`)}</Cell>
                      <Cell mono strong={d.visitors > 0}>
                        {d.visitors.toLocaleString()}
                      </Cell>
                      <Cell mono>{d.human.toLocaleString()}</Cell>
                      <Cell mono>{d.bot.toLocaleString()}</Cell>
                      <Cell mono>{dayHits ? `${share}%` : "—"}</Cell>
                      <td className="w-[38%] border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                        <ShareBar bot={d.bot} human={d.human} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="mt-12">
        <Section
          title="유입 경로"
          note={
            report.total.referrals
              ? `${report.total.referrals.toLocaleString()}건 · 사이트 안 이동은 뺀 값`
              : undefined
          }
        >
          {report.noReferrers ? (
            <Empty>
              유입 기록이 아직 한 건도 없습니다. 마이그레이션
              (<span className="font-mono">20260922000001_site_referrers</span>)을 올린 뒤
              밖에서 한 번 들어와야 쌓이기 시작합니다.
            </Empty>
          ) : (
            <div className="grid gap-12 lg:grid-cols-2">
              {/* 갈래가 먼저다 — 검색이 도는지 내 링크가 도는지가 제일 큰 질문이다 */}
              <div>
                <table className="w-full border-collapse">
                  <Head cols={["갈래", "요청", "비중", ""]} />
                  <tbody>
                    {report.kinds.map((k) => (
                      <tr key={k.kind} className="group">
                        <Cell strong>{KIND_LABELS[k.kind] ?? k.kind}</Cell>
                        <Cell mono>{k.hits.toLocaleString()}</Cell>
                        <Cell mono>{share(k.hits, report.total.referrals)}</Cell>
                        <td className="w-[34%] border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                          <Bar value={k.hits} total={report.total.referrals} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 출처는 그 안을 들여다보는 값이다. 어느 검색엔진인지, 노션인지 깃헙인지 */}
              <div>
                <table className="w-full border-collapse">
                  <Head cols={["출처", "갈래", "요청", "비중"]} />
                  <tbody>
                    {report.sources.map((s) => (
                      <tr key={`${s.kind}:${s.source}`} className="group">
                        <Cell mono strong>
                          {s.source}
                        </Cell>
                        <Cell>{KIND_LABELS[s.kind] ?? s.kind}</Cell>
                        <Cell mono>{s.hits.toLocaleString()}</Cell>
                        <Cell mono>{share(s.hits, report.total.referrals)}</Cell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Section>
      </div>

      <div className="mt-12">
        <Section
          title="검색어"
          note={report.terms.length ? `${report.terms.length}개` : undefined}
        >
          {report.terms.length === 0 ? (
            <Empty>
              넘어온 검색어가 없습니다. 구글·깃헙은 주소를 다 보내지 않아
              무엇을 검색했는지까지는 오지 않습니다 — 네이버·다음·빙에서 들어오면
              여기 쌓입니다.
            </Empty>
          ) : (
            <table className="w-full border-collapse">
              <Head cols={["검색어", "검색엔진", "요청"]} />
              <tbody>
                {report.terms.map((t) => (
                  <tr key={`${t.source}:${t.term}`} className="group">
                    <Cell strong>{t.term}</Cell>
                    <Cell mono>{t.source}</Cell>
                    <Cell mono>{t.hits.toLocaleString()}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <Section title={`봇 ${report.bots.length}종`}>
          {report.bots.length === 0 ? (
            <Empty>걸린 봇이 없습니다.</Empty>
          ) : (
            <AgentTable rows={report.bots} total={total.bot} />
          )}
        </Section>

        <Section title={`브라우저 ${report.humans.length}종`}>
          {report.humans.length === 0 ? (
            <Empty>사람 요청이 없습니다.</Empty>
          ) : (
            <AgentTable rows={report.humans} total={total.human} />
          )}
        </Section>
      </div>

      <div className="mt-12 space-y-3 border-t border-line pt-5 text-[13px] leading-[1.7] text-dim">
        <p>
          판정은 User-Agent 하나로 한다 — 이름을 숨긴 크롤러는 사람 쪽에 섞이고,
          UA 를 비운 요청은 봇(<span className="font-mono">무명</span>)으로 센다.
          IP 도 UA 원문도 저장하지 않으므로 여기서 개인을 되짚을 수는 없다.
          관리자 화면과 목업(<span className="font-mono">/preview</span>)은 세지 않는다.
        </p>
        <p>
          유입은 브라우저가 보낸 <span className="font-mono">Referer</span> 로 가른다.
          도메인만 이름표로 줄여 남기고 경로는 버린다 — 어느 글에서 왔는지까지 쌓으면
          링크 하나로 사람을 좁힐 수 있게 된다. 사이트 안에서 옮겨 다닌 요청은 유입이
          아니라서 빠지고, 그래서 유입 합계는 위의 사람 요청 수보다 작다.
        </p>
        <p>
          <b className="text-mute">검색어가 늘 오지는 않는다.</b> 구글과 깃헙은 주소를 다
          넘기지 않아 출처까지만 알 수 있다 — 구글 검색어는 서치 콘솔에서 봐야 한다.
          노션·카카오톡·인스타그램 앱처럼 <span className="font-mono">Referer</span> 를
          아예 안 보내는 곳도 있고, 거기서 온 사람은 <b className="text-mute">직접</b> 으로
          들어온다. 어디에 뿌린 링크인지 꼭 알아야 하면 주소 끝에{" "}
          <span className="font-mono">?utm_source=notion</span> 을 붙여 두면 된다 —
          그 값이 헤더보다 먼저다.
        </p>
      </div>
    </main>
  );
}

/* ── 조각 ──────────────────────────────────────────────────────── */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  /** 제목 오른쪽 끝에 붙는 한 마디. 합계처럼 표를 다 읽지 않아도 아는 값 */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-4">
        <h3 className="text-[17px] font-semibold">{title}</h3>
        <span className="-translate-y-[3px] min-w-10 flex-1 border-t border-line" />
        {note && <span className="font-mono text-[12px] text-dim">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** 비중. 0으로 나누지 않는다 — 기록이 없는 날은 빈 값이 맞다. */
function share(value: number, total: number): string {
  return total ? `${Math.round((value / total) * 100)}%` : "—";
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-y border-line py-12 text-center text-[13.5px] text-dim">
      {children}
    </p>
  );
}

function Head({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr>
        {cols.map((h, i) => (
          <th
            key={i}
            className="border-b border-edge px-3 py-[10px] text-left font-mono text-[11px] font-normal uppercase tracking-label text-dim"
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Cell({
  children,
  mono,
  strong,
}: {
  children: React.ReactNode;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel ${
        mono ? "font-mono text-[12.5px]" : "text-[14px]"
      } ${strong ? "text-ink" : "text-mute"}`}
    >
      {children}
    </td>
  );
}

/** 사람과 봇의 비율. 값 자체는 옆 칸에 숫자로 있으니 여기는 눈대중용이다. */
function ShareBar({ human, bot }: { human: number; bot: number }) {
  const sum = human + bot;
  if (!sum) return <span className="block h-[6px] border border-line" />;

  return (
    <span className="flex h-[6px] w-full">
      <span
        className="bg-amber"
        style={{ width: `${(human / sum) * 100}%` }}
        title={`사람 ${human}`}
      />
      <span
        className="bg-edge"
        style={{ width: `${(bot / sum) * 100}%` }}
        title={`봇 ${bot}`}
      />
    </span>
  );
}

/** 하나짜리 비율 막대. 옆 칸에 숫자가 있으니 여기는 눈대중용이다. */
function Bar({ value, total }: { value: number; total: number }) {
  if (!total) return <span className="block h-[6px] border border-line" />;

  return (
    <span className="flex h-[6px] w-full bg-edge">
      <span className="bg-amber" style={{ width: `${(value / total) * 100}%` }} />
    </span>
  );
}

function AgentTable({
  rows,
  total,
}: {
  rows: { agent: string; hits: number }[];
  total: number;
}) {
  return (
    <table className="w-full border-collapse">
      <Head cols={["이름표", "요청", "비중"]} />
      <tbody>
        {rows.map((r) => (
          <tr key={r.agent} className="group">
            <Cell mono strong>
              {r.agent}
            </Cell>
            <Cell mono>{r.hits.toLocaleString()}</Cell>
            <Cell mono>{total ? `${Math.round((r.hits / total) * 100)}%` : "—"}</Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
