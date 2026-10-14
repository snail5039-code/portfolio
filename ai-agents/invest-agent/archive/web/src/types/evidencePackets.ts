import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type EvidenceStatus = "확인" | "주의" | "차단";

export type EvidenceChecklistItem = Api<components["schemas"]["EvidenceChecklistItem"]>;
export type EvidencePacket = Api<components["schemas"]["EvidencePacket"]>;
export type EvidencePacketsData = Api<components["schemas"]["EvidencePacketsData"]>;
export type EvidencePacketsEnvelope = FixtureEnvelope<EvidencePacketsData>;
