import { getFixture } from "./client";
import type { TradeHistoryData, TradeHistoryEnvelope } from "../types/dashboard";

export async function getTradeHistory(): Promise<TradeHistoryEnvelope> {
  return getFixture<TradeHistoryData>("/api/trade-history");
}
