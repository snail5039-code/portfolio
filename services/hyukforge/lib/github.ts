/**
 * GitHub Releases 읽기.
 *
 * 설치파일은 GitHub Releases 에 두고 우리 DB 에는 주소만 저장한다.
 * Supabase 무료 티어는 대역폭이 5GB/월이라 200MB 짜리 설치파일을
 * 직접 서비스하면 한 달에 25번 받고 끝난다.
 * (docs/ARCHITECTURE.md 1장)
 *
 * 토큰 없이 호출한다. 공개 저장소만 다루고, 인증 없는 요청도
 * 시간당 60회까지 되므로 관리 화면에서 쓰기에는 충분하다.
 */

export type GithubAsset = {
  name: string;
  url: string;
  size: number;
  /** 확장자로 추측한 플랫폼. 틀릴 수 있으니 화면에서 고칠 수 있게 한다. */
  platform: string;
};

export type GithubRelease = {
  tag: string;
  name: string;
  publishedAt: string | null;
  prerelease: boolean;
  assets: GithubAsset[];
};

/** 파일 확장자로 플랫폼을 추측한다. */
export function guessPlatform(filename: string): string {
  const n = filename.toLowerCase();
  if (n.endsWith(".exe") || n.endsWith(".msi")) return "windows";
  if (n.endsWith(".dmg") || n.endsWith(".pkg")) return "macos";
  if (n.endsWith(".apk") || n.endsWith(".aab")) return "android";
  if (n.endsWith(".ipa")) return "ios";
  if (n.endsWith(".appimage") || n.endsWith(".deb") || n.endsWith(".rpm"))
    return "linux";
  // zip 은 어느 쪽인지 알 수 없다. 기본값을 두되 화면에서 고칠 수 있다.
  return "windows";
}

/** 'owner/name' 또는 GitHub 주소를 받아 'owner/name' 으로 정규화한다. */
export function normalizeRepo(input: string): string | null {
  const s = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const fromUrl = s.match(/github\.com\/([^/]+\/[^/]+)/i);
  const repo = fromUrl ? fromUrl[1] : s;
  return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : null;
}

export type FetchResult =
  | { ok: true; releases: GithubRelease[] }
  | { ok: false; message: string };

export async function fetchReleases(repoInput: string): Promise<FetchResult> {
  const repo = normalizeRepo(repoInput);
  if (!repo) {
    return {
      ok: false,
      message: "저장소는 '계정/저장소' 형식이거나 GitHub 주소여야 합니다.",
    };
  }

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=20`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      // 관리 화면에서 누를 때마다 최신을 봐야 한다
      cache: "no-store",
    });
  } catch {
    return { ok: false, message: "GitHub 에 연결하지 못했습니다." };
  }

  if (res.status === 404) {
    return { ok: false, message: `${repo} 저장소를 찾을 수 없습니다. 비공개인지 확인하세요.` };
  }
  if (res.status === 403) {
    return { ok: false, message: "GitHub 요청 한도에 걸렸습니다. 잠시 후 다시 시도하세요." };
  }
  if (!res.ok) {
    return { ok: false, message: `GitHub 응답 오류 (HTTP ${res.status})` };
  }

  const raw = (await res.json()) as {
    tag_name: string;
    name: string | null;
    published_at: string | null;
    prerelease: boolean;
    assets: { name: string; browser_download_url: string; size: number }[];
  }[];

  const releases = raw
    .map((r) => ({
      tag: r.tag_name,
      name: r.name?.trim() || r.tag_name,
      publishedAt: r.published_at,
      prerelease: r.prerelease,
      assets: (r.assets ?? []).map((a) => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
        platform: guessPlatform(a.name),
      })),
    }))
    // 첨부파일이 없는 릴리스는 받을 게 없으므로 걸러낸다
    .filter((r) => r.assets.length > 0);

  if (releases.length === 0) {
    return {
      ok: false,
      message: `${repo} 에 첨부파일이 있는 릴리스가 없습니다. GitHub 에서 릴리스를 만들고 설치파일을 첨부하세요.`,
    };
  }

  return { ok: true, releases };
}
