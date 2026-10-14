import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type ReportRangeKey = "week" | "month" | "quarter";
export type ReportTopicKey =
  | "return" | "risk" | "cash" | "benchmark" | "alpha" | "samsung" | "hynix" | "naver"
  | "approved" | "rejected" | "blocked" | "source" | "volatility" | "slippage" | "tax";

export type ReportRange = Api<components["schemas"]["ReportRange"]>;
export type ReportFact = Api<components["schemas"]["ReportFact"]>;
export type ReportRow = Api<components["schemas"]["ReportRow"]>;
export type ReportRiskItem = Api<components["schemas"]["ReportRiskItem"]>;
export type ReportDetail = Api<
  components["schemas"]["ReportDetail"],
  {
    summaryByRange: Record<ReportRangeKey, string>;
    factsByRange: Record<ReportRangeKey, ReportFact[]>;
  }
>;

export type WeeklyReportData = Api<
  components["schemas"]["WeeklyReportData"],
  {
    ranges: Record<ReportRangeKey, ReportRange>;
    details: Record<ReportTopicKey, ReportDetail>;
  }
>;
export type WeeklyReportEnvelope = FixtureEnvelope<WeeklyReportData>;
