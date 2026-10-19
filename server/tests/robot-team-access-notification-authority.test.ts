// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state, sharedFakeFirestore as db } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, default: { firestore: { FieldValue: { serverTimestamp: () => "NOW" } } } };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const send = vi.hoisted(() => vi.fn(async (): Promise<any> => ({ sent: true, provider: "resend", messageId: "fixture-message" })));
const beforeDispatch = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../utils/email", () => ({ sendEmail: send }));
vi.mock("../utils/taskStatusUpdates", () => ({ enqueueDueTaskStatusUpdates: vi.fn(), taskStatusUpdateIsCurrent: beforeDispatch, acknowledgeTaskStatusUpdate: vi.fn() }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ reconcileSceneReadyNotifications: vi.fn(), reconcileWebsitePreparationNotifications: vi.fn(), reconcileFootageBeforeAccountNotices: vi.fn() }));
vi.mock("../utils/agentRunResultNotifications", () => ({ reconcileAgentRunResultNotifications: vi.fn() }));
vi.mock("../utils/taskEvaluationNotificationRetry", () => ({ reconcileTaskEvaluationNotificationRetries: vi.fn() }));
vi.mock("../utils/pilotRecommendationNotifications", () => ({ pilotRecommendationNotificationIsCurrent: vi.fn(async () => true) }));
vi.mock("../utils/taskLifecycleNotificationAuthority", () => ({ taskLifecycleNotificationIsCurrent: vi.fn(async () => true) }));
vi.mock("../utils/newJobAlerts", () => ({ jobAlertIsCurrent: vi.fn(async () => true), resumeNewJobFanout: vi.fn() }));

import { buildOutboxEntry, deliverOutbox } from "../utils/captureOutbox";
import { accessRecordId } from "../utils/robotTeamEarlyAccess";
import { robotTeamAccessNotificationAuthority } from "../utils/robotTeamAccessNotificationAuthority";

const email = "fixture@example.invalid";
const recordId = accessRecordId(email);
const recordKey = `robotTeamAccess/${recordId}`;
const revision = "2026-10-19T10:00:00.000Z";
function notice(kind: "robot_team_access_approved" | "robot_team_access_not_yet" | "robot_team_access_received" = "robot_team_access_approved", legacy = false, resend = false) {
  const status = kind === "robot_team_access_approved" ? "approved" : kind === "robot_team_access_not_yet" ? "declined" : "applied";
  const idempotencyKey = `${kind}:${recordId}:${resend ? "resend-2026-10-19T10" : revision}`;
  const entry = buildOutboxEntry({ idempotencyKey, requestId: `robot-team-access:${recordId}`, kind, to: email,
    subject: "Fixture invitation", body: "Retained fixture body", replyTo: "hello@tryblueprint.io",
    ...(!legacy ? { robotTeamAccessNotice: { schemaVersion: "robot_team_access_notice.v1" as const, recordId, status, revision } } : {}),
  });
  const key = `captureOutbox/${idempotencyKey}`;
  state.docs.set(key, entry);
  state.docs.set(recordKey, { email, status, decidedBy: "fixture-ops", decidedAtIso: revision, appliedAtIso: revision });
  return key;
}
beforeEach(() => { state.docs.clear(); send.mockClear(); beforeDispatch.mockReset().mockResolvedValue(true); });

describe("manual access decision at the existing outbox dispatch boundary", () => {
  it("delivers an invitation only while its exact approval remains current", async () => {
    const key = notice();
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(state.docs.get(key)).toMatchObject({ status: "sent" });
  });

  it.each(["declined", "reapproved", "recipient_changed"])("fences %s between claim and provider dispatch", async reason => {
    const key = notice();
    beforeDispatch.mockImplementationOnce(async () => {
      const record = state.docs.get(recordKey)!;
      if (reason === "declined") record.status = "declined";
      if (reason === "reapproved") record.decidedAtIso = "2026-10-19T10:01:00.000Z";
      if (reason === "recipient_changed") record.email = "another@example.invalid";
      return true;
    });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(state.docs.get(key)).toMatchObject({ status: "cancelled", attempts: 0 });
  });

  it.each(["robot_team_access_received", "robot_team_access_not_yet"] as const)("does not send a stale %s after the team is approved", async kind => {
    const key = notice(kind);
    state.docs.get(recordKey)!.status = "approved";
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(state.docs.get(key)).toMatchObject({ status: "cancelled", attempts: 0 });
  });

  it("continues a legacy decision notice whose key proves the current revision", async () => {
    const key = notice("robot_team_access_approved", true);
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(state.docs.get(key)).toMatchObject({ status: "sent" });
  });

  it("retains an unverifiable legacy hourly resend for review without claiming delivery or retrying it", async () => {
    const key = notice("robot_team_access_approved", true, true);
    await deliverOutbox();
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(state.docs.get(key)).toMatchObject({ status: "review_required", attempts: 0,
      lastError: "robot_team_access_notice_revision_unverified", body: "Retained fixture body" });
  });

  it("fences a changed approval context along with the retained email body", async () => {
    const key = notice();
    beforeDispatch.mockImplementationOnce(async () => {
      (state.docs.get(key)!.robotTeamAccessNotice as Record<string, unknown>).revision = "2026-10-19T10:01:00.000Z";
      return true;
    });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(state.docs.get(key)).toMatchObject({ status: "pending", lastError: "delivery_message_changed", attempts: 0 });
  });

  it("leaves unrelated existing notices outside this access-decision check", async () => {
    const answer = await db.runTransaction(tx => robotTeamAccessNotificationAuthority({ kind: "task_received",
      requestId: "site-job", idempotencyKey: "site-receipt", to: email }, tx));
    expect(answer).toBe("current");
  });
});
