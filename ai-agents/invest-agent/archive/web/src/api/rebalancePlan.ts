import { getFixture } from "./client";
import type { RebalancePlanData, RebalancePlanEnvelope } from "../types/dashboard";

export async function getRebalancePlan(): Promise<RebalancePlanEnvelope> {
  return getFixture<RebalancePlanData>("/api/rebalance-plan");
}
