import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  FileText,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "../../lib/axios";

type Task = {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  submitted: boolean;
  aiAllowed: boolean;
  score: number | null;
};

export default function AssignmentsPage() {
  const navigate = useNavigate();

  const loginId =
    typeof window !== "undefined" ? localStorage.getItem("loginId") ?? "" : "";
  const loginRole =
    typeof window !== "undefined" ? localStorage.getItem("loginRole") ?? "" : "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState("");

  useEffect(() => {
    if (!loginId) {
      alert("로그인이 필요합니다.");
      navigate("/auth?mode=STUDENT");
      return;
    }

    if (loginRole !== "STUDENT") {
      alert("학생 계정만 접근할 수 있습니다.");
      navigate("/");
    }
  }, [loginId, loginRole, navigate]);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!loginId || loginRole !== "STUDENT") {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get("/student/tasks", {
          params: { loginId },
        });
        setTasks(res.data ?? []);
        setBlockedMessage("");
      } catch (error: any) {
        console.error(error);
        setTasks([]);
        setBlockedMessage(
          error?.response?.data?.message ||
            "아직 승인 대기 중인 학생 계정입니다. 교사 승인 후 과제를 확인할 수 있습니다."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [loginId, loginRole]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 py-8 sm:px-6">
      <main className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="relative px-6 py-8 sm:px-8 sm:py-9">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-slate-200/70 blur-3xl" />

            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  <Sparkles size={16} />
                  ASSIGNMENT LIST
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                  과제 목록
                </h1>
                <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">
                  진행 중인 과제를 확인하고 제출 상태를 관리하세요.
                </p>
              </div>

              <Link
                to="/student"
                className="inline-flex items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                학생 페이지
              </Link>
            </div>
          </div>
        </section>

        {loading && (
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            불러오는 중...
          </div>
        )}

        {!loading && blockedMessage && (
          <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-6 py-14 text-center shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <FileText size={28} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-amber-900">
              아직 승인 대기 중입니다
            </h2>
            <p className="mt-2 text-sm leading-6 text-amber-700">
              {blockedMessage}
            </p>
          </div>
        )}

        {!loading && !blockedMessage && tasks.length === 0 && (
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-white px-6 py-14 text-center shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <FileText size={28} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              표시할 과제가 없습니다
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              현재 확인 가능한 과제가 아직 없거나 불러오지 못했습니다.
            </p>
          </div>
        )}

        {!loading && !blockedMessage && tasks.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-7">
              <div className="grid grid-cols-12 gap-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                <div className="col-span-12 md:col-span-5">과제 정보</div>
                <div className="col-span-4 md:col-span-2">상태</div>
                <div className="col-span-4 md:col-span-2">점수</div>
                <div className="col-span-4 md:col-span-2">AI 사용</div>
                <div className="hidden md:col-span-1 md:block text-right">이동</div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const dueTime = new Date(task.dueDate).getTime();
                const isUrgent =
                  dueTime - new Date().getTime() < 3 * 24 * 60 * 60 * 1000;

                const statusText = task.submitted
                  ? "제출 완료"
                  : isUrgent
                  ? "마감 임박"
                  : "진행 중";

                const statusClassName = task.submitted
                  ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
                  : isUrgent
                  ? "bg-rose-50 text-rose-500 ring-1 ring-rose-100"
                  : "bg-blue-50 text-blue-600 ring-1 ring-blue-100";

                return (
                  <Link
                    key={task.id}
                    to={`/student/assignment/${task.id}`}
                    className="block transition hover:bg-slate-50/80"
                  >
                    <div className="px-5 py-5 sm:px-7">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-12 md:col-span-5">
                          <div className="flex items-start gap-4">
                            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                              <FileText size={20} />
                            </div>

                            <div className="min-w-0">
                              <h2 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                                {task.title}
                              </h2>
                              <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                <CalendarDays size={15} />
                                <span className="truncate">
                                  마감일 {task.dueDate}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="col-span-4 md:col-span-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${statusClassName}`}
                          >
                            {statusText}
                          </span>
                        </div>

                        <div className="col-span-4 md:col-span-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {task.score == null ? "미입력" : `${task.score}점`}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            현재 점수
                          </div>
                        </div>

                        <div className="col-span-4 md:col-span-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {task.aiAllowed ? "허용" : "금지"}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            AI 사용
                          </div>
                        </div>

                        <div className="col-span-12 md:col-span-1">
                          <div className="flex justify-end">
                            <div className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition group-hover:bg-slate-800">
                              보기
                              <ChevronRight size={14} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}