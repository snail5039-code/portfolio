import { getFixture } from "./client";
import type { DashboardData, DashboardEnvelope } from "../types/dashboard";

export async function getDashboard(): Promise<DashboardEnvelope> {
  // Holdings can honestly be live (a real KIS 모의투자 balance) — see
  // `holdingsConnected` on the response and `app/routers/dashboard.py`.
  return getFixture<DashboardData>("/api/dashboard", [0, 1]);
}
