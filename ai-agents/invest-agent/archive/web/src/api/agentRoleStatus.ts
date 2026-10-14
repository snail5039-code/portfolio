import { getFixture } from "./client";
import type { AgentRoleStatusData, AgentRoleStatusEnvelope } from "../types/dashboard";

export async function getAgentRoleStatus(): Promise<AgentRoleStatusEnvelope> {
  return getFixture<AgentRoleStatusData>("/api/agent-role-status");
}
