import { createClient } from "@/lib/supabase/server";
import OAuthLoginButton from "@/components/OAuthLoginButton";
import NewPostForm from "@/components/NewPostForm";

export default async function NewPostPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-lg font-bold text-foreground">
          로그인이 필요한 페이지예요
        </h1>
        <p className="text-[13px] text-muted">
          글을 쓰려면 먼저 로그인해주세요.
        </p>
        <div className="flex w-full flex-col gap-2">
          <OAuthLoginButton provider="kakao" fullWidth />
          <OAuthLoginButton provider="google" fullWidth />
        </div>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-[22px] font-bold tracking-tight text-foreground">
        글쓰기
      </h1>
      <NewPostForm isAdmin={isAdmin} userId={user.id} />
    </main>
  );
}
