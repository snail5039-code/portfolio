import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import MainHeader from "../components/MainHeader";

const sections = [
  { key: "board", label: "기록", links: [["/write", "새 기록 작성"], ["/list", "전체 기록"]] },
  { key: "work", label: "업무일지", links: [["/weeklyWrite", "주간 업무일지 작성"], ["/monthlyWrite", "월간 업무일지 작성"], ["/list?boardId=4", "일일 업무일지"], ["/list?boardId=5", "주간 업무일지"], ["/list?boardId=6", "월간 업무일지"]] },
  { key: "handover", label: "인수인계", links: [["/handoverWrite", "인수인계 작성"], ["/handoverList", "인수인계 목록"]] },
  { key: "etc", label: "커뮤니티", links: [["/list?boardId=1", "공지사항"], ["/list?boardId=2", "자유게시판"], ["/list?boardId=3", "질문과 답변"]] },
];

function MainLayout() {
  const [openMenus, setOpenMenus] = useState({ board: true, work: true, handover: true, etc: true });
  return (
    <div className="min-h-screen bg-[#fdfcf9] text-[#20304a]">
      <MainHeader />
      <nav aria-label="모바일 주요 기능" className="flex gap-2 overflow-x-auto border-b border-[#eadfd7] bg-[#fffaf6] px-4 py-3 lg:hidden">
        {[["/write", "오늘 기록"], ["/list?boardId=4", "기록함"], ["/weeklyWrite", "주간 보고"], ["/monthlyWrite", "월간 보고"], ["/handoverList", "인수인계"]].map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `shrink-0 rounded-full border px-4 py-2 text-xs font-bold no-underline ${isActive ? "border-[#d95d3b] bg-[#fff0e9] text-[#c84f31]" : "border-[#eadfd7] bg-white text-[#596274]"}`}>{label}</NavLink>
        ))}
      </nav>
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-[#eadfd7] bg-[#fffaf6] px-4 py-6 lg:block">
          <p className="mb-5 px-3 text-xs font-bold tracking-[0.18em] text-[#ad765f]">WORKSPACE</p>
          {sections.map((section) => <section key={section.key} className="mb-3">
            <button type="button" onClick={() => setOpenMenus((prev) => ({ ...prev, [section.key]: !prev[section.key] }))} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#26344a] hover:bg-[#fff0e9]">{section.label}<span className={`text-xs text-[#d95d3b] transition-transform ${openMenus[section.key] ? "rotate-180" : ""}`}>⌄</span></button>
            {openMenus[section.key] && <nav className="mt-1 space-y-1 pl-2">{section.links.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? "bg-white font-bold text-[#c84f31] shadow-sm" : "text-[#657084] hover:bg-white hover:text-[#c84f31]"}`}>{label}</NavLink>)}</nav>}
          </section>)}
          <div className="mt-8 rounded-2xl border border-[#f0d7c9] bg-white p-4 text-xs leading-5 text-[#7a6b62]"><b className="mb-1 block text-[#d95d3b]">작은 기록의 힘</b>오늘의 업무 한 줄이 다음 보고서와 인수인계의 시작이 됩니다.</div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:px-10"><Outlet /></main>
      </div>
    </div>
  );
}
export default MainLayout;
