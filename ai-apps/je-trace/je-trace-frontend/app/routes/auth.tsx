import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, GraduationCap, School, ShieldCheck } from "lucide-react";
import api from "~/lib/axios";

type LoginResponse = { success: boolean; message: string; loginId: string | null; name: string | null; role: string | null; approved: boolean; className: string | null };

const modeInfo = {
  STUDENT: { label: "학생", number: "01", icon: GraduationCap, note: "나의 과제와 학습 기록을 이어서 확인합니다." },
  TEACHER: { label: "교사", number: "02", icon: School, note: "학생의 학습 흐름과 제출 기록을 검토합니다." },
  ADMIN: { label: "관리자", number: "03", icon: ShieldCheck, note: "승인 요청과 서비스 운영 상태를 관리합니다." },
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = useMemo<keyof typeof modeInfo>(() => {
    const value = searchParams.get("mode");
    return value === "TEACHER" || value === "ADMIN" ? value : "STUDENT";
  }, [searchParams]);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const info = modeInfo[mode];
  const ModeIcon = info.icon;

  const handlePreview = () => {
    const previewProfile = {
      STUDENT: { id: "preview-student", name: "미리보기 학생", className: "1학년 1반" },
      TEACHER: { id: "preview-teacher", name: "미리보기 교사", className: "" },
      ADMIN: { id: "preview-admin", name: "미리보기 관리자", className: "" },
    }[mode];

    localStorage.setItem("previewMode", "true");
    localStorage.setItem("loginId", previewProfile.id);
    localStorage.setItem("loginName", previewProfile.name);
    localStorage.setItem("loginRole", mode);
    localStorage.setItem("className", previewProfile.className);
    localStorage.setItem("approved", "true");
    localStorage.setItem("subject", mode === "TEACHER" ? "정보" : "");
    localStorage.setItem("managedClasses", mode === "TEACHER" ? "1학년 1반,1학년 2반" : "");

    navigate(mode === "ADMIN" ? "/admin" : mode === "TEACHER" ? "/teacher" : "/student");
  };

  const handleLogin = async () => {
    if (!loginId.trim() || !password.trim()) { alert(!loginId.trim() ? "아이디를 입력하세요." : "비밀번호를 입력하세요."); return; }
    try {
      setLoading(true);
      const { data } = await api.post<LoginResponse>("/auth/login", { loginId, password });
      if (!data.success) { alert(data.message || "로그인에 실패했습니다."); return; }
      if (data.role !== mode) {
        await api.post("/auth/logout");
        alert(`${info.label} 계정이 아닙니다.`);
        return;
      }
      localStorage.setItem("loginId", data.loginId ?? "");
      localStorage.setItem("loginName", data.name ?? "");
      localStorage.setItem("loginRole", data.role ?? "");
      localStorage.setItem("className", data.className ?? "");
      localStorage.setItem("approved", String(Boolean(data.approved)));
      if (data.role === "ADMIN") navigate("/admin");
      else if (data.role === "TEACHER") navigate("/teacher");
      else { if (!data.approved) alert("아직 승인 대기 중인 학생 계정입니다."); navigate("/student"); }
    } catch (error: any) {
      alert(error?.response?.data?.message || "로그인 중 오류가 발생했습니다.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#f3f0e8] text-[#17201c]">
      <header className="border-b border-[#17201c]/20">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center bg-[#17201c] text-xs font-bold text-[#f3f0e8]">JE</span><span className="text-[15px] font-bold">J·E TRACE</span></Link>
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />홈으로</Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-80px)] max-w-[1240px] border-x border-[#17201c]/20 lg:grid-cols-[0.82fr_1.18fr]">
        <aside className="flex flex-col justify-between border-b border-[#17201c]/20 bg-[#dce7df] p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
          <div>
            <div className="flex items-center gap-3 text-xs font-bold tracking-[0.15em] text-[#33705b]"><ModeIcon className="h-5 w-5" strokeWidth={1.7} /> {info.number} / {mode}</div>
            <h1 className="mt-10 font-serif text-5xl leading-[1.08] tracking-[-0.045em] sm:text-6xl">기록을<br />이어서 엽니다.</h1>
            <p className="mt-7 max-w-sm text-base leading-8 text-[#4d5953]">{info.note}</p>
          </div>
          <div className="mt-14 border-t border-[#17201c]/25 pt-6">
            <p className="font-serif text-lg italic text-[#33705b]">“과정은 사라지지 않고, 다음 배움의 근거가 됩니다.”</p>
            <p className="mt-4 text-xs text-[#65706a]">J·E TRACE · LEARNING ARCHIVE</p>
          </div>
        </aside>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-16">
          <div className="w-full max-w-lg">
            <div className="flex items-end justify-between border-b border-[#17201c] pb-5">
              <div><p className="text-xs font-bold tracking-[0.15em] text-[#33705b]">SIGN IN</p><h2 className="mt-3 font-serif text-4xl tracking-[-0.035em]">{info.label} 로그인</h2></div>
              <span className="font-mono text-xs text-[#747e78]">{info.number}</span>
            </div>

            <div className="mt-9 space-y-7">
              <label className="block"><span className="mb-3 block text-sm font-bold">아이디</span><input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="아이디를 입력하세요" autoComplete="username" className="w-full border-0 border-b border-[#17201c]/35 bg-transparent px-0 py-3 text-base outline-none transition placeholder:text-[#8c948f] focus:border-[#33705b]" /></label>
              <label className="block"><span className="mb-3 block text-sm font-bold">비밀번호</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="비밀번호를 입력하세요" autoComplete="current-password" className="w-full border-0 border-b border-[#17201c]/35 bg-transparent px-0 py-3 text-base outline-none transition placeholder:text-[#8c948f] focus:border-[#33705b]" /></label>
            </div>

            <button onClick={handleLogin} disabled={loading} className="group mt-10 flex w-full items-center justify-between bg-[#17201c] px-6 py-5 text-left text-sm font-bold text-[#f3f0e8] transition-colors hover:bg-[#285442] disabled:opacity-60"><span>{loading ? "기록을 여는 중..." : "로그인하고 기록 열기"}</span><ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></button>

            {import.meta.env.DEV && (
              <button onClick={handlePreview} className="mt-3 flex w-full items-center justify-between border border-[#33705b]/45 bg-[#dce7df] px-6 py-4 text-left text-sm font-bold text-[#285442] transition-colors hover:bg-[#cbded1]">
                <span>로그인 없이 {info.label} 화면 미리보기</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            )}

            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 text-sm">
              {mode !== "ADMIN" ? <Link to={`/signup?mode=${mode}`} className="border-b border-[#17201c]/40 pb-1 font-semibold">처음 방문하셨나요? 회원가입</Link> : <span />}
              <div className="flex gap-4 text-[#65706a]">{Object.entries(modeInfo).filter(([key]) => key !== mode).map(([key, value]) => <Link key={key} to={`/auth?mode=${key}`} className="hover:text-[#17201c]">{value.label}</Link>)}</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
