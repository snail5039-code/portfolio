import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, LogOut, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import api from "../../lib/axios";

type RecentLog = { id: number; taskId: number; studentName: string; question: string; answer: string; createdAt: string; status: string };
type LearningStep = "NOT_STARTED" | "FIRST_QUESTION" | "EXPLORING" | "DRAFT_WRITTEN" | "REFLECTED" | "SUBMITTED";
type UpcomingTask = { id: number; title: string; className: string; dueDate: string; submitted: boolean; progress: number; currentStep: LearningStep; nextAction: string; questionCount: number };
type Feedback = { submissionId: number; taskId: number; taskTitle: string; teacherComment: string; feedbackStatus: "REVIEWED" | "REVISION_REQUESTED" | "REVISION_SUBMITTED"; feedbackCreatedAt: string; feedbackReadAt: string | null };
type WeeklyLearning = { questionCount: number; revisionCount: number; reflectionCount: number; feedbackAppliedCount: number; feedbackApplicationRate: number; previousQuestionCount: number; previousRevisionCount: number; previousReflectionCount: number; previousFeedbackAppliedCount: number; previousFeedbackApplicationRate: number; frequentBlockedKeyword: string | null; summaryMessage: string };
type MyPageSummary = { submittedCount: number; notSubmittedCount: number; recentLogs: RecentLog[]; upcomingTasks: UpcomingTask[]; feedbacks: Feedback[]; unreadFeedbackCount: number; weeklyLearning: WeeklyLearning | null };

const emptySummary: MyPageSummary = { submittedCount: 0, notSubmittedCount: 0, recentLogs: [], upcomingTasks: [], feedbacks: [], unreadFeedbackCount: 0, weeklyLearning: null };

function formatDueDate(value: string) {
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(dueDate);
}

function getDueLabel(value: string) {
  const dueTime = new Date(value).getTime();
  if (Number.isNaN(dueTime)) return "마감 예정";
  const days = Math.ceil((dueTime - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "오늘 마감";
  if (days === 1) return "내일 마감";
  return `D-${days}`;
}

const learningSteps: Array<{ key: LearningStep; label: string }> = [
  { key: "NOT_STARTED", label: "시작 전" },
  { key: "FIRST_QUESTION", label: "첫 질문" },
  { key: "EXPLORING", label: "추가 탐색" },
  { key: "DRAFT_WRITTEN", label: "풀이 작성" },
  { key: "REFLECTED", label: "자기 성찰" },
  { key: "SUBMITTED", label: "제출" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginRole, setLoginRole] = useState("");
  const [className, setClassName] = useState("");
  const [approved, setApproved] = useState(false);
  const [summary, setSummary] = useState<MyPageSummary>(emptySummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState("");
  const [privacyExpanded, setPrivacyExpanded] = useState(false);

  useEffect(() => {
    const storedLoginId = localStorage.getItem("loginId") ?? "";
    const storedLoginRole = localStorage.getItem("loginRole") ?? "";
    if (!storedLoginId || storedLoginRole !== "STUDENT") {
      navigate("/auth?mode=STUDENT", { replace: true });
      return;
    }
    setLoginId(storedLoginId);
    setLoginName(localStorage.getItem("loginName") ?? "");
    setLoginRole(storedLoginRole);
    setClassName(localStorage.getItem("className") ?? "");
    setApproved((localStorage.getItem("approved") ?? "false") === "true");
    setPrivacyExpanded(localStorage.getItem("studentPrivacyExpanded") === "true");
  }, [navigate]);

  const isLoggedIn = useMemo(() => !!loginId && loginRole === "STUDENT", [loginId, loginRole]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!loginId || loginRole !== "STUDENT") { setSummary(emptySummary); setBlockedMessage(""); return; }
      if (!approved) { setSummary(emptySummary); setBlockedMessage("교사 승인 후 과제와 제출 기능을 사용할 수 있습니다."); return; }
      try {
        setSummaryLoading(true);
        const res = await api.get("/student/tasks/summary", { params: { loginId } });
        setSummary({ submittedCount: res.data?.submittedCount ?? 0, notSubmittedCount: res.data?.notSubmittedCount ?? 0, recentLogs: res.data?.recentLogs ?? [], upcomingTasks: res.data?.upcomingTasks ?? [], feedbacks: res.data?.feedbacks ?? [], unreadFeedbackCount: res.data?.unreadFeedbackCount ?? 0, weeklyLearning: res.data?.weeklyLearning ?? null });
        setBlockedMessage("");
      } catch (error: any) {
        setSummary(emptySummary);
        setBlockedMessage(localStorage.getItem("previewMode") === "true" ? "미리보기 모드입니다. 실제 학습 데이터는 로그인 후 표시됩니다." : error?.response?.data?.message || "학습 기록을 불러오지 못했습니다.");
      } finally { setSummaryLoading(false); }
    };
    fetchSummary();
  }, [loginId, loginRole, approved]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      ["loginId", "loginName", "loginRole", "className", "approved"].forEach((key) => localStorage.removeItem(key));
      navigate("/");
    }
  };

  const openFeedback = async (feedback: Feedback) => {
    if (!feedback.feedbackReadAt) {
      try { await api.put(`/student/tasks/feedback/${feedback.submissionId}/read`); } catch (error) { console.error("피드백 읽음 처리 실패:", error); }
    }
    navigate(`/student/assignment/${feedback.taskId}`);
  };

  const exportMyRecords = async () => {
    const response = await api.get("/student/tasks/privacy/export");
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `je-trace-${loginId}-records.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const requestRecordDeletion = async () => {
    if (!window.confirm("AI 대화·제출·성찰 기록의 삭제를 관리자에게 요청할까요?")) return;
    try {
      await api.post("/student/tasks/privacy/deletion-request", { reason: "학생 본인 요청" });
      alert("삭제 요청을 접수했습니다. 관리자가 확인 후 처리합니다.");
    } catch (error: any) {
      alert(error?.response?.data?.message ?? "삭제 요청을 접수하지 못했습니다.");
    }
  };

  const togglePrivacy = () => {
    setPrivacyExpanded((current) => {
      localStorage.setItem("studentPrivacyExpanded", String(!current));
      return !current;
    });
  };

  return (
    <div className="student-dashboard min-h-screen bg-[#f3f0e8] text-[#17201c]">
      <header className="student-topbar border-b border-[#17201c]/20">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Link to="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center bg-[#17201c] text-xs font-bold text-[#f3f0e8]">JE</span><span className="text-[15px] font-bold">J·E TRACE</span></Link>
          <div className="flex items-center gap-5 text-sm"><span className="hidden text-[#65706a] sm:inline">학생 기록부</span>{isLoggedIn ? <button onClick={handleLogout} className="flex items-center gap-2 font-semibold"><LogOut className="h-4 w-4" />로그아웃</button> : <Link to="/auth?mode=STUDENT" className="border-b border-[#17201c] pb-1 font-semibold">로그인</Link>}</div>
        </div>
      </header>

      <main className="student-shell mx-auto grid max-w-[1440px] border-x border-[#17201c]/20 lg:grid-cols-[240px_1fr]">
        <aside className="student-sidebar border-b border-[#17201c]/20 bg-[#dce7df] p-6 sm:p-8 lg:min-h-[calc(100vh-80px)] lg:border-b-0 lg:border-r">
          <p className="text-xs font-bold tracking-[0.15em] text-[#33705b]">STUDENT / 01</p>
          <div className="mt-10 flex items-center gap-4 lg:block">
            <div className="grid h-14 w-14 place-items-center border border-[#17201c]/30 bg-[#f3f0e8]"><UserRound className="h-6 w-6" strokeWidth={1.5} /></div>
            <div className="lg:mt-5"><h2 className="font-serif text-2xl">{isLoggedIn ? `${loginName || "학생"} 님` : "방문자"}</h2><p className="mt-1 text-sm text-[#5e6963]">{className || "로그인 후 학급 표시"}</p></div>
          </div>
          <dl className="mt-9 divide-y divide-[#17201c]/20 border-y border-[#17201c]/20 text-sm">
            <div className="flex justify-between py-4"><dt className="text-[#65706a]">아이디</dt><dd className="font-semibold">{loginId || "—"}</dd></div>
            <div className="flex justify-between py-4"><dt className="text-[#65706a]">계정 상태</dt><dd className="font-semibold text-[#33705b]">{approved ? "승인 완료" : isLoggedIn ? "승인 대기" : "미로그인"}</dd></div>
          </dl>
          <nav className="mt-9 space-y-1 text-sm">
            <span className="flex items-center justify-between bg-[#17201c] px-4 py-3 font-bold text-[#f3f0e8]">오늘의 기록 <span>01</span></span>
            <Link to="/student/assignments" className="flex items-center justify-between border-b border-[#17201c]/15 px-4 py-3 font-semibold hover:bg-[#cbdcd2]">전체 과제 <ArrowRight className="h-4 w-4" /></Link>
          </nav>
        </aside>

        <div className="student-content flex flex-col p-6 sm:p-9 lg:p-12 xl:p-16">
          <section className="student-hero flex flex-col justify-between gap-8 border-b border-[#17201c] pb-9 md:flex-row md:items-end">
            <div><p className="text-xs font-bold tracking-[0.15em] text-[#33705b]">TODAY'S LEARNING</p><h1 className="mt-4 font-serif text-4xl tracking-[-0.04em] sm:text-5xl">오늘의 학습 기록부</h1><p className="mt-4 text-sm leading-7 text-[#59635e]">과제를 이어서 수행하고 최근에 남긴 생각의 흐름을 확인하세요.</p></div>
            <p className="font-mono text-xs text-[#6c756f]">2026 — 08 — 21</p>
          </section>

          {blockedMessage && <div className="mt-6 border-l-2 border-[#b2603d] bg-[#eadfd5] px-5 py-4 text-sm text-[#78432f]">{blockedMessage}</div>}

          <section className="student-stats mt-9 grid border-y border-[#17201c]/25 sm:grid-cols-3">
            <div className="border-b border-[#17201c]/20 py-6 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0"><div className="flex items-center gap-2 text-xs font-bold text-[#33705b]"><CheckCircle2 className="h-4 w-4" />제출 완료</div><p className="mt-3 font-serif text-4xl">{summaryLoading ? "—" : String(summary.submittedCount).padStart(2, "0")}</p></div>
            <div className="border-b border-[#17201c]/20 py-6 sm:border-b-0 sm:border-r sm:px-6"><div className="flex items-center gap-2 text-xs font-bold text-[#b2603d]"><Clock3 className="h-4 w-4" />미제출</div><p className="mt-3 font-serif text-4xl">{summaryLoading ? "—" : String(summary.notSubmittedCount).padStart(2, "0")}</p></div>
            <div className="py-6 sm:pl-6"><p className="text-xs font-bold text-[#65706a]">최근 학습 기록</p><p className="mt-3 font-serif text-4xl">{String(summary.recentLogs.length).padStart(2, "0")}</p></div>
          </section>

          {summary.feedbacks.length > 0 && <section className="order-[50] mt-12"><div className="flex items-end justify-between border-b border-[#17201c] pb-4"><div><p className="text-xs font-bold tracking-[0.12em] text-[#33705b]">TEACHER FEEDBACK</p><h2 className="mt-2 font-serif text-2xl">새 피드백</h2></div>{summary.unreadFeedbackCount > 0 && <span className="bg-[#b2603d] px-3 py-1 text-xs font-bold text-white">읽지 않음 {summary.unreadFeedbackCount}</span>}</div><div className="divide-y divide-[#17201c]/15">{summary.feedbacks.map((feedback) => <button key={feedback.submissionId} onClick={() => openFeedback(feedback)} className="group flex w-full items-start justify-between gap-5 py-5 text-left outline-none hover:bg-[#e8e4d9] focus-visible:ring-2 focus-visible:ring-[#33705b] sm:px-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`text-xs font-bold ${feedback.feedbackReadAt ? "text-[#65706a]" : "text-[#b2603d]"}`}>{feedback.feedbackReadAt ? "읽음" : "새 피드백"}</span><span className="text-xs text-[#65706a]">{feedback.feedbackStatus === "REVISION_REQUESTED" ? "수정 요청" : feedback.feedbackStatus === "REVISION_SUBMITTED" ? "수정 제출됨" : "검토 완료"}</span></div><h3 className="mt-2 font-serif text-lg">{feedback.taskTitle}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#59635e]">{feedback.teacherComment}</p></div><ArrowRight className="mt-2 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" /></button>)}</div></section>}

          {summary.weeklyLearning && <section className="order-[60] mt-12 border-y border-[#17201c] py-8"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold tracking-[0.12em] text-[#33705b]">WEEKLY CHANGE</p><h2 className="mt-2 font-serif text-2xl">이번 주 학습 변화</h2><p className="mt-3 text-sm text-[#59635e]">{summary.weeklyLearning.summaryMessage}</p></div>{summary.weeklyLearning.frequentBlockedKeyword && <div className="border-l-2 border-[#b2603d] pl-4"><p className="text-xs text-[#65706a]">자주 막힌 키워드</p><p className="mt-1 font-serif text-xl">{summary.weeklyLearning.frequentBlockedKeyword}</p></div>}</div><div className="mt-7 grid grid-cols-2 gap-px bg-[#17201c]/20 sm:grid-cols-4">{[
            ["질문", summary.weeklyLearning.questionCount, summary.weeklyLearning.previousQuestionCount],
            ["풀이 수정", summary.weeklyLearning.revisionCount, summary.weeklyLearning.previousRevisionCount],
            ["성찰 작성", summary.weeklyLearning.reflectionCount, summary.weeklyLearning.previousReflectionCount],
            ["피드백 반영률", summary.weeklyLearning.feedbackApplicationRate, summary.weeklyLearning.previousFeedbackApplicationRate],
          ].map(([label, current, previous]) => { const difference = Number(current) - Number(previous); const isRate = label === "피드백 반영률"; return <div key={String(label)} className="bg-[#f3f0e8] p-5"><p className="text-xs font-bold text-[#65706a]">{label}</p><p className="mt-3 font-serif text-3xl">{current}{isRate ? "%" : ""}</p><p className={`mt-2 text-xs ${difference > 0 ? "text-[#33705b]" : difference < 0 ? "text-[#b2603d]" : "text-[#747d78]"}`}>지난주보다 {difference > 0 ? `+${difference}` : difference}{isRate ? "%p" : ""}</p></div>; })}</div></section>}

          <section className="student-modules order-[10] mt-12 grid gap-10">
            <div>
              <div className="flex items-center justify-between border-b border-[#17201c] pb-4"><div><p className="text-xs font-bold tracking-[0.12em] text-[#33705b]">NEXT STEP</p><h2 className="mt-2 font-serif text-2xl">과제 이어가기</h2></div><BookOpen className="h-6 w-6 text-[#33705b]" strokeWidth={1.5} /></div>
              {summaryLoading ? (
                <div className="mt-5 space-y-3" aria-label="마감 과제를 불러오는 중">
                  {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse border border-[#17201c]/15 bg-[#e8e4d9]" />)}
                </div>
              ) : summary.upcomingTasks.length > 0 ? (
                <div className="mt-5 divide-y divide-[#17201c]/15 border-y border-[#17201c]">
                  {summary.upcomingTasks.map((task) => (
                    <Link key={task.id} to={`/student/assignment/${task.id}`} className="group block py-5 outline-none transition-colors hover:bg-[#e8e4d9] focus-visible:ring-2 focus-visible:ring-[#33705b] sm:px-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0"><p className="text-xs font-bold text-[#33705b]">{task.className} · {task.submitted ? "제출 완료" : getDueLabel(task.dueDate)}</p><h3 className="mt-2 truncate font-serif text-xl">{task.title}</h3></div>
                        <ArrowRight className="mt-1 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[#65706a]"><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDueDate(task.dueDate)}</span><span>{task.progress}% 진행</span></div>
                      <div className="mt-2 h-1 bg-[#17201c]/10"><span className="block h-full bg-[#33705b]" style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }} /></div>
                      <div className="mt-4 flex flex-wrap gap-1.5" aria-label={`현재 학습 단계: ${learningSteps.find((step) => step.key === task.currentStep)?.label ?? "시작 전"}`}>
                        {learningSteps.map((step, index) => {
                          const currentIndex = Math.max(0, learningSteps.findIndex((item) => item.key === task.currentStep));
                          const completed = index <= currentIndex;
                          return <span key={step.key} className={`px-2 py-1 text-[10px] font-bold ${completed ? "bg-[#dce7df] text-[#285442]" : "bg-[#17201c]/5 text-[#7a837e]"}`}>{step.label}</span>;
                        })}
                      </div>
                      <p className="mt-3 text-xs text-[#59635e]">다음 행동 · {task.nextAction}</p>
                    </Link>
                  ))}
                  <Link to="/student/assignments" className="flex items-center justify-between py-4 text-sm font-bold sm:px-3"><span>전체 과제 보기</span><ArrowRight className="h-4 w-4" /></Link>
                </div>
              ) : (
                <div className="mt-5 border border-dashed border-[#17201c]/30 px-6 py-10 text-center"><p className="font-serif text-xl text-[#4e5953]">7일 안에 마감되는 과제가 없습니다.</p><Link to="/student/assignments" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#33705b]">전체 과제 보기 <ArrowRight className="h-4 w-4" /></Link></div>
              )}
            </div>

            <div>
              <div className="flex items-end justify-between border-b border-[#17201c] pb-4"><div><p className="text-xs font-bold tracking-[0.12em] text-[#33705b]">LEARNING PROGRESS</p><h2 className="mt-2 font-serif text-2xl">진행 단계</h2></div><span className="text-xs text-[#65706a]">최근 마감순</span></div>
              {summary.upcomingTasks.length > 0 ? <div className="mt-5 grid gap-3 md:grid-cols-3">{summary.upcomingTasks.slice(0, 3).map((task) => <Link key={task.id} to={`/student/assignment/${task.id}`} className="border border-[#17201c]/20 bg-[#e8e4d9] p-4 outline-none hover:border-[#33705b] focus-visible:ring-2 focus-visible:ring-[#33705b]"><p className="truncate text-sm font-bold">{task.title}</p><p className="mt-2 text-xs text-[#33705b]">{learningSteps.find((step) => step.key === task.currentStep)?.label ?? "시작 전"} · {task.progress}%</p><p className="mt-2 text-xs leading-5 text-[#59635e]">{task.nextAction}</p></Link>)}</div> : <div className="mt-5 border border-dashed border-[#17201c]/30 p-6 text-center text-sm text-[#65706a]">진행 중인 마감 과제가 없습니다.</div>}
            </div>

            <div>
              <div className="flex items-end justify-between border-b border-[#17201c] pb-4"><div><p className="text-xs font-bold tracking-[0.12em] text-[#33705b]">REFLECTION</p><h2 className="mt-2 font-serif text-2xl">성찰 이어쓰기</h2></div></div>
              {summary.upcomingTasks.length > 0 ? <Link to={`/student/assignment/${summary.upcomingTasks[0].id}`} className="mt-5 flex items-center justify-between border border-[#17201c]/20 p-5 outline-none hover:bg-[#e8e4d9] focus-visible:ring-2 focus-visible:ring-[#33705b]"><div><p className="font-bold">{summary.upcomingTasks[0].title}</p><p className="mt-2 text-sm text-[#59635e]">과제에서 오늘 달라진 생각과 아직 막힌 부분을 기록하세요.</p></div><ArrowRight className="h-5 w-5 shrink-0" /></Link> : <div className="mt-5 border border-dashed border-[#17201c]/30 p-6 text-center"><p className="text-sm text-[#65706a]">성찰을 연결할 진행 과제가 없습니다.</p><Link to="/student/assignments" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#285442] outline-none focus-visible:ring-2 focus-visible:ring-[#33705b]">과제 목록에서 시작하기 <ArrowRight className="h-4 w-4" /></Link></div>}
            </div>

            <div>
              <div className="flex items-end justify-between border-b border-[#17201c] pb-4"><div><p className="text-xs font-bold tracking-[0.12em] text-[#33705b]">LEARNING TRACE</p><h2 className="mt-2 font-serif text-2xl">최근 생각의 흔적</h2></div><span className="text-xs text-[#6c756f]">시간순</span></div>
              {summary.recentLogs.length === 0 ? (
                <div className="mt-5 border border-dashed border-[#17201c]/30 px-6 py-12 text-center"><p className="font-serif text-xl text-[#4e5953]">아직 남겨진 학습 기록이 없습니다.</p><p className="mt-3 text-sm text-[#747d78]">과제에서 AI와 대화를 시작하면 이곳에 과정이 쌓입니다.</p></div>
              ) : (
                <div className="relative mt-6 pl-7 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-[#33705b]/35">
                  {summary.recentLogs.map((log) => <article key={log.id} className="relative border-b border-[#17201c]/15 pb-6 pt-1"><span className="absolute -left-7 top-2 h-[11px] w-[11px] border-2 border-[#33705b] bg-[#f3f0e8]" /><div className="flex justify-between gap-4"><span className="text-xs font-bold text-[#33705b]">과제 #{log.taskId}</span><time className="font-mono text-[11px] text-[#747d78]">{log.createdAt}</time></div><p className="mt-3 line-clamp-2 text-sm leading-7 text-[#46514b]">{log.question}</p></article>)}
                </div>
              )}
            </div>
          </section>

          <section className="student-privacy order-[70] mt-12 border border-[#17201c] bg-[#e8e4d9] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.14em] text-[#33705b]">DATA & AI TRANSPARENCY</p><h2 className="mt-2 font-serif text-2xl">내 기록은 이렇게 사용됩니다</h2></div><button type="button" onClick={togglePrivacy} aria-expanded={privacyExpanded} aria-controls="privacy-settings" className="shrink-0 border border-[#17201c] px-4 py-2 text-sm font-bold outline-none hover:bg-[#f3f0e8] focus-visible:ring-2 focus-visible:ring-[#33705b]">{privacyExpanded ? "접기" : "펼치기"}</button></div>
            {privacyExpanded && <div id="privacy-settings" className="mt-5 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
              <div><div className="grid gap-4 text-sm leading-6 text-[#4e5953] sm:grid-cols-3"><p><strong className="block text-[#17201c]">저장</strong>계정 정보, 내가 쓴 질문·답안·성찰과 AI가 만든 답변을 학습 과정 확인용으로 저장합니다.</p><p><strong className="block text-[#17201c]">공개</strong>담당 교사는 담당 과제의 질문, AI 답변, 제출물과 성찰을 지도·평가 목적으로 볼 수 있습니다.</p><p><strong className="block text-[#17201c]">보존</strong>수업·이용 종료 후 1년 이내 삭제가 원칙이며 학교 정책과 법령을 우선합니다.</p></div><p className="mt-5 border-l-2 border-[#b2603d] pl-4 text-xs leading-5 text-[#78432f]">미성년 학생은 학교 및 법정대리인의 동의 절차가 필요합니다. 주민등록번호·주소·전화번호·비밀번호·건강정보는 AI 대화에 입력하지 마세요.</p></div>
              <div className="flex flex-col justify-end gap-3"><button onClick={exportMyRecords} className="border border-[#17201c] bg-[#f3f0e8] px-5 py-3 text-sm font-bold outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[#33705b]">내 기록 JSON으로 내보내기</button><button onClick={requestRecordDeletion} className="bg-[#17201c] px-5 py-3 text-sm font-bold text-white outline-none hover:bg-[#78432f] focus-visible:ring-2 focus-visible:ring-[#b2603d]">기록 삭제 요청</button><p className="text-[11px] leading-5 text-[#65706a]">삭제 승인 시 AI 대화·제출·성찰·유사도 기록이 삭제되며 계정은 별도 관리됩니다.</p></div>
            </div>}
          </section>
        </div>
      </main>
    </div>
  );
}
