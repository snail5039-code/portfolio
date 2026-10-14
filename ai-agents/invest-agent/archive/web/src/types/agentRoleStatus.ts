import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type AgentRoleState = "대기" | "승인 필요" | "실패 이력";

export type AgentRoleStatusItem = Api<components["schemas"]["AgentRoleStatusItem"]>;
export type AgentRoleStatusData = Api<components["schemas"]["AgentRoleStatusData"]>;
export type AgentRoleStatusEnvelope = FixtureEnvelope<AgentRoleStatusData>;
