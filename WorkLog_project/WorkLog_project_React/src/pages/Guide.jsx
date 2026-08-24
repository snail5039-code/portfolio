import React from "react";
import { Link } from "react-router-dom";

const modes = [
  { icon: "✎", eyebrow: "매일 3분", title: "오늘 한 일을 가볍게 남겨요", description: "완벽한 보고서 대신 진행한 업무, 상태, 이슈만 적어도 충분합니다.", steps: ["일일 업무일지에서 새 기록 작성", "업무 상태와 필요한 파일 추가", "저장한 기록은 주간·월간 정리에 활용"] },
  { icon: "▦", eyebrow: "매주 한 번", title: "흩어진 기록을 한 주로 묶어요", description: "작성해 둔 일일 기록을 기준으로 성과와 다음 계획을 한눈에 확인합니다.", steps: ["주간 업무일지 작성 메뉴 선택", "정리할 기간과 기록 확인", "내용을 다듬어 팀 보고에 활용"] },
  { icon: "□", eyebrow: "월말 정리", title: "한 달의 흐름을 리포트로 바꿔요", description: "프로젝트와 업무 변화가 쌓인 맥락을 놓치지 않고 월간 기록으로 남깁니다.", steps: ["월간 업무일지에서 대상 월 선택", "프로젝트별 주요 기록 점검", "문서로 내려받아 보관하거나 공유"] },
  { icon: "⇄", eyebrow: "업무 연결", title: "다음 사람에게 맥락까지 전해요", description: "단순 목록이 아니라 진행 상황, 주의점, 남은 일을 인수인계합니다.", steps: ["인수인계 대상과 기간 지정", "관련 기록에서 필요한 내용 선택", "최종 내용을 확인하고 전달"] },
];

function Guide() {
  return <div className="mx-auto max-w-6xl">
    <section className="mb-8 overflow-hidden rounded-[28px] border border-[#eedfd5] bg-[#fff8f3] px-6 py-9 md:px-10">
      <span className="text-xs font-bold tracking-[0.18em] text-[#d95d3b]">HOW IT WORKS</span>
      <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><h1 className="font-serif text-3xl font-bold text-[#1f2e45] md:text-4xl">기록은 짧게, 업무의 흐름은 선명하게</h1><p className="mt-3 max-w-2xl leading-7 text-[#697386]">WorkLog는 AI가 앞에 나서는 서비스가 아니라, 내가 남긴 업무 기록을 정돈하고 다음 업무로 이어 주는 작업 공간입니다.</p></div><Link to="/write" className="shrink-0 rounded-full bg-[#d95d3b] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(217,93,59,0.2)] hover:bg-[#c84f31]">첫 기록 작성하기</Link></div>
    </section>
    <section className="grid gap-5 md:grid-cols-2">{modes.map((mode, index) => <article key={mode.title} className="rounded-[24px] border border-[#eadfd7] bg-white p-6 shadow-[0_12px_35px_rgba(72,48,34,0.05)]"><div className="flex items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff0e9] text-xl font-bold text-[#d95d3b]">{mode.icon}</span><span className="font-serif text-4xl text-[#eadfd7]">0{index + 1}</span></div><p className="mt-5 text-xs font-bold tracking-[0.16em] text-[#c8795c]">{mode.eyebrow}</p><h2 className="mt-2 text-xl font-bold text-[#1f2e45]">{mode.title}</h2><p className="mt-3 leading-6 text-[#6e7787]">{mode.description}</p><ol className="mt-5 space-y-3 border-t border-[#f0e6df] pt-5">{mode.steps.map((step, stepIndex) => <li key={step} className="flex gap-3 text-sm text-[#4f5b6d]"><span className="font-bold text-[#d95d3b]">{stepIndex + 1}</span>{step}</li>)}</ol></article>)}</section>
  </div>;
}
export default Guide;
