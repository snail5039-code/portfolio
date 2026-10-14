"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/app/restaurants/actions";
import LoginRequiredModal from "./LoginRequiredModal";

export default function FavoriteButton({
  restaurantId,
  initialFavorited,
  isLoggedIn,
}: {
  restaurantId: number | string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = () => {
    if (!isLoggedIn) {
      setModalOpen(true);
      return;
    }
    setFavorited((v) => !v);
    startTransition(async () => {
      const result = await toggleFavorite(restaurantId);
      if (result?.error) {
        setFavorited((v) => !v);
      }
    });
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending}
        aria-label="즐겨찾기"
        title="즐겨찾기"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-sm transition-colors hover:text-red-500"
      >
        <Heart className={`h-4 w-4 ${favorited ? "fill-red-500 text-red-500" : ""}`} />
      </button>
      <LoginRequiredModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        message="즐겨찾기는 로그인 후 이용할 수 있어요."
      />
    </>
  );
}
