// @vitest-environment node
/**
 * Beta F-01: a site hears once when its job's evaluation reaches an outcome.
 * Real ingest, outbox, reconciler and dispatch authority over the shared
 * Firestore fake; the email transport is a spy.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { outcomePublication, screeningFixture, sealScreening } from "./fixtures/beta-policy-screening";
import { screeningOutcomeSentence, type ScreeningOutcome } from "../utils/betaPolicyScreeningContract";

const send = vi.hoisted(() => vi.fn());
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/email", () => ({ sendEmail: send }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: vi.fn(async (value: string) => value.replace(/^encrypted:/, "")) }));

const { ingestBetaPolicyScreening } = await import("../utils/betaPolicyScreeningIngest");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { reconcileScreeningOutcomeNotifications } = await import("../utils/screeningOutcomeNotifications");

const RESULT_OUTCOMES = ["estimate", "reference_only", "held_capability", "held_unprepared", "infeasible", "no_match"] as const;
const scene = createHash("sha256").update("scene-one").digest("hex").slice(0, 24);
const key = (outcome: string) => `captureOutbox/job-one:evaluation_outcome:${outcome}-${scene}`;
const notices = () => [...state.docs.entries()].filter(([path]) => path.startsWith("captureOutbox/job-one:evaluation_outcome:")
  && !path.includes("/deliveryReceipts/"));
const run = (campaign = "campaign-one") => state.docs.get(`taskEvaluationPolicyRuns/${campaign}`) as Record<string, any>;
let base: ReturnType<typeof screeningFixture>["publication"];

beforeEach(() => {
  state.docs.clear();
  const { publication, job, brief, intake } = screeningFixture();
  base = publication;
  state.docs.set("inboundRequests/job-one", { ...job, contact: { email: "encrypted:owner@example.com" } });
  state.docs.set("siteTaskBriefs/job-one", brief);
  state.docs.set("taskEvaluationSceneIntakes/intake-one", intake);
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
});

describe("one email per terminal outcome of the job's evaluation (F-01)", () => {
  it.each(RESULT_OUTCOMES)("sends %s once, with the page's sentence, the private link and the disclaimer", async outcome => {
    const publication = outcomePublication(base, outcome);
    await ingestBetaPolicyScreening(publication);
    expect(run()).toMatchObject({ screening_outcome: outcome, outcome_notification_pending: true,
      outcome_notification_intent: { request_id: "job-one", outcome, event_id: `${outcome}-${scene}` } });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    const notice = state.docs.get(key(outcome)) as Record<string, string>;
    expect(notice).toMatchObject({ status: "sent", kind: "evaluation_outcome", to: "owner@example.com" });
    expect(notice.body.startsWith(screeningOutcomeSentence(outcome as ScreeningOutcome))).toBe(true);
    expect(notice.body).toMatch(/never certifies physical performance or safety/);
    expect(notice.body).toMatch(/on your private job page:\nhttps?:\/\/\S+\/capture-upload\//);
    // Everything before the link: no code, operator instruction or budget, which are Blueprint's own.
    const words = notice.body.slice(0, notice.body.indexOf("on your private job page"));
    expect(words).not.toMatch(/rerun|setup blocker|owner approval|budget|\$|development only|[a-z]_[a-z]/i);
    if (outcome === "estimate") {
      expect(notice.subject).toBe("Your simulation estimate is ready");
      expect(notice.body).toContain("In the simulation, 2 of 36 candidates ran, with 6 episodes scored against the job's success criteria.");
    } else {
      expect(notice.subject).toBe("Your job's simulation evaluation has finished");
      expect(notice.body).not.toMatch(/estimate is ready|episodes scored/);
    }
    expect(run().outcome_notification_pending).toBe(false);
    // A replayed delivery, a later pass or a budget-only revision is not another email.
    await ingestBetaPolicyScreening(publication);
    await ingestBetaPolicyScreening(sealScreening({ ...publication, revision: publication.revision + 1,
      budget: { ...publication.budget, committed_upper_bound_usd: "5", spent_upper_bound_usd: "5" } }));
    expect(run().outcome_notification_pending).toBe(false);
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(notices()).toHaveLength(1);
  });

  it.each(["awaiting_spend_approval", "setup_repair", "superseded"])("sends nothing for %s", async outcome => {
    await ingestBetaPolicyScreening(outcomePublication(base, outcome));
    expect(run()).toMatchObject({ screening_outcome: outcome });
    expect(run().outcome_notification_pending).toBeUndefined();
    await deliverOutbox();
    expect(notices()).toHaveLength(0);
  });

  it("sends nothing while the run is open, then once when it ends", async () => {
    await ingestBetaPolicyScreening(base);
    await deliverOutbox();
    expect(notices()).toHaveLength(0);
    await ingestBetaPolicyScreening(outcomePublication(base, "held_capability"));
    await deliverOutbox();
    expect(notices().map(([path]) => path)).toEqual([key("held_capability")]);
  });

  it("sends nothing for a run that was cancelled before it ended", async () => {
    await ingestBetaPolicyScreening(base);
    state.docs.set("taskEvaluationPolicyRuns/campaign-one", { ...run(), cancellationRequested: true, state: "cancelled" });
    await ingestBetaPolicyScreening(outcomePublication(base, "held_capability"));
    expect(run()).toMatchObject({ state: "cancelled", screening_outcome: "held_capability" });
    expect(run().outcome_notification_pending).toBeUndefined();
    await deliverOutbox();
    expect(notices()).toHaveLength(0);
  });

  it("cancels a queued held email at dispatch once an estimate has won the page", async () => {
    await ingestBetaPolicyScreening(outcomePublication(base, "held_capability"));
    await reconcileScreeningOutcomeNotifications();
    expect(state.docs.get(key("held_capability"))).toMatchObject({ status: "pending" });
    await ingestBetaPolicyScreening(sealScreening({ ...outcomePublication(base, "estimate"), campaign_id: "campaign-two" }));
    await deliverOutbox();
    expect(state.docs.get(key("held_capability"))).toMatchObject({ status: "cancelled", attempts: 0 });
    expect(state.docs.get(key("estimate"))).toMatchObject({ status: "sent" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toBe("Your simulation estimate is ready");
    expect([run().outcome_notification_pending, run("campaign-two").outcome_notification_pending]).toEqual([false, false]);
  });

  it("does not email a re-planned successor that reaches the same outcome again", async () => {
    await ingestBetaPolicyScreening(outcomePublication(base, "held_unprepared"));
    await deliverOutbox();
    await ingestBetaPolicyScreening(sealScreening({ ...outcomePublication(base, "held_unprepared"), campaign_id: "campaign-two" }));
    expect(run("campaign-two")).toMatchObject({ outcome_notification_pending: true,
      outcome_notification_intent: { event_id: `held_unprepared-${scene}` } });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(notices()).toHaveLength(1);
    expect(run("campaign-two").outcome_notification_pending).toBe(false);
  });

  it("cancels it when recording permission is withdrawn before dispatch, and keeps the intent when withdrawn before enqueue", async () => {
    await ingestBetaPolicyScreening(outcomePublication(base, "no_match"));
    await reconcileScreeningOutcomeNotifications();
    const job = state.docs.get("inboundRequests/job-one") as Record<string, any>;
    state.docs.set("inboundRequests/job-one", { ...job, consent_revoked: true });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(state.docs.get(key("no_match"))).toMatchObject({ status: "cancelled", attempts: 0 });
    // Withdrawn before anything was queued: nothing is queued, and the intent stays for the record.
    state.docs.clear();
    const { publication, job: fresh, brief, intake } = screeningFixture();
    state.docs.set("inboundRequests/job-one", { ...fresh, contact: { email: "encrypted:owner@example.com" } });
    state.docs.set("siteTaskBriefs/job-one", brief);
    state.docs.set("taskEvaluationSceneIntakes/intake-one", intake);
    await ingestBetaPolicyScreening(outcomePublication(publication, "no_match"));
    state.docs.set("inboundRequests/job-one", { ...state.docs.get("inboundRequests/job-one")!, consent_revoked: true });
    await deliverOutbox();
    expect(notices()).toHaveLength(0);
    expect(run().outcome_notification_pending).toBe(true);
  });
});
