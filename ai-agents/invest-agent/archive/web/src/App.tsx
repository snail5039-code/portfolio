import { useState } from "react";
import { AccountPage } from "./pages/AccountPage";
import { AgentStagePage } from "./pages/AgentStagePage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApprovalQueuePage } from "./pages/ApprovalQueuePage";
import { AgentRoleStatusPage } from "./pages/AgentRoleStatusPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { BacktestSummaryPage } from "./pages/BacktestSummaryPage";
import { CompanyDetailPage } from "./pages/CompanyDetailPage";
import { DataConnectionsPage } from "./pages/DataConnectionsPage";
import { DecisionReviewPage } from "./pages/DecisionReviewPage";
import { EvidencePacketPage } from "./pages/EvidencePacketPage";
import { NotificationSettingsPage } from "./pages/NotificationSettingsPage";
import { PolicySettingsPage } from "./pages/PolicySettingsPage";
import { PortfolioHealthPage } from "./pages/PortfolioHealthPage";
import { PortfolioChangeComparePage } from "./pages/PortfolioChangeComparePage";
import { RebalancePlanPage } from "./pages/RebalancePlanPage";
import { RiskAlertsPage } from "./pages/RiskAlertsPage";
import { StressTestPage } from "./pages/StressTestPage";
import { TradeHistoryPage } from "./pages/TradeHistoryPage";
import { TaxFeeImpactPage } from "./pages/TaxFeeImpactPage";
import { WeeklyReportPage } from "./pages/WeeklyReportPage";
import type { PageKey } from "./types/dashboard";

export function App() {
  const [page, setPage] = useState<PageKey>("dashboard");

  if (page === "account") {
    return <AccountPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "analysisAgent") {
    return <AgentStagePage stage="analysis" activePage={page} onNavigate={setPage} />;
  }

  if (page === "verificationAgent") {
    return <AgentStagePage stage="verification" activePage={page} onNavigate={setPage} />;
  }

  if (page === "executionAgent") {
    return <AgentStagePage stage="execution" activePage={page} onNavigate={setPage} />;
  }

  if (page === "approvals") {
    return <ApprovalQueuePage activePage={page} onNavigate={setPage} />;
  }

  if (page === "taxFee") {
    return <TaxFeeImpactPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "decisionReview") {
    return <DecisionReviewPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "roleStatus") {
    return <AgentRoleStatusPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "company") {
    return <CompanyDetailPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "evidence") {
    return <EvidencePacketPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "compare") {
    return <PortfolioChangeComparePage activePage={page} onNavigate={setPage} />;
  }

  if (page === "audit") {
    return <AuditLogPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "policy") {
    return <PolicySettingsPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "data") {
    return <DataConnectionsPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "trades") {
    return <TradeHistoryPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "risks") {
    return <RiskAlertsPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "notifications") {
    return <NotificationSettingsPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "backtest") {
    return <BacktestSummaryPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "rebalance") {
    return <RebalancePlanPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "weekly") {
    return <WeeklyReportPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "stress") {
    return <StressTestPage activePage={page} onNavigate={setPage} />;
  }

  if (page === "health") {
    return <PortfolioHealthPage activePage={page} onNavigate={setPage} />;
  }

  return <DashboardPage activePage={page} onNavigate={setPage} />;
}
