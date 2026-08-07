import { ArrowLeft, ClipboardList, Search, Sparkles, UserRound } from "lucide-react";
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

type SubmissionDetail = {
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

  topStudentSimilarity: number | null;
  topStudentTargetName: string | null;
  topStudentJudge: string | null;
  topStudentReason: string | null;

  aiLogSimilarity: number | null;
  aiLogJudge: string | null;
  aiLogReason: string | null;
};

type AiLog = {
  id: number;
  taskId: number;
  studentName: string;
  question: string;
  answer: string;
  createdAt: string;
  status: string;
};

type Notice = {
  type: "success" | "error" | "info";
  text: string;
} | null;

function getJudgeBadgeClass(judge: string | null | undefined) {
  if (judge === "위험") return "bg-rose-50 text-rose-700";
  if (judge === "주의") return "bg-amber-50 text-amber-700";
  if (judge === "정상") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-500";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data ||
      error.message ||
      fallback
    );
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}

export default function TeacherSubmissionEvaluationPage() {
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
  const { taskId, submissionId } = useParams();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [score, setScore] = useState("");
  const [teacherComment, setTeacherComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    if (!taskId || !submissionId) return;

    try {
      const taskResponse = await api.get(`/teacher/tasks/${taskId}`, { params: { loginId } });
      const submissionResponse = await api.get(
        `/teacher/tasks/submissions/${submissionId}`,
        { params: { loginId } }
      );

      setTask(taskResponse.data);
      setSubmission(submissionResponse.data);
      setScore(
        submissionResponse.data?.score !== null && submissionResponse.data?.score !== undefined
          ? String(submissionResponse.data.score)
          : ""
      );
      setTeacherComment(submissionResponse.data?.teacherComment ?? "");

      if (submissionResponse.data?.studentName) {
        const logResponse = await api.get(`/teacher/tasks/${taskId}/logs`, {
          params: { loginId, studentName: submissionResponse.data.studentName },
        });
        setLogs(logResponse.data);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error("평가 페이지 조회 실패:", error);
      setNotice({
        type: "error",
        text: getErrorMessage(error, "평가 페이지 조회 실패"),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!taskId || !submissionId) return;
    fetchData();
  }, [taskId, submissionId]);

  const handleSaveEvaluation = async () => {
    if (!submissionId) return;

    const numericScore = Number(score);

    if (score === "" || Number.isNaN(numericScore)) {
      setNotice({ type: "error", text: "점수를 입력해주세요." });
      return;
    }

    if (numericScore < 0 || numericScore > 100) {
      setNotice({ type: "error", text: "점수는 0점 이상 100점 이하만 가능합니다." });
      return;
    }

    setSaving(true);
    setNotice({ type: "info", text: "평가 저장 중..." });

    try {
      await api.put(
        `/teacher/tasks/submissions/${submissionId}/evaluation`,
        {
          score: numericScore,
          teacherComment,
        },
        {
          params: { loginId },
        }
      );

      alert("평가가 저장되었습니다.");
      navigate(-1);
    } catch (error) {
      console.error("평가 저장 실패:", error);
      setNotice({
        type: "error",
        text: getErrorMessage(error, "평가 저장 실패"),
      });
    } finally {
      setSaving(false);
    }
  };

  const noticeClassName = useMemo(() => {
    if (!notice) return "";
    if (notice.type === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (notice.type === "error") return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-sky-200 bg-sky-50 text-sky-700";
  }, [notice]);

  if (loading) {
    return <div className="p-6">평가 정보를 불러오는 중...</div>;
  }

  if (!task || !submission) {
    return <div className="p-6">평가 정보를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-5 py-6 md:px-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* 헤더 */}
        <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-slate-400">
              TEACHER DASHBOARD
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              과제 평가
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              제출된 과제를 분석하고 평가를 진행합니다.
            </p>
          </div>

          <button
            onClick={() => navigate(`/teacher/tasks/${taskId}`)}
            className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            제출 현황으로
          </button>
        </section>

        {notice && (
          <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${noticeClassName}`}>
            {notice.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">

          {/* 사이드바 */}
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
              <button
                onClick={() => navigate(`/teacher/tasks/${taskId}`)}
                className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100"
              >
                ← 제출 현황
              </button>

              <button
                onClick={() => navigate("/teacher")}
                className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100"
              >
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
          </aside>

          {/* 메인 */}
          <main className="space-y-6">

            {/* 평가 대상 */}
            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">평가 대상 정보</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-4 text-sm">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">과제명</p>
                  <p className="font-semibold">{task.title}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">학생</p>
                  <p className="font-semibold">{submission.studentName}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">반</p>
                  <p className="font-semibold">{task.className}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">결과</p>
                  <p className="font-semibold">{submission.result || "-"}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">

              {/* 좌측 */}
              <div className="space-y-6">

                {/* 제출 내용 */}
                <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold">제출 내용</h2>
                  <div className="mt-4 text-sm whitespace-pre-wrap">
                    {submission.content || "제출 내용 없음"}
                  </div>
                </div>

                {/* AI 분석 */}
                <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold">AI 분석 참고</h2>

                  <div className="mt-4 grid gap-4 md:grid-cols-4 text-sm">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-slate-500">학생 간 유사도</p>
                      <p className="font-semibold">{submission.topStudentSimilarity ?? 0}%</p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-slate-500">비교 대상</p>
                      <p className="font-semibold">{submission.topStudentTargetName || "-"}</p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-slate-500">AI 로그 유사도</p>
                      <p className="font-semibold">{submission.aiLogSimilarity ?? 0}%</p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-slate-500">AI 사용 여부</p>
                      <p className="font-semibold">{submission.aiUsed ? "사용" : "미사용"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-slate-500 mb-2">학생 간 판정</p>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getJudgeBadgeClass(submission.topStudentJudge)}`}>
                        {submission.topStudentJudge || "-"}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-slate-500 mb-2">AI 로그 판정</p>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getJudgeBadgeClass(submission.aiLogJudge)}`}>
                        {submission.aiLogJudge || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 text-sm font-semibold text-slate-800">학생 간 판정 사유</p>
                      <p className="text-sm text-slate-700">{submission.topStudentReason || "없음"}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 text-sm font-semibold text-slate-800">AI 로그 판정 사유</p>
                      <p className="text-sm text-slate-700">{submission.aiLogReason || "없음"}</p>
                    </div>
                  </div>
                </div>

                {/* AI 로그 */}
                <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b">
                    <h2 className="font-bold">AI 로그</h2>
                  </div>

                  <div className="divide-y">
                    {logs.length === 0 ? (
                      <div className="p-6 text-center text-slate-500">로그 없음</div>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="p-6 hover:bg-slate-50">
                          <p className="text-xs text-slate-400">
                            {formatDateTime(log.createdAt)}
                          </p>
                          <p className="mt-2 font-medium">Q. {log.question}</p>
                          <p className="mt-2 text-sm text-slate-600">{log.answer}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* 우측 평가 */}
              <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">평가 입력</h2>

                <div className="mt-5 space-y-5">
                  <div>
                    <label className="text-sm font-semibold">점수</label>
                    <input
                      type="number"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold">코멘트</label>
                    <textarea
                      rows={8}
                      value={teacherComment}
                      onChange={(e) => setTeacherComment(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 text-sm">
                    현재 점수: {submission.score ?? 0}
                  </div>

                  <button
                    onClick={handleSaveEvaluation}
                    disabled={saving}
                    className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {saving ? "저장 중..." : "평가 저장"}
                  </button>
                </div>
              </div>

            </section>
          </main>
        </div>
      </div>
    </div>
  );
}