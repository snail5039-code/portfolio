import { getFixture } from "./client";
import type { AccountData, AccountEnvelope } from "../types/dashboard";

export async function getAccount(): Promise<AccountEnvelope> {
  return getFixture<AccountData>("/api/account");
}
