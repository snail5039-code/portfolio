import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type PortfolioChangePolicyType = "pass" | "check" | "block";

export type PortfolioChangeAsset = Api<components["schemas"]["PortfolioChangeAsset"]>;
export type PortfolioChangeStats = Api<components["schemas"]["PortfolioChangeStats"]>;
export type PortfolioChangeCompareData = Api<components["schemas"]["PortfolioChangeCompareData"]>;
export type PortfolioChangeCompareEnvelope = FixtureEnvelope<PortfolioChangeCompareData>;
