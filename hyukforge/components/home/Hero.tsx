import { getTranslations } from "next-intl/server";
import { Btn, Label } from "@/components/ui";
import { AppWindow } from "@/components/product/AppWindow";
import { platformLabel } from "@/lib/format";
import { imageUrl, isUnoptimized } from "@/lib/images";
import type { Product } from "@/lib/queries/products";
import type { Notice } from "@/lib/queries/notices";
import { NoticePanel } from "./NoticePanel";

/**
 * 히어로. 비대칭 44:56으로 나눈다 — 반반은 기계적으로 보인다.
 * 오른쪽은 3D 렌더가 아니라 실제 앱 화면이 들어갈 자리다.
 *
 * 오른쪽에 무엇이 오는지는 있는 것 중에서 고른다.
 *   1. 공지 — 홈에 공지가 들어갈 자리가 여기뿐이다 (제품·개발 기록은 아래에 있다)
 *   2. 대표 제품 스크린샷
 *   3. CSS 로 만든 모형 — 둘 다 없을 때만
 * 지어낸 제품을 첫 화면에 크게 걸어두면 "숫자는 진짜만" 이라고 써둔 것과
 * 어긋난다 (docs/DESIGN.md 글쓰기 규칙). 그래서 모형은 마지막 수단이다.
 */
export async function Hero({
  product,
  notices = [],
}: {
  product?: Product | null;
  notices?: Notice[];
}) {
  const t = await getTranslations();
  const shot = product?.images[0];

  return (
    <section className="grid items-start gap-16 pb-[76px] pt-[92px] lg:grid-cols-[minmax(0,44fr)_minmax(0,56fr)]">
      <div>
        <Label>{t("home.eyebrow")}</Label>
        <h1 className="mb-[22px] mt-[18px] text-[clamp(30px,4.2vw,50px)] font-bold leading-[1.18] tracking-[-0.03em]">
          {t.rich("home.headline", {
            br: () => <br />,
            accent: (chunks) => (
              <em className="not-italic text-amber">{chunks}</em>
            ),
          })}
        </h1>
        <p className="max-w-[34ch] text-[15.5px] text-mute">{t("home.lead")}</p>

        <div className="mt-[30px] flex flex-wrap gap-[10px]">
          <Btn href="/products" variant="primary">
            {t("home.ctaProducts")}
          </Btn>
          <Btn href="/changelog">{t("home.ctaChangelog")}</Btn>
        </div>

        <p className="mt-5 border-l border-edge pl-3 text-[13px] text-dim">
          {t("home.privacyNote")}
        </p>
      </div>

      {notices.length > 0 ? (
        <NoticePanel notices={notices} />
      ) : shot && product ? (
        <AppWindow
          title={product.name}
          footLeft={
            product.latest
              ? `v${product.latest.version.replace(/^v/, "")}`
              : undefined
          }
          footRight={
            product.platforms.length ? platformLabel(product.platforms) : undefined
          }
          src={imageUrl(shot.path)}
          unoptimized={isUnoptimized(shot.path)}
          alt={shot.alt ?? product.name}
        />
      ) : (
        <HeroWindow />
      )}
    </section>
  );
}

/**
 * 스크린샷이 없을 때만 쓰는 UI 모형.
 * 대표 제품에 스크린샷이 올라오면 위에서 실제 캡처로 바뀐다.
 *
 * 이 안의 글자는 번역하지 않는다. 스크린샷을 대신하는 자리이고,
 * 실제 캡처 이미지는 어느 언어로 찍혔든 그대로 쓰기 때문이다.
 * 화면에 보이는 UI 문구(버튼·라벨)는 messages/*.json 에 있다.
 */
function HeroWindow() {
  const rows = [
    ["2026_계약서_최종.pdf", "문서 / 계약", "1.2 MB", true],
    ["capture_0814.png", "이미지 / 캡처", "820 KB", false],
    ["setup_v1.2.0.exe", "설치파일", "24.5 MB", false],
    ["회의록_사본(2).docx", "중복 의심", "96 KB", false],
    ["backup_0731.zip", "압축 / 백업", "412 MB", false],
    ["invoice_july.xlsx", "문서 / 정산", "44 KB", false],
  ] as const;

  return (
    <AppWindow
      title="File Organizer — D:\Downloads"
      footLeft="규칙 12개 적용"
      footRight="v1.2.0 · Windows 10/11"
    >
      <div className="grid min-h-[296px] grid-cols-[132px_1fr]">
        <div className="border-r border-line py-3">
          {["모든 파일", "중복 항목", "규칙 12", "제외 목록", "기록"].map(
            (label, i) => (
              <span
                key={label}
                className={`block border-l-2 px-[14px] py-[6px] font-mono text-[12px] ${
                  i === 0
                    ? "border-l-amber bg-[#141210] text-amber"
                    : "border-l-transparent text-mute"
                }`}
              >
                {label}
              </span>
            ),
          )}
        </div>

        <div>
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr>
                {["이름", "분류 결과", "크기"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-line px-[14px] py-[9px] text-left font-normal tracking-btn text-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, kind, size, hit]) => (
                <tr key={name}>
                  <td
                    className={`border-b border-[#151312] px-[14px] py-[7px] ${
                      hit ? "text-ink" : "text-mute"
                    }`}
                  >
                    {hit && <span className="text-amber">▸ </span>}
                    {name}
                  </td>
                  <td
                    className={`border-b border-[#151312] px-[14px] py-[7px] ${
                      hit ? "text-ink" : "text-mute"
                    }`}
                  >
                    {kind}
                  </td>
                  <td
                    className={`border-b border-[#151312] px-[14px] py-[7px] ${
                      hit ? "text-ink" : "text-mute"
                    }`}
                  >
                    {size}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-[14px] py-3">
            <span className="u-label">정리 중 · 1,284개 중 873개</span>
            <div className="mt-[2px] h-[3px] bg-[#1A1815]">
              <span className="block h-[3px] w-[68%] bg-amber" />
            </div>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}
