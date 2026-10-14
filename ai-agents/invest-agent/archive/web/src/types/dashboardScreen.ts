import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type ChartPoint = Api<components["schemas"]["DashboardChartPoint"]>;
export type EvidenceItem = Api<components["schemas"]["DashboardEvidence"]>;
export type Holding = Api<components["schemas"]["DashboardHolding"]>;
export type DashboardSummary = Api<components["schemas"]["DashboardSummary"]>;
export type DashboardDecision = Api<components["schemas"]["DashboardDecision"]>;
export type DashboardData = Api<components["schemas"]["DashboardData"], { currency: "KRW" }>;
export type DashboardEnvelope = FixtureEnvelope<DashboardData>;
