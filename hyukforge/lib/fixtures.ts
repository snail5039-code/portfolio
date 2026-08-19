import type { Product, Stats } from "@/lib/queries/products";
import type { ChangelogEntry } from "@/lib/queries/changelog";
import type { Notice } from "@/lib/queries/notices";

/**
 * 디자인 확인용 예시 데이터.
 *
 * DB에 들어가지 않는다. /preview 화면에서만 쓴다.
 * 실제 제품·통계로 노출되지 않게, 이 값을 실제 라우트에서 부르지 않는다.
 * (docs/DESIGN.md "숫자는 진짜만")
 */

const make = (
  p: Partial<Product> & { slug: string; name: string },
): Product => ({
  id: p.slug,
  kind: "download",
  category: "utilities",
  iconLetter: p.name[0],
  platforms: ["windows"],
  isFree: true,
  externalUrl: null,
  downloadCount: 0,
  publishedAt: "2026-08-16",
  isFeatured: false,
  tagline: null,
  description: null,
  requirements: null,
  demoUrl: null,
  videoUrl: null,
  images: [],
  latest: null,
  ...p,
});

export const PRODUCTS: Product[] = [
  make({
    slug: "file-organizer",
    name: "File Organizer Pro",
    tagline: "규칙을 걸어두면 알아서 분류합니다",
    category: "office",
    iconLetter: "F",
    isFeatured: true,
    downloadCount: 1284,
    description: `다운로드 폴더가 감당이 안 돼서 만들었습니다.

규칙을 한 번 걸어두면 새로 들어온 파일을 알아서 분류합니다. 이름만 다른 중복 파일을 찾아 주는데, 지우기 전에 무엇을 지울지 먼저 보여줍니다.

WebP 변환이 느린 건 알고 있고 다음 버전에서 고칩니다.`,
    requirements: `Windows 10 이상 · 64비트
메모리 4GB 이상
설치 공간 60MB`,
    latest: {
      id: "r1",
      version: "1.2.0",
      platform: "windows",
      assetUrl: "#",
      fileSize: 25_690_112,
      releasedAt: "2026-08-16",
    },
  }),
  make({
    slug: "hyuknote",
    name: "HyukNote",
    tagline: "단축키로 여는 메모장",
    category: "office",
    iconLetter: "N",
    downloadCount: 612,
    latest: {
      id: "r2",
      version: "1.1.0",
      platform: "windows",
      assetUrl: "#",
      fileSize: 19_084_083,
      releasedAt: "2026-08-10",
    },
  }),
  make({
    slug: "pixel-adventure",
    name: "Pixel Adventure",
    tagline: "2D 액션, 스테이지 24개",
    category: "games",
    iconLetter: "P",
    downloadCount: 2140,
    latest: {
      id: "r3",
      version: "1.0.3",
      platform: "windows",
      assetUrl: "#",
      fileSize: 327_155_712,
      releasedAt: "2026-08-14",
    },
  }),
  make({
    slug: "image-converter",
    name: "Image Converter",
    tagline: "끌어다 놓으면 한번에 변환·압축",
    category: "utilities",
    iconLetter: "I",
    downloadCount: 431,
    latest: {
      id: "r4",
      version: "1.0.0",
      platform: "windows",
      assetUrl: "#",
      fileSize: 16_462_643,
      releasedAt: "2026-07-28",
    },
  }),
  make({
    slug: "commute-battle",
    name: "출퇴근 생존일지",
    tagline: "출퇴근 기록과 경로 안내를 한곳에서",
    kind: "webapp",
    category: "webapps",
    iconLetter: "출",
    platforms: [],
    externalUrl: "https://commute-battle.vercel.app",
    // 웹앱이라 받기 전에 그 자리에서 바로 써볼 수 있다
    demoUrl: "https://commute-battle.vercel.app",
    publishedAt: "2026-08-02",
    description: `매일 출퇴근 시간을 손으로 적기 싫어서 만들었습니다.

출퇴근을 기록하면 경로와 소요 시간을 정리해 보여줍니다. 같은 회사 사람끼리 워크스페이스를 만들어 쓸 수 있고, 관리자는 근태를 확인할 수 있습니다.

설치할 게 없습니다. 아래 체험 탭에서 바로 눌러보세요.`,
  }),
  make({
    slug: "my-little-restaurant",
    name: "나만의 작은 맛집",
    tagline: "가본 곳을 기록하고 다시 찾기",
    kind: "webapp",
    category: "webapps",
    iconLetter: "맛",
    platforms: [],
    externalUrl: "https://my-little-restaurant.vercel.app",
    publishedAt: "2026-06-19",
  }),
  make({
    slug: "gesture-os",
    name: "GestureOS Manager",
    tagline: "카메라로 손을 읽어 PC를 조작",
    category: "labs",
    iconLetter: "G",
    publishedAt: "2026-08-10",
  }),
];

export const FEATURED = PRODUCTS[0];

export const STATS: Stats = {
  productCount: 7,
  monthlyDownloads: 1340,
  totalDownloads: 4467,
  lastUpdated: "2026-08-16",
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "c1",
    date: "2026-08-16",
    productSlug: "file-organizer",
    productName: "File Organizer Pro",
    body: "확장자 없는 파일이 전부 기타로 가던 문제를 고쳤습니다.",
  },
  {
    id: "c2",
    date: "2026-08-14",
    productSlug: "pixel-adventure",
    productName: "Pixel Adventure",
    body: "스테이지 3개를 넣었습니다. 2-4 보스가 너무 어렵다는 말이 많아서 패턴을 하나 줄였습니다.",
  },
  {
    id: "c3",
    date: "2026-08-10",
    productSlug: "hyuknote",
    productName: "HyukNote",
    body: "다크 모드와 전역 단축키 Ctrl+Shift+N을 넣었습니다.",
  },
  {
    id: "c4",
    date: "2026-08-02",
    productSlug: "commute-battle",
    productName: "출퇴근 생존일지",
    body: "회원 탈퇴 기능과 채팅 알림을 반영했습니다.",
  },
  {
    id: "c5",
    date: "2026-07-28",
    productSlug: "image-converter",
    productName: "Image Converter",
    body: "첫 공개입니다. WebP 변환이 느린 건 알고 있고 다음 버전에서 고칩니다.",
  },
];

export const NOTICES: Notice[] = [
  {
    id: "n1",
    slug: "all-free",
    isPinned: true,
    publishedAt: "2026-08-01",
    title: "지금 올라온 제품은 모두 무료입니다",
    body: `당분간 결제 기능을 붙이지 않습니다. 받아서 그냥 쓰시면 됩니다.

나중에 유료 제품이 생기더라도, 지금 무료로 올라온 것들은 계속 무료로 둡니다. 받아두신 버전이 갑자기 잠기는 일은 없습니다.

가입을 요구하는 건 새 버전이 나왔을 때 알려드리기 위한 것뿐입니다. 광고 메일은 보내지 않습니다.`,
  },
  {
    id: "n2",
    slug: "how-to-report-bugs",
    isPinned: false,
    publishedAt: "2026-07-20",
    title: "버그를 알려주실 때 함께 적어주시면 좋은 것",
    body: `혼자 만들고 혼자 고치기 때문에, 재현이 안 되면 손을 못 댑니다.

이 세 가지만 있으면 대부분 며칠 안에 고칠 수 있습니다. 사용하신 Windows 버전, 어떤 순서로 눌렀을 때 생겼는지, 그리고 화면 캡처.

메일로 보내주세요. snail5039@gmail.com`,
  },
];
