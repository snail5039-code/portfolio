import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
        로그인에 실패했어요
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        잠시 후 다시 시도해주세요.
      </p>
      <Link href="/" className="text-sm font-medium text-orange-500">
        홈으로 돌아가기
      </Link>
    </main>
  );
}
