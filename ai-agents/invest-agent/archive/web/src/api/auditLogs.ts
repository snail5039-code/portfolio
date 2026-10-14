import { getFixture } from "./client";
import type { AuditLogData, AuditLogEnvelope } from "../types/dashboard";

export async function getAuditLogs(): Promise<AuditLogEnvelope> {
  return getFixture<AuditLogData>("/api/audit-logs");
}
