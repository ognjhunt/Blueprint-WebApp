// @vitest-environment node
/**
 * Codes the Pipeline sends (review, 2026-11-12): an unknown reason or flag never fails a read or an ingest, and the
 * codes known today each have one plain sentence. Written from the rule: each slot, an unknown value, a known one.
 */
import { describe, expect, it } from "vitest";
import { betaPolicyScreeningHoldSchema, isKnownHoldReason, screeningHoldOutcome } from "../utils/betaPolicyScreeningHold";
import { adoptedSceneOutcome, sceneIntentOutcomeSchema, sceneOutcomeMessage } from "../utils/sceneIntentOutcome";
import { projectWebsiteSceneProgression } from "../utils/websiteSceneProgression";
import { parseWebsitePreparationWatch } from "../utils/websitePreparationWatch";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { jobOutlook, type JobOutlookInput } from "../utils/jobOutlook";
import { projectAtlasPreparationOutcome, recaptureSentences, TASK_NOT_NAMED_REASON } from "../utils/taskPreparationOutcome";

describe("waits and holds", () => {
  it("reads a hold reason it does not know as a hold on our side, instead of refusing the hold", () => {
    expect(isKnownHoldReason("brand_new_hold")).toBe(false);
    expect(screeningHoldOutcome({ status: "held", reason_code: "brand_new_hold" as never })).toBe("held_setup");
    expect(screeningHoldOutcome({ status: "held", reason_code: "robot_free_probe_failed" })).toBe("held_scene_check");
    const shape = betaPolicyScreeningHoldSchema.shape ?? (betaPolicyScreeningHoldSchema as any)._def?.schema?.shape;
    expect(shape?.reason_code.safeParse("brand_new_hold").success ?? true).toBe(true);
  });
});

describe("scene outcome kinds", () => {
  const sealed = (kind: string, terminal = true) => {
    const value = { schema_version: "task_evaluation_scene_intent_outcome.v1", intent_id: "scene-one",
      intent_digest: `sha256:${"d".repeat(64)}`, kind, terminal, reason_category: "blueprint_fault", reason_code: "anything",
      decided_at_epoch: 1793000000.25 };
    return { ...value, outcome_digest: crossRuntimeArtifactDigest(value, "outcome_digest") };
  };
  // Owner decision 2026-11-19: the job's spending cap is an ending with its own sentence and one email; the old wait for
  // an owner's money approval, still stored on a job in flight, is not adopted until the Pipeline's next status replaces it.
  it("adopts the spending cap as an ending and leaves an old money wait unadopted", () => {
    const capped = { state: "blocked", website_request_id: "job-1", pipeline_status: { status: "blocked",
      outcome: sealed("spending_cap_reached") } };
    expect(adoptedSceneOutcome(capped)?.kind).toBe("spending_cap_reached");
    expect(sceneOutcomeNoticeIntent("intake-1", capped)?.kind).toBe("spending_cap_reached");
    expect(sceneOutcomeMessage("spending_cap_reached")).toBe("We reached our spending cap for this job, so we stopped "
      + "building the simulation of your site. Your first look stays on your job page. Nothing is needed from you.");
    const waiting = { state: "accepted", website_request_id: "job-1", pipeline_status: { status: "blocked",
      outcome: sealed("awaiting_spend_approval", false) } };
    expect(adoptedSceneOutcome(waiting)).toBeNull();
    expect(sceneOutcomeNoticeIntent("intake-1", waiting)).toBeNull();
  });
  // Rewritten (review, 2026-11-12): an unknown TERMINAL kind is the general ending; an unknown wait is not adopted.
  it("does not adopt a wait whose kind it does not know: the job keeps the state its status shows", () => {
    expect(sceneIntentOutcomeSchema.safeParse(sealed("brand_new_kind", false)).success).toBe(true);
    const record = { state: "accepted", website_request_id: "job-1", pipeline_status: { status: "running", outcome: sealed("brand_new_kind", false) } };
    expect(adoptedSceneOutcome(record)).toBeNull();
    expect(projectWebsiteSceneProgression(record)).toEqual({ state: "in_progress" });
    expect(adoptedSceneOutcome({ state: "accepted", pipeline_status: { status: "blocked", outcome: sealed("held") } })?.kind).toBe("held");
  });
  it("adopts an ending whose kind it does not know as the general ending, and never 'time ran out'", () => {
    const record = { state: "blocked", website_request_id: "job-1", pipeline_status: { status: "blocked", outcome: sealed("brand_new_kind") } };
    expect(adoptedSceneOutcome(record)?.kind).toBe("stopped");
    const progression = projectWebsiteSceneProgression(record)!;
    expect(progression.state).toBe("ended");
    const sentence = "The simulation of your job stopped, for a reason this page cannot show yet. Our team is alerted when this happens. "
      + "Your first look stays on your job page. Nothing is needed from you.";
    expect(sceneOutcomeMessage("stopped")).toBe(sentence);
    expect(sentence).not.toMatch(/time .*ran out|expired|window/i);
    const outlook = jobOutlook({ consentRevoked: false, closedByOwner: false, answer: { state: "ready", unsized: false, reason: null }, windowEnded: false, noGrantEnded: false,
      preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "ended", endingKind: "stopped" }, proof: null });
    expect(outlook).toMatchObject({ phase: "no_test", reason: "simulation_stopped",
      sentence: "The simulation of your job stopped, for a reason this page cannot show yet." });
  });
});

describe("a job waiting for its sentence", () => {
  const base: JobOutlookInput = { consentRevoked: false, closedByOwner: false, answer: { state: "ready", unsized: false, reason: null },
    windowEnded: false, noGrantEnded: false, preparation: { state: "awaiting_inputs", geometryOnlyEnd: false }, scene: null, proof: null };
  it("waits on the site: not building, not an ending, no answer", () => {
    expect(jobOutlook({ ...base, awaitsSiteSentence: true })).toEqual({ phase: "waiting_on_site", reason: "task_not_named",
      sentence: "Tell us in one sentence what the robot should do, so we can build the simulation of your job." });
    expect(jobOutlook({ ...base, awaitsSiteSentence: true, windowEnded: true }).phase).toBe("no_test");
    expect(jobOutlook(base).phase).toBe("building");
  });
  it("says so on the page from the Atlas preview, never as a processing failure", () => {
    const outcome = projectAtlasPreparationOutcome({ state: "needs_input", reason: TASK_NOT_NAMED_REASON,
      preview_digest: `sha256:${"a".repeat(64)}` } as never);
    expect(outcome).toMatchObject({ title: "Tell us the job in one sentence", actionOwner: "site", category: "insufficient_evidence" });
  });
  it("names the unseen object from the site's own words when it can, else says the object the job moves", () => {
    expect(recaptureSentences("website_task_object_not_observed", "the red bin").reason).toBe("We could not find the red bin in your video.");
    expect(recaptureSentences("website_task_object_not_observed", null).reason).toBe("We could not find the object the job moves in your video.");
    expect(recaptureSentences("website_task_object_not_observed", "<script>").reason).toBe("We could not find the object the job moves in your video.");
  });
});

describe("a capacity_blocked ending in the job outlook", () => {
  it("says we could not prepare the job in time, on our side; any other ending keeps its own reason", () => {
    const input = (terminalReason: string | null): JobOutlookInput => ({ consentRevoked: false, closedByOwner: false,
      answer: { state: "ready", unsized: false, reason: null },
      windowEnded: false, noGrantEnded: false, preparation: { state: "failed_terminal", geometryOnlyEnd: false, terminalReason }, scene: null, proof: null });
    expect(jobOutlook(input("capacity_blocked"))).toEqual({ phase: "no_test", reason: "not_processed_in_time",
      sentence: "We could not start or finish preparing your job in time, for a reason on our side. Nothing you did caused it." });
    expect(jobOutlook(input("retry_exhausted")).reason).toBe("preparation_failed");
    expect(jobOutlook(input(null)).reason).toBe("preparation_failed");
  });
});

describe("the preparation watch keeps a long reason code", () => {
  const watch = (terminal_reason: string) => ({ schema_version: "website_preparation_watch.v1", request_id: "job-1", capture_id: "cap-1",
    kind: "ended", state: "failed_terminal", terminal_reason, attempt_count: 1, since_iso: "2026-11-12T00:00:00.000Z", due_at_ms: 1,
    alerted_at_iso: null, delivery: null });
  it.each([40, 41, 128])("parses a %i-character reason, as long as any Pipeline code", length => {
    const code = `r${"x".repeat(length - 1)}`;
    expect(parseWebsitePreparationWatch(watch(code))?.terminal_reason).toBe(code);
  });
});

describe("the cold-storage hold", () => {
  const holdRun = (detail: string | null) => ({ id: "hold-1", run: { run_kind: "beta_policy_screening_hold", team_namespace: "team",
    state: "blocked", screening_outcome: "held_setup", hold_reason_code: "team_scene_packet_blocked", hold_detail_code: detail } });
  const COLD = "Held on our side while the saved simulation of your job is restored. Nothing is needed from you.";
  it("is said by its detail on the page; any other detail keeps the reason's sentence", async () => {
    const { sceneHold } = await import("../utils/websiteSceneProgression");
    const { projectTaskStatus } = await import("../utils/taskStatusProjection");
    const { simulationHoldSentence } = await import("../utils/betaPolicyScreeningContract");
    const page = (detail: string | null) => {
      const progression = projectWebsiteSceneProgression({ state: "completed", pipeline_status: { status: "completed" } },
        { hold: sceneHold([holdRun(detail)], "team"), simulationReady: false });
      return projectTaskStatus({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, stage: null, coversScene: null,
        missingViews: [], supplementWouldFinish: false, sceneProgression: progression } as never).headline;
    };
    expect(page("scene_run_in_cold_storage")).toContain(COLD);
    expect(page("something_new")).toContain(simulationHoldSentence("held_setup"));
    expect(page("something_new")).not.toContain("restored");
  });
});

describe("the part-6 preparation endings", () => {
  const sha = `sha256:${"e".repeat(64)}`;
  const read = async (value: Record<string, unknown>) => {
    const { preparationOutcomeV7Schema, projectPreparationOutcome } = await import("../utils/taskPreparationOutcome");
    const parsed = preparationOutcomeV7Schema.safeParse(value);
    expect(parsed.success).toBe(true);
    return projectPreparationOutcome(parsed.data as never);
  };
  const base = { category: "insufficient_evidence", reason: "website_preparation_not_possible", basis: "missing_evidence",
    robot_id: null, evidence_digest: sha };
  // Rewritten (review, 2026-11-12): nothing says the job is looked at or tried again (no code confirmed does it).
  it.each([
    ["support_surface_not_found_under_subject", "We could not find the surface the object rests on in your video. We cannot prepare the simulation of your job, so it has stopped.",
      "Nothing is needed from you now. Your recording is saved."],
    ["website_assembly_whole_object_coverage_required", "Your video does not show the whole of the object the job assembles. We cannot prepare the simulation of your job, so it has stopped.",
      "A new video that shows the whole object would let us try again. Your recording is saved."],
    ["website_registration_scale_conflicts_declared", "The sizes we measured in your video do not match the sizes given for your job. We cannot prepare the simulation of your job, so it has stopped.",
      "Your recording is saved."],
    ["brand_new_blocker", "Preparing the simulation of your job needs a step we cannot do yet, so it has stopped.",
      "Nothing is needed from you now. Your recording is saved."],
  ])("words a not-possible ending for cause %s, and never promises a later look", async (cause, reason, nextStep) => {
    const outcome = await read({ ...base, cause });
    expect(outcome).toMatchObject({ title: "We cannot prepare the simulation of your job", actionOwner: "blueprint", reason, nextStep });
    expect(JSON.stringify(outcome)).not.toMatch(/brand_new_blocker|review|look at it again|try again each/i);
  });
  it("reads an extra key, and words retries spent plainly", async () => {
    expect((await read({ ...base, cause: "support_surface_not_found_under_subject", later_key: 1 })).title)
      .toBe("We cannot prepare the simulation of your job");
    const spent = await read({ category: "processing_failure", reason: "website_preparation_retries_spent", basis: "execution_failure",
      robot_id: null, evidence_digest: sha });
    expect(spent).toMatchObject({ title: "We could not finish preparing your job",
      reason: "We could not finish preparing your job after several tries, for a reason on our side.",
      nextStep: "Nothing is needed from you now. Your recording is saved." });
  });
  it("is the whole card on the page: nothing added beside it, in every state it arrives in", async () => {
    const { projectTaskStatus } = await import("../utils/taskStatusProjection");
    const page = { briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, stage: null, coversScene: null, missingViews: [],
      supplementWouldFinish: false };
    for (const outcome of [await read({ ...base, cause: "support_surface_not_found_under_subject" }),
      await read({ category: "processing_failure", reason: "website_preparation_retries_spent", basis: "execution_failure", robot_id: null, evidence_digest: sha })])
      for (const state of ["failed_terminal", "failed_retryable", "awaiting_inputs"]) {
        const card = projectTaskStatus({ ...page, preparationStatus: { state, correlationId: null, outcome, terminalReason: null } } as never);
        expect(card.headline).toBe(outcome.title);
        expect(card.outcome?.reason).toBe(outcome.reason);
        expect(`${card.headline} ${card.outcome?.reason} ${card.outcome?.nextStep}`).not.toMatch(/Automatic preparation retries|review/i);
      }
  });
});

describe("the test stage's new codes", () => {
  it("never shows a hold's detail other than cold storage, and never alerts on it", async () => {
    const { screeningHoldDetail } = await import("../utils/betaPolicyScreeningContract");
    expect(screeningHoldDetail("team_scene_packet_blocked", "scene_run_in_cold_storage")).toBe("scene_run_in_cold_storage");
    for (const detail of ["probe_root_unavailable", "profile_missing"]) {
      expect(screeningHoldDetail("team_scene_packet_blocked", detail)).toBeNull();
      expect(screeningHoldOutcome({ status: "held", reason_code: "team_scene_packet_blocked", detail_code: detail })).toBe("held_setup");
    }
  });
});

describe("a job stopped on a planner abstention", () => {
  it("shows a card with no promise when the status has no outcome of its own, and the status's when it has one", async () => {
    const { projectAtlasPreparationOutcome, preparationRetriesSpent } = await import("../utils/taskPreparationOutcome");
    const { selectWebsiteAtlasPreview } = await import("../utils/websiteAtlasPreview");
    const { projectTaskStatus } = await import("../utils/taskStatusProjection");
    const value = { schema_version: "website_atlas_preview.v1", capture_id: "walkthrough-r1", revision: 2, state: "needs_input",
      reason: "atlas_scene_planner_abstained", updated_at_epoch: 1793109960, bundle: null, splat_available: false, mesh_available: false,
      claim_ceiling: "development_only", scale_status: "unscaled_provider_world_units" };
    const preview = selectWebsiteAtlasPreview({ website_atlas_previews: { "walkthrough-r1": { ...value,
      preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") } } }, "walkthrough-r1");
    const page = { briefDrafted: true, briefConfirmed: false, hasStoredCapture: true, stage: null, coversScene: null, missingViews: [],
      supplementWouldFinish: false, preparationOutcome: projectAtlasPreparationOutcome(preview) };
    for (const preparationStatus of [undefined, { state: "unavailable", correlationId: null }, { state: "awaiting_inputs", correlationId: null, outcome: null }]) {
      const status = projectTaskStatus({ ...page, preparationStatus } as never);
      expect(status.headline).toBe("We could not confirm the 3D scene covers your job");
      expect(JSON.stringify(status)).not.toMatch(/next update will appear|review/i);
    }
    const own = preparationRetriesSpent(`sha256:${"e".repeat(64)}`);
    expect(projectTaskStatus({ ...page, preparationStatus: { state: "awaiting_inputs", correlationId: null, outcome: own } } as never).headline)
      .toBe(own.title);
  });
});
