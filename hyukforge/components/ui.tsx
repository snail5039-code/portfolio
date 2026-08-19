import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { categoryVar } from "@/lib/format";

/**
 * 화면 곳곳에서 반복되는 조각들.
 * 규칙은 docs/DESIGN.md 6장. 둥근 모서리·그림자·그라데이션은 쓰지 않는다.
 */

/** 제목 + 오른쪽으로 뻗는 1px 선. 섹션을 나누는 유일한 장치다. */
export function Section({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`pt-[78px] ${className}`}>
      <div className="mb-[26px] flex items-baseline gap-4">
        <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{title}</h2>
        <span className="-translate-y-[3px] flex-1 border-t border-line" />
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-mono text-[12px] text-dim transition-colors hover:text-amber"
    >
      {children} →
    </Link>
  );
}

/** mono 대문자 라벨. 값 위에 붙는 작은 설명. */
export function Label({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`u-label ${className}`}>{children}</span>;
}

type BtnProps = {
  href?: string;
  external?: boolean;
  /**
   * 언어 접두사를 붙이지 않는다. `[locale]` 밖에 있는 주소에 쓴다.
   *
   * next-intl 의 Link 는 내부 주소로 보이는 건 전부 접두사를 붙인다.
   * `/api/download/...` 가 `/ko/api/download/...` 가 되면서 404 가 났다.
   * 라우트를 직접 curl 하면 통과하니 화면에서만 깨져 찾기 어렵다.
   */
  unlocalized?: boolean;
  variant?: "primary" | "ghost";
  children: ReactNode;
};

export function Btn({
  href,
  external,
  unlocalized,
  variant = "ghost",
  children,
}: BtnProps) {
  const base =
    "inline-block border px-5 py-[11px] font-mono text-[12px] tracking-btn transition-colors";
  const style =
    variant === "primary"
      ? `${base} border-amber bg-amber font-semibold text-on-amber hover:border-amber-hi hover:bg-amber-hi`
      : `${base} border-edge text-ink hover:border-ink`;

  if (!href) return <span className={style}>{children}</span>;
  if (unlocalized)
    return (
      <a href={href} className={style}>
        {children}
      </a>
    );
  if (external)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={style}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={style}>
      {children}
    </Link>
  );
}

/** 분류 태그. 색은 테두리와 글자에만 들어간다. */
export function Tag({ slug, label }: { slug: string | null; label: string }) {
  const v = slug ? categoryVar[slug] : null;
  return (
    <span
      className="inline-block border px-2 py-[3px] font-mono text-tag tracking-tag"
      style={
        v
          ? { color: `var(${v})`, borderColor: `var(${v})` }
          : { color: "var(--color-dim)", borderColor: "var(--color-edge)" }
      }
    >
      {label}
    </span>
  );
}

/** 제품 아이콘 자리. 실제 아이콘이 없을 때 한 글자를 넣는다. */
export function IconBox({ letter }: { letter: string | null }) {
  return (
    <span className="grid size-[30px] shrink-0 place-items-center border border-edge font-mono text-[12px] text-amber">
      {letter ?? "·"}
    </span>
  );
}

/** dt/dd 한 줄. 사양표에 쓴다. */
export function SpecRow({
  label,
  children,
  accent,
}: {
  label: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <dl className="grid grid-cols-[92px_1fr] border-b border-line py-2 font-mono text-data">
      <dt className="text-dim">{label}</dt>
      <dd className={accent ? "text-amber" : "text-mute"}>{children}</dd>
    </dl>
  );
}
