"use client";

import { useState } from "react";
import Link from "next/link";
import { PenSquare } from "lucide-react";
import LoginRequiredModal from "./LoginRequiredModal";

export default function NewPostButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);

  if (!isLoggedIn) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong"
        >
          <PenSquare className="h-4 w-4" strokeWidth={2.2} />
          글쓰기
        </button>
        <LoginRequiredModal
          open={open}
          onClose={() => setOpen(false)}
          message="글을 쓰려면 로그인이 필요해요."
        />
      </>
    );
  }

  return (
    <Link
      href="/board/new"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong"
    >
      <PenSquare className="h-4 w-4" strokeWidth={2.2} />
      글쓰기
    </Link>
  );
}
