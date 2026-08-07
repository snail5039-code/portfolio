"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { updateVisited } from "@/app/restaurants/actions";

export default function VisitedToggle({
  restaurantId,
  initialVisited,
}: {
  restaurantId: number | string;
  initialVisited: boolean;
}) {
  const [visited, setVisited] = useState(initialVisited);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    const next = !visited;
    setVisited(next);
    startTransition(async () => {
      const result = await updateVisited(restaurantId, next);
      if (result?.error) {
        setVisited(!next);
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={visited ? "방문 완료 (클릭해서 취소)" : "방문 체크하기"}
      className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-sm transition-colors ${
        visited
          ? "border-brand bg-brand text-white"
          : "border-line bg-surface text-muted hover:text-brand"
      }`}
    >
      {visited ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Clock className="h-3.5 w-3.5" />
      )}
      {visited ? "방문 완료" : "방문 체크"}
    </button>
  );
}
