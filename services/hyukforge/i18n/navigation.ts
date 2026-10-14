import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * 언어 접두사를 알아서 붙여주는 이동 도구.
 * next/link 대신 여기의 Link를 쓴다. `/products`라고 쓰면 `/ko/products`로 나간다.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
