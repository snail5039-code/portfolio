import { getFixture } from "./client";
import type { DataConnectionsData, DataConnectionsEnvelope } from "../types/dashboard";

export async function getDataConnections(): Promise<DataConnectionsEnvelope> {
  return getFixture<DataConnectionsData>("/api/data-connections");
}
