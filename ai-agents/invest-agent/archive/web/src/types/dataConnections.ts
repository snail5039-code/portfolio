import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type DataConnectionKey =
  | "opendart" | "price" | "securities" | "database" | "report" | "unknown" | "stale" | "permission" | "paper";
export type DataConnectionKind = "blocked" | "mock";

export type DataConnectionFact = Api<components["schemas"]["DataConnectionFact"]>;
export type DataConnectionDetail = Api<components["schemas"]["DataConnectionDetail"]>;
export type DataConnectionCard = Api<components["schemas"]["DataConnectionCard"]>;
export type DataConnectionRow = Api<components["schemas"]["DataConnectionRow"]>;
export type DataQualityChip = Api<components["schemas"]["DataQualityChip"]>;
export type DataConnectionsData = Api<
  components["schemas"]["DataConnectionsData"],
  { details: Record<DataConnectionKey, DataConnectionDetail> }
>;
export type DataConnectionsEnvelope = FixtureEnvelope<DataConnectionsData>;
