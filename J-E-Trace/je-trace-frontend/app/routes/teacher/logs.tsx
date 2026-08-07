import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import api from "../../lib/axios";

type Task = {
    id: number;
    title: string;
    className: string;
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

type AiLog = {
    id: number;
    taskId: number;
    studentName: string;
    question: string;
    answer: string;
    createdAt: string;
    status: "정상" | "주의";
};

export default function TeacherLogsPage() {
    const navigate = useNavigate();

    const loginId =
        typeof window !== "undefined" ? localStorage.getItem("loginId") ?? "" : "";
    const loginRole =
        typeof window !== "undefined" ? localStorage.getItem("loginRole") ?? "" : "";

    const [tasks, setTasks] = useState<Task[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [logs, setLogs] = useState<AiLog[]>([]);

    const [selectedTaskId, setSelectedTaskId] = useState("");
    const [selectedStudentName, setSelectedStudentName] = useState("");

    const [taskLoading, setTaskLoading] = useState(true);
    const [studentLoading, setStudentLoading] = useState(true);
    const [logLoading, setLogLoading] = useState(false);

    const [expandedQuestionIds, setExpandedQuestionIds] = useState<number[]>([]);
    const [expandedAnswerIds, setExpandedAnswerIds] = useState<number[]>([]);
    const [blockedMessage, setBlockedMessage] = useState("");

    const [teacherName, setTeacherName] = useState(
        typeof window !== "undefined" ? localStorage.getItem("loginName") ?? "" : ""
    );
    const [teacherSubject, setTeacherSubject] = useState(
        typeof window !== "undefined" ? localStorage.getItem("subject") ?? "" : ""
    );

    useEffect(() => {
        if (!loginId) {
            alert("로그인이 필요합니다.");
            navigate("/auth?mode=TEACHER");
            return;
        }

        if (loginRole !== "TEACHER") {
            alert("교사 계정만 접근할 수 있습니다.");
            navigate("/");
        }
    }, [loginId, loginRole, navigate]);

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
        const fetchTasks = async () => {
            try {
                const response = await api.get("/teacher/tasks", {
                    params: { loginId },
                });
                setTasks(response.data ?? []);
            } catch (error) {
                console.error("과제 목록 조회 실패:", error);
                setTasks([]);
            } finally {
                setTaskLoading(false);
            }
        };

        if (loginId) {
            fetchTasks();
        }
    }, [loginId]);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const response = await api.get("/teacher/tasks/students", {
                    params: { loginId },
                });
                setAllStudents(response.data ?? []);
            } catch (error) {
                console.error("학생 목록 조회 실패:", error);
                setAllStudents([]);
            } finally {
                setStudentLoading(false);
            }
        };

        if (loginId) {
            fetchStudents();
        }
    }, [loginId]);

    const selectedTask = useMemo(
        () => tasks.find((task) => String(task.id) === selectedTaskId),
        [tasks, selectedTaskId]
    );

    const filteredStudents = useMemo(() => {
        if (!selectedTask) return [];

        return allStudents.filter(
            (student) => student.className?.trim() === selectedTask.className?.trim()
        );
    }, [allStudents, selectedTask]);

    useEffect(() => {
        setSelectedStudentName("");
        setLogs([]);
        setExpandedQuestionIds([]);
        setExpandedAnswerIds([]);
        setBlockedMessage("");
    }, [selectedTaskId]);

    useEffect(() => {
        if (!selectedTaskId || !selectedStudentName) {
            setLogs([]);
            setExpandedQuestionIds([]);
            setExpandedAnswerIds([]);
            setBlockedMessage("");
            return;
        }

        const fetchLogs = async () => {
            setLogLoading(true);
            try {
                const response = await api.get(`/teacher/tasks/${selectedTaskId}/logs`, {
                    params: {
                        loginId,
                        studentName: selectedStudentName,
                    },
                });

                setLogs(response.data ?? []);
                setExpandedQuestionIds([]);
                setExpandedAnswerIds([]);
                setBlockedMessage("");
            } catch (error: any) {
                console.error("AI 로그 조회 실패:", error);
                setLogs([]);
                setBlockedMessage(
                    error?.response?.data?.message ||
                        error?.response?.data ||
                        "AI 로그를 불러오지 못했습니다."
                );
            } finally {
                setLogLoading(false);
            }
        };

        fetchLogs();
    }, [selectedTaskId, selectedStudentName, loginId]);

    const toggleQuestionExpand = (id: number) => {
        setExpandedQuestionIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const toggleAnswerExpand = (id: number) => {
        setExpandedAnswerIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const isQuestionExpanded = (id: number) => expandedQuestionIds.includes(id);
    const isAnswerExpanded = (id: number) => expandedAnswerIds.includes(id);

    const shouldShowMoreButton = (text: string, limit = 28) => text.length > limit;

    const shortenText = (text: string, limit = 28) => {
        if (!text) return "";
        if (text.length <= limit) return text;
        return `${text.slice(0, limit)}...`;
    };

    return (
        <div className="min-h-screen bg-[#f5f7fb] px-5 py-6 text-slate-900 md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="flex items-center justify-between rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div>
                        <p className="text-xs font-bold tracking-[0.25em] text-slate-400">
                            TEACHER DASHBOARD
                        </p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">
                            AI 로그 관리
                        </h1>
                        <p className="mt-2 text-sm text-slate-500">
                            학생 질문 및 AI 응답 기록 확인
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
                    <aside className="flex flex-col rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
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

                            <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
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

                    <main className="space-y-6">
                        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900">조회 조건</h2>

                            <div className="mt-4 grid gap-4 md:grid-cols-3">
                                <select
                                    value={selectedTaskId}
                                    onChange={(e) => setSelectedTaskId(e.target.value)}
                                    disabled={taskLoading}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                                >
                                    <option value="">과제 선택</option>
                                    {tasks.map((task) => (
                                        <option key={task.id} value={task.id}>
                                            {task.title} ({task.className})
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={selectedStudentName}
                                    onChange={(e) => setSelectedStudentName(e.target.value)}
                                    disabled={!selectedTaskId || studentLoading}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                                >
                                    <option value="">
                                        {!selectedTaskId
                                            ? "과제를 먼저 선택하세요"
                                            : studentLoading
                                            ? "학생 불러오는 중..."
                                            : filteredStudents.length === 0
                                            ? "해당 반 학생 없음"
                                            : "학생 선택"}
                                    </option>

                                    {filteredStudents.map((student) => (
                                        <option key={student.id} value={student.studentName}>
                                            {student.studentName}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    onClick={() => {
                                        setSelectedTaskId("");
                                        setSelectedStudentName("");
                                        setLogs([]);
                                        setExpandedQuestionIds([]);
                                        setExpandedAnswerIds([]);
                                        setBlockedMessage("");
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                    초기화
                                </button>
                            </div>
                        </section>

                        <section className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-sm text-slate-500">선택 과제</p>
                                <p className="mt-2 font-semibold text-slate-900">
                                    {selectedTask ? selectedTask.title : "-"}
                                </p>
                            </div>

                            <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-sm text-slate-500">선택 학생</p>
                                <p className="mt-2 font-semibold text-slate-900">
                                    {selectedStudentName || "-"}
                                </p>
                            </div>

                            <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-sm text-slate-500">로그 수</p>
                                <p className="mt-2 text-2xl font-bold text-slate-900">
                                    {logs.length}개
                                </p>
                            </div>
                        </section>

                        {blockedMessage && (
                            <section className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                                {blockedMessage}
                            </section>
                        )}

                        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                            <div className="border-b bg-slate-50 px-6 py-4">
                                <h2 className="font-bold text-slate-900">AI 로그 목록</h2>
                            </div>

                            <div className="max-h-[600px] overflow-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium">번호</th>
                                            <th className="px-4 py-3 text-left font-medium">학생</th>
                                            <th className="px-4 py-3 text-left font-medium">질문</th>
                                            <th className="px-4 py-3 text-left font-medium">응답</th>
                                            <th className="px-4 py-3 text-left font-medium">시간</th>
                                            <th className="px-4 py-3 text-left font-medium">상태</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y">
                                        {!logLoading && logs.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="px-4 py-10 text-center text-sm text-slate-400"
                                                >
                                                    {selectedTaskId && selectedStudentName
                                                        ? "해당 학생의 AI 로그가 없습니다."
                                                        : "과제와 학생을 선택하면 AI 로그가 표시됩니다."}
                                                </td>
                                            </tr>
                                        )}

                                        {logs.map((log, index) => (
                                            <tr key={log.id} className="transition hover:bg-slate-50">
                                                <td className="px-4 py-4 text-slate-500">
                                                    {index + 1}
                                                </td>

                                                <td className="px-4 py-4 font-semibold text-slate-900">
                                                    {log.studentName}
                                                </td>

                                                <td className="px-4 py-4 text-slate-700">
                                                    <div className="space-y-1">
                                                        <div>
                                                            {isQuestionExpanded(log.id)
                                                                ? log.question
                                                                : shortenText(log.question, 30)}
                                                        </div>
                                                        {shouldShowMoreButton(log.question, 30) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleQuestionExpand(log.id)}
                                                                className="text-xs font-medium text-slate-500 hover:text-slate-800"
                                                            >
                                                                {isQuestionExpanded(log.id)
                                                                    ? "접기"
                                                                    : "더보기"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-slate-700">
                                                    <div className="space-y-1">
                                                        <div>
                                                            {isAnswerExpanded(log.id)
                                                                ? log.answer
                                                                : shortenText(log.answer, 40)}
                                                        </div>
                                                        {shouldShowMoreButton(log.answer, 40) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleAnswerExpand(log.id)}
                                                                className="text-xs font-medium text-slate-500 hover:text-slate-800"
                                                            >
                                                                {isAnswerExpanded(log.id)
                                                                    ? "접기"
                                                                    : "더보기"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-xs text-slate-400">
                                                    {log.createdAt?.replace("T", " ").slice(0, 16)}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                                            log.status === "주의"
                                                                ? "bg-rose-100 text-rose-600"
                                                                : "bg-emerald-100 text-emerald-600"
                                                        }`}
                                                    >
                                                        {log.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>       
    );
}