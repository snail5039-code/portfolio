import { ClipboardList, Search, Sparkles, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import api from "../../lib/axios";

type AiLog = {
    id: number;
    taskId: number;
    studentName: string;
    question: string;
    answer: string;
    createdAt: string;
    status: string;
};

type SimilarityDetail = {
    id: number;
    taskId: number;
    taskTitle: string;
    studentName: string;
    targetName: string;
    comparisonType: "STUDENT_TO_STUDENT" | "STUDENT_TO_AI_LOG";
    similarity: number;
    judge: "정상" | "주의" | "위험";
    reason: string;
    studentContent: string;
    targetContent: string;
    checkedAt: string;
};

export default function TeacherSimilarityDetailPage() {
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
    const { similarityId } = useParams();

    const [detail, setDetail] = useState<SimilarityDetail | null>(null);
    const [studentLogs, setStudentLogs] = useState<AiLog[]>([]);
    const [targetLogs, setTargetLogs] = useState<AiLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [blockedMessage, setBlockedMessage] = useState("");
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
        if (!similarityId) return;

        const fetchDetail = async () => {
            try {
                const detailResponse = await api.get(
                    `/teacher/tasks/similarity/${similarityId}`,
                    { params: { loginId } }
                );

                const detailData = detailResponse.data;
                setDetail(detailData);

                const studentLogResponse = await api.get(
                    `/teacher/tasks/${detailData.taskId}/logs`,
                    { params: { loginId, studentName: detailData.studentName } }
                );
                setStudentLogs(studentLogResponse.data);

                if (detailData.comparisonType === "STUDENT_TO_STUDENT") {
                    const targetLogResponse = await api.get(
                        `/teacher/tasks/${detailData.taskId}/logs`,
                        { params: { loginId, studentName: detailData.targetName } }
                    );
                    setTargetLogs(targetLogResponse.data);
                } else {
                    setTargetLogs([]);
                }
            } catch (error) {
                console.error("유사도 상세 조회 실패:", error);
                setBlockedMessage(error?.response?.data?.message ?? "유사도 상세 조회 실패");
                setDetail(null);
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [similarityId, loginId]);

    if (loading) {
        return <div className="p-6">유사도 상세 정보를 불러오는 중...</div>;
    }

    if (!detail) {
        return <div className="p-6">{blockedMessage || "유사도 상세 정보를 찾을 수 없습니다."}</div>;
    }

return (
  <div className="min-h-screen bg-[#f5f7fb] px-5 py-6 md:px-8">
    <div className="mx-auto max-w-7xl space-y-6">

      {/* ✅ 상단 헤더 카드 */}
      <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-slate-400">
            SIMILARITY ANALYSIS
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            유사도 분석 상세
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            학생 간 또는 AI 로그 기반 유사도를 분석합니다.
          </p>
        </div>

        <button
          onClick={() => navigate("/teacher/similarity")}
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
        >
          목록으로
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
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm text-white"
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

          {/* 기본 정보 */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">분석 기본 정보</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-4 text-sm">
              {[
                ["과제명", detail.taskTitle],
                ["대상 학생", detail.studentName],
                ["비교 대상", detail.targetName],
                [
                  "분석 유형",
                  detail.comparisonType === "STUDENT_TO_STUDENT"
                    ? "학생 간 비교"
                    : "AI 로그 비교",
                ],
                ["유사도", `${detail.similarity}%`],
                ["판정", detail.judge],
                ["분석 시각", detail.checkedAt],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">{label}</p>
                  <p className="font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 분석 사유 */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">AI 자동 분석 사유</h2>
            <div className="mt-4 text-sm whitespace-pre-wrap text-slate-700">
              {detail.reason}
            </div>
          </section>

          {/* 제출 내용 */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">학생 제출 내용</h2>
              <div className="mt-4 text-sm whitespace-pre-wrap text-slate-700">
                {detail.studentContent}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">비교 대상 내용</h2>
              <div className="mt-4 text-sm whitespace-pre-wrap text-slate-700">
                {detail.targetContent}
              </div>
            </div>
          </section>

          {/* AI 로그 */}
          <section className="grid gap-6 lg:grid-cols-2">

            {/* 학생 로그 */}
            <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-bold text-slate-900">대상 학생 AI 로그</h2>
              </div>

              <div className="divide-y">
                {studentLogs.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-400">
                    AI 로그가 없습니다.
                  </div>
                ) : (
                  studentLogs.map((log) => (
                    <div key={log.id} className="px-6 py-5 space-y-3 hover:bg-slate-50">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{log.createdAt?.replace("T", " ").slice(0, 16)}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                          {log.status}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400">질문</p>
                        <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm">
                          {log.question}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400">응답</p>
                        <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm">
                          {log.answer}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 비교 로그 */}
            <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-bold text-slate-900">비교 대상 AI 로그</h2>
              </div>

              <div className="divide-y">
                {targetLogs.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-400">
                    AI 로그가 없습니다.
                  </div>
                ) : (
                  targetLogs.map((log) => (
                    <div key={log.id} className="px-6 py-5 space-y-3 hover:bg-slate-50">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{log.createdAt?.replace("T", " ").slice(0, 16)}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                          {log.status}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400">질문</p>
                        <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm">
                          {log.question}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400">응답</p>
                        <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm">
                          {log.answer}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </section>

        </main>
      </div>
    </div>
  </div>
);
}