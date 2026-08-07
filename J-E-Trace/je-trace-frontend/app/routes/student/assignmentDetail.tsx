import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import api from "../../lib/axios";

type LogItem = {
  id: number;
  question: string;
  answer: string;
  createdAt: string;
  status: string;
};

type TaskDetail = {
  id: number;
  title: string;
  className: string;
  description: string;
  dueDate: string;
  aiAllowed: boolean;
  submissionId: number | null;
  submitted: boolean;
  submittedAt: string | null;
  aiUsed: boolean;
  content: string | null;
  score: number | null;
  teacherComment: string | null;
  logs: LogItem[];
};

type ChatResponse = {
  relevant: boolean;
  score: number;
  answer: string;
  status: string;
};

type ChatMessage =
  | {
      type: "question";
      text: string;
      createdAt: string;
      status?: string;
      isLatest?: boolean;
    }
  | {
      type: "answer";
      text: string;
      createdAt: string;
      status: string;
      isLatest?: boolean;
    };

export default function AssignmentDetailPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const loginId =
    typeof window !== "undefined" ? localStorage.getItem("loginId") ?? "" : "";
  const loginRole =
    typeof window !== "undefined" ? localStorage.getItem("loginRole") ?? "" : "";

  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [question, setQuestion] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [lastAiAnswer, setLastAiAnswer] = useState<ChatResponse | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  useEffect(() => {
    if (!loginId) {
      alert("로그인이 필요합니다.");
      navigate("/auth?mode=STUDENT");
      return;
    }

    if (loginRole !== "STUDENT") {
      alert("학생 계정만 접근할 수 있습니다.");
      navigate("/");
      return;
    }
  }, [loginId, loginRole, navigate]);

  const fetchDetail = async () => {
    if (!taskId || !loginId) return;

    try {
      const res = await api.get(`/student/tasks/${taskId}`, {
        params: { loginId },
      });
      setDetail(res.data);
      setAnswerText(res.data.content ?? "");
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.message ?? "과제 상세 조회 실패");
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [taskId, loginId]);

  const sortedLogs = useMemo(() => {
    return [...(detail?.logs ?? [])].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });
  }, [detail?.logs]);

  const cautionCount = useMemo(() => {
    return sortedLogs.filter((log) => log.status === "주의").length;
  }, [sortedLogs]);

  const chatMessages = useMemo(() => {
    const messages: ChatMessage[] = [];

    sortedLogs.forEach((log) => {
      messages.push({
        type: "question",
        text: log.question,
        createdAt: log.createdAt,
      });

      messages.push({
        type: "answer",
        text: log.answer,
        createdAt: log.createdAt,
        status: log.status,
      });
    });

    if (
      lastAiAnswer &&
      lastQuestion.trim() &&
      !sortedLogs.some(
        (log) =>
          log.question === lastQuestion &&
          log.answer === lastAiAnswer.answer &&
          log.status === lastAiAnswer.status
      )
    ) {
      const now = new Date().toLocaleString("ko-KR");

      messages.push({
        type: "question",
        text: lastQuestion,
        createdAt: now,
        isLatest: true,
      });

      messages.push({
        type: "answer",
        text: lastAiAnswer.answer,
        createdAt: now,
        status: lastAiAnswer.status,
        isLatest: true,
      });
    }

    return messages;
  }, [sortedLogs, lastAiAnswer, lastQuestion]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, isChatLoading]);

  const handleAskAi = async () => {
    if (detail?.submitted) {
      alert("제출 완료 후에는 AI 질문을 할 수 없습니다.");
      return;
    }

    if (!question.trim()) {
      alert("질문을 입력하세요.");
      return;
    }

    if (!detail?.aiAllowed) {
      alert("이 과제는 AI 사용이 허용되지 않았습니다.");
      return;
    }

    const currentQuestion = question.trim();

    try {
      setIsChatLoading(true);
      setLastQuestion(currentQuestion);

      const res = await api.post(`/student/tasks/${taskId}/chat`, {
        loginId,
        question: currentQuestion,
      });

      setLastAiAnswer(res.data);
      setQuestion("");
      await fetchDetail();
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.message ?? "AI 질문 실패");
    } finally {
      setIsChatLoading(false);
    }
  };

  const appendAiAnswerToContent = () => {
    if (!lastAiAnswer?.answer) return;

    setAnswerText((prev) => {
      if (!prev.trim()) return lastAiAnswer.answer;
      return `${prev}\n\n${lastAiAnswer.answer}`;
    });
  };

  const handleAppendSpecificAnswer = (text: string) => {
    if (!text?.trim()) return;

    setAnswerText((prev) => {
      if (!prev.trim()) return text;
      return `${prev}\n\n${text}`;
    });
  };

  const handleSubmit = async () => {
    if (!detail || detail.submitted || isSubmitLoading) return;

    if (!answerText.trim()) {
      alert("답안을 입력하세요.");
      return;
    }

    try {
      setIsSubmitLoading(true);

      await api.put(`/student/tasks/${taskId}/submit`, {
        loginId,
        content: answerText,
        aiUsed: (detail?.logs?.length ?? 0) > 0,
      });

      setDetail((prev) =>
        prev
          ? {
              ...prev,
              submitted: true,
              submittedAt: new Date().toLocaleString("ko-KR"),
            }
          : prev
      );

      alert("제출 완료");
      navigate("/student/assignments");
    } catch (error: any) {
      console.error(error);
      alert(error?.response?.data?.message ?? "제출 실패");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleQuestionKeyDown = async (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleAskAi();
    }
  };

  if (!detail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 p-6 sm:p-8">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-slate-200 bg-white px-8 py-10 text-slate-600 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="relative px-6 py-7 sm:px-8 sm:py-8">
            <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-blue-100/60 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-slate-200/70 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  <Sparkles size={16} />
                  ASSIGNMENT DETAIL
                </div>

                <p className="mt-4 text-sm font-semibold text-slate-500">
                  {detail.className}
                </p>

                <h1 className="mt-2 break-words text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                  {detail.title}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2">
                    <CalendarDays size={15} />
                    마감일: {detail.dueDate}
                  </div>

                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 ${
                      detail.aiAllowed
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Bot size={15} />
                    AI 사용: {detail.aiAllowed ? "허용" : "금지"}
                  </div>
                </div>
              </div>

              <Link
                to="/student/assignments"
                className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                과제 목록
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <ClipboardCheck size={20} />
                </div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">
                  과제 설명
                </h2>
              </div>

              <div className="mt-5 rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {detail.description}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    AI 사용
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-900">
                    {detail.aiAllowed ? "허용" : "금지"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    제출 여부
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-900">
                    {detail.submitted ? "제출 완료" : "미제출"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <MessageSquare size={20} />
                </div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">
                  최종 답안 작성
                </h2>
              </div>

              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                rows={14}
                disabled={detail.submitted}
                className="mt-5 w-full rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-200/60 disabled:opacity-60"
                placeholder="최종 답안을 입력하세요."
              />

              <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
                  제출 상태:{" "}
                  {detail.submitted
                    ? `제출 완료 (${detail.submittedAt ?? "-"})`
                    : "미제출"}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitLoading || detail.submitted}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-6 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {detail.submitted
                    ? "제출 완료"
                    : isSubmitLoading
                    ? "제출 중..."
                    : "최종 제출"}
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <CheckCircle2 size={20} />
                </div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">
                  교사 피드백
                </h2>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    점수
                  </p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                    {detail.score ?? 0}
                  </p>
                </div>

                <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    코멘트
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {detail.teacherComment ?? "아직 없음"}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div>
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-7 lg:sticky lg:top-6">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Bot size={20} />
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900">
                      AI 대화
                    </h2>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    이전 대화는 위에, 새 질문과 새 답변은 아래에 쌓입니다.
                  </p>
                </div>

                <div className="flex shrink-0 gap-3">
                  <div className="min-w-[100px] rounded-2xl bg-slate-50 px-4 py-4 text-center ring-1 ring-slate-200">
                    <p className="text-xs font-semibold text-slate-500">
                      총 질문 수
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                      {sortedLogs.length}
                    </p>
                  </div>

                  <div className="min-w-[100px] rounded-2xl bg-rose-50 px-4 py-4 text-center ring-1 ring-rose-100">
                    <p className="text-xs font-semibold text-rose-500">주의</p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-rose-600">
                      {cautionCount}
                    </p>
                  </div>
                </div>
              </div>

              <div
                ref={chatScrollRef}
                className="mt-5 h-[460px] overflow-y-auto rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4">
                  {chatMessages.length === 0 && !isChatLoading && (
                    <div className="flex h-[260px] flex-col items-center justify-center text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 ring-1 ring-slate-200">
                        <MessageSquare size={22} />
                      </div>
                      <p className="mt-4 text-sm text-slate-500">
                        아직 질문 기록이 없습니다.
                      </p>
                    </div>
                  )}

                  {chatMessages.map((message, index) => {
                    const isQuestion = message.type === "question";

                    return (
                      <div
                        key={`${message.type}-${index}-${message.createdAt}`}
                        className={`flex ${
                          isQuestion ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`w-full rounded-[24px] px-4 py-4 shadow-sm ${
                            isQuestion
                              ? "max-w-[88%] bg-slate-900 text-white"
                              : "max-w-[94%] border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`text-xs font-bold ${
                                isQuestion
                                  ? "text-slate-200"
                                  : "text-slate-500"
                              }`}
                            >
                              {isQuestion ? "나" : "AI"}
                            </span>

                            <div className="flex flex-wrap items-center gap-2">
                              {!isQuestion && "status" in message && (
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                    message.status === "주의"
                                      ? "bg-rose-50 text-rose-600 ring-1 ring-rose-100"
                                      : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
                                  }`}
                                >
                                  {message.status}
                                </span>
                              )}

                              <span
                                className={`text-[11px] ${
                                  isQuestion
                                    ? "text-slate-300"
                                    : "text-slate-400"
                                }`}
                              >
                                {message.createdAt}
                              </span>
                            </div>
                          </div>

                          <p
                            className={`whitespace-pre-wrap break-words text-[15px] leading-7 ${
                              isQuestion ? "text-white" : "text-slate-700"
                            }`}
                          >
                            {message.text}
                          </p>

                          {!isQuestion && (
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() =>
                                  handleAppendSpecificAnswer(message.text)
                                }
                                className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-slate-800"
                              >
                                답안에 추가
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="w-full max-w-[94%] rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-500">
                            AI
                          </span>
                          <span className="text-[11px] text-slate-400">
                            응답 생성 중
                          </span>
                        </div>
                        <p className="text-[15px] leading-7 text-slate-600">
                          질문을 분석하고 답변을 작성하는 중...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleQuestionKeyDown}
                  rows={3}
                  className="w-full resize-none rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder={
                    detail.aiAllowed
                      ? "과제와 관련된 질문을 입력하세요. (Enter 전송 / Shift+Enter 줄바꿈)"
                      : "이 과제는 AI 사용이 허용되지 않았습니다."
                  }
                  disabled={!detail.aiAllowed || isChatLoading || detail.submitted}
                />

                <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500 ring-1 ring-slate-200">
                    <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                    <span>
                      {detail.aiAllowed
                        ? "채팅창은 스크롤되고, 새 질문과 새 답변은 맨 아래에 계속 누적됩니다."
                        : "현재 과제는 AI 사용 금지 상태입니다."}
                    </span>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {lastAiAnswer && (
                      <button
                        onClick={appendAiAnswerToContent}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-800 whitespace-nowrap transition hover:bg-slate-300"
                      >
                        최근 답변 추가
                      </button>
                    )}

                    <button
                      onClick={handleAskAi}
                      disabled={
                        isChatLoading || !detail.aiAllowed || detail.submitted
                      }
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isChatLoading ? "질문 중..." : "보내기"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}