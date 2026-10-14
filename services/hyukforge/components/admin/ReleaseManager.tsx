"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  importGithubReleases,
  saveRelease,
  deleteRelease,
} from "@/app/[locale]/admin/releases/actions";
import type { GithubRelease } from "@/lib/github";
import { fileSize, shortDate } from "@/lib/format";

/**
 * 릴리스 관리. 제품 수정 화면 안에 둔다 — 릴리스는 항상 어떤 제품의 것이고,
 * GitHub 저장소 주소도 같은 화면에 있다.
 *
 * 파일은 GitHub Releases 에 올리고 여기서는 주소만 등록한다.
 * 사이트로 직접 업로드하지 않는 이유는 lib/github.ts 주석에 적어뒀다.
 */

export type ExistingRelease = {
  id: string;
  version: string;
  channel: string;
  platform: string;
  assetUrl: string;
  fileSize: number | null;
  isLatest: boolean;
  releasedAt: string;
};

export function ReleaseManager({
  productId,
  githubRepo,
  releases,
}: {
  productId: string;
  githubRepo: string;
  releases: ExistingRelease[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<GithubRelease[] | null>(null);
  const [repo, setRepo] = useState(githubRepo);

  function load() {
    setError(null);
    setFound(null);
    startTransition(async () => {
      const res = await importGithubReleases(repo);
      if (!res.ok) setError(res.message);
      else setFound(res.releases);
    });
  }

  function add(
    rel: GithubRelease,
    asset: GithubRelease["assets"][number],
    isLatest: boolean,
  ) {
    setError(null);
    startTransition(async () => {
      const res = await saveRelease({
        id: null,
        productId,
        version: rel.tag,
        channel: rel.prerelease ? "beta" : "stable",
        platform: asset.platform,
        assetUrl: asset.url,
        fileSize: String(asset.size),
        checksum: "",
        isLatest,
        releasedAt: rel.publishedAt ?? "",
      });
      if (!res.ok) setError(res.message);
      else {
        setFound(null);
        router.refresh();
      }
    });
  }

  function remove(id: string, version: string) {
    if (!confirm(`릴리스 ${version} 을 지웁니다.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteRelease(id);
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  return (
    <section className="pt-12">
      <div className="mb-4 flex items-baseline gap-4">
        <h3 className="text-[17px] font-semibold">받을 수 있는 파일</h3>
        <span className="-translate-y-[3px] flex-1 border-t border-line" />
        <span className="u-label">{releases.length}개</span>
      </div>

      {error && (
        <p className="mb-4 border border-games px-4 py-3 text-[13.5px] text-ink">
          {error}
        </p>
      )}

      {/* ── 등록된 릴리스 ──────────────────────── */}
      {releases.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                {["버전", "환경", "채널", "용량", "배포일", "최신", ""].map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-edge px-3 py-[9px] text-left font-mono text-[11px] font-normal uppercase tracking-label text-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id}>
                  <td className="u-data border-b border-line px-3 py-[11px] text-ink">
                    {r.version}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[11px]">
                    {r.platform}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[11px]">
                    {r.channel}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[11px]">
                    {fileSize(r.fileSize)}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[11px]">
                    {shortDate(r.releasedAt)}
                  </td>
                  <td className="border-b border-line px-3 py-[11px]">
                    {r.isLatest ? (
                      <span className="font-mono text-tag tracking-tag text-amber">
                        최신
                      </span>
                    ) : (
                      <span className="font-mono text-tag text-dim">—</span>
                    )}
                  </td>
                  <td className="border-b border-line px-3 py-[11px] text-right">
                    <button
                      type="button"
                      onClick={() => remove(r.id, r.version)}
                      disabled={pending}
                      className="font-mono text-[12px] text-dim transition-colors hover:text-games disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── GitHub 에서 가져오기 ────────────────── */}
      <div className="border border-edge p-6">
        <span className="u-label">GitHub Releases 에서 가져오기</span>
        <p className="mt-2 text-[13px] text-dim">
          GitHub 에 릴리스를 만들고 설치파일을 첨부한 뒤 여기서 불러오면
          버전·주소·용량이 자동으로 채워집니다.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="snail5039-code/commute-battle"
            className="min-w-[260px] flex-1 border border-edge bg-panel px-3 py-[10px] font-mono text-[13px] text-ink placeholder:text-dim focus:border-amber focus:outline-none"
          />
          <button
            type="button"
            onClick={load}
            disabled={pending || !repo.trim()}
            className="border border-edge px-5 py-[10px] font-mono text-[12px] tracking-btn text-ink transition-colors hover:border-ink disabled:opacity-50"
          >
            {pending ? "불러오는 중" : "불러오기"}
          </button>
        </div>

        {found && (
          <div className="mt-6 space-y-4">
            {found.map((rel) => (
              <div key={rel.tag} className="border-t border-line pt-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  <b className="font-mono text-[13px] text-ink">{rel.tag}</b>
                  <span className="u-data">{shortDate(rel.publishedAt)}</span>
                  {rel.prerelease && (
                    <span className="border border-edge px-2 py-[2px] font-mono text-tag tracking-tag text-dim">
                      사전배포 · beta 로 등록
                    </span>
                  )}
                </div>

                <ul className="mt-3 space-y-2">
                  {rel.assets.map((a) => {
                    const already = releases.some((r) => r.assetUrl === a.url);
                    return (
                      <li
                        key={a.url}
                        className="flex flex-wrap items-center gap-3 border border-line px-3 py-[10px]"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-mute">
                          {a.name}
                        </span>
                        <span className="u-data">{fileSize(a.size)}</span>
                        <span className="font-mono text-tag tracking-tag text-dim">
                          {a.platform}
                        </span>
                        {already ? (
                          <span className="font-mono text-[12px] text-dim">
                            등록됨
                          </span>
                        ) : (
                          <span className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => add(rel, a, true)}
                              disabled={pending}
                              className="border border-amber bg-amber px-3 py-[6px] font-mono text-[12px] font-semibold tracking-btn text-on-amber transition-colors hover:bg-amber-hi disabled:opacity-50"
                            >
                              최신으로 등록
                            </button>
                            <button
                              type="button"
                              onClick={() => add(rel, a, false)}
                              disabled={pending}
                              className="border border-edge px-3 py-[6px] font-mono text-[12px] tracking-btn text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
                            >
                              지난 버전으로
                            </button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
