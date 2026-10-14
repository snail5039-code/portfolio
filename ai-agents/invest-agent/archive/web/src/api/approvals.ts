import { getFixture, postFixtureAction } from "./client";
import { APPROVALS_CHANGED_EVENT } from "../lib/useApprovalsPendingCount";
import type { ApprovalActionEnvelope, ApprovalOrder, ApprovalsData, ApprovalsEnvelope } from "../types/dashboard";

export async function getApprovals(): Promise<ApprovalsEnvelope> {
  // Can honestly be live once an order actually went to KIS 모의투자 — see
  // `kisOrderNo` on each order and `app/routers/approvals.py`.
  return getFixture<ApprovalsData>("/api/approvals", [0, 1]);
}

export async function approveOrder(decisionId: string): Promise<ApprovalActionEnvelope> {
  const result = await postFixtureAction<ApprovalOrder>(`/api/approvals/${decisionId}/approve`, [0, 1]);
  window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
  return result;
}

export async function rejectOrder(decisionId: string): Promise<ApprovalActionEnvelope> {
  const result = await postFixtureAction<ApprovalOrder>(`/api/approvals/${decisionId}/reject`);
  window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
  return result;
}
