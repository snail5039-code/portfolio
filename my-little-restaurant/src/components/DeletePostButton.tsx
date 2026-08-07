"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deletePost } from "@/app/board/actions";

export default function DeletePostButton({ postId }: { postId: number }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-red-500"
      >
        <Trash2 className="h-3.5 w-3.5" />
        삭제
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted">정말 삭제할까요?</span>
      <button
        onClick={() =>
          startTransition(async () => {
            await deletePost(postId);
          })
        }
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-md bg-red-500 px-2 py-1 font-semibold text-white hover:bg-red-600 disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        삭제
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-md px-2 py-1 text-muted hover:bg-surface-muted"
      >
        취소
      </button>
    </div>
  );
}
