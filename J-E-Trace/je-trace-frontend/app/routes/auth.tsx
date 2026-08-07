import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  GraduationCap,
  LogIn,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import api from "~/lib/axios";

type LoginResponse = {
  success: boolean;
  message: string;
  loginId: string | null;
  name: string | null;
  role: string | null;
  approved: boolean;
  className: string | null;
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const mode = useMemo(() => {
    const value = searchParams.get("mode");
    if (value === "TEACHER") return "TEACHER";
    if (value === "ADMIN") return "ADMIN";
    return "STUDENT";
  }, [searchParams]);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const modeLabel =
    mode === "TEACHER" ? "교사" : mode === "ADMIN" ? "관리자" : "학생";

  const handleLogin = async () => {
    if (!loginId.trim()) {
      alert("아이디를 입력하세요.");
      return;
    }

    if (!password.trim()) {
      alert("비밀번호를 입력하세요.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post<LoginResponse>("/auth/login", {
        loginId,
        password,
      });

      const data = response.data;

      if (!data.success) {
        alert(data.message || "로그인에 실패했습니다.");
        return;
      }

      if (data.role !== mode) {
        alert(`${modeLabel} 계정이 아닙니다.`);
        return;
      }

      localStorage.setItem("loginId", data.loginId ?? "");
      localStorage.setItem("loginName", data.name ?? "");
      localStorage.setItem("loginRole", data.role ?? "");
      localStorage.setItem("className", data.className ?? "");
      localStorage.setItem("approved", String(Boolean(data.approved)));

      if (data.role === "ADMIN") {
        navigate("/admin");
        return;
      }

      if (data.role === "TEACHER") {
        navigate("/teacher");
        return;
      }

      if (!data.approved) {
        alert("아직 승인 대기 중인 학생 계정입니다. 교사 승인 후 과제를 확인할 수 있습니다.");
      }

      navigate("/student");
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const modeIcon =
    mode === "TEACHER" ? (
      <GraduationCap size={20} />
    ) : mode === "ADMIN" ? (
      <ShieldCheck size={20} />
    ) : (
      <UserRound size={20} />
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.10)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden bg-slate-900 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.10),transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between p-10 text-white">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold">
                {modeIcon}
                {modeLabel} 모드
              </div>

              <h1 className="mt-8 text-4xl font-black leading-tight">
                JE Trace
                <br />
                {modeLabel} 로그인
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
                깔끔한 학습 관리 화면으로 바로 진입할 수 있도록 로그인 화면을
                정리했습니다.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm font-semibold text-slate-300">
                  빠른 안내
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  선택한 모드와 실제 계정 권한이 다르면 로그인되지 않습니다.
                </p>
              </div>

              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                <ArrowLeft size={16} />
                홈으로 돌아가기
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                {modeIcon}
                {modeLabel} 모드
              </div>
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
                Login
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                {modeLabel} 로그인
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {modeLabel} 계정으로 로그인하세요.
              </p>
            </div>

            <div className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  아이디
                </label>
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                  placeholder="아이디 입력"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                  placeholder="비밀번호 입력"
                />
              </div>

              <button
                onClick={handleLogin}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:opacity-60"
              >
                <LogIn size={18} />
                {loading ? "로그인 중..." : "로그인"}
              </button>

              <div className="grid grid-cols-2 gap-3">
                {mode !== "ADMIN" && (
                  <Link
                    to={
                      mode === "STUDENT"
                        ? "/signup?mode=STUDENT"
                        : "/signup?mode=TEACHER"
                    }
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    회원가입
                  </Link>
                )}

                <Link
                  to="/"
                  className={`inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 ${
                    mode === "ADMIN" ? "col-span-2" : ""
                  }`}
                >
                  홈으로
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}