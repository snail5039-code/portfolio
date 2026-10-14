"use client";

import { Children, useState, type ReactNode } from "react";

/**
 * 미리 만들어둔 화면 조각을 앞뒤로 넘겨 하나씩 보여준다.
 *
 * FeaturedCarousel과 달리 여기서는 슬라이드 애니메이션을 쓰지 않는다.
 * 이동은 그 자리 하나로 충분하다 (docs/DESIGN.md 6장 "transform 애니메이션 없음").
 * 조각은 서버에서 만들어 children으로 받는다 — FeaturedCarousel과 같은 이유다.
 */
export function Pager({
  children,
  index,
  labels,
}: {
  children: ReactNode;
  /** 조각마다 화살표 사이에 보여줄 라벨. children과 순서가 같다. */
  index: string[];
  labels: { prev: string; next: string };
}) {
  const pages = Children.toArray(children);
  const count = pages.length;
  const [current, setCurrent] = useState(0);

  if (count === 0) return null;
  if (count === 1) return <>{pages}</>;

  const go = (i: number) => setCurrent(Math.max(0, Math.min(count - 1, i)));

  return (
    <div>
      {pages.map((page, i) => (
        <div key={i} hidden={i !== current}>
          {page}
        </div>
      ))}

      <div className="mt-[2px] flex items-center justify-center gap-[14px] border border-edge px-[14px] py-[10px]">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          aria-label={labels.prev}
          className="grid size-[30px] place-items-center border border-edge font-mono text-[12px] text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-30 disabled:hover:border-edge disabled:hover:text-mute"
        >
          ←
        </button>
        <span className="u-data min-w-[72px] text-center text-dim">
          {index[current]}
        </span>
        <button
          type="button"
          onClick={() => go(current + 1)}
          disabled={current === count - 1}
          aria-label={labels.next}
          className="grid size-[30px] place-items-center border border-edge font-mono text-[12px] text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-30 disabled:hover:border-edge disabled:hover:text-mute"
        >
          →
        </button>
      </div>
    </div>
  );
}
