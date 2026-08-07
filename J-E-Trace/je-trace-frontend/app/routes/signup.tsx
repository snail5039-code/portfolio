import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import api from "~/lib/axios";

const STUDENT_CLASS_OPTIONS = ["선택하세요", "A", "B", "C", "D"];
const TEACHER_CLASS_OPTIONS = ["A", "B", "C", "D"];

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const mode = useMemo(() => {
    const value = searchParams.get("mode");
    return value === "TEACHER" ? "TEACHER" : "STUDENT";
  }, [searchParams]);

  const modeLabel = mode === "TEACHER" ? "교사" : "학생";

  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [className, setClassName] = useState("선택하세요");
  const [subject, setSubject] = useState("");
  const [managedClasses, setManagedClasses] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [checkingLoginId, setCheckingLoginId] = useState(false);
  const [isLoginIdChecked, setIsLoginIdChecked] = useState(false);
  const [isLoginIdAvailable, setIsLoginIdAvailable] = useState(false);

  const toggleManagedClass = (value: string) => {
    setManagedClasses((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const handleCheckLoginId = async () => {
    if (!loginId.trim()) {
      alert("아이디를 입력하세요.");
      return;
    }

    try {
      setCheckingLoginId(true);

      const response = await api.get("/auth/check-login-id", {
        params: { loginId: loginId.trim() },
      });

      const available =
        response.data === true || response.data?.available === true;

      setIsLoginIdChecked(true);
      setIsLoginIdAvailable(available);

      if (available) {
        alert("사용 가능한 아이디입니다.");
      } else {
        alert("이미 사용 중인 아이디입니다.");
      }
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.message || "중복확인 중 오류가 발생했습니다.");
    } finally {
      setCheckingLoginId(false);
    }
  };

  const handleSignup = async () => {
    if (!loginId.trim()) {
      alert("아이디를 입력하세요.");
      return;
    }

    if (!isLoginIdChecked || !isLoginIdAvailable) {
      alert("아이디 중복확인을 완료하세요.");
      return;
    }

    if (!email.trim()) {
      alert("이메일을 입력하세요.");
      return;
    }

    if (!password.trim()) {
      alert("비밀번호를 입력하세요.");
      return;
    }

    if (!passwordConfirm.trim()) {
      alert("비밀번호 확인을 입력하세요.");
      return;
    }

    if (password !== passwordConfirm) {
      alert("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (!name.trim()) {
      alert("이름을 입력하세요.");
      return;
    }

    if (mode === "STUDENT" && className === "선택하세요") {
      alert("반을 선택하세요.");
      return;
    }

    if (mode === "TEACHER" && !subject.trim()) {
      alert("담당 과목을 입력하세요.");
      return;
    }

    if (mode === "TEACHER" && managedClasses.length === 0) {
      alert("관리 반을 하나 이상 선택하세요.");
      return;
    }

    try {
      setLoading(true);

      await api.post("/auth/signup", {
        loginId: loginId.trim(),
        email: email.trim(),
        password,
        name: name.trim(),
        role: mode,
        className: mode === "STUDENT" ? className : null,
        subject: mode === "TEACHER" ? subject.trim() : null,
        managedClasses: mode === "TEACHER" ? managedClasses.join(",") : null,
      });

      if (mode === "TEACHER") {
        alert("교사 회원가입 완료. 관리자 승인 후 로그인 가능합니다.");
      } else {
        alert("회원가입 완료");
      }

      navigate(`/auth?mode=${mode}`);
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.message || "회원가입 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const isPasswordMatched =
    passwordConfirm.trim() && password === passwordConfirm;

  const modeIcon =
    mode === "TEACHER" ? (
      <GraduationCap size={20} />
    ) : (
      <UserRound size={20} />
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.10)] lg:grid-cols-[1.02fr_0.98fr]">
        <div className="relative hidden overflow-hidden bg-slate-900 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.10),transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between p-10 text-white">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold">
                {modeIcon}
                {modeLabel} 회원가입
              </div>

              <h1 className="mt-8 text-4xl font-black leading-tight">
                새 {modeLabel} 계정 생성
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
                입력 영역을 더 정돈하고, 정보 구조가 잘 보이도록 회원가입
                화면만 디자인 개선한 버전이다.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm font-semibold text-slate-300">
                  가입 안내
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  교사 계정은 회원가입 후 관리자 승인 완료 시 로그인할 수
                  있습니다.
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
          <div className="w-full max-w-xl">
            <div className="mb-8 lg:hidden">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                {modeIcon}
                {modeLabel} 회원가입
              </div>
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
                Sign Up
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                {modeLabel} 회원가입
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {modeLabel} 계정을 생성하세요.
              </p>
            </div>

            <div className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  아이디
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={loginId}
                    onChange={(e) => {
                      setLoginId(e.target.value);
                      setIsLoginIdChecked(false);
                      setIsLoginIdAvailable(false);
                    }}
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                    placeholder="아이디 입력"
                  />

                  <button
                    type="button"
                    onClick={handleCheckLoginId}
                    disabled={checkingLoginId}
                    className="rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {checkingLoginId ? "확인 중..." : "중복확인"}
                  </button>
                </div>

                {isLoginIdChecked && (
                  <p
                    className={`mt-2 text-sm font-medium ${
                      isLoginIdAvailable ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {isLoginIdAvailable
                      ? "사용 가능한 아이디입니다."
                      : "이미 사용 중인 아이디입니다."}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                  placeholder="이메일 입력"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    비밀번호
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                    placeholder="비밀번호 입력"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    비밀번호 확인
                  </label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                    placeholder="비밀번호 다시 입력"
                  />
                </div>
              </div>

              {passwordConfirm.trim() && (
                <div
                  className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    password === passwordConfirm
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                  }`}
                >
                  <CheckCircle2 size={16} />
                  {password === passwordConfirm
                    ? "비밀번호가 일치합니다."
                    : "비밀번호가 일치하지 않습니다."}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  이름
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                  placeholder="이름 입력"
                />
              </div>

              {mode === "STUDENT" && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    반
                  </label>
                  <select
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                  >
                    {STUDENT_CLASS_OPTIONS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        disabled={option === "선택하세요"}
                      >
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {mode === "TEACHER" && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      담당 과목
                    </label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                      placeholder="담당 과목 입력"
                    />
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-700">
                      관리 반
                    </label>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {TEACHER_CLASS_OPTIONS.map((option) => {
                        const checked = managedClasses.includes(option);

                        return (
                          <label
                            key={option}
                            className={`flex cursor-pointer items-center justify-center rounded-2xl border px-4 py-3.5 text-sm font-bold transition ${
                              checked
                                ? "border-slate-900 bg-slate-900 text-white shadow-md"
                                : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleManagedClass(option)}
                              className="hidden"
                            />
                            {option}반
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={handleSignup}
                disabled={
                  loading ||
                  !isLoginIdChecked ||
                  !isLoginIdAvailable ||
                  !passwordConfirm.trim() ||
                  password !== passwordConfirm
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:opacity-60"
              >
                <UserPlus size={18} />
                {loading ? "처리 중..." : "회원가입"}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  to={`/auth?mode=${mode}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  로그인으로
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
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