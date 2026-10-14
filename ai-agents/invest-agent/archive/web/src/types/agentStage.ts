import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type AgentStage = "analysis" | "verification" | "execution";
export type ExecutionGrade = "자동 실행" | "간편 승인" | "강화 승인" | "실행 금지";

export type AgentMetric = Api<components["schemas"]["AgentMetric"]>;
export type AgentCapability = Api<components["schemas"]["AgentCapability"]>;
export type AgentWorkField = Api<components["schemas"]["AgentWorkField"]>;
export type AgentWorkItem = Api<components["schemas"]["AgentWorkItem"]>;
export type AgentStageStep = Api<components["schemas"]["AgentStageStep"]>;
export type AgentScreenData = Api<components["schemas"]["AgentScreenData"]>;
export type AgentScreenEnvelope = FixtureEnvelope<AgentScreenData>;
