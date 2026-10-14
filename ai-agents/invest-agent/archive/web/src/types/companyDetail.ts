import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type CompanyEvidenceKind = "positive" | "negative" | "filing";

export type CompanyChartPoint = Api<components["schemas"]["CompanyChartPoint"]>;
export type CompanyMetric = Api<components["schemas"]["CompanyMetric"]>;
export type CompanyEvidenceItem = Api<components["schemas"]["CompanyEvidenceItem"]>;
export type CompanyPricePanel = Api<components["schemas"]["CompanyPricePanel"]>;
export type CompanyDetailData = Api<components["schemas"]["CompanyDetailData"]>;
export type CompanyDetailEnvelope = FixtureEnvelope<CompanyDetailData>;
