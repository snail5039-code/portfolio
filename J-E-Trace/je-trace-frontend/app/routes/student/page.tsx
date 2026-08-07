import {
  BookOpen,
  ClipboardList,
  LogOut,
  UserCircle,
  Sparkles,
  GraduationCap,
  ChevronRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import api from "../../lib/axios";

type RecentLog = {
  id: number;
  taskId: number;
  studentName: string;
  question: string;
  answer: string;
  createdAt: string;
  status: string;
};

type MyPageSummary = {
  submittedCount: number;
  notSubmittedCount: number;
  recentLogs: RecentLog[];
};

export default function HomePage() {
  const navigate = useNavigate();

  const [loginId, setLoginId] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginRole, setLoginRole] = useState("");
  const [className, setClassName] = useState("");
  const [approved, setApproved] = useState(false);
  const [summary, setSummary] = useState<MyPageSummary>({
    submittedCount: 0,
    notSubmittedCount: 0,
    recentLogs: [],
  });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState("");

  useEffect(() => {
    setLoginId(localStorage.getItem("loginId") ?? "");
    setLoginName(localStorage.getItem("loginName") ?? "");
    setLoginRole(localStorage.getItem("loginRole") ?? "");
    setClassName(localStorage.getItem("className") ?? "");
    setApproved((localStorage.getItem("approved") ?? "false") === "true");
  }, []);

  const isLoggedIn = useMemo(() => {
    return !!loginId && loginRole === "STUDENT";
  }, [loginId, loginRole]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!loginId || loginRole !== "STUDENT") {
        setSummary({
          submittedCount: 0,
          notSubmittedCount: 0,
          recentLogs: [],
        });
        setBlockedMessage("");
        return;
      }

      if (!approved) {
        setSummary({
          submittedCount: 0,
          notSubmittedCount: 0,
          recentLogs: [],
        });
        setBlockedMessage(
          "아직 승인 대기 중인 학생 계정입니다. 학생 관리에서 교사가 승인하면 과제와 제출 기능을 사용할 수 있습니다."
        );
        return;
      }

      try {
        setSummaryLoading(true);

        const res = await api.get("/student/tasks/summary", {
          params: { loginId },
        });

        setSummary({
          submittedCount: res.data?.submittedCount ?? 0,
          notSubmittedCount: res.data?.notSubmittedCount ?? 0,
          recentLogs: res.data?.recentLogs ?? [],
        });
        setBlockedMessage("");
      } catch (error: any) {
        console.error(error);
        setSummary({
          submittedCount: 0,
          notSubmittedCount: 0,
          recentLogs: [],
        });
        setBlockedMessage(
          error?.response?.data?.message ||
            "아직 승인 대기 중인 학생 계정입니다. 교사 승인 후 과제를 확인할 수 있습니다."
        );
      } finally {
        setSummaryLoading(false);
      }
    };

    fetchSummary();
  }, [loginId, loginRole, approved]);

  const handleLogout = () => {
    localStorage.removeItem("loginId");
    localStorage.removeItem("loginName");
    localStorage.removeItem("loginRole");
    localStorage.removeItem("className");
    localStorage.removeItem("approved");

    alert("로그아웃 되었습니다.");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-[#f8fafc] to-blue-50 px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="relative px-6 py-8 md:px-10 md:py-10">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-slate-200/70 blur-3xl" />

            <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  <Sparkles size={16} />
                  STUDENT MY PAGE
                </div>

                <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
                  학생 마이페이지
                </h1>

                <p className="mt-4 text-sm leading-7 text-slate-600 md:text-lg">
                  내 정보, 과제 제출 현황, 최근 학습 기록을 한눈에 확인할 수
                  있습니다.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                    <GraduationCap size={16} />
                    학습 관리
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                    <ClipboardList size={16} />
                    제출 현황 확인
                  </div>
                </div>
              </div>

              <div className="relative">
                {isLoggedIn ? (
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    <LogOut size={18} />
                    로그아웃
                  </button>
                ) : (
                  <Link
                    to="/auth?mode=STUDENT"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    로그인하러 가기
                    <ChevronRight size={18} />
                  </Link>
                )}
              </div>
            </div>

            {blockedMessage && (
              <div className="relative mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-700">
                {blockedMessage}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)] md:p-7">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-slate-100 text-slate-700 ring-1 ring-slate-200">
                <UserCircle size={30} />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-500">
                  MY PROFILE
                </p>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">
                  프로필
                </h2>
              </div>
            </div>

            {isLoggedIn ? (
              <div className="mt-7 space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                  <p className="text-sm font-semibold text-slate-400">이름</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {loginName || "-"}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                  <p className="text-sm font-semibold text-slate-400">아이디</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {loginId || "-"}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                  <p className="text-sm font-semibold text-slate-400">반</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {className || "-"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="text-sm leading-6 text-slate-600">
                  로그인 후 학생 정보가 표시됩니다.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)] md:p-7">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 text-slate-700 ring-1 ring-slate-200">
                <ClipboardList size={28} />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-500">
                  TASK & LEARNING
                </p>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">
                  과제 / 학습 메뉴
                </h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
              과제 목록 조회와 최근 학습 기록, 제출 현황을 확인할 수 있습니다.
            </p>

            <div className="mt-7">
              <Link
                to={blockedMessage ? "#" : "/student/assignments"}
                onClick={(e) => {
                  if (blockedMessage) {
                    e.preventDefault();
                    alert(blockedMessage);
                  }
                }}
                className={`group relative block overflow-hidden rounded-[28px] p-6 shadow-xl transition ${
                  blockedMessage
                    ? "cursor-not-allowed bg-slate-300 text-slate-500 shadow-none"
                    : "bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white shadow-slate-900/10 hover:-translate-y-1"
                }`}
              >
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute bottom-0 right-0 h-20 w-20 rounded-full bg-blue-400/10 blur-2xl" />

                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                        <BookOpen size={22} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold tracking-[0.18em] text-white/70">
                          ASSIGNMENTS
                        </p>
                        <h3 className="mt-1 text-2xl font-black tracking-tight">
                          과제 목록 바로가기
                        </h3>
                      </div>
                    </div>

                    <p className="mt-4 max-w-xl text-sm leading-7 text-white/80 md:text-base">
                      과제를 확인하고 제출 현황과 점수를 빠르게 살펴볼 수 있습니다.
                    </p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 transition group-hover:translate-x-0.5">
                    <ChevronRight size={22} />
                  </div>
                </div>
              </Link>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-400">제출 완료</p>
                <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                  {summaryLoading ? "-" : summary.submittedCount}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-400">미제출</p>
                <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                  {summaryLoading ? "-" : summary.notSubmittedCount}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-[26px] border border-slate-200 bg-slate-50/70 p-5 md:p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    RECENT ACTIVITY
                  </p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                    최근 AI 학습 로그
                  </h3>
                </div>
              </div>

              {summary.recentLogs.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-5 text-sm leading-7 text-slate-500">
                  최근 AI 로그가 없습니다.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {summary.recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-3xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm font-bold text-slate-900">
                          과제 #{log.taskId}
                        </p>
                        <span className="text-xs font-medium text-slate-400">
                          {log.createdAt}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                        Q. {log.question}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}