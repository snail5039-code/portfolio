import { useEffect, useState } from "react";
import { getApprovals } from "../api/approvals";

/** Fired after an approve/reject call succeeds, so any mounted sidebar refreshes its count. */
export const APPROVALS_CHANGED_EVENT = "approvals:changed";

/**
 * Pending count for the sidebar's "승인 대기" badge. Fetches on mount and
 * whenever `APPROVALS_CHANGED_EVENT` fires elsewhere in the app. Failures are
 * swallowed to `null` (no badge) since this is a secondary nav decoration, not
 * a page's primary data load — a page's own fetch already surfaces backend
 * errors through `useFixture`.
 */
export function useApprovalsPendingCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    function load() {
      getApprovals()
        .then((envelope) => {
          if (!active) return;
          const pending = envelope.data.orders.filter((order) => order.decisionStatus === "pending").length;
          setCount(pending);
        })
        .catch(() => {
          if (active) setCount(null);
        });
    }

    load();
    window.addEventListener(APPROVALS_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(APPROVALS_CHANGED_EVENT, load);
    };
  }, []);

  return count;
}
