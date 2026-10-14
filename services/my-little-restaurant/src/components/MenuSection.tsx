"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  addMenuItem,
  deleteMenuItem,
  type ActionState,
} from "@/app/restaurants/actions";

const initialState: ActionState = {};

type MenuItem = {
  id: number;
  name: string;
  price: number | null;
  description: string | null;
  is_representative: boolean;
};

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
      )}
      추가
    </button>
  );
}

function DeleteButton({
  menuId,
  restaurantId,
}: {
  menuId: number;
  restaurantId: number | string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await deleteMenuItem(menuId, restaurantId);
        })
      }
      disabled={isPending}
      aria-label="메뉴 삭제"
      className="shrink-0 rounded p-1 text-muted transition-colors hover:text-red-500 disabled:opacity-60"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

export default function MenuSection({
  restaurantId,
  menu,
  isOwner,
}: {
  restaurantId: number | string;
  menu: MenuItem[];
  isOwner: boolean;
}) {
  const [state, formAction] = useActionState(addMenuItem, initialState);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-sm font-bold text-foreground">메뉴</h2>
        {isOwner && (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            메뉴 추가
          </button>
        )}
      </div>

      {menu.length > 0 ? (
        <ul className="divide-y divide-line">
          {menu.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  {item.name}
                  {item.is_representative && (
                    <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                      대표
                    </span>
                  )}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-muted">{item.description}</p>
                )}
              </div>
              {item.price !== null && (
                <span className="tnum shrink-0 text-[13px] text-muted">
                  {item.price.toLocaleString()}원
                </span>
              )}
              {isOwner && (
                <DeleteButton menuId={item.id} restaurantId={restaurantId} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-8 text-center text-[13px] text-muted">
          등록된 메뉴가 없어요.
        </p>
      )}

      {isOwner && formOpen && (
        <form
          action={formAction}
          className="flex flex-wrap items-end gap-2 border-t border-line px-5 py-4"
        >
          <input type="hidden" name="restaurant_id" value={restaurantId} />
          <label className="flex flex-col gap-1 text-xs text-muted">
            이름
            <input
              name="name"
              required
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            가격
            <input
              name="price"
              type="number"
              min="0"
              className="w-24 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-brand"
            />
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-muted">
            <input type="checkbox" name="is_representative" className="h-3.5 w-3.5" />
            대표 메뉴
          </label>
          <AddButton />
          {state.error && <p className="w-full text-xs text-red-500">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
