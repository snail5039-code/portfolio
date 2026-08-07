import { ArrowLeft, FileText, Search, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import api from "../../lib/axios";
import axios from "axios";

type TaskDetail = {
  id: number;
  title: string;
  className: string;
  description: string;
  dueDate: string;
  aiAllowed: boolean;
  createdAt: string;
};

type TaskSubmission = {
  id: number;
  taskId: number;
  studentName: string;
  submitted: boolean;
  submittedAt: string | null;
  aiUsed: boolean;
  result: string | null;
  content: string | null;
  score: number;
  teacherComment: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  approvedStudent?: boolean;
};

type Notice = {
  type: "success" | "error" | "info";
  text: string;
} | null;

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data ||
      error.message ||
      fallback
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}

function getResultBadgeClass(result: string | null | undefined) {
  if (!result) return "bg-slate-100 text-slate-500";
  if (result.includes("복사") || result.includes("위험")) return "bg-rose-50 text-rose-700";
  if (result.includes("일부") || result.includes("주의")) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export default function TeacherTaskDetailPage() {
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
  const { taskId } = useParams();

  const [assignment, setAssignment] = useState<TaskDetail | null>(null);
  const [students, setStudents] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSimilarity, setRunningSimilarity] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [teacherName, setTeacherName] = useState(
    typeof window !== "undefined" ? localStorage.getItem("loginName") ?? "" : ""
  );
  const [teacherSubject, setTeacherSubject] = useState(
    typeof window !== "undefined" ? localStorage.getItem("subject") ?? "" : ""
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

        localStorage.setItem("loginName", data?.name ?? "");
        localStorage.setItem("subject", data?.subject ?? "");
      } catch (error) {
        console.error("교사 프로필 조회 실패:", error);
      }
    };

    fetchTeacherProfile();
  }, [loginId, loginRole]);
  const fetchData = async () => {
    if (!taskId) return;

    try {
      const [taskResponse, studentResponse] = await Promise.all([
        api.get(`/teacher/tasks/${taskId}`, { params: { loginId } }),
        api.get(`/teacher/tasks/${taskId}/taskSubmissions`, { params: { loginId } }),
      ]);

      setAssignment(taskResponse.data);
      setStudents(studentResponse.data);
    } catch (error) {
      console.error("과제 상세 조회 실패:", error);
      setNotice({
        type: "error",
        text: getErrorMessage(error, "과제 상세 조회 실패"),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [taskId, loginId]);

  const handleRunSimilarityAnalysis = async () => {
    if (!taskId) return;

    setRunningSimilarity(true);
    setNotice({ type: "info", text: "유사도 분석 실행 중..." });

    try {
      await api.post(`/teacher/tasks/${taskId}/similarity/run`, null, { params: { loginId } });
      await fetchData();

      setNotice({
        type: "success",
        text: "유사도 분석 완료",
      });
    } catch (error) {
      console.error("유사도 분석 실행 실패:", error);
      setNotice({
        type: "error",
        text: getErrorMessage(error, "유사도 분석 실행 실패"),
      });
    } finally {
      setRunningSimilarity(false);
    }
  };

  const submittedCount = useMemo(
    () => students.filter((student) => student.submitted).length,
    [students]
  );

  const notSubmittedCount = students.length - submittedCount;

  const aiUsedCount = useMemo(
    () => students.filter((student) => student.aiUsed).length,
    [students]
  );

  const noticeClassName = useMemo(() => {
    if (!notice) return "";
    if (notice.type === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (notice.type === "error") return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-sky-200 bg-sky-50 text-sky-700";
  }, [notice]);

  if (loading) {
    return <div className="p-6">과제 정보를 불러오는 중...</div>;
  }

  if (!assignment) {
    return <div className="p-6">과제 정보를 찾을 수 없습니다.</div>;
  }

return (
  <div className="min-h-screen bg-[#f5f7fb] px-5 py-6 md:px-8">
    <div className="mx-auto max-w-7xl space-y-6">

      {/* ✅ 헤더 */}
      <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-slate-400">
            TEACHER SYSTEM
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            제출 현황 확인
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            학생 제출 상태 및 AI 사용 여부를 확인합니다.
          </p>
        </div>

        <button
          onClick={() => navigate("/teacher")}
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
        >
          과제 목록
        </button>
      </section>

      {notice && (
        <div className={`rounded-xl border px-5 py-4 text-sm font-medium ${noticeClassName}`}>
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">

        {/* ✅ 사이드바 */}
        <aside className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold">
              T
            </div>
            <p className="mt-4 font-semibold text-slate-900">{teacherName || "교사"}</p>
            <p className="text-sm text-slate-500">
              {teacherSubject ? `${teacherSubject} 수업 담당` : "담당 과목 미설정"}
            </p>
          </div>

          <div className="mt-6 space-y-2">
            <button
              onClick={() => navigate("/teacher")}
              className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100"
            >
              과제 목록으로
            </button>

            <button
              onClick={() => navigate("/teacher/logs")}
              className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100"
            >
              AI 로그 확인
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
        </aside>

        {/* ✅ 메인 */}
        <main className="space-y-6">

          {/* 과제 정보 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-slate-900">과제 정보</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4">
              {[
                ["과제명", assignment.title],
                ["대상 반", assignment.className],
                ["마감일", assignment.dueDate?.slice(0, 10)],
                ["AI 허용", assignment.aiAllowed ? "허용" : "비허용"],
              ].map(([label, value], i) => (
                <div key={i} className="p-4 border-b md:border-r last:border-r-0">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 text-sm text-slate-600">
              {assignment.description || "과제 설명이 없습니다."}
            </div>
          </section>

          {/* 요약 카드 */}
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">제출 완료</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{submittedCount}명</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">미제출</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{notSubmittedCount}명</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">AI 사용</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{aiUsedCount}명</p>
            </div>
          </section>

          {/* 학생 목록 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 px-6 py-4 border-b sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-bold text-slate-900">학생 제출 목록</h2>

              <div className="flex gap-2">
                <button
                  onClick={handleRunSimilarityAnalysis}
                  disabled={runningSimilarity}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {runningSimilarity ? "분석 실행 중..." : "유사도 분석 실행"}
                </button>

                <button
                  onClick={() => navigate("/teacher/similarity")}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  결과 보기
                </button>
              </div>
            </div>

            <div className="divide-y">
              {students.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-400">
                  등록된 학생 제출 데이터가 없습니다.
                </div>
              ) : (
                students.map((student) => (
                  <div
                    key={student.id}
                    className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between hover:bg-slate-50"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">{student.studentName}</p>
                      <p className="text-xs text-slate-500">
                        {student.submitted ? "제출 완료" : "미제출"} ·{" "}
                        {student.aiUsed ? "AI 사용" : "AI 미사용"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDateTime(student.submittedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 text-xs rounded-full font-semibold ${getResultBadgeClass(student.result)}`}>
                        {student.result || "-"}
                      </span>

                      <span className="text-sm font-semibold text-slate-900">
                        {student.score ?? 0}점
                      </span>

                      {!student.approvedStudent && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          승인 전
                        </span>
                      )}

                      <button
                        onClick={() => {
                          if (!student.approvedStudent) {
                            alert("아직 승인 전 학생입니다. 학생 관리에서 승인 후 확인할 수 있습니다.");
                            return;
                          }
                          navigate(`/teacher/tasks/${assignment.id}/submissions/${student.id}`);
                        }}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          student.approvedStudent
                            ? "text-slate-700 hover:bg-slate-50"
                            : "cursor-not-allowed bg-slate-100 text-slate-400"
                        }`}
                      >
                        상세
                      </button>

                      <button
                        onClick={() => {
                          if (!student.approvedStudent) {
                            alert("아직 승인 전 학생입니다. 학생 관리에서 승인 후 평가할 수 있습니다.");
                            return;
                          }
                          navigate(`/teacher/tasks/${assignment.id}/submissions/${student.id}/evaluation`);
                        }}
                        className={`rounded-lg px-3 py-2 text-xs ${
                          student.approvedStudent
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : "cursor-not-allowed bg-slate-200 text-slate-400"
                        }`}
                      >
                        평가
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  </div>
);
}