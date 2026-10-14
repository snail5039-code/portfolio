import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import LogoutButton from "../../pages/Logout";
import { HomeLogo } from "./HomeBrand";
import { formatToday } from "./homeUtils";

const defaultEntries = [
  { id: "1", start: "09:00", end: "10:00", title: "주간 팀 미팅", detail: "이번 주 목표와 주요 이슈 공유", status: "회의록", tone: "coral" },
  { id: "2", start: "10:30", end: "11:30", title: "프로젝트 A 진행 리뷰", detail: "핵심 기능 개발 현황 점검", status: "4명", tone: "coral" },
  { id: "3", start: "13:00", end: "15:00", title: "프로젝트 A", detail: "기능 설계 및 문서 정리", status: "집중", tone: "blue" },
  { id: "4", start: "12:00", end: "13:00", title: "점심시간", detail: "가볍게 산책하며 쉬기", status: "완료", tone: "sand" },
  { id: "5", start: "15:30", end: "17:00", title: "집중 업무", detail: "고객사 보고서 작성", status: "진행 중", tone: "blue" },
  { id: "6", start: "14:00", end: "15:00", title: "보고서 초안 작성", detail: "보고서 구조와 자료 정리", status: "완료", tone: "sand" },
  { id: "7", start: "17:30", end: "18:00", title: "데일리 체크인", detail: "오늘 업무 마무리 및 내일 계획", status: "3명", tone: "coral" },
];

const CARD_STEP = 218;
const getTimelinePosition = (index) => ({
  x: 42 + index * CARD_STEP,
  top: index % 2 === 0 ? 18 + (index % 3) * 7 : 292 + (index % 3) * 6,
  line: index % 2 === 0 ? 112 : -70,
});

const toneStyles = {
  coral: { card: "border-[#efc9bb] bg-[#fffaf7]", badge: "bg-[#fff0ea] text-[#d85b39]", dot: "#df6948" },
  blue: { card: "border-[#bed0ed] bg-[#f9fbff]", badge: "bg-[#edf4ff] text-[#3f68aa]", dot: "#5479b7" },
  sand: { card: "border-[#e7d8bf] bg-[#fffdf8]", badge: "bg-[#fbf4e7] text-[#987230]", dot: "#b9a67f" },
};

const workMenus = [
  { label: "일일 업무일지", sub: "오늘의 기록 작성", to: "/write", icon: "✎" },
  { label: "주간 업무보고", sub: "한 주 흐름 정리", to: "/weeklyWrite", icon: "▦" },
  { label: "월간 업무보고", sub: "이번 달 성과 확인", to: "/monthlyWrite", icon: "□" },
  { label: "인수인계", sub: "업무 맥락 이어주기", to: "/handoverList", icon: "⇄" },
  { label: "업무 기록함", sub: "지난 기록 찾아보기", to: "/list", icon: "⌕" },
];

function loadEntries(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {
    localStorage.removeItem(storageKey);
  }
  return defaultEntries;
}

function TimelineCard({ entry, position, onEdit }) {
  const tone = toneStyles[entry.tone] ?? toneStyles.coral;
  const lineDown = position.line > 0;
  return (
    <button type="button" onClick={() => onEdit(entry)} className={`absolute z-20 w-[188px] rounded-xl border p-4 text-left shadow-[0_8px_24px_rgba(48,36,27,0.035)] transition hover:-translate-y-1 hover:shadow-md ${tone.card}`} style={{ left: position.x, top: position.top }} aria-label={`${entry.title} 수정`}>
      <span className="text-[10px] text-[#85817c]">{entry.start} - {entry.end}</span><h3 className="mt-2 truncate text-[13px] font-bold text-[#26334a]">{entry.title}</h3><p className="mt-2 line-clamp-2 text-[11px] leading-4 text-[#5b6069]">{entry.detail}</p><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] ${tone.badge}`}>{entry.status}</span>
      <span className="absolute left-1/2 w-px border-l border-dashed border-[#d8cec7]" style={lineDown ? { top: "100%", height: position.line } : { bottom: "100%", height: Math.abs(position.line) }} aria-hidden="true" />
      <span className="absolute h-1.5 w-1.5 rounded-full" style={{ left: "calc(50% - 3px)", background: tone.dot, ...(lineDown ? { top: `calc(100% + ${position.line}px)` } : { bottom: `calc(100% + ${Math.abs(position.line)}px)` }) }} aria-hidden="true" />
    </button>
  );
}

function EntryModal({ entry, onClose, onSave, onDelete, isNew }) {
  const [form, setForm] = useState(entry);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const canSave = form.title.trim() && form.start && form.end;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#172033]/35 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="entry-modal-title">
        <div className="flex items-center justify-between"><h2 id="entry-modal-title" className="text-lg font-bold">{isNew ? "업무 흐름 추가" : "업무 흐름 수정"}</h2><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100" aria-label="닫기">×</button></div>
        <div className="mt-5 space-y-4">
          <label className="block text-xs font-semibold">업무 제목<input value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={40} className="mt-2 w-full rounded-lg border border-[#ded8d2] px-3 py-2.5 text-sm outline-none focus:border-[#d95d3b]" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">시작 시간<input type="time" value={form.start} onChange={(e) => update("start", e.target.value)} className="mt-2 w-full rounded-lg border border-[#ded8d2] px-3 py-2.5 text-sm" /></label><label className="text-xs font-semibold">종료 시간<input type="time" value={form.end} onChange={(e) => update("end", e.target.value)} className="mt-2 w-full rounded-lg border border-[#ded8d2] px-3 py-2.5 text-sm" /></label></div>
          <label className="block text-xs font-semibold">업무 내용<textarea value={form.detail} onChange={(e) => update("detail", e.target.value)} maxLength={120} rows={3} className="mt-2 w-full resize-none rounded-lg border border-[#ded8d2] px-3 py-2.5 text-sm outline-none focus:border-[#d95d3b]" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">상태<input value={form.status} onChange={(e) => update("status", e.target.value)} maxLength={12} className="mt-2 w-full rounded-lg border border-[#ded8d2] px-3 py-2.5 text-sm" /></label><label className="text-xs font-semibold">색상<select value={form.tone} onChange={(e) => update("tone", e.target.value)} className="mt-2 w-full rounded-lg border border-[#ded8d2] px-3 py-2.5 text-sm"><option value="coral">코랄</option><option value="blue">블루</option><option value="sand">샌드</option></select></label></div>
        </div>
        <div className="mt-6 flex items-center gap-2">{!isNew && <button type="button" onClick={() => onDelete(form.id)} className="mr-auto rounded-lg px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50">삭제</button>}<button type="button" onClick={onClose} className="rounded-lg border border-[#e2ddd8] px-4 py-2.5 text-xs font-semibold">취소</button><button type="button" disabled={!canSave} onClick={() => onSave(form)} className="rounded-lg bg-[#d95d3b] px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">저장</button></div>
      </div>
    </div>
  );
}

function WorkDashboard({ userId, previewMode = false }) {
  const storageKey = previewMode ? "worklog:preview-timeline" : `worklog:timeline:${userId}`;
  const [entries, setEntries] = useState(() => loadEntries(storageKey));
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(true);
  const today = useMemo(() => formatToday(), []);
  const timelineWidth = Math.max(1440, entries.length * CARD_STEP + 120);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(entries)); }, [entries, storageKey]);

  const openNew = () => {
    setIsNew(true); setEditing({ id: crypto.randomUUID(), start: "09:00", end: "10:00", title: "", detail: "", status: "예정", tone: "coral" });
  };
  const saveEntry = (entry) => {
    setEntries((current) => (isNew ? [...current, entry] : current.map((item) => item.id === entry.id ? entry : item)).sort((a, b) => a.start.localeCompare(b.start)));
    setEditing(null); setIsNew(false);
  };
  const deleteEntry = (id) => { setEntries((current) => current.filter((item) => item.id !== id)); setEditing(null); };
  const resetEntries = () => setEntries(defaultEntries);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fdfcf9] text-[#1f2e45]">
      {!previewMode && sessionStorage.getItem("worklog:developer-mode") === "true" && <div className="bg-[#24334a] px-4 py-2 text-center text-xs font-semibold text-white">개발자 모드 · 테스트 회원 데이터 사용 중</div>}
      {previewMode && <div className="bg-[#24334a] px-4 py-2 text-center text-xs text-white"><b>미리보기 모드</b><span className="ml-2 text-white/70">변경 내용은 이 브라우저에만 임시 저장됩니다.</span></div>}
      <header className="flex min-h-[74px] items-center justify-between border-b border-[#eee7e1] px-5 md:px-9"><HomeLogo /><div className="hidden items-center gap-3 md:flex"><strong className="font-serif text-base">{today}</strong><span className="text-[#d96543]">☼</span><span className="text-xs text-[#8b8984]">오늘의 업무 흐름</span></div><div className="flex items-center gap-3">{previewMode ? <><Link to="/" className="text-xs font-semibold text-[#4f5763] no-underline">소개로 돌아가기</Link><Link to="/join" className="rounded-full bg-[#d95d3b] px-4 py-2 text-xs font-bold text-white no-underline">무료로 시작하기</Link></> : <><Link to="/mypage" className="text-xs text-[#4f5763] no-underline">내 정보</Link><LogoutButton /></>}</div></header>
      <nav className="mx-auto flex max-w-[1180px] gap-2 overflow-x-auto px-4 py-4" aria-label="WorkLog 주요 기능">{workMenus.map((menu) => previewMode ? <div key={menu.label} className="group flex min-w-[205px] flex-1 items-center gap-3 rounded-xl px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff1ea] text-[#d75d3b]">{menu.icon}</span><span><strong className="block text-xs text-[#303947]">{menu.label}</strong><small className="mt-1 block text-[10px] text-[#94918c]">{menu.sub}</small></span></div> : <Link key={menu.label} to={menu.to} className="group flex min-w-[205px] flex-1 items-center gap-3 rounded-xl px-4 py-3 no-underline hover:bg-white"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff1ea] text-[#d75d3b]">{menu.icon}</span><span><strong className="block text-xs text-[#303947]">{menu.label}</strong><small className="mt-1 block text-[10px] text-[#94918c]">{menu.sub}</small></span></Link>)}</nav>
      <main className="mx-auto max-w-[1500px] px-4 pb-8 md:px-8">
        <div className="flex items-center justify-between py-2"><div><span className="font-serif text-sm md:hidden">{today}</span><p className="hidden text-xs text-[#8a8782] md:block">카드를 선택하면 내용을 수정할 수 있습니다. 기록이 많아지면 좌우로 이동하세요.</p></div><div className="flex gap-2"><button type="button" onClick={resetEntries} className="rounded-full border border-[#eadfd7] px-4 py-2 text-xs text-[#616772] hover:bg-white">기본값 복원</button><button type="button" onClick={openNew} className="rounded-full bg-[#d95d3b] px-4 py-2 text-xs font-bold text-white hover:bg-[#c84f31]">+ 업무 흐름 추가</button></div></div>
        <section className="hidden overflow-x-auto pb-3 lg:block" aria-label="오늘의 업무 흐름"><div className="relative h-[455px]" style={{ width: timelineWidth }}><svg className="absolute left-0 top-[203px] h-[110px] w-full" viewBox={`0 0 ${timelineWidth} 110`} preserveAspectRatio="none" aria-hidden="true"><path d={`M0 67 C${timelineWidth * .12} 76,${timelineWidth * .18} 34,${timelineWidth * .3} 50 S${timelineWidth * .5} 88,${timelineWidth * .62} 61 S${timelineWidth * .82} 40,${timelineWidth} 66`} fill="none" stroke="#334f73" strokeWidth="1.6" /></svg>{entries.map((entry, index) => <TimelineCard key={entry.id} entry={entry} position={getTimelinePosition(index)} onEdit={(item) => { setIsNew(false); setEditing(item); }} />)}<div className="absolute top-[215px] z-10 text-center" style={{ left: timelineWidth / 2 }}><span className="block text-[10px] font-bold text-[#d95d3b]">오늘</span><span className="mx-auto mt-1 block h-4 w-4 rounded-full border-[3px] border-[#f3c5b6] bg-[#d95d3b]" /></div></div></section>
        <section className="grid gap-3 py-5 lg:hidden">{entries.map((entry) => { const tone = toneStyles[entry.tone] ?? toneStyles.coral; return <button type="button" key={entry.id} onClick={() => { setIsNew(false); setEditing(entry); }} className={`rounded-xl border p-4 text-left ${tone.card}`}><div className="flex justify-between gap-3"><div><span className="text-[10px] text-[#8d8a84]">{entry.start} - {entry.end}</span><h3 className="mt-1 text-sm font-bold">{entry.title}</h3><p className="mt-1 text-xs text-[#6d7075]">{entry.detail}</p></div><span className={`h-fit rounded-full px-2 py-1 text-[10px] ${tone.badge}`}>{entry.status}</span></div></button>; })}</section>
        <section className="overflow-hidden rounded-[22px] border border-[#eee5de] bg-white shadow-[0_14px_45px_rgba(70,49,35,0.06)]"><div className="flex items-center justify-between px-6 py-4"><button type="button" onClick={() => setRecordsOpen((value) => !value)} className="text-sm font-bold" aria-expanded={recordsOpen}>{recordsOpen ? "⌃" : "⌄"} 오늘의 업무 흐름 {entries.length}개</button><div className="flex gap-4">{previewMode ? <span className="text-xs text-[#a06a55]">샘플 기록</span> : <><Link to="/list?boardId=4" className="text-xs no-underline">전체 기록</Link><Link to="/write" className="text-xs no-underline">✎ 업무일지 작성</Link></>}</div></div>{recordsOpen && <div className="grid max-h-[360px] overflow-y-auto border-t border-[#f0ebe6] sm:grid-cols-2 lg:grid-cols-4">{entries.map((entry) => <button type="button" key={entry.id} onClick={() => { setIsNew(false); setEditing(entry); }} className="min-h-[88px] border-b border-r border-[#f0ebe6] px-5 py-4 text-left hover:bg-[#fffaf6]"><span className="text-[10px] text-[#99948f]">{entry.start} - {entry.end}</span><strong className="mt-1 block truncate text-xs">{entry.title}</strong><span className="mt-1 block truncate text-[10px] text-[#777a80]">{entry.detail}</span></button>)}</div>}</section>
        <p className="mt-6 text-center font-serif text-xs text-[#88837c]">❦ 작은 기록이 쌓여, 더 나은 업무 흐름을 만듭니다.</p>
      </main>
      {editing && <EntryModal entry={editing} isNew={isNew} onClose={() => setEditing(null)} onSave={saveEntry} onDelete={deleteEntry} />}
    </div>
  );
}

export default WorkDashboard;
