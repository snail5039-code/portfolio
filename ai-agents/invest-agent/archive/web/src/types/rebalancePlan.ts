import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type RebalanceStrategyKey = "conservative" | "balanced" | "aggressive";
export type RebalanceAssetKey = "cash" | "market" | "samsung" | "sk" | "naver";

export type CurrentAllocation = Api<components["schemas"]["CurrentAllocation"]>;
export type RebalanceStrategy = Api<
  components["schemas"]["RebalanceStrategy"],
  { targets: Record<RebalanceAssetKey, number> }
>;
export type RebalanceProposal = Api<components["schemas"]["RebalanceProposal"]>;
export type RebalancePlanData = Api<
  components["schemas"]["RebalancePlanData"],
  {
    strategies: Record<RebalanceStrategyKey, RebalanceStrategy>;
    proposalsByStrategy: Record<RebalanceStrategyKey, RebalanceProposal[]>;
  }
>;
export type RebalancePlanEnvelope = FixtureEnvelope<RebalancePlanData>;
