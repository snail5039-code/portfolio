import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type PolicyNumberKey = "maxWeight" | "maxOrder" | "maxLoss" | "minCash" | "volatility" | "expiry";
export type PolicyCheckKey = "limitOrder" | "marketOrder" | "blockUnknown" | "blockCorrection";

export type PolicyNumberRule = Api<components["schemas"]["PolicyNumberRule"]>;
export type PolicyCheckRule = Api<components["schemas"]["PolicyCheckRule"]>;
export type PolicyPreview = Api<components["schemas"]["PolicyPreview"]>;
export type PolicySettingsData = Api<components["schemas"]["PolicySettingsData"]>;
export type PolicySettingsEnvelope = FixtureEnvelope<PolicySettingsData>;
