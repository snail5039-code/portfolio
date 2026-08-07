import { ClipboardList, Search, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import api from "../../lib/axios";
import axios from "axios";
type StudentRequest = {
    id: number;
    studentName: string;
    className: string;
    status: string;
    requestedAt: string;
    processedAt: string | null;
};

type Student = {
    id: number;
    studentName: string;
    className: string;
    finalScore: number;
    totalTasks: number;
    submittedTasks: number;
    notSubmittedTasks: number;
    aiLogCount: number;
    cautionLogCount: number;
    approvedAt: string;
};

type StudentTaskScore = {
    id: number;
    taskId: number;
    taskTitle: string;
    className: string;
    submitted: boolean;
    submittedAt: string | null;
    score: number;
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

    if (error instanceof Error) return error.message;
    return fallback;
}

function formatDateTime(value: string | null | undefined) {
    if (!value) return "-";
    return value.replace("T", " ").slice(0, 16);
}

export default function TeacherStudentsPage() {
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
    const [teacherName, setTeacherName] = useState(
        typeof window !== "undefined" ? localStorage.getItem("loginName") ?? "" : ""
    );
    const [teacherSubject, setTeacherSubject] = useState(
        typeof window !== "undefined" ? localStorage.getItem("subject") ?? "" : ""
    );
    const [requests, setRequests] = useState<StudentRequest[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [studentDetail, setStudentDetail] = useState<Student | null>(null);
    const [taskScores, setTaskScores] = useState<StudentTaskScore[]>([]);

    const [requestLoading, setRequestLoading] = useState(true);
    const [studentLoading, setStudentLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [scoreLoading, setScoreLoading] = useState(false);

    const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);

    const [editForm, setEditForm] = useState({
        studentName: "",
        className: "",
    });
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
    const [savingInfo, setSavingInfo] = useState(false);
    const [savingScoreId, setSavingScoreId] = useState<number | null>(null);
    const [notice, setNotice] = useState<Notice>(null);

    const fetchRequests = async () => {
        try {
            const response = await api.get("/teacher/tasks/studentRequests", {
                params: { loginId },
            });
            setRequests(response.data);
        } catch (error) {
            console.error("학생 신청 목록 조회 실패:", error);
            setNotice({
                type: "error",
                text: getErrorMessage(error, "학생 신청 목록 조회 실패"),
            });
        } finally {
            setRequestLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const response = await api.get("/teacher/tasks/students", {
                params: { loginId },
            });
            setStudents(response.data);
        } catch (error) {
            console.error("학생 목록 조회 실패:", error);
            setNotice({
                type: "error",
                text: getErrorMessage(error, "학생 목록 조회 실패"),
            });
        } finally {
            setStudentLoading(false);
        }
    };

    const fetchStudentDetail = async (studentId: number) => {
        setDetailLoading(true);

        try {
            const response = await api.get(`/teacher/tasks/students/${studentId}`, {
                params: { loginId },
            });
            const data = response.data;

            setStudentDetail(data);
            setEditForm({
                studentName: data.studentName ?? "",
                className: data.className ?? "",
            });
        } catch (error) {
            console.error("학생 상세 조회 실패:", error);
            setStudentDetail(null);
            setNotice({
                type: "error",
                text: getErrorMessage(error, "학생 상세 조회 실패"),
            });
        } finally {
            setDetailLoading(false);
        }
    };

    const fetchStudentTaskScores = async (studentId: number) => {
        setScoreLoading(true);

        try {
            const response = await api.get(`/teacher/tasks/students/${studentId}/taskScores`, {
                params: { loginId },
            });
            setTaskScores(response.data);
        } catch (error) {
            console.error("학생 과제별 점수 조회 실패:", error);
            setTaskScores([]);
            setNotice({
                type: "error",
                text: getErrorMessage(error, "학생 과제별 점수 조회 실패"),
            });
        } finally {
            setScoreLoading(false);
        }
    };

    const refreshSelectedStudent = async (studentId: number) => {
        await Promise.all([
            fetchStudentDetail(studentId),
            fetchStudentTaskScores(studentId),
            fetchStudents(),
            fetchRequests(),
        ]);
    };

    useEffect(() => {
        fetchRequests();
        fetchStudents();
    }, [loginId]);

    useEffect(() => {
        if (!selectedStudentId) {
            setStudentDetail(null);
            setTaskScores([]);
            return;
        }

        fetchStudentDetail(selectedStudentId);
        fetchStudentTaskScores(selectedStudentId);
    }, [selectedStudentId]);

    const handleApprove = async (requestId: number) => {
        setProcessingRequestId(requestId);
        setNotice({ type: "info", text: "학생 신청 승인 중..." });

        try {
            await api.post(`/teacher/tasks/studentRequests/${requestId}/approve`, null, {
                params: { loginId },
            });
            await Promise.all([fetchRequests(), fetchStudents()]);

            setNotice({
                type: "success",
                text: "학생 신청 승인 완료",
            });
        } catch (error) {
            console.error("학생 신청 승인 실패:", error);
            setNotice({
                type: "error",
                text: getErrorMessage(error, "학생 신청 승인 실패"),
            });
        } finally {
            setProcessingRequestId(null);
        }
    };

    const handleReject = async (requestId: number) => {
        setProcessingRequestId(requestId);
        setNotice({ type: "info", text: "학생 신청 거절 처리 중..." });

        try {
            await api.post(`/teacher/tasks/studentRequests/${requestId}/reject`, null, {
                params: { loginId },
            });
            await fetchRequests();

            setNotice({
                type: "success",
                text: "학생 신청 거절 완료",
            });
        } catch (error) {
            console.error("학생 신청 거절 실패:", error);
            setNotice({
                type: "error",
                text: getErrorMessage(error, "학생 신청 거절 실패"),
            });
        } finally {
            setProcessingRequestId(null);
        }
    };

    const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        setEditForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleUpdateStudentInfo = async () => {
        if (!selectedStudentId) return;

        if (!editForm.studentName.trim()) {
            setNotice({ type: "error", text: "학생명을 입력해주세요." });
            return;
        }

        if (!editForm.className.trim()) {
            setNotice({ type: "error", text: "반 정보를 입력해주세요." });
            return;
        }

        setSavingInfo(true);
        setNotice({ type: "info", text: "학생 정보 저장 중..." });

        try {
            await api.put(
                `/teacher/tasks/students/${selectedStudentId}`,
                {
                    studentName: editForm.studentName.trim(),
                    className: editForm.className.trim(),
                },
                {
                    params: { loginId },
                }
            );

            await refreshSelectedStudent(selectedStudentId);

            setNotice({
                type: "success",
                text: "학생 정보 수정 완료",
            });
        } catch (error) {
            console.error("학생 정보 수정 실패:", error);
            setNotice({
                type: "error",
                text: getErrorMessage(error, "학생 정보 수정 실패"),
            });
        } finally {
            setSavingInfo(false);
        }
    };

    const handleScoreChange = (submissionId: number, value: string) => {
        if (value === "") {
            setTaskScores((prev) =>
                prev.map((item) => (item.id === submissionId ? { ...item, score: 0 } : item))
            );
            return;
        }

        const nextScore = Number(value);

        setTaskScores((prev) =>
            prev.map((item) =>
                item.id === submissionId ? { ...item, score: Number.isNaN(nextScore) ? 0 : nextScore } : item
            )
        );
    };

    const handleUpdateTaskScore = async (submissionId: number, score: number) => {
        if (!selectedStudentId) return;

        if (Number.isNaN(score) || score < 0 || score > 100) {
            setNotice({ type: "error", text: "점수는 0점 이상 100점 이하만 가능합니다." });
            return;
        }

        setSavingScoreId(submissionId);
        setNotice({ type: "info", text: "과제 점수 저장 중..." });

        try {
            await api.put(
                `/teacher/tasks/students/${selectedStudentId}/taskScores/${submissionId}`,
                { score },
                {
                    params: { loginId },
                }
            );

            await refreshSelectedStudent(selectedStudentId);

            setNotice({
                type: "success",
                text: "과제 점수 수정 완료",
            });
        } catch (error) {
            console.error("과제 점수 수정 실패:", error);
            setNotice({
                type: "error",
                text: getErrorMessage(error, "과제 점수 수정 실패"),
            });
        } finally {
            setSavingScoreId(null);
        }
    };

    const selectedStudent = useMemo(
        () => students.find((student) => student.id === selectedStudentId) ?? null,
        [students, selectedStudentId]
    );

    const noticeClassName = useMemo(() => {
        if (!notice) return "";
        if (notice.type === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
        if (notice.type === "error") return "border-rose-200 bg-rose-50 text-rose-700";
        return "border-sky-200 bg-sky-50 text-sky-700";
    }, [notice]);

 return (
  <div className="min-h-screen bg-[#f5f7fb] px-5 py-6 md:px-8 text-slate-800">
    <div className="mx-auto max-w-7xl space-y-6">

      {/* ✅ 헤더 */}
      <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-slate-400">
            STUDENT MANAGEMENT
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            학생 관리
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            학생 승인, 정보 수정, 성적을 관리합니다.
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
            <p className="text-sm text-slate-500">{teacherSubject || "과목 미설정"}</p>
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
              className="w-full rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-100"
            >
              유사도 분석
            </button>

            <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
              학생 관리
            </button>
          </div>
        </aside>

        {/* ✅ 메인 */}
        <main className="space-y-6">

          {/* 신청 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-slate-900">승인 대기 신청</h2>
            </div>

            <div className="divide-y">
              {requestLoading ? (
                <div className="px-6 py-10 text-center text-slate-400">불러오는 중...</div>
              ) : requests.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-400">신청 없음</div>
              ) : (
                requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50">
                    <div>
                      <p className="font-semibold text-slate-900">{r.studentName}</p>
                      <p className="text-sm text-slate-500">{r.className}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDateTime(r.requestedAt)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(r.id)}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-xs text-white"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        className="rounded-lg bg-rose-500 px-4 py-2 text-xs text-white"
                      >
                        거절
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 학생 + 상세 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm p-5">
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">

              {/* 리스트 */}
              <div className="space-y-2 max-h-[700px] overflow-y-auto">
                {studentLoading ? (
                  <div className="text-center text-slate-400 py-10">불러오는 중...</div>
                ) : students.map((s) => {
                  const isSelected = s.id === selectedStudentId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`w-full text-left rounded-xl p-4 border transition ${
                        isSelected ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <p className="font-semibold">{s.studentName}</p>
                      <p className="text-xs opacity-70">{s.className}</p>
                      <p className="text-xs mt-2">평균 {s.finalScore}점</p>
                    </button>
                  );
                })}
              </div>

              {/* 상세 */}
              <div className="space-y-4">
                {!studentDetail ? (
                  <div className="text-center text-slate-400 py-20">학생 선택</div>
                ) : (
                  <>
                    <div className="grid md:grid-cols-3 gap-4">

                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">과제</p>
                        <p>{studentDetail.submittedTasks}/{studentDetail.totalTasks}</p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">평균</p>
                        <p>{studentDetail.finalScore}</p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">AI 로그</p>
                        <p>{studentDetail.aiLogCount}</p>
                      </div>

                    </div>

                    {/* 수정 */}
                    <div className="rounded-xl border p-4 space-y-3">
                      <input
                        name="studentName"
                        value={editForm.studentName}
                        onChange={handleEditFormChange}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                      <input
                        name="className"
                        value={editForm.className}
                        onChange={handleEditFormChange}
                        className="w-full rounded-lg border px-3 py-2"
                      />

                      <button
                        onClick={handleUpdateStudentInfo}
                        className="w-full rounded-lg bg-slate-900 text-white py-2"
                      >
                        저장
                      </button>
                    </div>
                  </>
                )}
              </div>

            </div>
          </section>

          {/* 점수 */}
          <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-slate-900">과제별 점수</h2>
            </div>

            <div className="divide-y">
              {taskScores.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50">
                  <div>
                    <p className="font-semibold">{t.taskTitle}</p>
                    <p className="text-xs text-slate-500">{t.className}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={t.score}
                      onChange={(e) => handleScoreChange(t.id, e.target.value)}
                      className="w-16 rounded-lg border px-2 py-1 text-center"
                    />

                    <button
                      onClick={() => handleUpdateTaskScore(t.id, t.score)}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white"
                    >
                      저장
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