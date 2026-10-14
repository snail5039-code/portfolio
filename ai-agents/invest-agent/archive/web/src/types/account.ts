import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type AccountSummary = Api<components["schemas"]["AccountSummary"]>;
export type AssetClassRow = Api<components["schemas"]["AssetClassRow"]>;
export type CurrencyRow = Api<components["schemas"]["CurrencyRow"]>;
export type ReturnRow = Api<components["schemas"]["ReturnRow"]>;
export type CashFlowRow = Api<components["schemas"]["CashFlowRow"]>;
export type AccountData = Api<components["schemas"]["AccountData"], { currency: "KRW" }>;
export type AccountEnvelope = FixtureEnvelope<AccountData>;
