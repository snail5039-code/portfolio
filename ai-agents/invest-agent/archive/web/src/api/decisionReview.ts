import { getFixture } from "./client";
import type { DecisionReviewData, DecisionReviewEnvelope } from "../types/dashboard";

export async function getDecisionReview(): Promise<DecisionReviewEnvelope> {
  return getFixture<DecisionReviewData>("/api/decision-review");
}
