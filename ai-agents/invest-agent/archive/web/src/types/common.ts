import type { LucideIcon } from "lucide-react";

/**
 * Shared utility types and cross-screen contracts used by every `types/*.ts`
 * screen file. See `dashboard.ts` (the barrel re-exporting all of them) for
 * the full rationale on why screen types are aliases onto `./api.generated`.
 *
 * Every field with a Pydantic default (`Optional[int] = None`, `= "KRW"`, ...)
 * comes out of openapi-typescript marked `?`, since JSON Schema has no way to
 * say "always present, but has a default". A FastAPI response model always
 * serializes every field though, so nothing is genuinely absent — only `| null`
 * on nullable fields is meaningful. `Api<T>` strips that spurious optionality.
 */
export type Data<T> = T extends Array<infer U>
  ? Array<Data<U>>
  : T extends object
    ? { [K in keyof T]-?: Data<T[K]> }
    : T;
export type Api<T, U extends Record<string, unknown> = Record<never, never>> = Omit<Data<T>, keyof U> & U;

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";
export type PageKey =
  | "dashboard"
  | "account"
  | "company"
  | "approvals"
  | "taxFee"
  | "decisionReview"
  | "roleStatus"
  | "evidence"
  | "compare"
  | "audit"
  | "policy"
  | "data"
  | "trades"
  | "risks"
  | "notifications"
  | "backtest"
  | "rebalance"
  | "weekly"
  | "stress"
  | "health"
  | "analysisAgent"
  | "verificationAgent"
  | "executionAgent";

export interface NavItem {
  label: string;
  group: "투자 운영" | "에이전트" | "문서" | "설정";
  icon: LucideIcon;
  page?: PageKey;
  badge?: string;
}

/**
 * Numeric API contract.
 *
 * Money fields are integers in `DashboardData.currency`. Percent fields are in
 * percent units, so 6.65 means 6.65%. Fields that do not apply to a row (cash
 * has no average price) are `null` rather than a placeholder string. All display
 * formatting lives in `src/lib/format.ts`.
 */

/**
 * Safety metadata every local fixture response carries. `externalConnections`
 * is 0 for every screen except Company Detail, which honestly reports 1 while
 * its filings just came from a live, read-only OpenDART call — see
 * `getCompanyDetail` in `../api/companyDetail` for the one place a non-zero
 * value is expected and allowed through `assertFixtureEnvelope`.
 */
export interface FixtureEnvelope<TData> {
  generatedAt: string;
  dataAsOf: string;
  sourceLabel: string;
  isMock: true;
  paperOnly: true;
  executed: false;
  externalConnections: number;
  disclaimer: string;
  data: TData;
}
