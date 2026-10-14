/**
 * Barrel re-exporting every screen's types so existing `from "../types/dashboard"`
 * imports keep working unchanged. Each screen's own aliases onto
 * `./api.generated` (which `npm run generate:types` produces from the FastAPI
 * OpenAPI schema in `apps/api`) live in its own `types/<screen>.ts` file next
 * to this one — re-run that script whenever a backend response shape changes,
 * this file (and its siblings) should never hand-author a field the backend
 * already describes. See `docs/handoff/01-current-state.md` (FRONTEND-006) for
 * why, and `types/common.ts` for the shared `Api`/`FixtureEnvelope`/`PageKey`
 * this file and every sibling below build on.
 *
 * Prefer importing a specific screen's file directly in new code (e.g.
 * `from "../types/policySettings"`) — this barrel exists for the ~150
 * existing call sites, not as the preferred way to reach a new one.
 */
export * from "./common";
export * from "./dashboardScreen";
export * from "./account";
export * from "./agentStage";
export * from "./approvals";
export * from "./riskAlerts";
export * from "./tradeHistory";
export * from "./portfolioHealth";
export * from "./evidencePackets";
export * from "./auditLog";
export * from "./decisionReview";
export * from "./agentRoleStatus";
export * from "./weeklyReport";
export * from "./taxFeeImpact";
export * from "./portfolioChangeCompare";
export * from "./rebalancePlan";
export * from "./backtestSummary";
export * from "./companyDetail";
export * from "./dataConnections";
export * from "./notificationSettings";
export * from "./policySettings";
export * from "./stressTest";
