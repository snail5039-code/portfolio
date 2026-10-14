import React from "react";
import { Link } from "react-router-dom";
import { HomeLogo } from "./HomeBrand";

const features = [
  { icon: "✎", title: "매일 가볍게 기록", text: "오늘 한 일과 이어서 할 일을 짧게 남기면 업무의 맥락이 자연스럽게 쌓입니다." },
  { icon: "▦", title: "주간·월간 흐름 확인", text: "흩어진 일일 기록을 주간과 월간 단위로 모아 성과와 진행 상황을 확인합니다." },
  { icon: "⇄", title: "매끄러운 인수인계", text: "업무 기록을 바탕으로 다음 담당자가 이해하기 쉬운 인수인계 문서를 만듭니다." },
];

const previewCards = [
  { title: "주간 팀 미팅", time: "09:00", position: "left-[8%] top-0", tone: "border-[#efc9bb] bg-[#fffaf7]" },
  { title: "프로젝트 집중", time: "13:00", position: "left-[42%] top-0", tone: "border-[#bed0ed] bg-[#f9fbff]" },
  { title: "하루 마무리", time: "17:30", position: "right-[7%] top-2", tone: "border-[#efc9bb] bg-[#fffaf7]" },
];

function LandingHome() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fdfcf9] text-[#1f2e45]">
      <header className="mx-auto flex min-h-[76px] max-w-[1280px] items-center justify-between px-5 md:px-8">
        <HomeLogo />
        <nav className="hidden items-center gap-8 text-xs text-[#5d6470] md:flex" aria-label="소개 메뉴">
          <a href="#how" className="no-underline hover:text-[#d95635]">사용 흐름</a>
          <a href="#features" className="no-underline hover:text-[#d95635]">주요 기능</a>
          <Link to="/guide" className="no-underline hover:text-[#d95635]">이용 방법</Link>
        </nav>
        <div className="flex items-center gap-2">
          {import.meta.env.DEV && <Link to="/developer" className="hidden rounded-full px-3 py-2 text-xs font-semibold text-[#7a6f68] no-underline hover:bg-white lg:inline-flex">개발자 모드</Link>}
          <Link to="/preview" className="hidden rounded-full border border-[#e6cfc3] bg-[#fff8f4] px-4 py-2 text-xs font-bold text-[#c65b3d] no-underline hover:bg-white sm:inline-flex">미리보기 체험</Link>
          <Link to="/login" className="rounded-full border border-[#eadfd7] px-4 py-2 text-xs text-[#4e5664] no-underline hover:bg-white">로그인</Link>
          <Link to="/join" className="hidden rounded-full bg-[#d95d3b] px-4 py-2 text-xs font-bold text-white no-underline hover:bg-[#c95032] sm:inline-flex">무료로 시작하기</Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1120px] px-5 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <span className="inline-flex rounded-full border border-[#efdcd2] bg-[#fff8f4] px-4 py-2 text-[11px] font-semibold text-[#c65b3d]">기록이 이어지는 업무 공간</span>
          <h1 className="mx-auto mt-7 max-w-[820px] font-serif text-4xl font-bold leading-[1.25] tracking-[-0.04em] text-[#202d43] md:text-6xl">
            오늘의 작은 기록이<br /><span className="text-[#d95d3b]">내일의 업무 맥락</span>이 됩니다
          </h1>
          <p className="mx-auto mt-6 max-w-[590px] text-sm leading-7 text-[#73767b] md:text-base">WorkLog는 업무일지, 주간·월간 보고, 인수인계를 하나의 흐름으로 연결합니다. 복잡한 도구 대신 매일의 일을 차근차근 기록해 보세요.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/join" className="rounded-xl bg-[#d95d3b] px-7 py-3.5 text-sm font-bold text-white no-underline shadow-[0_10px_30px_rgba(217,93,59,0.18)] hover:bg-[#c95032]">WorkLog 시작하기</Link>
            <Link to="/preview" className="rounded-xl border border-[#e8dfd8] bg-white px-7 py-3.5 text-sm font-semibold text-[#515966] no-underline hover:bg-[#fffaf7]">로그인 없이 체험하기</Link>
          </div>

          <div className="relative mx-auto mt-20 hidden h-[300px] max-w-[980px] md:block" aria-label="WorkLog 업무 흐름 미리보기">
            <svg className="absolute left-0 top-[145px] h-[100px] w-full" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 58 C120 70,170 35,300 44 S510 82,650 55 S835 35,1000 61" fill="none" stroke="#334f73" strokeWidth="1.5" /></svg>
            {previewCards.map((card) => (
              <article key={card.title} className={`absolute z-10 w-[190px] rounded-xl border p-4 text-left shadow-[0_14px_35px_rgba(65,45,34,0.06)] ${card.position} ${card.tone}`}>
                <span className="text-[10px] text-[#918b85]">{card.time}</span><h2 className="mt-2 text-sm font-bold">{card.title}</h2><p className="mt-2 text-[11px] leading-5 text-[#6f7072]">업무 내용과 다음 행동을 간단하게 기록합니다.</p>
              </article>
            ))}
            <div className="absolute left-1/2 top-[202px] z-20 -translate-x-1/2 text-center"><span className="block text-[10px] font-bold text-[#d95d3b]">지금 여기</span><span className="mx-auto mt-1 block h-4 w-4 rounded-full border-[3px] border-[#f3c5b6] bg-[#d95d3b]" /></div>
          </div>
        </section>

        <section id="how" className="border-y border-[#eee7e1] bg-white/70 px-5 py-16 md:py-20">
          <div className="mx-auto max-w-[1080px]"><p className="text-center text-xs font-bold tracking-[0.2em] text-[#d95d3b]">WORK FLOW</p><h2 className="mt-3 text-center font-serif text-3xl font-bold">기록에서 인수인계까지, 한 흐름으로</h2>
            <div className="mt-12 grid gap-4 md:grid-cols-4">
              {["오늘 업무 기록", "주간 흐름 정리", "월간 성과 확인", "인수인계 문서 완성"].map((step, index) => (
                <div key={step} className="rounded-2xl border border-[#eee5de] bg-[#fdfcf9] p-6 text-left"><span className="text-xs font-bold text-[#d95d3b]">0{index + 1}</span><h3 className="mt-4 text-sm font-bold">{step}</h3><p className="mt-2 text-xs leading-6 text-[#7b7b79]">앞선 기록이 다음 단계의 재료가 되어 반복 입력을 줄여줍니다.</p></div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1080px] px-5 py-16 md:py-24"><div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => <article key={feature.title} className="rounded-2xl border border-[#eee5de] bg-white p-7"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#fff1ea] text-[#d95d3b]">{feature.icon}</span><h2 className="mt-5 text-lg font-bold">{feature.title}</h2><p className="mt-3 text-sm leading-7 text-[#74777b]">{feature.text}</p></article>)}
        </div></section>

        <section className="px-5 pb-20"><div className="mx-auto max-w-[1000px] rounded-[28px] bg-[#24334a] px-7 py-12 text-center text-white md:px-12"><h2 className="font-serif text-3xl font-bold">오늘의 업무부터 기록해 보세요</h2><p className="mt-3 text-sm text-white/65">가입 전에도 샘플 타임라인을 직접 수정해 볼 수 있습니다.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/preview" className="inline-flex rounded-xl border border-white/25 px-6 py-3 text-sm font-bold text-white no-underline hover:bg-white/10">먼저 체험하기</Link><Link to="/join" className="inline-flex rounded-xl bg-[#e36a48] px-6 py-3 text-sm font-bold text-white no-underline hover:bg-[#ef7653]">무료로 시작하기</Link></div></div></section>
      </main>
      <footer className="border-t border-[#eee7e1] px-5 py-7 text-center text-xs text-[#98938e]">© 2026 WorkLog. 매일의 업무를 연결합니다.</footer>
    </div>
  );
}

export default LandingHome;
