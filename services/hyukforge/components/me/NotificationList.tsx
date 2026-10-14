"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { markAllRead, markRead } from "@/app/[locale]/me/notifications";
import { shortDate } from "@/lib/format";
import type { Notification } from "@/lib/queries/notifications";

/**
 * 알림 목록.
 *
 * 지우지 않고 읽음만 표시한다. 누른 알림은 읽음이 되고 그 글로 간다.
 * 글이 지워졌으면 링크 없이 "지워진 글" 로만 남긴다 — 눌러도 404 인 링크를 두지 않는다.
 */
export function NotificationList({ items }: { items: Notification[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const unread = items.filter((n) => !n.read).length;

  function open(n: Notification) {
    if (n.read) return;
    startTransition(async () => {
      await markRead(n.id);
      router.refresh();
    });
  }

  function allRead() {
    startTransition(async () => {
      await markAllRead();
      router.refresh();
    });
  }

  function line(n: Notification) {
    const actor = n.actor ?? t("notif.someone");
    const key =
      n.kind === "comment_on_post"
        ? "notif.commentOnPost"
        : n.kind === "new_post"
          ? "notif.newPost"
          : "notif.newComment";
    return t(key, { actor });
  }

  return (
    <section className="pt-12">
      <div className="mb-5 flex items-baseline gap-4">
        <h2 className="text-[17px] font-semibold">{t("notif.title")}</h2>
        <span className="-translate-y-[3px] flex-1 border-t border-line" />
        {unread > 0 && (
          <button
            type="button"
            onClick={allRead}
            disabled={pending}
            className="font-mono text-[12px] text-dim transition-colors hover:text-ink disabled:opacity-50"
          >
            {t("notif.markAll")}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-[13.5px] text-dim">
          {t("notif.empty")}
        </p>
      ) : (
        <ul className="border-t border-line">
          {items.map((n) => {
            const body = (
              <>
                <span className="flex items-baseline gap-3">
                  {!n.read && (
                    <span
                      aria-label={t("notif.unread")}
                      className="size-[6px] shrink-0 translate-y-[-1px] rounded-none bg-amber"
                    />
                  )}
                  <span
                    className={n.read ? "text-[14px] text-mute" : "text-[14px] text-ink"}
                  >
                    {line(n)}
                  </span>
                  <time
                    dateTime={n.createdAt}
                    className="ml-auto shrink-0 font-mono text-[12px] text-dim"
                  >
                    {shortDate(n.createdAt)}
                  </time>
                </span>
                <span className="mt-1 block truncate pl-[18px] font-mono text-[12px] text-dim">
                  {n.postTitle ?? t("notif.deleted")}
                </span>
              </>
            );

            return (
              <li key={n.id} className="border-b border-line">
                {n.postId && n.board ? (
                  <Link
                    href={`/board/${n.board}/${n.postId}`}
                    onClick={() => open(n)}
                    className="block py-[13px] transition-colors hover:bg-panel"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="py-[13px]">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
