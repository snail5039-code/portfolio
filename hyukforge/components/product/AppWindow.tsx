import Image from "next/image";

/**
 * 제품 화면을 담는 창 프레임.
 *
 * 제목 표시줄의 점은 정사각이다. macOS 원형 점을 쓰지 않는다 — 여기 올라오는 건
 * 대부분 Windows 앱이다. (docs/DESIGN.md 6장)
 *
 * 스크린샷이 아직 없으면 children 자리에 CSS로 만든 UI 모형을 넣는다.
 * 3D 렌더나 추상 도형으로 때우지 않는다.
 */
export function AppWindow({
  title,
  footLeft,
  footRight,
  src,
  unoptimized,
  alt,
  children,
}: {
  title: string;
  footLeft?: string;
  footRight?: string;
  src?: string;
  /** Storage 에서 온 이미지면 켠다 (lib/images.ts) */
  unoptimized?: boolean;
  alt?: string;
  children?: React.ReactNode;
}) {
  return (
    <figure className="border border-edge bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-[11px] py-[9px]">
        <span className="size-[9px] border border-dim" />
        <span className="size-[9px] border border-dim" />
        <span className="size-[9px] border border-dim" />
        <figcaption className="ml-[6px] truncate font-mono text-label text-dim">
          {title}
        </figcaption>
      </div>

      {src ? (
        <Image
          src={src}
          alt={alt ?? title}
          width={1280}
          height={800}
          unoptimized={unoptimized}
          className="w-full"
        />
      ) : (
        children
      )}

      {(footLeft || footRight) && (
        <div className="flex justify-between border-t border-line px-[14px] py-[9px] font-mono text-label text-dim">
          <span>{footLeft}</span>
          <span>{footRight}</span>
        </div>
      )}
    </figure>
  );
}
