import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type TaxFeeStatus = "영향 작음" | "재검토" | "보류 권장";

export type TaxFeeOrder = Api<components["schemas"]["TaxFeeOrder"]>;
export type TaxFeeImpactData = Api<components["schemas"]["TaxFeeImpactData"]>;
export type TaxFeeImpactEnvelope = FixtureEnvelope<TaxFeeImpactData>;
