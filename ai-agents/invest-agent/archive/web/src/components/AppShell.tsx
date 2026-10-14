import {
  Activity,
  Bell,
  BookOpenCheck,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  Gauge,
  HeartPulse,
  History,
  LayoutDashboard,
  ListChecks,
  PlayCircle,
  RefreshCw,
  ReceiptText,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  SplitSquareHorizontal,
  TestTubeDiagonal,
  TableProperties,
  UsersRound,
  Waypoints
} from "lucide-react";
import type { NavItem, PageKey } from "../types/dashboard";
import { DataBoundaryNotice } from "./DataBoundaryNotice";
import { useApprovalsPendingCount } from "../lib/useApprovalsPendingCount";

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { group: "투자 운영", label: "포트폴리오", icon: LayoutDashboard, page: "dashboard" },
  { group: "투자 운영", label: "기업 상세", icon: Building2, page: "company" },
  { group: "투자 운영", label: "계좌", icon: CircleDollarSign, page: "account" },
  { group: "투자 운영", label: "거래 내역", icon: History, page: "trades" },
  { group: "투자 운영", label: "세금·수수료", icon: ReceiptText, page: "taxFee" },
  { group: "투자 운영", label: "리스크 알림", icon: ShieldAlert, page: "risks" },
  { group: "투자 운영", label: "백테스트", icon: Gauge, page: "backtest" },
  { group: "투자 운영", label: "전략 조정", icon: SlidersHorizontal, page: "rebalance" },
  { group: "투자 운영", label: "변경 비교", icon: SplitSquareHorizontal, page: "compare" },
  { group: "투자 운영", label: "근거 패킷", icon: ClipboardCheck, page: "evidence" },
  { group: "투자 운영", label: "스트레스 테스트", icon: TestTubeDiagonal, page: "stress" },
  { group: "투자 운영", label: "포트폴리오 건강", icon: HeartPulse, page: "health" },
  { group: "에이전트", label: "분석 에이전트", icon: Activity, page: "analysisAgent" },
  { group: "에이전트", label: "검증 에이전트", icon: BookOpenCheck, page: "verificationAgent" },
  { group: "에이전트", label: "실행 에이전트", icon: PlayCircle, page: "executionAgent" },
  { group: "에이전트", label: "승인 대기", icon: ListChecks, page: "approvals" },
  { group: "에이전트", label: "역할 상태", icon: UsersRound, page: "roleStatus" },
  { group: "문서", label: "투자 리포트", icon: TableProperties, page: "weekly" },
  { group: "문서", label: "감사 로그", icon: FileClock, page: "audit" },
  { group: "문서", label: "결정 회고", icon: ClipboardList, page: "decisionReview" },
  { group: "설정", label: "투자 정책", icon: Scale, page: "policy" },
  { group: "설정", label: "알림 설정", icon: Bell, page: "notifications" },
  { group: "설정", label: "데이터 연결", icon: Settings, page: "data" }
];

const NAV_GROUPS: ReadonlyArray<NavItem["group"]> = ["투자 운영", "에이전트", "문서", "설정"];

interface AppShellProps {
  title: string;
  accountLabel: string;
  lastSync: string;
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  main: React.ReactNode;
  inspector: React.ReactNode;
}

export function AppShell({ title, accountLabel, lastSync, activePage, onNavigate, main, inspector }: AppShellProps) {
  const pendingApprovals = useApprovalsPendingCount();

  return (
    <main className="app-shell" aria-label="금융 AI 모의투자 프론트엔드">
      <header className="titlebar">
        <div className="title-left">
          <div className="traffic" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <button className="icon-button" aria-label="사이드바 접기">
            <Waypoints size={16} />
          </button>
          <strong>{title}</strong>
        </div>
        <div className="title-center">
          <button className="account-switcher">{accountLabel}</button>
          <span className="paper-badge">모의투자</span>
        </div>
        <div className="title-right">
          <span>마지막 동기화 {lastSync}</span>
          <button className="icon-button" aria-label="검색">
            <Search size={15} />
          </button>
          <button className="icon-button" aria-label="새로고침">
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <nav aria-label="주요 메뉴">
            {NAV_GROUPS.map((group) => (
              <div key={group} className="nav-group">
                <p className="nav-label">{group}</p>
                {NAV_ITEMS
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = item.page === activePage;
                    const badge = item.page === "approvals" && pendingApprovals !== null ? String(pendingApprovals) : item.badge;
                    return (
                      <button
                        className={isActive ? "nav-item active" : "nav-item"}
                        key={item.label}
                        type="button"
                        aria-label={item.label}
                        data-nav-label={item.label}
                        data-nav-group={item.group}
                        aria-current={isActive ? "page" : undefined}
                        aria-disabled={item.page ? undefined : true}
                        onClick={() => {
                          if (item.page) onNavigate(item.page);
                        }}
                      >
                        <Icon size={15} aria-hidden="true" />
                        <span>{item.label}</span>
                        {badge ? <b>{badge}</b> : null}
                      </button>
                    );
                  })}
              </div>
            ))}
          </nav>
          <DataBoundaryNotice compact />
        </aside>
        {main}
        {inspector}
      </div>
    </main>
  );
}
