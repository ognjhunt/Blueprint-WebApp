// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { communicationsDigest } from "../agents/communications-contract";
import { readEvaluationReadiness, EVALUATION_READINESS_REF, siteReplyPromiseBlockers } from "../agents/communications-readiness";
import { memoryFirestore, communicationsNow } from "./fixtures/communications";
import { publishSyntheticReadiness } from "./fixtures/communications-readiness";
import { CANONICAL_TASK_EVALUATION_ALLOCATOR } from "../utils/taskEvaluationLaunchContract";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function catalogProfile(claim_ceiling = "partner_run_pending_physical_join", live_enabled = true) {
  const reference = { uri: "gs://synthetic-test/readiness.json", digest: `sha256:${"a".repeat(64)}` };
  return { profile_id: "synthetic-partner-evaluation", profile_digest: `sha256:${"b".repeat(64)}`,
    source_bundle: { ...reference, bundle_id: "synthetic-raw-capture", source_kind: "raw_v3_2_capture" },
    evaluation_run_spec: reference, required_controls: { canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
      secret_profile_id: "synthetic-test", watchdog_required: true, artifact_storage_required: true, teardown_required: true,
      provider_zero_required: true, webapp_status_sync_required: true, retry_cap: 0 },
    execution_admission: { live_enabled, readiness_receipt: reference, blockers: live_enabled ? [] : ["access_unavailable"] }, claim_ceiling,
    task_evaluation_run: { run_mode: "scene_configuration", team_namespace: "synthetic-team", scene_id: "site-1", task_id: "task-1",
      configuration_run_id: "synthetic-run", evaluation_episode_executed: false } };
}

const scope = { siteId: "site-1", taskId: "task-1" };
describe("capability evidence for site communications", () => {
  it("uses the existing live Pipeline catalog without a new publication, treats profiles as alternatives, and keeps retrieval times out of the binding", async () => {
    const db = memoryFirestore(); vi.stubEnv("TASK_EVALUATION_LAUNCH_PROFILES_URL", "https://pipeline.example/catalog");
    const profiles = [{ ...catalogProfile("development_only"), profile_id: "development-alternative" },
      { ...catalogProfile("partner_run_pending_physical_join", false), profile_id: "blocked-alternative" }, catalogProfile()];
    const fetchCatalog = vi.fn(async () => new Response(JSON.stringify({ schema_version: "task_evaluation_launch_profile_catalog.v1", profiles }),
      { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchCatalog);
    const first = await readEvaluationReadiness(db, scope, communicationsNow);
    expect(first).toMatchObject({ state: "available", capabilities: [{ capabilityId: "synthetic-partner-evaluation", basis: "live_pipeline_catalog" }] });
    expect((await readEvaluationReadiness(db, scope, communicationsNow + 100000)).bindingDigest).toBe(first.bindingDigest);
    expect(fetchCatalog).toHaveBeenCalledWith("https://pipeline.example/catalog", expect.objectContaining({ method: "GET" }));
    expect((await readEvaluationReadiness(db, { ...scope, taskId: "unmatched-task" }, communicationsNow)).state).toBe("unknown");
  });
  it.each(["development_only", "diagnostic_policy_execution"])("never promotes the catalog's %s profile into site evaluation access", async ceiling => {
    const db = memoryFirestore(); vi.stubEnv("TASK_EVALUATION_LAUNCH_PROFILES_URL", "https://pipeline.example/catalog");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ schema_version: "task_evaluation_launch_profile_catalog.v1", profiles: [catalogProfile(ceiling)] }))));
    expect((await readEvaluationReadiness(db, scope, communicationsNow)).state).toBe("unknown");
  });
  it("does not infer current access from an environment-only profile declaration", async () => {
    const db = memoryFirestore(); vi.stubEnv("TASK_EVALUATION_LAUNCH_PROFILES_URL", ""); vi.stubEnv("TASK_EVALUATION_LAUNCH_URL", "");
    vi.stubEnv("TASK_EVALUATION_LAUNCH_PROFILES_JSON", JSON.stringify([catalogProfile()]));
    const fetchCatalog = vi.fn(); vi.stubGlobal("fetch", fetchCatalog);
    expect((await readEvaluationReadiness(db, scope, communicationsNow)).state).toBe("unknown");
    expect(fetchCatalog).not.toHaveBeenCalled();
  });
  it("keeps absent readiness unknown and retains a stable binding across reads", async () => {
    const db = memoryFirestore();
    const first = await readEvaluationReadiness(db, scope, communicationsNow);
    expect(first).toMatchObject({ state: "unknown", blockers: ["capability_readiness_evidence_missing"] });
    expect((await readEvaluationReadiness(db, scope, communicationsNow + 100)).bindingDigest).toBe(first.bindingDigest);
  });
  it.each(["available", "unavailable", "unknown"] as const)("uses current owner evidence for %s, without requiring Atlas", async status => {
    const db = memoryFirestore(); await publishSyntheticReadiness(db, status);
    expect(await readEvaluationReadiness(db, scope, communicationsNow)).toMatchObject({ state: status,
      capabilities: [{ capabilityId: "evaluation_access", status }] });
  });
  it.each([
    { checkedAt: new Date(communicationsNow - 8 * 86400000).toISOString() },
    { checkedAt: new Date(communicationsNow + 1000).toISOString() },
    { expiresAt: new Date(communicationsNow).toISOString() },
    { siteId: "other-site", taskId: "task-1" },
    { claimCeiling: "development_only" },
    { proofBasis: "vendor_announcement" },
  ])("keeps unsupported, stale or mismatched evidence unknown: %j", async change => {
    const db = memoryFirestore(); await publishSyntheticReadiness(db, "available", change);
    expect((await readEvaluationReadiness(db, scope, communicationsNow)).state).toBe("unknown");
  });
  it("does not reuse a digest after the owning capability record changed", async () => {
    const db = memoryFirestore(), { recordRef } = await publishSyntheticReadiness(db, "available");
    await db.doc(recordRef).update({ communicationsReadiness: { status: "unavailable" } });
    expect((await readEvaluationReadiness(db, scope, communicationsNow)).state).toBe("unknown");
  });
  it("requires every configured capability, and handles Atlas only if evidenced required", async () => {
    const db = memoryFirestore(); await publishSyntheticReadiness(db, "available");
    const atlas = { communicationsReadiness: { version: "blueprint.capability-readiness-evidence.v1", capabilityId: "Atlas",
      status: "unavailable", sourceSystem: "synthetic-runtime", proofBasis: "owner_system", claimCeiling: "operational",
      checkedAt: new Date(communicationsNow - 1000).toISOString(), expiresAt: new Date(communicationsNow + 3600000).toISOString(), siteId: null, taskId: null } };
    await db.doc("runtimeCapabilities/Atlas").set(atlas);
    const publication = db.records.get(EVALUATION_READINESS_REF);
    publication.requiredCapabilities.push({ capabilityId: "Atlas", recordRef: "runtimeCapabilities/Atlas", recordDigest: communicationsDigest(atlas) });
    expect(await readEvaluationReadiness(db, scope, communicationsNow)).toMatchObject({ state: "unavailable", blockers: ["capability_unavailable:Atlas"] });
    atlas.communicationsReadiness.status = "available";
    await db.doc("runtimeCapabilities/Atlas").set(atlas);
    publication.requiredCapabilities[1].recordDigest = communicationsDigest(atlas);
    expect((await readEvaluationReadiness(db, scope, communicationsNow)).state).toBe("available");
  });
  it.each([
    ["We will supply a robot.", "unsupported_reply_commitment"],
    ["We can provide a robot for your pilot.", "unsupported_reply_commitment"],
    ["We already have a robot team ready for your pilot.", "unsupported_reply_commitment"],
    ["We'll match you with a team.", "unsupported_reply_commitment"],
    ["We will book your pilot.", "unsupported_reply_commitment"],
    ["Evaluation access will be ready next week.", "unsupported_reply_launch_date"],
    ["We will evaluate your packing task next week.", "unsupported_reply_launch_date"],
    ["We are launching evaluation access next Tuesday.", "unsupported_reply_launch_date"],
    ["Atlas is ready for your evaluation.", "reply_atlas_access_not_evidenced"],
    ["Atlas access is unavailable, so we cannot proceed until Atlas launches.", "reply_atlas_blocker_not_evidenced"],
    ["Evaluation access is unavailable.", "reply_readiness_status_not_evidenced"],
    ["We can run an evaluation now.", "reply_evaluation_readiness_not_evidenced"],
    ["We need a video before we can reply.", "reply_video_condition"],
  ])("flags fabricated promises and reply conditions: %s", (body, code) => {
    expect(siteReplyPromiseBlockers(body)).toContain(code);
  });
  it("allows a useful conditional conversation and optional video wording", () => {
    expect(siteReplyPromiseBlockers("Happy to help scope the job while evaluation access is being confirmed. What constraints should we consider? We can revisit evaluation when access is confirmed. You don't need a video to reply.")).toEqual([]);
  });
});
