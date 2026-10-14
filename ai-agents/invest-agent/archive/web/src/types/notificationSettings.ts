import type { components } from "./api.generated";
import type { Api, FixtureEnvelope } from "./common";

export type NotificationChannelId = "inapp" | "browser" | "email" | "messenger";
export type NotificationTypeId = "policy" | "source" | "approval" | "data" | "volatility" | "cost";
export type NotificationSeverity = "중대" | "높음" | "보통";

export type NotificationChannel = Api<components["schemas"]["NotificationChannel"]>;
export type NotificationType = Api<components["schemas"]["NotificationType"]>;
export type NotificationSettingsData = Api<components["schemas"]["NotificationSettingsData"]>;
export type NotificationSettingsEnvelope = FixtureEnvelope<NotificationSettingsData>;
