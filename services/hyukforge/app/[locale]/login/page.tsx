import { setRequestLocale } from "next-intl/server";
import { LoginPage } from "@/components/pages/LoginPage";

// error·next 쿼리를 읽으므로 요청마다 렌더한다
export const dynamic = "force-dynamic";

export default async function Login({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  return <LoginPage />;
}
