import { getFixture } from "./client";
import type { AgentScreenData, AgentScreenEnvelope, AgentStage } from "../types/dashboard";

const STAGE_PATHS: Record<AgentStage, string> = {
  analysis: "/api/agents/analysis",
  verification: "/api/agents/verification",
  execution: "/api/agents/execution"
};

export async function getAgentStage(stage: AgentStage): Promise<AgentScreenEnvelope> {
  return getFixture<AgentScreenData>(STAGE_PATHS[stage]);
}
