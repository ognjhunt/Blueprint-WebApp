// @vitest-environment node
/**
 * A job whose evaluation could not start after scene publication is held by
 * name: the Pipeline's hold is bound like a campaign, read by the job page as a
 * finished outcome, told to the site once and to our team once, and outranked
 * by any campaign or a release. Real ingest, outbox and ops scan over the
 * shared Firestore fake; the email and Slack transports are spies.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { outcomePublication, screeningFixture, sealScreening } from "./fixtures/beta-policy-screening";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { screeningOutcomeSentence } from "../utils/betaPolicyScreeningContract";

const send = vi.hoisted(() => vi.fn());
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/email", () => ({ sendEmail: send }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: vi.fn(async (value: string) => value.replace(/^encrypted:/, "")) }));

const { ingestBetaPolicyScreeningHold, parseBetaPolicyScreeningHold } = await import("../utils/betaPolicyScreeningHold");
const { ingestBetaPolicyScreening } = await import("../utils/betaPolicyScreeningIngest");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { readWebsiteSceneProgression, sceneScreening } = await import("../utils/websiteSceneProgression");
const { scanHeldWebsiteEvaluations } = await import("../utils/websitePreparationOpsAlerts");

let base: ReturnType<typeof screeningFixture>["publication"];
const holdId = (intent: string) => `hold-${createHash("sha256").update(intent).digest("hex").slice(0, 32)}`;
function sealHold(fields: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = { schema_version: "beta_policy_screening_hold.v1", hold_id: holdId(base.source.scene_intent_id),
    site_id: base.site_id, source: base.source, status: "held", reason_code: "robot_free_probe_failed", detail_code: "not_passed",
    revision: 1, generated_at: "2026-11-03T18:00:00+00:00", ...fields };
  return { ...value, hold_digest: crossRuntimeArtifactDigest(value, "hold_digest") };
}
const holdRun = () => state.docs.get(`taskEvaluationPolicyRuns/${holdId(base.source.scene_intent_id)}`) as Record<string, any>;
const progression = () => readWebsiteSceneProgression("job-one", base.source.capture_id);

beforeEach(() => {
  state.docs.clear();
  const { publication, job, brief, intake } = screeningFixture();
  base = publication;
  state.docs.set("inboundRequests/job-one", { ...job, contact: { email: "encrypted:owner@example.com" } });
  state.docs.set("siteTaskBriefs/job-one", brief);
  state.docs.set("taskEvaluationSceneIntakes/intake-one", intake);
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
});

describe("a website evaluation held before any campaign started", () => {
  it("accepts only a sealed hold named by its scene intent, with a reason exactly while held", () => {
    expect(parseBetaPolicyScreeningHold(sealHold())).not.toBeNull();
    expect(parseBetaPolicyScreeningHold({ ...sealHold(), detail_code: "changed" })).toBeNull();
    expect(parseBetaPolicyScreeningHold(sealHold({ hold_id: holdId("another-intent") }))).toBeNull();
    expect(parseBetaPolicyScreeningHold(sealHold({ status: "released" }))).toBeNull();
    expect(parseBetaPolicyScreeningHold(sealHold({ reason_code: "made_up_reason" }))).toBeNull();
    expect(parseBetaPolicyScreeningHold(sealHold({ status: "released", reason_code: null, detail_code: null }))).not.toBeNull();
  });

  it.each([
    ["robot_free_probe_failed", "held_scene_check"],
    ["robot_free_probe_not_completed", "held_setup"],
    ["team_scene_packet_blocked", "held_setup"],
    ["robot_free_probe_unavailable_for_task", "held_capability"],
  ])("shows %s on the job page as %s and tells the site once", async (reason, outcome) => {
    const hold = parseBetaPolicyScreeningHold(sealHold({ reason_code: reason }))!;
    await expect(ingestBetaPolicyScreeningHold(hold)).resolves.toMatchObject({ status: "created", revision: 1,
      hold_id: hold.hold_id, hold_digest: hold.hold_digest });
    expect(holdRun()).toMatchObject({ run_kind: "beta_policy_screening_hold", state: "blocked", screening_outcome: outcome,
      hold_reason_code: reason, website_request_id: "job-one", outcome_notification_pending: true });
    // Never listed as a result: it carries no job evidence binding.
    expect(holdRun()).not.toHaveProperty("job_evidence_binding");
    await expect(progression()).resolves.toMatchObject({ state: "held", heldReason: outcome });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].text.startsWith(screeningOutcomeSentence(outcome as never))).toBe(true);
    // The same hold again, or a replay, is not another email.
    await expect(ingestBetaPolicyScreeningHold(hold)).resolves.toMatchObject({ status: "replayed" });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("is outranked by any campaign for the scene, and silenced by a release after a re-drive", async () => {
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold())!);
    expect(sceneScreening([{ id: "hold", run: holdRun() }], holdRun().team_namespace).outcome).toBe("held_scene_check");
    // A deploy re-drove the probe: released, the page no longer says held.
    const released = parseBetaPolicyScreeningHold(sealHold({ status: "released", reason_code: null, detail_code: null, revision: 2 }))!;
    await expect(ingestBetaPolicyScreeningHold(released)).resolves.toMatchObject({ status: "updated", revision: 2 });
    expect(holdRun()).toMatchObject({ state: "released", screening_outcome: null });
    await expect(progression()).resolves.not.toMatchObject({ state: "held" });
    // An older revision never replaces a newer one; the same revision with other bytes is a conflict.
    await expect(ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold())!)).resolves.toMatchObject(
      { status: "replayed", revision: 2 });
    await expect(ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ revision: 2 }))!))
      .rejects.toThrow("screening_hold_revision_conflict");
    // Held again, then the probe passes and a campaign is published: the campaign speaks.
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ revision: 3 }))!);
    await expect(progression()).resolves.toMatchObject({ state: "held", heldReason: "held_scene_check" });
    await ingestBetaPolicyScreening(outcomePublication(base, "estimate"));
    await expect(progression()).resolves.toMatchObject({ state: "evaluated" });
  });

  it("reads a run stored as still waiting again from its publication, so a final end never stays in progress", async () => {
    await ingestBetaPolicyScreening(outcomePublication(base, "held_budget"));
    const stored = state.docs.get("taskEvaluationPolicyRuns/campaign-one") as Record<string, any>;
    expect(stored.screening_outcome).toBe("held_budget");
    // As an earlier release stored it.
    state.docs.set("taskEvaluationPolicyRuns/campaign-one", { ...stored, screening_outcome: "awaiting_spend_approval" });
    await expect(progression()).resolves.toMatchObject({ state: "held", heldReason: "held_budget" });
    // A run the Pipeline plans again after a deploy stays in progress.
    await ingestBetaPolicyScreening(sealScreening({ ...outcomePublication(base, "setup_repair"), campaign_id: "campaign-two" }));
    await expect(progression()).resolves.toMatchObject({ progressOutcome: "setup_repair" });
  });

  it("refuses a hold for a source the job's scene intake does not bind", async () => {
    const other = sealScreening({ ...base, source: { ...base.source, scene_revision_digest: `sha256:${"9".repeat(64)}` } });
    const hold = parseBetaPolicyScreeningHold(sealHold({ source: other.source }))!;
    await expect(ingestBetaPolicyScreeningHold(hold)).rejects.toThrow("screening_scene_source_mismatch");
    expect(holdRun()).toBeUndefined();
  });

  it("tells our team once about a hold that is ours to look at, and not about a capability hold", async () => {
    const alert = vi.fn(async () => ({ sent: true }));
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ reason_code: "robot_free_probe_unavailable_for_task" }))!);
    await expect(scanHeldWebsiteEvaluations({ alert })).resolves.toEqual({ held: 0, alerted: 0 });
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ reason_code: "team_scene_packet_blocked",
      detail_code: "team_scene_packet_bundle_invalid", revision: 2 }))!);
    await expect(scanHeldWebsiteEvaluations({ alert })).resolves.toEqual({ held: 1, alerted: 1 });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(String((alert.mock.calls[0] as unknown[])[1])).toMatch(
      /finished without an estimate: held_setup \(team_scene_packet_blocked\)\. .*\/admin\/leads\/job-one/);
    await expect(scanHeldWebsiteEvaluations({ alert })).resolves.toMatchObject({ alerted: 0 });
    // A campaign that ended on our side is reported the same way.
    await ingestBetaPolicyScreening(outcomePublication(base, "held_setup"));
    await expect(scanHeldWebsiteEvaluations({ alert })).resolves.toMatchObject({ alerted: 1 });
  });
});
