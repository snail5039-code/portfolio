import { ClipboardList, Search, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import api from "../../lib/axios";

type SimilarityItem = {
    id: number;
    taskId: number;
    taskTitle: string;
    studentName: string;
    targetName: string;
    comparisonType: "STUDENT_TO_STUDENT" | "STUDENT_TO_AI_LOG";
    similarity: number;
    judge: "정상" | "주의" | "위험";
    reason: string;
    checkedAt: string;
};

export default function TeacherSimilarityPage() {
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
    const [items, setItems] = useState<SimilarityItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [studentKeyword, setStudentKeyword] = useState("");
    const [taskKeyword, setTaskKeyword] = useState("");
    const [judgeFilter, setJudgeFilter] = useState<"전체" | "정상" | "주의" | "위험">("전체");
    const [typeFilter, setTypeFilter] = useState<"전체" | "학생 간 비교" | "AI 로그 비교">("전체");
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
        const fetchSimilarityResults = async () => {
            try {
                const response = await api.get("/teacher/tasks/similarity", {
                    params: { loginId },
                });
                setItems(response.data);
            } catch (error) {
                console.error("유사도 분석 목록 조회 실패:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSimilarityResults();
    }, [loginId]);

    const filteredData = useMemo(() => {
        return items.filter((item) => {
            const matchStudent =
                item.studentName.includes(studentKeyword) ||
                item.targetName.includes(studentKeyword);

            const matchTask = item.taskTitle.includes(taskKeyword);
            const matchJudge = judgeFilter === "전체" ? true : item.judge === judgeFilter;
            const matchType =
                typeFilter === "전체"
                    ? true
                    : typeFilter === "학생 간 비교"
                        ? item.comparisonType === "STUDENT_TO_STUDENT"
                        : item.comparisonType === "STUDENT_TO_AI_LOG";

            return matchStudent && matchTask && matchJudge && matchType;
        });
    }, [items, studentKeyword, taskKeyword, judgeFilter, typeFilter]);

return (
  <div className="min-h-screen bg-[#f5f7fb] px-5 py-6 md:px-8 text-slate-900">
    <div className="mx-auto max-w-7xl space-y-6">

      {/* ✅ 상단 헤더 */}
      <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-slate-400">
            TEACHER DASHBOARD
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            유사도 분석
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            학생 간 및 AI 로그 기반 유사도를 분석합니다.
          </p>
        </div>

        <button
          onClick={() => navigate("/teacher")}
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
        >
          과제 목록
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

            <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
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

          {/* 🔍 검색 필터 */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              유사도 결과 검색
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <input
                type="text"
                value={studentKeyword}
                onChange={(e) => setStudentKeyword(e.target.value)}
                placeholder="학생명"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <input
                type="text"
                value={taskKeyword}
                onChange={(e) => setTaskKeyword(e.target.value)}
                placeholder="과제명"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <select
                value={judgeFilter}
                onChange={(e) =>
                  setJudgeFilter(e.target.value as any)
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="전체">전체</option>
                <option value="정상">정상</option>
                <option value="주의">주의</option>
                <option value="위험">위험</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as any)
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="전체">전체</option>
                <option value="학생 간 비교">학생 간 비교</option>
                <option value="AI 로그 비교">AI 로그 비교</option>
              </select>
            </div>
          </section>

          {/* 📊 결과 리스트 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between">
              <h2 className="font-bold text-slate-900">
                유사도 분석 목록
              </h2>
            </div>

            <div className="divide-y">
              {loading ? (
                <div className="px-6 py-10 text-center text-slate-500">
                  불러오는 중...
                </div>
              ) : filteredData.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-500">
                  결과 없음
                </div>
              ) : (
                filteredData.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">
                        {item.taskTitle}
                      </p>
                      <p className="text-sm text-slate-500">
                        {item.studentName} vs {item.targetName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {item.checkedAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span>
                        {item.comparisonType === "STUDENT_TO_STUDENT"
                          ? "학생 간"
                          : "AI 로그"}
                      </span>

                      <span className="font-semibold">
                        {item.similarity}%
                      </span>

                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                          item.judge === "위험"
                            ? "bg-rose-100 text-rose-700"
                            : item.judge === "주의"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {item.judge}
                      </span>

                      <button
                        onClick={() =>
                          navigate(`/teacher/similarity/${item.id}`)
                        }
                        className="rounded-lg border px-3 py-2 hover:bg-slate-100"
                      >
                        상세
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