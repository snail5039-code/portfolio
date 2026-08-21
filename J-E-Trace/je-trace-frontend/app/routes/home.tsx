import { ArrowUpRight, Check, GraduationCap, School, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "J·E Trace — 생각의 과정을 기록하다" },
    { name: "description", content: "AI와 함께한 학습의 과정을 기록하고, 이해하고, 평가하는 교육 플랫폼" },
  ];
}

const roles = [
  { number: "01", title: "학생으로 시작", description: "과제를 확인하고 AI와 나눈 사고 과정을 기록합니다.", to: "/auth?mode=STUDENT", icon: GraduationCap },
  { number: "02", title: "교사로 시작", description: "결과 너머의 학습 흐름을 살피고 구체적으로 피드백합니다.", to: "/auth?mode=TEACHER", icon: School },
  { number: "03", title: "관리자 로그인", description: "교사 승인과 서비스 운영 상태를 관리합니다.", to: "/auth?mode=ADMIN", icon: ShieldCheck },
];

const trace = [
  { time: "14:02", label: "질문", text: "이 풀이에서 반복문을 두 번 사용해야 하는 이유가 뭘까?" },
  { time: "14:06", label: "탐색", text: "입력 배열과 결과 배열의 역할을 나눠 생각해 보기로 했다." },
  { time: "14:18", label: "수정", text: "중복 순회를 하나로 합치고 시간 복잡도를 O(n)으로 개선했다." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f3f0e8] text-[#17201c] selection:bg-[#b7d4c8]">
      <header className="border-b border-[#17201c]/20">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link to="/" className="flex items-center gap-3" aria-label="J·E Trace 홈">
            <span className="grid h-9 w-9 place-items-center border border-[#17201c] bg-[#17201c] text-xs font-bold text-[#f3f0e8]">JE</span>
            <span className="text-[15px] font-bold tracking-[-0.02em]">J·E TRACE</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#46504b] sm:flex" aria-label="주요 메뉴">
            <a href="#about" className="transition-colors hover:text-[#17201c]">서비스 소개</a>
            <a href="#entry" className="transition-colors hover:text-[#17201c]">시작하기</a>
          </nav>
          <Link to="/auth?mode=STUDENT" className="group inline-flex items-center gap-2 border-b border-[#17201c] pb-1 text-sm font-semibold">
            로그인
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1400px] border-x border-[#17201c]/20 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="flex min-h-[650px] flex-col justify-between border-b border-[#17201c]/20 p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-14 xl:p-20">
            <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.16em] text-[#56625c]">
              <span className="h-px w-10 bg-[#56625c]" /> LEARNING PROCESS ARCHIVE
            </div>
            <div className="py-16 lg:py-24">
              <p className="mb-5 text-sm font-semibold text-[#33705b]">AI 시대의 새로운 학습 기록</p>
              <h1 className="max-w-3xl font-serif text-[clamp(3.4rem,7vw,7rem)] font-medium leading-[0.98] tracking-[-0.055em]">
                정답보다,<br />생각의 <em className="font-normal text-[#33705b]">흔적</em>
              </h1>
              <p className="mt-8 max-w-xl text-base leading-8 text-[#4d5752] sm:text-lg">
                학생이 무엇을 물었고, 어떻게 이해하고, 어디서 다시 고쳤는지. J·E Trace는 AI와 함께한 배움의 전 과정을 한 편의 기록으로 남깁니다.
              </p>
            </div>
            <div className="grid gap-3 border-t border-[#17201c]/20 pt-5 text-sm sm:grid-cols-3">
              {["질문과 응답 기록", "과제·평가 연결", "학습 흐름 분석"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-[#46504b]"><Check className="h-4 w-4 text-[#33705b]" />{item}</div>
              ))}
            </div>
          </div>

          <div id="about" className="relative min-h-[650px] overflow-hidden bg-[#dce7df] p-6 sm:p-10 lg:p-14 xl:p-20">
            <div className="absolute right-6 top-7 font-serif text-7xl leading-none text-[#33705b]/15 sm:right-10 sm:top-10 sm:text-9xl">“</div>
            <div className="relative flex h-full flex-col">
              <div className="flex items-end justify-between border-b border-[#17201c]/25 pb-5">
                <div><p className="text-xs font-bold tracking-[0.16em] text-[#33705b]">TRACE 024</p><h2 className="mt-2 font-serif text-2xl font-medium">알고리즘 과제 학습 기록</h2></div>
                <span className="hidden text-xs text-[#56625c] sm:block">2026. 08. 21</span>
              </div>
              <div className="relative mt-8 flex-1 pl-7 before:absolute before:bottom-4 before:left-[5px] before:top-2 before:w-px before:bg-[#33705b]/35">
                {trace.map((item, index) => (
                  <div key={item.time} className="relative pb-9 last:pb-0">
                    <span className="absolute -left-7 top-1 h-[11px] w-[11px] border-2 border-[#33705b] bg-[#dce7df]" />
                    <div className="flex items-baseline gap-3"><span className="font-mono text-[11px] text-[#65716b]">{item.time}</span><span className="text-xs font-bold text-[#33705b]">{item.label}</span></div>
                    <p className="mt-2 max-w-md text-[15px] leading-7 text-[#35413b]">{item.text}</p>
                    {index === 2 && (
                      <div className="mt-5 rotate-[-1deg] border-l-2 border-[#b2603d] pl-4 font-serif text-sm italic leading-6 text-[#8c4a30]">
                        “풀이의 변화가 명확해요. 처음 접근과 수정 이유를 함께 적어 봅시다.”
                        <span className="mt-1 block font-sans text-[11px] not-italic">— 담당 교사 피드백</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-10 flex items-center justify-between border-t border-[#17201c]/25 pt-5 text-xs text-[#56625c]"><span>대화 12회 · 수정 3회</span><span className="font-semibold text-[#33705b]">과정이 평가가 됩니다</span></div>
            </div>
          </div>
        </section>

        <section id="entry" className="mx-auto max-w-[1400px] border-x border-b border-[#17201c]/20 px-6 py-16 sm:px-10 sm:py-20 lg:px-14 xl:px-20">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div><p className="text-xs font-bold tracking-[0.16em] text-[#33705b]">YOUR WORKSPACE</p><h2 className="mt-4 max-w-sm font-serif text-4xl leading-tight tracking-[-0.035em] sm:text-5xl">당신의 자리에서<br />기록을 시작하세요.</h2></div>
            <div className="border-t border-[#17201c]">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <Link key={role.number} to={role.to} className="group grid gap-4 border-b border-[#17201c]/25 py-6 transition-colors hover:bg-[#e8e4d9] sm:grid-cols-[48px_52px_1fr_32px] sm:items-center sm:px-4">
                    <span className="font-mono text-xs text-[#768079]">{role.number}</span><Icon className="h-6 w-6 text-[#33705b]" strokeWidth={1.6} />
                    <div><h3 className="text-lg font-bold tracking-[-0.02em]">{role.title}</h3><p className="mt-1 text-sm leading-6 text-[#59635e]">{role.description}</p></div>
                    <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 py-7 text-xs text-[#66716b] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><span>© 2026 J·E Trace</span><span>배움의 결과가 아닌 과정을 기록합니다.</span></footer>
    </div>
  );
}
