import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type HealthStatus = "확인 필요" | "차단" | "완료";
export type HealthGroupKey = "policy" | "source" | "risk" | "approval" | "strategy" | "stress" | "complete";

export type HealthGroup = Api<components["schemas"]["HealthGroup"]>;
export type HealthCheck = Api<components["schemas"]["HealthCheck"]>;
export type PortfolioHealthData = Api<components["schemas"]["PortfolioHealthData"]>;
export type PortfolioHealthEnvelope = FixtureEnvelope<PortfolioHealthData>;
