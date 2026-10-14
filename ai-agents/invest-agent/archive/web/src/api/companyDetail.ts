import { getFixture } from "./client";
import type { CompanyDetailData, CompanyDetailEnvelope } from "../types/dashboard";

export async function getCompanyDetail(): Promise<CompanyDetailEnvelope> {
  // 1 is allowed here (and only here) because filings can honestly come from
  // a live OpenDART call — see FixtureEnvelope in ../types/dashboard.
  return getFixture<CompanyDetailData>("/api/company-detail", [0, 1]);
}
