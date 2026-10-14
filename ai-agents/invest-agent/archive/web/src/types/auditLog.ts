import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type AuditDecisionRow = Api<components["schemas"]["AuditDecisionRow"]>;
export type AuditStepEntry = Api<components["schemas"]["AuditStepEntry"]>;
export type AuditLogData = Api<components["schemas"]["AuditLogData"]>;
export type AuditLogEnvelope = FixtureEnvelope<AuditLogData>;
