"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, MessageCircle } from "lucide-react";
import { createComment, type ActionState } from "@/app/restaurants/actions";
import OAuthLoginButton from "./OAuthLoginButton";

const initialState: ActionState = {};

type Comment = {
  id: number;
  content: string;
  created_at: string;
  profiles?: { nickname: string } | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      등록
    </button>
  );
}

export default function CommentSection({
  restaurantId,
  comments,
  isLoggedIn,
}: {
  restaurantId: number | string;
  comments: Comment[];
  isLoggedIn: boolean;
}) {
  const [state, formAction] = useActionState(createComment, initialState);

  return (
    <section className="flex flex-col rounded-lg border border-line bg-surface">
      <h2 className="flex items-baseline gap-1.5 border-b border-line px-5 py-3 text-sm font-bold text-foreground">
        <MessageCircle className="h-4 w-4" strokeWidth={2} />
        댓글
        <span className="tnum text-xs font-normal text-muted">
          {comments.length}
        </span>
      </h2>

      {comments.length > 0 ? (
        <ul className="divide-y divide-line">
          {comments.map((comment) => (
            <li key={comment.id} className="px-5 py-3">
              <span className="text-xs font-medium text-muted">
                {comment.profiles?.nickname ?? "익명"}
              </span>
              <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                {comment.content}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-8 text-center text-[13px] text-muted">
          아직 댓글이 없어요.
        </p>
      )}

      {isLoggedIn ? (
        <form
          action={formAction}
          className="flex items-start gap-2 border-t border-line px-5 py-4"
        >
          <input type="hidden" name="restaurant_id" value={restaurantId} />
          <input
            name="content"
            required
            placeholder="댓글을 남겨보세요"
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-brand"
          />
          <SubmitButton />
        </form>
      ) : (
        <div className="flex flex-col gap-2 border-t border-line px-5 py-4">
          <p className="text-[13px] text-muted">댓글은 로그인 후 남길 수 있어요.</p>
          <div className="flex gap-2">
            <OAuthLoginButton provider="kakao" size="sm" />
            <OAuthLoginButton provider="google" size="sm" />
          </div>
        </div>
      )}
      {state.error && (
        <p className="px-5 pb-4 text-xs text-red-500">{state.error}</p>
      )}
    </section>
  );
}
