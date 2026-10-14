"use client";

import { Children, useEffect, useState, type ReactNode } from "react";

/**
 * 대표 제품 자리를 여러 제품이 돌아가며 쓴다.
 *
 * 카드 하나만 크게 띄우는 규칙(docs/DESIGN.md 5장)은 그대로 두고, 그 한 자리를
 * 시간이 지나면 다음 제품에게 넘긴다. 아래 표에 이름만 남는 제품도 큰 자리에
 * 한 번씩 걸리게 하려는 것.
 *
 * 여기가 사이트에서 유일하게 움직이는 곳이다. DESIGN.md 6장은 transform
 * 애니메이션을 쓰지 않는다고 못박았는데, 옆으로 넘어간다는 걸 보여주려면
 * 슬라이드 말고 방법이 없어서 이 자리만 예외로 뒀다. 대신
 *  · 8초. 읽다가 넘어가지 않을 만큼 두고, 마우스나 키보드 초점이 올라가 있으면 멈춘다
 *  · 화살표와 막대로 직접 넘길 수 있다. 자동으로만 도는 자리는 만들지 않는다
 *  · 운영체제에서 애니메이션 줄이기를 켜면 슬라이드 없이 바로 바뀐다
 *
 * 제품 카드는 서버에서 만들어 children 으로 받는다. 그래야 이 파일 때문에
 * 제품 조회·번역이 클라이언트로 넘어가지 않는다.
 * (node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
 *  "Interleaving Server and Client Components")
 */

const INTERVAL = 8000;

const pad = (n: number) => String(n).padStart(2, "0");

export function FeaturedCarousel({
  children,
  names,
  labels,
}: {
  children: ReactNode;
  /** 막대 버튼의 이름표. children 과 같은 순서다. */
  names: string[];
  labels: { prev: string; next: string };
}) {
  const slides = Children.toArray(children);
  const count = slides.length;

  const [current, setCurrent] = useState(0);
  // 마우스가 올라가 있거나 안쪽에 초점이 있으면 멈춘다. 읽는 중에 넘어가면 안 된다.
  const [held, setHeld] = useState(false);

  // setInterval 이 아니라 매번 새로 거는 setTimeout 이다.
  // current 가 바뀔 때마다 시계가 다시 시작해서, 직접 넘긴 직후에
  // 남아 있던 시간 때문에 곧바로 또 넘어가는 일이 없다.
  useEffect(() => {
    if (count < 2 || held) return;
    const timer = setTimeout(
      () => setCurrent((i) => (i + 1) % count),
      INTERVAL,
    );
    return () => clearTimeout(timer);
  }, [count, held, current]);

  // 제품이 하나뿐이면 넘길 것이 없다. 조작 줄도 만들지 않는다.
  if (count < 2) return <>{slides}</>;

  const go = (i: number) => setCurrent(((i % count) + count) % count);

  return (
    <div
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              className="w-full shrink-0"
              // 화면 밖에 있는 카드의 링크·버튼이 탭으로 잡히면
              // 초점이 안 보이는 데로 사라진다. inert 가 통째로 막는다.
              inert={i !== current || undefined}
              aria-hidden={i !== current || undefined}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-[2px] flex flex-wrap items-center justify-between gap-3 border border-edge px-[14px] py-[10px] sm:px-[22px]">
        {/* 몇 개 중 몇 번째인지. 점 대신 막대다 — 원은 쓰지 않는다 */}
        <div className="flex items-center gap-[6px]">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={names[i]}
              aria-current={i === current || undefined}
              // 좁은 화면에서 막대를 줄인다. 그대로 두면 조작 줄이
              // 두 줄로 접히면서 높이가 배로 늘어난다
              className="group flex h-[18px] w-[18px] items-center sm:w-[26px]"
            >
              <span
                className={`block h-[2px] w-full transition-colors ${
                  i === current ? "bg-amber" : "bg-line group-hover:bg-mute"
                }`}
              />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-[10px]">
          <span className="u-data text-dim">
            {pad(current + 1)} / {pad(count)}
          </span>
          <button
            type="button"
            onClick={() => go(current - 1)}
            aria-label={labels.prev}
            className="grid size-[30px] place-items-center border border-edge font-mono text-[12px] text-mute transition-colors hover:border-ink hover:text-ink"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            aria-label={labels.next}
            className="grid size-[30px] place-items-center border border-edge font-mono text-[12px] text-mute transition-colors hover:border-ink hover:text-ink"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
