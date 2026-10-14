import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type StressScenarioKey = "rates" | "chips" | "fx" | "liquidity";
export type StressAssetKey = "cash" | "market" | "samsung" | "sk" | "naver";

export type StressAsset = Api<components["schemas"]["StressAsset"]>;
export type StressScenario = Api<
  components["schemas"]["StressScenario"],
  { shock: Record<StressAssetKey, number> }
>;
export type StressAssetImpact = Api<components["schemas"]["StressAssetImpact"]>;
export type StressTestData = Api<
  components["schemas"]["StressTestData"],
  {
    scenarios: Record<StressScenarioKey, StressScenario>;
    rowsByScenario: Record<StressScenarioKey, StressAssetImpact[]>;
  }
>;
export type StressTestEnvelope = FixtureEnvelope<StressTestData>;
