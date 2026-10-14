import { getFixture } from "./client";
import type { PortfolioHealthData, PortfolioHealthEnvelope } from "../types/dashboard";

export async function getPortfolioHealth(): Promise<PortfolioHealthEnvelope> {
  return getFixture<PortfolioHealthData>("/api/portfolio-health");
}
