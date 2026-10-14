import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type BacktestStrategyKey = "conservative" | "balanced" | "aggressive";
export type BacktestPeriodKey = "3m" | "6m" | "1y";

export type BacktestConfig = Api<components["schemas"]["BacktestConfig"]>;
export type BacktestPeriod = Api<components["schemas"]["BacktestPeriod"]>;
export type BacktestMetrics = Api<components["schemas"]["BacktestMetrics"]>;
export type BacktestRow = Api<components["schemas"]["BacktestRow"]>;
export type BacktestSummaryData = Api<
  components["schemas"]["BacktestSummaryData"],
  {
    configs: Record<BacktestStrategyKey, BacktestConfig>;
    periods: Record<BacktestPeriodKey, BacktestPeriod>;
    metrics: Record<BacktestStrategyKey, Record<BacktestPeriodKey, BacktestMetrics>>;
    rows: Record<BacktestStrategyKey, Record<BacktestPeriodKey, BacktestRow[]>>;
  }
>;
export type BacktestSummaryEnvelope = FixtureEnvelope<BacktestSummaryData>;
