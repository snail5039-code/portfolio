import { getFixture } from "./client";
import type { TaxFeeImpactData, TaxFeeImpactEnvelope } from "../types/dashboard";

export async function getTaxFeeImpact(): Promise<TaxFeeImpactEnvelope> {
  return getFixture<TaxFeeImpactData>("/api/tax-fee-impact");
}
