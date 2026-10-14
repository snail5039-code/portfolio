import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type RiskCategory = "정책" | "출처" | "시장" | "승인" | "데이터";
export type RiskSeverity = "중대" | "높음" | "보통" | "낮음";

export type RiskEvent = Api<components["schemas"]["RiskEvent"]>;
export type RiskAlertsData = Api<components["schemas"]["RiskAlertsData"]>;
export type RiskAlertsEnvelope = FixtureEnvelope<RiskAlertsData>;
