import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, locales } from "@/i18n/routing";

/**
 * 로그아웃. POST만 받는다.
 *
 * GET으로 열어두면 <img src="/auth/signout"> 같은 것만으로 남을 로그아웃시킬 수 있다.
 */
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const raw = String(form?.get("locale") ?? "");
  const locale = (locales as readonly string[]).includes(raw) ? raw : defaultLocale;

  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(`${origin}/${locale}`, { status: 303 });
}
