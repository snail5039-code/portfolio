"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteRestaurant } from "@/app/restaurants/actions";

export default function DeleteRestaurantButton({
  restaurantId,
  redirectTo,
  size = "sm",
}: {
  restaurantId: number | string;
  redirectTo?: string;
  size?: "sm" | "md";
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm("이 맛집을 삭제할까요? 되돌릴 수 없어요.")) return;

    startTransition(async () => {
      const result = await deleteRestaurant(restaurantId);
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      if (redirectTo) router.push(redirectTo);
    });
  };

  if (size === "md") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        title="맛집 삭제"
        className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted shadow-sm transition-colors hover:border-red-400 hover:text-red-500 disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        삭제
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label="맛집 삭제"
      title="맛집 삭제"
      className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:border-red-400 hover:text-red-500 disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
