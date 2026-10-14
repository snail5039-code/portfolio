import { getFixture } from "./client";
import type { StressTestData, StressTestEnvelope } from "../types/dashboard";

export async function getStressTest(): Promise<StressTestEnvelope> {
  return getFixture<StressTestData>("/api/stress-test");
}
