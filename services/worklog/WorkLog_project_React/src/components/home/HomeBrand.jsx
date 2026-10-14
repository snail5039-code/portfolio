import React from "react";
import { Link } from "react-router-dom";

export function BrandMark() {
  return (
    <span className="relative inline-block h-6 w-6" aria-hidden="true">
      <span className="absolute left-[2px] top-[3px] h-3 w-2 rotate-[-38deg] rounded-[100%_0] bg-[#dc5b37]" />
      <span className="absolute right-[2px] top-[1px] h-3 w-2 rotate-[38deg] rounded-[0_100%] bg-[#dc5b37]" />
      <span className="absolute left-[9px] top-[10px] h-3 w-2 rounded-[100%_0] bg-[#dc5b37]" />
    </span>
  );
}

export function HomeLogo() {
  return (
    <Link to="/" className="flex items-center gap-2 no-underline" aria-label="WorkLog 홈">
      <BrandMark />
      <span className="font-serif text-2xl font-bold tracking-[-0.03em] text-[#d95635]">WorkLog</span>
    </Link>
  );
}
