import { getFixture } from "./client";
import type { RiskAlertsData, RiskAlertsEnvelope } from "../types/dashboard";

export async function getRiskAlerts(): Promise<RiskAlertsEnvelope> {
  return getFixture<RiskAlertsData>("/api/risk-alerts");
}
