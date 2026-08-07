import { ArrowLeft, ClipboardList, FileText, Search, Sparkles, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import api from "../../lib/axios";

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

function getJudgeBadgeClass(judge: string | null | undefined) {
  if (judge === "위험") return "bg-rose-50 text-rose-700";
  if (judge === "주의") return "bg-amber-50 text-amber-700";
  if (judge === "정상") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-500";
}

export default function TeacherSubmissionDetailPage() {
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
  const [loading, setLoading] = useState(true);
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
  useEffect(() => {
    if (!taskId || !submissionId) return;

    const fetchData = async () => {
      try {
        const taskResponse = await api.get(`/teacher/tasks/${taskId}`, { params: { loginId } });
        const submissionResponse = await api.get(
          `/teacher/tasks/submissions/${submissionId}`,
          { params: { loginId } }
        );

        setTask(taskResponse.data);
        setSubmission(submissionResponse.data);

        if (submissionResponse.data?.studentName) {
          const logResponse = await api.get(`/teacher/tasks/${taskId}/logs`, {
            params: { loginId, studentName: submissionResponse.data.studentName },
          });
          setLogs(logResponse.data);
        }
      } catch (error) {
        console.error("제출 상세 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [taskId, submissionId, loginId]);

  if (loading) {
    return <div className="p-6">제출 상세 정보를 불러오는 중...</div>;
  }

  if (!task || !submission) {
    return <div className="p-6">제출 상세 정보를 찾을 수 없습니다.</div>;
  }

return (
  <div className="min-h-screen bg-[#f5f7fb] px-5 py-6 md:px-8 text-slate-900">
    <div className="mx-auto max-w-7xl space-y-6">

      {/* 헤더 */}
      <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-slate-400">
            TEACHER SYSTEM
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            제출 상세 보기
          </h1>
        </div>

        <button
          onClick={() => navigate(`/teacher/tasks/${taskId}`)}
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
        >
          제출 현황으로
        </button>
      </section>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">

        {/* 사이드바 */}
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
            <button onClick={() => navigate(`/teacher/tasks/${taskId}`)} className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100">
              제출 현황으로
            </button>
            <button onClick={() => navigate("/teacher")} className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100">
              과제 관리
            </button>
            <button onClick={() => navigate("/teacher/logs")} className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100">
              AI 로그 확인
            </button>
            <button onClick={() => navigate("/teacher/similarity")} className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100">
              유사도 분석
            </button>
            <button onClick={() => navigate("/teacher/students")} className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100">
              학생 관리
            </button>
          </div>
        </aside>

        {/* 메인 */}
        <main className="space-y-6">

          {/* 기본 정보 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-slate-900">기본 정보</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4">
              {[
                ["과제명", task.title],
                ["학생명", submission.studentName],
                ["반", task.className],
                ["제출 시각", submission.submittedAt ? submission.submittedAt.replace("T", " ").slice(0, 16) : "-"],
                ["제출 여부", submission.submitted ? "제출 완료" : "미제출"],
                ["AI 사용", submission.aiUsed ? "사용" : "미사용"],
                ["분석 결과", submission.result || "-"],
              ].map(([label, value], i) => (
                <div key={i} className="p-4 border-b md:border-r last:border-r-0">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* AI 분석 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-slate-900">AI 분석 요약</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4">
              {[
                ["학생 간 최고 유사도", `${submission.topStudentSimilarity ?? 0}%`],
                ["주요 비교 대상", submission.topStudentTargetName || "-"],
                ["AI 로그 유사도", `${submission.aiLogSimilarity ?? 0}%`],
                ["최종 분석 결과", submission.result || "-"],
              ].map(([label, value], i) => (
                <div key={i} className="p-4 border-b md:border-r last:border-r-0">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">학생 간 분석 사유</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm whitespace-pre-wrap">
                  {submission.topStudentReason || "학생 간 유사도 분석 결과가 없습니다."}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">AI 로그 분석 사유</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm whitespace-pre-wrap">
                  {submission.aiLogReason || "AI 로그 유사도 분석 결과가 없습니다."}
                </div>
              </div>
            </div>
          </section>

          {/* 과제 안내 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-slate-900">과제 안내</h2>
            </div>
            <div className="px-6 py-5 text-sm whitespace-pre-wrap">
              {task.description || "과제 안내가 없습니다."}
            </div>
          </section>

          {/* 제출 내용 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-slate-900">학생 제출 내용</h2>
            </div>
            <div className="px-6 py-5 text-sm whitespace-pre-wrap">
              {submission.content || "제출 내용이 없습니다."}
            </div>
          </section>

          {/* 평가 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-slate-900">평가 결과</h2>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="text-sm text-slate-500">점수</label>
                <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                  {submission.score ?? 0}점
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-500">평가 코멘트</label>
                <div className="mt-1 min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm whitespace-pre-wrap">
                  {submission.teacherComment || "저장된 평가 코멘트가 없습니다."}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => navigate(`/teacher/tasks/${taskId}/submissions/${submissionId}/evaluation`)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  평가하기
                </button>
              </div>
            </div>
          </section>

          {/* AI 로그 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-slate-900">AI 로그 참고</h2>
            </div>

            <div className="divide-y">
              {logs.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-400">
                  AI 로그가 없습니다.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="space-y-3 px-6 py-5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{log.createdAt?.replace("T", " ").slice(0, 16)}</span>
                      <span className="px-2 py-1 bg-slate-100 rounded-lg text-slate-600">
                        {log.status}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 mb-1">질문</p>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm whitespace-pre-wrap">
                        {log.question}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 mb-1">응답</p>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm whitespace-pre-wrap">
                        {log.answer}
                      </div>
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