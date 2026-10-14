import { getFixture } from "./client";
import type { PortfolioChangeCompareData, PortfolioChangeCompareEnvelope } from "../types/dashboard";

export async function getPortfolioChangeCompare(): Promise<PortfolioChangeCompareEnvelope> {
  return getFixture<PortfolioChangeCompareData>("/api/portfolio-change-compare");
}
