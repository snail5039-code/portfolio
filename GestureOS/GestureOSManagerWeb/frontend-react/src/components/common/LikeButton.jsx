import React, { useState } from "react";
import { api } from "../../api/client";

export default function LikeButton({
    targetId,
    targetType = "article",
    initialLiked = false,
    initialCount = 0
}) {
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
        try {
            setLoading(true);
            const url = `/reactions/${targetType}/${targetId}`;
            const res = await api.post(url);
            setLiked(res.data.isLiked);
            setCount(res.data.likeCount);
        } catch (e) {
            console.error(e);
            if (e?.response?.status === 401) {
                alert("로그인이 필요합니다.");
            } else {
                alert("좋아요 처리 중 오류가 발생했습니다.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${liked
                ? "bg-rose-500/15 border-rose-400/40 text-rose-200"
                : "bg-[var(--surface-soft)] border-[var(--border)] text-slate-200 hover:border-slate-400/60"
                }`}
        >
            <svg
                className={`w-4 h-4 ${liked ? "fill-rose-300 text-rose-300" : "text-slate-300"}`}
                viewBox="0 0 24 24"
                fill={liked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0L12 5.5l-0.9-0.9a5.6 5.6 0 0 0-7.9 7.9l0.9 0.9L12 21l7.9-7.9 0.9-0.9a5.6 5.6 0 0 0 0-7.9z" />
            </svg>
            <span className="text-sm font-medium">{count}</span>
        </button>
    );
}
