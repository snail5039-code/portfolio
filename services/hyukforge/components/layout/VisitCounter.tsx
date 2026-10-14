"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const KEY = "hf.visit";

/**
 * 방문 한 건을 알린다. 그리는 것은 없다.
 *
 * 서버에서 세지 않는 이유
 *   화면 대부분이 정적으로 만들어져 재생성될 때만 서버가 돈다. 거기서 세면
 *   사람이 아니라 빌드를 세게 된다. 그래서 브라우저가 한 번 알린다.
 *
 * 한 세션에 한 번만 보낸다. 같은 사람이 하루에 몇 번 왔는지까지는
 * 서버가 쿠키로 가른다 (app/api/visit/route.ts).
 */
export function VisitCounter() {
  const pathname = usePathname();
  const sent = useRef(false);

  useEffect(() => {
    // 관리자 화면과 목업(/preview)은 방문이 아니다. 내가 보는 것까지 세면 숫자가 거짓이 된다.
    if (/\/(admin|preview)(\/|$)/.test(pathname)) return;
    if (sent.current) return;

    try {
      if (sessionStorage.getItem(KEY)) {
        sent.current = true;
        return;
      }
      sessionStorage.setItem(KEY, "1");
    } catch {
      // 사생활 보호 모드에서는 sessionStorage 가 막힌다.
      // 그때도 이 탭에서 한 번은 보내도록 ref 로만 막는다.
    }

    sent.current = true;
    // 실패해도 알릴 것이 없다. 숫자가 하나 덜 세어질 뿐이다.
    fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => {});
  }, [pathname]);

  return null;
}
