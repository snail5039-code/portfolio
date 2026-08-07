import {
  ClipboardList,
  LogOut,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import api from "../../lib/axios";

type Task = {
  id: number;
  title: string;
  className: string;
  description: string;
  dueDate: string;
  aiAllowed: boolean;
  createdAt: string;

  totalStudentCount: number;
  submittedCount: number;
  notSubmittedCount: number;
};

export default function TeacherPage() {
  const navigate = useNavigate();
  const loginId =
    typeof window !== "undefined" ? localStorage.getItem("loginId") ?? "" : "";
  const loginRole =
    typeof window !== "undefined" ? localStorage.getItem("loginRole") ?? "" : "";

  useEffect(() => {
    if (!loginId) {
      alert("로그인이 필요합니다.");
      navigate("/auth?mode=TEACHER");
      return;
    }

    if (loginRole !== "TEACHER") {
      alert("교사 계정만 접근할 수 있습니다.");
      navigate("/");
      return;
    }
  }, [loginId, loginRole, navigate]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState(
    typeof window !== "undefined" ? localStorage.getItem("loginName") ?? "" : ""
  );
  const [teacherSubject, setTeacherSubject] = useState(
    typeof window !== "undefined" ? localStorage.getItem("subject") ?? "" : ""
  );
  const [teacherManagedClasses, setTeacherManagedClasses] = useState(
    typeof window !== "undefined" ? localStorage.getItem("managedClasses") ?? "" : ""
  );

  useEffect(() => {
    const fetchTeacherProfile = async () => {
      if (!loginId || loginRole !== "TEACHER") return;

      try {
        const response = await api.get("/teacher/profile", {
          params: { loginId },
        });

        const data = response.data;
        setTeacherName(data?.name ?? "");
        setTeacherSubject(data?.subject ?? "");
        setTeacherManagedClasses(data?.managedClasses ?? "");

        localStorage.setItem("loginName", data?.name ?? "");
        localStorage.setItem("subject", data?.subject ?? "");
        localStorage.setItem("managedClasses", data?.managedClasses ?? "");
      } catch (error) {
        console.error("교사 프로필 조회 실패:", error);
      }
    };

    fetchTeacherProfile();
  }, [loginId, loginRole]);
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await api.get("/teacher/tasks", {
          params: { loginId },
        });
        setTasks(response.data ?? []);
      } catch (error) {
        console.error("과제 목록 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [loginId]);

  const handleLogout = () => {
    localStorage.removeItem("loginId");
    localStorage.removeItem("loginName");
    localStorage.removeItem("loginRole");
    localStorage.removeItem("className");
    localStorage.removeItem("subject");
    localStorage.removeItem("managedClasses");

    alert("로그아웃 되었습니다.");
    navigate("/");
  };

  const totalTaskCount = tasks.length;
  const aiAllowedTaskCount = tasks.filter((task) => task.aiAllowed).length;

  const totalSubmittedCount = useMemo(() => {
    return tasks.reduce((sum, task) => sum + (task.submittedCount ?? 0), 0);
  }, [tasks]);

  const totalNotSubmittedCount = useMemo(() => {
    return tasks.reduce((sum, task) => sum + (task.notSubmittedCount ?? 0), 0);
  }, [tasks]);

  const taskRows = useMemo(() => {
    return tasks.map((task) => {
      const totalStudentCount = task.totalStudentCount ?? 0;
      const submittedCount = task.submittedCount ?? 0;
      const notSubmittedCount = task.notSubmittedCount ?? 0;

      return {
        ...task,
        deadlineText: task.dueDate ? String(task.dueDate).slice(0, 10) : "-",
        submissionText: `${submittedCount} / ${totalStudentCount}`,
        submissionRateText:
          totalStudentCount > 0
            ? `${submittedCount} / ${totalStudentCount} (${Math.round(
              (submittedCount / totalStudentCount) * 100
            )}%)`
            : "-",
        statusText: notSubmittedCount === 0 ? "제출 완료" : "진행 중",
        statusClass:
          notSubmittedCount === 0
            ? "inline-block rounded-sm bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
            : "inline-block rounded-sm bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700",
      };
    });
  }, [tasks]);

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-5 py-6 md:px-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ✅ 상단 헤더 카드 */}
        <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-slate-400">
              TEACHER DASHBOARD
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              과제 관리
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              과제 생성, 제출 현황, AI 로그를 한눈에 관리합니다.
            </p>
          </div>

          <button
            onClick={() => navigate("/teacher/create-task")}
            className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            과제 등록
          </button>
        </section>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">

          {/* ✅ 사이드바 */}
          <aside className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold">
                T
              </div>
              <p className="mt-4 font-semibold text-slate-900">
                {teacherName || "교사"}
              </p>
              <p className="text-sm text-slate-500">
                {teacherSubject || "과목 미설정"}
              </p>
            </div>

            <div className="mt-6 space-y-2">
              <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
                과제 관리
              </button>

              <button
                onClick={() => navigate("/teacher/logs")}
                className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100"
              >
                AI 로그
              </button>

              <button
                onClick={() => navigate("/teacher/similarity")}
                className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100"
              >
                유사도 분석
              </button>

              <button
                onClick={() => navigate("/teacher/students")}
                className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100"
              >
                학생 관리
              </button>
            </div>

            <div className="mt-auto space-y-3 pt-6">
              <button
                onClick={() => navigate("/teacher/profile")}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                회원정보 수정
              </button>

              <button
                onClick={handleLogout}
                className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm text-white"
              >
                로그아웃
              </button>
            </div>
          </aside>

          {/* ✅ 메인 */}
          <main className="space-y-6">

            {/* 교사 정보 */}
            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">담당 정보</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">교사</p>
                  <p className="font-semibold text-slate-800">{teacherName}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">과목</p>
                  <p className="font-semibold text-slate-800">{teacherSubject}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">관리 반</p>
                  <p className="font-semibold text-slate-800">
                    {teacherManagedClasses || "-"}
                  </p>
                </div>
              </div>
            </section>

            {/* 통계 카드 */}
            <section className="grid gap-4 md:grid-cols-4">
              {[
                { title: "전체 과제", value: `${totalTaskCount}개` },
                { title: "제출 수", value: `${totalSubmittedCount}건` },
                { title: "미제출", value: `${totalNotSubmittedCount}건` },
                { title: "AI 허용", value: `${aiAllowedTaskCount}개` },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1"
                >
                  <p className="text-sm text-slate-500">{item.title}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {loading ? "-" : item.value}
                  </p>
                </div>
              ))}
            </section>

            {/* 과제 목록 */}
            <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex justify-between px-6 py-4 border-b">
                <h2 className="font-bold text-slate-900">과제 목록</h2>

                <button
                  onClick={() => navigate("/teacher/create-task")}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
                >
                  새 과제
                </button>
              </div>

              <div className="divide-y">
                {taskRows.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {task.title}
                      </p>
                      <p className="text-sm text-slate-500">
                        {task.className} · {task.deadlineText}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span>{task.submissionRateText}</span>

                      <span className={task.statusClass}>
                        {task.statusText}
                      </span>

                      <button
                        onClick={() =>
                          navigate(`/teacher/tasks/${task.id}`)
                        }
                        className="rounded-lg border px-3 py-2"
                      >
                        상세
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}