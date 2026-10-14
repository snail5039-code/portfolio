import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type ApprovalCategory = "conditional" | "verified" | "attention";
/** The only states an order can be in. There is no "executed" or "filled". */
export type DecisionStatus = "pending" | "approved" | "rejected";

export type ApprovalOrder = Api<components["schemas"]["ApprovalOrder"]>;
export type ApprovalsData = Api<components["schemas"]["ApprovalsData"]>;
export type ApprovalsEnvelope = FixtureEnvelope<ApprovalsData>;
/** Returned by approve/reject: `data` is the single order that changed. */
export type ApprovalActionEnvelope = FixtureEnvelope<ApprovalOrder>;
