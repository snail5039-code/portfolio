import {
  ArrowRight,
  BarChart3,
  GraduationCap,
  MessageSquareText,
  School,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router";

const highlights = [
  {
    title: "AI 대화 기반 학습",
    desc: "학생 질문과 답변 흐름을 기록하고 누적합니다.",
    icon: MessageSquareText,
  },
  {
    title: "학습 분석 시각화",
    desc: "제출, 평가, 대화 로그를 바탕으로 학습 현황을 확인합니다.",
    icon: BarChart3,
  },
  {
    title: "교사·학생 통합 운영",
    desc: "학생, 교사, 관리자 화면을 한 서비스로 연결합니다.",
    icon: Sparkles,
  },
];

const modeCards = [
  {
    title: "학생 모드",
    desc: "AI와 대화하며 과제를 수행하고, 제출 현황과 학습 기록을 확인합니다.",
    badge: "STUDENT",
    to: "/auth?mode=STUDENT",
    icon: GraduationCap,
  },
  {
    title: "교사 모드",
    desc: "학생 제출 현황, AI 대화 로그, 과제 관리와 평가를 한 화면에서 관리합니다.",
    badge: "TEACHER",
    to: "/auth?mode=TEACHER",
    icon: School,
  },
  {
    title: "관리자",
    desc: "교사 가입 승인과 계정 관리 등 서비스 운영에 필요한 기능을 담당합니다.",
    badge: "ADMIN",
    to: "/auth?mode=ADMIN",
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-8 shadow-[0_10px_30px_rgba(15,23,42,0.05)] md:px-10 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold tracking-[0.28em] text-slate-500">
                JE TRACE
              </div>

              <h1 className="mt-6 text-4xl font-black tracking-[-0.03em] text-slate-950 md:text-6xl">
                AI 교육 솔루션
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                학습자와 교사를 위한 AI 채팅 기반 학습 기록 및 분석 플랫폼.
                과제 수행, 제출 관리, 대화 로그, 평가 흐름을 하나의 서비스로
                연결합니다.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  AI 채팅 학습 기록
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  과제 제출 및 평가
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  교사 승인 및 관리
                </span>
              </div>
            </div>

            <div className="grid gap-4">
              {highlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {modeCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.title}
                  to={card.to}
                  className="group rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-slate-200 bg-slate-50 text-slate-700 transition-colors group-hover:bg-slate-900 group-hover:text-white">
                      <Icon className="h-7 w-7" />
                    </div>

                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold tracking-[0.22em] text-slate-500">
                      {card.badge}
                    </span>
                  </div>

                  <h2 className="mt-7 text-3xl font-black tracking-[-0.03em] text-slate-950">
                    {card.title}
                  </h2>

                  <p className="mt-4 min-h-[88px] text-base leading-8 text-slate-600">
                    {card.desc}
                  </p>

                  <div className="mt-8 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      클릭해서 바로 시작
                    </span>

                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white transition-transform group-hover:translate-x-1">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}