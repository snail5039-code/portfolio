import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type DecisionReviewOutcome = "승인" | "반려" | "보류";

export type DecisionReviewItem = Api<components["schemas"]["DecisionReviewItem"]>;
export type DecisionReviewData = Api<components["schemas"]["DecisionReviewData"]>;
export type DecisionReviewEnvelope = FixtureEnvelope<DecisionReviewData>;
