import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type TradeStatus = "모의승인" | "반려" | "정책 차단" | "만료" | "대기";

export type TradeHistoryItem = Api<components["schemas"]["TradeHistoryItem"]>;
export type TradeRelatedLink = Api<components["schemas"]["TradeRelatedLink"]>;
export type TradeHistoryData = Api<components["schemas"]["TradeHistoryData"]>;
export type TradeHistoryEnvelope = FixtureEnvelope<TradeHistoryData>;
