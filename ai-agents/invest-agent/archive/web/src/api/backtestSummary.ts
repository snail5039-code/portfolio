import { getFixture } from "./client";
import type { BacktestSummaryData, BacktestSummaryEnvelope } from "../types/dashboard";

export async function getBacktestSummary(): Promise<BacktestSummaryEnvelope> {
  return getFixture<BacktestSummaryData>("/api/backtest-summary");
}
