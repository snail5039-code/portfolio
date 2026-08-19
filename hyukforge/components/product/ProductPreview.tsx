"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { imageUrl, isUnoptimized } from "@/lib/images";

/**
 * 받기 전에 확인하는 자리.
 *
 * 소프트웨어는 설명을 읽어도 감이 안 온다. 실제로 움직이는 걸 봐야 받을지 정한다.
 * 그래서 스크린샷 · 영상 · 브라우저에서 바로 체험을 한곳에 묶었다.
 *
 * 있는 탭만 보여준다. 세 개를 다 만들어놓고 "준비 중"으로 채우지 않는다.
 */

type Img = { path: string; alt: string | null };

/** YouTube 주소는 임베드 형태로 바꾼다. */
function youtubeEmbed(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export function ProductPreview({
  name,
  images,
  videoUrl,
  demoUrl,
}: {
  name: string;
  images: Img[];
  videoUrl: string | null;
  demoUrl: string | null;
}) {
  const t = useTranslations("preview");

  const tabs = [
    images.length > 0 && { key: "shots", label: t("screenshots") },
    videoUrl && { key: "video", label: t("video") },
    demoUrl && { key: "demo", label: t("demo") },
  ].filter(Boolean) as { key: string; label: string }[];

  const [tab, setTab] = useState(tabs[0]?.key);
  const [shot, setShot] = useState(0);

  // 보여줄 게 하나도 없으면 섹션 자체를 내지 않는다
  if (tabs.length === 0) return null;

  const embed = videoUrl ? youtubeEmbed(videoUrl) : null;

  return (
    <section className="pt-[68px]">
      <div className="mb-6 flex items-baseline gap-4">
        <h2 className="text-[17px] font-semibold">{t("title")}</h2>
        <span className="-translate-y-[3px] flex-1 border-t border-line" />
      </div>

      {/* 탭이 하나뿐이면 탭 줄을 그리지 않는다 */}
      {tabs.length > 1 && (
        <div role="tablist" className="mb-4 flex gap-[2px]">
          {tabs.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={tab === x.key}
              onClick={() => setTab(x.key)}
              className={`border px-[15px] py-2 font-mono text-[12px] tracking-tag transition-colors ${
                tab === x.key
                  ? "border-amber text-amber"
                  : "border-transparent text-dim hover:text-ink"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      )}

      {tab === "shots" && images.length > 0 && (
        <div>
          <div className="border border-edge bg-panel">
            <Image
              src={imageUrl(images[shot].path)}
              alt={images[shot].alt ?? name}
              width={1280}
              height={800}
              className="w-full"
              unoptimized={isUnoptimized(images[shot].path)}
            />
          </div>

          {images.length > 1 && (
            <div className="mt-[2px] flex flex-wrap gap-[2px]">
              {images.map((img, i) => (
                <button
                  key={img.path}
                  onClick={() => setShot(i)}
                  aria-label={`${i + 1}`}
                  className={`h-[52px] w-[84px] overflow-hidden border transition-colors ${
                    i === shot ? "border-amber" : "border-edge hover:border-mute"
                  }`}
                >
                  <Image
                    src={imageUrl(img.path)}
                    alt=""
                    width={168}
                    height={104}
                    className="h-full w-full object-cover"
                    unoptimized={isUnoptimized(img.path)}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "video" && videoUrl && (
        <div className="border border-edge bg-panel">
          {embed ? (
            <iframe
              src={embed}
              title={`${name} — ${t("video")}`}
              allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full"
            />
          ) : (
            <video
              src={videoUrl}
              controls
              preload="metadata"
              className="aspect-video w-full"
            />
          )}
        </div>
      )}

      {tab === "demo" && demoUrl && (
        <div>
          <p className="mb-3 border-l border-edge pl-3 text-[13px] text-dim">
            {t("demoNote")}
          </p>
          <div className="border border-edge bg-panel">
            <iframe
              src={demoUrl}
              title={`${name} — ${t("demo")}`}
              // 남의 페이지를 우리 창에 띄우는 것이라 권한을 최소로 준다
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
              loading="lazy"
              className="h-[560px] w-full"
            />
          </div>
          <p className="mt-2 text-right">
            <a
              href={demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[12px] text-amber hover:underline"
            >
              {t("openInNewTab")} ↗
            </a>
          </p>
        </div>
      )}
    </section>
  );
}
