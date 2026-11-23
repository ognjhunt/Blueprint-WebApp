// @vitest-environment node
/**
 * A job held at the scene stage, by name: the Pipeline's hold is bound to the
 * scene intake and the job, read by the job page as the simulation's hold,
 * told to the site once and to our team once, and silenced by a release.
 * Campaign records of Blueprint's retired early trial stay stored and never
 * speak: the scene's own outcome, a blocked hold, or the published simulation
 * package does. Real ingest, outbox and ops scan over the shared Firestore
 * fake; the email and Slack transports are spies.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { screeningFixture, sealScreening } from "./fixtures/beta-policy-screening";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

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
const { deliverOutbox } = await import("../utils/captureOutbox");
const { readWebsiteSceneProgression, sceneHold } = await import("../utils/websiteSceneProgression");
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
/** A campaign record of the retired early trial, as an earlier release stored it for this scene. */
function storeCampaign(outcome: string) {
  state.docs.set("taskEvaluationPolicyRuns/campaign-one", { run_id: "campaign-one", run_kind: "beta_policy_screening",
    state: outcome === "estimate" ? "completed" : "blocked", screening_outcome: outcome, screening_execution_observed: true,
    website_request_id: "job-one", team_namespace: "blueprint-operations", source_scene_intent_id: base.source.scene_intent_id,
    outcome_notification_pending: true, created_at_iso: "2026-10-27T00:00:00.000Z" });
}
/** The company simulation package the Pipeline publishes for the job's capture (`storedCompanySimulation`). */
function publishSimulation() {
  const value = { schema_version: "website_company_simulation.v1", capture_id: base.source.capture_id,
    simulation_revision: `sha256:${"1".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
    content_type: "application/zip", digest: `sha256:${"2".repeat(64)}`, size_bytes: 1024, files: ["scene.usda", "success_rule.json"],
    permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4", updated_at_epoch: 1_800_000_000 };
  state.docs.set(`captureUploadSessions/${base.source.capture_id}`,
    { company_simulation: { ...value, simulation_digest: crossRuntimeArtifactDigest(value, "simulation_digest") } });
}

beforeEach(() => {
  state.docs.clear();
  const { publication, job, brief, intake, launch } = screeningFixture();
  base = publication;
  state.docs.set(launch.path, launch.record);
  state.docs.set("inboundRequests/job-one", { ...job, contact: { email: "encrypted:owner@example.com" } });
  state.docs.set("siteTaskBriefs/job-one", brief);
  state.docs.set("taskEvaluationSceneIntakes/intake-one", intake);
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
});

describe("a website evaluation held before any campaign started", () => {
  it("stores the account's monthly spend limit as a wait on Blueprint, never a setup problem, and sends no email", async () => {
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ reason_code: "team_scene_packet_blocked",
      detail_code: "account_monthly_spend_limit_reached" }))!);
    expect(holdRun()).toMatchObject({ state: "blocked", screening_outcome: "awaiting_spend_approval" });
    expect(holdRun().outcome_notification_pending).toBeUndefined();
    // Only the retired trial's campaigns reached that limit; the page reads the simulation as still being built.
    expect(await progression()).toEqual({ state: "completed" });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    // Any other detail of the same reason is still the setup hold it was.
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ reason_code: "team_scene_packet_blocked",
      detail_code: "team_scene_compile_failed", revision: 2 }))!);
    expect(holdRun().screening_outcome).toBe("held_setup");
    expect(await progression()).toEqual({ state: "held", heldReason: "held_setup" });
  });
  it("accepts only a sealed hold named by its scene intent, with a reason exactly while held", () => {
    expect(parseBetaPolicyScreeningHold(sealHold())).not.toBeNull();
    expect(parseBetaPolicyScreeningHold({ ...sealHold(), detail_code: "changed" })).toBeNull();
    expect(parseBetaPolicyScreeningHold(sealHold({ hold_id: holdId("another-intent") }))).toBeNull();
    expect(parseBetaPolicyScreeningHold(sealHold({ status: "released" }))).toBeNull();
    // A reason this release does not know is read, not refused (review, 2026-11-12): a hold on our side.
    expect(parseBetaPolicyScreeningHold(sealHold({ reason_code: "made_up_reason" }))).not.toBeNull();
    expect(parseBetaPolicyScreeningHold(sealHold({ status: "released", reason_code: null, detail_code: null }))).not.toBeNull();
  });

  it.each([
    ["robot_free_probe_failed", "held_scene_check"],
    ["robot_free_probe_not_completed", "held_setup"],
    ["team_scene_packet_blocked", "held_setup"],
    ["robot_free_probe_unavailable_for_task", "held_capability"],
  ])("shows %s on the job page as %s, and sends no email (the page says it)", async (reason, outcome) => {
    const hold = parseBetaPolicyScreeningHold(sealHold({ reason_code: reason }))!;
    await expect(ingestBetaPolicyScreeningHold(hold)).resolves.toMatchObject({ status: "created", revision: 1,
      hold_id: hold.hold_id, hold_digest: hold.hold_digest });
    expect(holdRun()).toMatchObject({ run_kind: "beta_policy_screening_hold", state: "blocked", screening_outcome: outcome,
      hold_reason_code: reason, website_request_id: "job-one" });
    expect(holdRun()).not.toHaveProperty("outcome_notification_intent");
    // Never listed as a result: it carries no job evidence binding.
    expect(holdRun()).not.toHaveProperty("job_evidence_binding");
    await expect(progression()).resolves.toMatchObject({ state: "held", heldReason: outcome });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    // The same hold again is a replay.
    await expect(ingestBetaPolicyScreeningHold(hold)).resolves.toMatchObject({ status: "replayed" });
  });

  it("is silenced by a release after a re-drive, and speaks again when held again", async () => {
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold())!);
    expect(sceneHold([{ id: "hold", run: holdRun() }], holdRun().team_namespace)).toEqual({ outcome: "held_scene_check" });
    // A deploy re-drove the probe: released, the page no longer says held.
    const released = parseBetaPolicyScreeningHold(sealHold({ status: "released", reason_code: null, detail_code: null, revision: 2 }))!;
    await expect(ingestBetaPolicyScreeningHold(released)).resolves.toMatchObject({ status: "updated", revision: 2 });
    expect(holdRun()).toMatchObject({ state: "released", screening_outcome: null });
    await expect(progression()).resolves.toEqual({ state: "completed" });
    // An older revision never replaces a newer one; the same revision with other bytes is a conflict.
    await expect(ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold())!)).resolves.toMatchObject(
      { status: "replayed", revision: 2 });
    await expect(ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ revision: 2 }))!))
      .rejects.toThrow("screening_hold_revision_conflict");
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ revision: 3 }))!);
    await expect(progression()).resolves.toEqual({ state: "held", heldReason: "held_scene_check" });
  });

  it("keeps the owner's closure on a hold: never shown, emailed or reported", async () => {
    state.docs.set("taskEvaluationPolicyRuns/" + holdId(base.source.scene_intent_id),
      { run_kind: "beta_policy_screening_hold", source_scene_intent_id: base.source.scene_intent_id, website_request_id: "job-one",
        state: "closed", cancellationRequested: true, hold_revision: 0, hold_digest: "sha256:" + "0".repeat(64) });
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ reason_code: "team_scene_packet_blocked" }))!);
    expect(holdRun()).toMatchObject({ state: "closed", cancellationRequested: true, screening_outcome: "held_setup" });
    expect(holdRun().outcome_notification_pending).toBeUndefined();
    await expect(progression()).resolves.not.toMatchObject({ state: "held" });
    await expect(scanHeldWebsiteEvaluations({ alert: vi.fn(async () => ({ sent: true })) })).resolves.toEqual({ held: 0, alerted: 0 });
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
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ reason_code: "robot_free_probe_failed",
      detail_code: "not_passed", revision: 2 }))!);
    await expect(scanHeldWebsiteEvaluations({ alert })).resolves.toEqual({ held: 1, alerted: 1 });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(String((alert.mock.calls[0] as unknown[])[1])).toMatch(
      /holds the scene stage: held_scene_check \(robot_free_probe_failed\)\. .*\/admin\/jobs\?job=job-one/);
    await expect(scanHeldWebsiteEvaluations({ alert })).resolves.toMatchObject({ alerted: 0 });
    // A stored campaign of the retired trial is never reported.
    state.docs.clear();
    storeCampaign("held_setup");
    await expect(scanHeldWebsiteEvaluations({ alert })).resolves.toEqual({ held: 0, alerted: 0 });
  });
});

describe("where a job's simulation stands without the early trial", () => {
  it("an old job with a campaign estimate and a published simulation package reads ready, not evaluated", async () => {
    storeCampaign("estimate");
    await expect(progression()).resolves.toEqual({ state: "completed" });
    publishSimulation();
    await expect(progression()).resolves.toEqual({ state: "ready" });
    // No email: the job page says the simulation is ready (owner, 2026-11-19).
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
  });

  it("an old job whose campaign ended held on budget, with no hold record, reads as being built", async () => {
    storeCampaign("held_budget");
    await expect(progression()).resolves.toEqual({ state: "completed" });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
  });

  it("a job with a campaign and a new blocked hold shows the hold, and sends no email", async () => {
    storeCampaign("estimate");
    publishSimulation();
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ reason_code: "team_scene_packet_blocked",
      detail_code: "scene_run_in_cold_storage" }))!);
    await expect(progression()).resolves.toEqual({ state: "held", heldReason: "held_setup", holdDetail: "scene_run_in_cold_storage" });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
  });

  it("a released hold does not speak: the simulation reads ready once its package is published", async () => {
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold())!);
    await ingestBetaPolicyScreeningHold(parseBetaPolicyScreeningHold(sealHold({ status: "released", reason_code: null,
      detail_code: null, revision: 2 }))!);
    publishSimulation();
    await expect(progression()).resolves.toEqual({ state: "ready" });
  });

  it("a new job with no campaign is being built until its package is published", async () => {
    await expect(progression()).resolves.toEqual({ state: "completed" });
    publishSimulation();
    await expect(progression()).resolves.toEqual({ state: "ready" });
  });
});
