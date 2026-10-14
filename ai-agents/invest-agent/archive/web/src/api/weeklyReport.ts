import { getFixture } from "./client";
import type { WeeklyReportData, WeeklyReportEnvelope } from "../types/dashboard";

export async function getWeeklyReport(): Promise<WeeklyReportEnvelope> {
  return getFixture<WeeklyReportData>("/api/weekly-report");
}
