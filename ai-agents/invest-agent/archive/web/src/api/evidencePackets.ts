import { getFixture } from "./client";
import type { EvidencePacketsData, EvidencePacketsEnvelope } from "../types/dashboard";

export async function getEvidencePackets(): Promise<EvidencePacketsEnvelope> {
  return getFixture<EvidencePacketsData>("/api/evidence-packets");
}
