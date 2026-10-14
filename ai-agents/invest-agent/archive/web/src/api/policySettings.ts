import { getFixture, postFixture } from "./client";
import type { PolicyCheckKey, PolicyNumberKey, PolicySettingsData, PolicySettingsEnvelope } from "../types/dashboard";

export async function getPolicySettings(): Promise<PolicySettingsEnvelope> {
  return getFixture<PolicySettingsData>("/api/policy-settings");
}

export type PolicyApplyRequest = Record<PolicyNumberKey, string> & Record<PolicyCheckKey, boolean>;

export async function applyPolicySettings(body: PolicyApplyRequest): Promise<PolicySettingsEnvelope> {
  return postFixture<PolicySettingsData>("/api/policy-settings/apply", body);
}
