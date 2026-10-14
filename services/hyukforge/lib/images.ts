/**
 * 제품 이미지 주소.
 *
 * product_images.storage_path 에는 버킷 안의 경로만 들어간다
 * (예: `commute-battle/1755...-shot.png`). 화면에서 쓰려면 공개 URL 로 바꿔야 한다.
 *
 * 원래 ProductPreview 안에만 있던 함수다. 제품 상세의 큰 이미지는 이걸 안 거쳐서
 * Storage 경로를 그대로 src 에 넣고 있었다 — 스크린샷이 하나도 없어서 안 드러났다.
 * 두 곳이 같은 규칙을 쓰도록 꺼냈다.
 */

export const MEDIA_BUCKET = "product-media";

/** Storage 경로면 공개 URL로, 이미 전체 주소면 그대로 쓴다. */
export function imageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/**
 * next/image 최적화를 건너뛸지.
 *
 * Storage 에서 오는 이미지는 건너뛴다. 최적화를 켜려면 next.config 에
 * remotePatterns 로 Supabase 호스트를 열어야 하고, Vercel 무료 티어의
 * 이미지 최적화 횟수도 함께 쓰게 된다. 스크린샷은 몇 장 되지 않아 그럴 값어치가 없다.
 */
export function isUnoptimized(path: string): boolean {
  return !/^https?:\/\//.test(path);
}
