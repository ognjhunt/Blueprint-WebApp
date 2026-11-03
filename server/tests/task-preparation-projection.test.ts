// @vitest-environment node
import { describe, expect, it } from "vitest";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";
import { screeningOutcome, screeningOutcomeSentence, SCREENING_OUTCOMES } from "../utils/betaPolicyScreeningContract";
import { managedJobTask, projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { scientificBriefDigest } from "../utils/jobEvidenceContract";
import { projectWebsiteSceneProgression, sceneScreening, sceneScreeningResult } from "../utils/websiteSceneProgression";
import { outcomePublication, PUBLISHED_SCREENING_OUTCOMES, screeningFixture } from "./fixtures/beta-policy-screening";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";

const reference = "bp-prep-0123456789abcdef";
const base = { briefDrafted: true, briefConfirmed: true, stage: null,
  coversScene: true, missingViews: [], supplementWouldFinish: false,
  hasStoredCapture: true, disposition: "qualified" as const, claimed: true };

describe("current source-bound preparation projection", () => {
  it("a retryable processing failure remains Blueprint's issue before confirmation", () => {
    const status = projectTaskStatus({...base, briefConfirmed: false,
      preparationStatus: {state: "failed_retryable", correlationId: reference}} as never);
    expect(status).toMatchObject({decision: "processing_failure", operatorAction: null,
      outcome: {category: "processing_failure", actionOwner: "blueprint", reference}});
    expect(status.outcome?.reason).not.toContain("retries have stopped");
  });
  it.each([
    ["awaiting_inputs", "needs more information"],
    ["authority_ended", "on hold"],
    ["unavailable", "could not verify"],
  ])("%s remains visible without brief confirmation and does not claim success", (state, phrase) => {
    const status = projectTaskStatus({ ...base, briefConfirmed: false,
      preparationStatus: { state, correlationId: reference } } as never);
    expect(status.decision).toBe("footage_received");
    expect(status.stage).toBeNull();
    expect(status.headline).toContain(phrase);
    expect(status.headline).toContain("Keep your original recording");
    expect(status.headline).not.toContain("our team has been told");
    expect(status.headline).not.toContain("we are preparing it");
    // Blueprint owns preparation and recovery; confirmation does not repair it.
    expect(status.operatorAction).toBeNull();
    const confirmed = projectTaskStatus({ ...base, preparationStatus: { state, correlationId: reference } } as never);
    expect(confirmed.headline).toBe(status.headline);
    expect(confirmed.operatorAction).toBeNull();
  });
  it("includes only a host-validated correlation reference", () => {
    const status = projectTaskStatus({ ...base,
      preparationStatus: { state: "failed_retryable", correlationId: reference } } as never);
    expect(status.outcome?.reference).toBe(reference);
    const unsafe = projectTaskStatus({ ...base,
      preparationStatus: { state: "failed_retryable", correlationId: "https://private.invalid/bearer" } } as never);
    expect(unsafe.headline).not.toContain("private.invalid");
    expect(JSON.stringify(unsafe.outcome)).not.toContain("private.invalid");
  });
  it("a current running preparation is distinct from robot execution", () => {
    const status = projectTaskStatus({ ...base,
      preparationStatus: { state: "preparing", correlationId: reference } } as never);
    expect(status.decision).toBe("assessing");
    expect(status.headline).toContain("preparing your job");
    expect(status.headline).not.toContain("Results");
  });
  it("a handoff never becomes an assessment result", () => {
    const status = projectTaskStatus({ ...base,
      preparationStatus: { state: "handed_off", correlationId: reference } } as never);
    expect(status.decision).not.toBe("results");
  });
  it.each([
    [{ consentRevoked: true }, "withdrawn"],
    [{ briefDrafted: false }, "reading"],
    [{ coversScene: false, missingViews: ["destination"] }, "needs more information"],
    [{ disposition: "not_now" }, "needs more information"],
    [{ disposition: "needs_conversation" }, "needs more information"],
    [{ claimed: false }, "needs more information"],
  ])("preserves consent and source evidence while showing observed preparation above old intake hints %j", (override, phrase) => {
    const status = projectTaskStatus({ ...base, ...override,
      preparationStatus: { state: "awaiting_inputs", correlationId: reference } } as never);
    expect(status.headline).toContain(phrase);
    expect(status.headline).not.toContain("encountered a problem");
    if ("missingViews" in override) {
      expect(status.missingViews).toEqual(override.missingViews);
      expect(status.operatorAction).toBeNull();
    }
  });
  it.each([
    [{ teams: 1, queued: 0, running: 0, reported: 1, noResult: 0 }, "results"],
    [{ teams: 1, queued: 0, running: 0, reported: 0, noResult: 1 }, "results"],
    [{ teams: 1, queued: 1, running: 0, reported: 0, noResult: 0 }, "screening"],
  ])("preserves genuine downstream run evidence %j", (screening, decision) => {
    const status = projectTaskStatus({ ...base, screening,
      preparationStatus: { state: "failed_retryable", correlationId: reference } } as never);
    expect(status.decision).toBe(decision);
    expect(status.headline).not.toContain("encountered a problem");
  });
  it("does not let an earlier ready preview hide a current required preparation failure", () => {
    const status = projectTaskStatus({ ...base, scenePreviewReady: true,
      preparationStatus: { state: "failed_retryable", correlationId: reference } } as never);
    expect(status.decision).toBe("processing_failure");
    expect(status.outcome?.actionOwner).toBe("blueprint");
  });
  it("the shared route adapter preserves the verified preparation observation", () => {
    const input = taskStatusInputFrom({ briefDrafted: true, stage: null,
      site_task_brief_confirmed_at: "2026-10-08T12:00:00Z", account_owner_uid: "test-owner",
      capture_coverage: { covers_scene: true },
      preparationStatus: { state: "failed_retryable", correlationId: reference } } as never);
    expect(projectTaskStatus(input).decision).toBe("processing_failure");
  });
});

describe("preparation that waits on capacity or ends for good (beta L3/L6)", () => {
  const preparing = (state: string, extra: Record<string, unknown> = {}) =>
    projectTaskStatus({ ...base, preparationStatus: { state, correlationId: reference, ...extra }, ...extra } as never);
  it("capacity_delayed is ours to wait on, not a request for information", () => {
    const status = preparing("capacity_delayed");
    expect(status.decision).toBe("assessing");
    expect(status.headline).toContain("waiting for processing capacity on our side; nothing is needed from you");
    expect(status.headline).not.toContain("needs more information");
    expect(status.operatorAction).toBeNull();
  });
  it.each([
    ["retry_exhausted", "tried several times"],
    ["budget_exhausted", "more processing than the free beta provides"],
    ["capacity_blocked", "capacity stayed full"],
    ["permanent_invalid", "could not read this recording"],
    ["out_of_scope", "outside what the beta can build"],
  ])("failed_terminal %s says preparation could not finish, and why", (terminalReason, phrase) => {
    const status = preparing("failed_terminal", { terminalReason });
    expect(status.decision).toBe("processing_failure");
    expect(status.stage).toBeNull();
    expect(status.outcome?.reason).toContain("Automatic preparation retries have stopped");
    expect(status.outcome?.actionOwner).toBe("blueprint");
    expect(status.headline).not.toContain("our team has been told");
    expect(status.outcome?.reason).toContain(phrase);
    expect(status.outcome?.nextStep).toContain("do not need to record or upload it again");
    expect(status.outcome?.reference).toBe(reference);
    expect(status.headline).not.toMatch(/budget|we are preparing|needs more information/i);
    expect(status.operatorAction).toBeNull();
  });
  it("an unknown or missing reason adds no sentence of its own", () => {
    expect(preparing("failed_terminal", { terminalReason: "provider_failed" }).headline)
      .toBe(preparing("failed_terminal", { terminalReason: null }).headline);
  });
  it("an overdue watch adds 'taking longer' to a live state, never to an ending", () => {
    const overdue = preparing("preparing", { preparationOverdue: true });
    expect(overdue.headline).toContain("taking longer than it should and needs review");
    expect(overdue.headline).not.toContain("our team has been told");
    expect(preparing("failed_terminal", { preparationOverdue: true }).headline).not.toContain("taking longer");
  });
  it("no status since the upload, past the bound, is said plainly instead of 'preparing'", () => {
    const status = projectTaskStatus({ ...base, preparationOverdue: true } as never);
    expect(status.headline).toContain("Preparing it is taking longer than it should and needs review");
    expect(status.headline).not.toContain("our team has been told");
    expect(status.headline).not.toContain("we are preparing it");
    expect(projectTaskStatus({ ...base } as never).headline).toContain("we are preparing it");
  });
  it("a scene that stopped after hand-off says so, ahead of an unpublished card", () => {
    const ended = projectTaskStatus({ ...base, scenePreviewReady: true, listed: false,
      preparationStatus: { state: "handed_off", correlationId: reference }, sceneProgression: { state: "ended" } } as never);
    expect(ended.decision).toBe("processing_failure");
    expect(ended.outcome?.actionOwner).toBe("blueprint");
    expect(ended.headline).not.toContain("our team has been told");
    const waiting = projectTaskStatus({ ...base, scenePreviewReady: true, listed: false,
      preparationStatus: { state: "handed_off", correlationId: reference }, sceneProgression: { state: "waiting" } } as never);
    expect(waiting.decision).toBe("not_listed");
    const open = projectTaskStatus({ ...base, scenePreviewReady: true,
      preparationStatus: { state: "handed_off", correlationId: reference }, sceneProgression: { state: "waiting" } } as never);
    expect(open.headline).toContain("waiting on our team; nothing is needed from you");
  });
  it("the scene is ready only once its first test started; built alone is still preparing", () => {
    const handedOff = { ...base, preparationStatus: { state: "handed_off", correlationId: reference } };
    const testing = projectTaskStatus({ ...handedOff, sceneProgression: { state: "testing" } } as never);
    expect(testing.decision).toBe("assessing");
    expect(testing.headline).toBe("Your scene is ready, and we are running our first tests on it. Nothing is needed from you.");
    expect(testing.operatorAction).toBeNull();
    const evaluated = projectTaskStatus({ ...handedOff, sceneProgression: { state: "evaluated" } } as never);
    expect(evaluated.decision).toBe("assessing");
    expect(evaluated.headline).toBe("Your simulation estimate is ready. It is an estimate from a simulation of your site, not a certified result. Nothing is needed from you.");
    const held = projectTaskStatus({ ...handedOff, sceneProgression: { state: "held" } } as never);
    expect(held.decision).toBe("assessing");
    expect(held.headline).toBe("Held: we can't simulate this kind of job yet. It counts as demand for what we build next. Nothing is needed from you.");
    const outOfReach = projectTaskStatus({ ...handedOff, sceneProgression: { state: "held", heldReason: "infeasible" } } as never);
    expect(outOfReach.decision).toBe("assessing");
    expect(outOfReach.headline).toBe("Held: from the robot position planned in the scene built from your video, none of the robots we can simulate could reach this task. Nothing is needed from you.");
    expect(outOfReach.headline).not.toMatch(/setup blockers|rerun|can't do|cannot do|anywhere/);
    const built = projectTaskStatus({ ...handedOff, sceneProgression: { state: "completed" } } as never);
    expect(built.decision).toBe("assessing");
    expect(built.headline).toBe("We are preparing your job for simulation. Nothing is needed from you.");
    expect(built.headline).not.toMatch(/ready/i);
    // An unpublished card is still the site's own step, and says the scene is ready.
    const unlisted = projectTaskStatus({ ...handedOff, listed: false, sceneProgression: { state: "testing" } } as never);
    expect(unlisted.decision).toBe("not_listed");
    expect(unlisted.headline).toContain("Your scene is ready, and we are running our first tests on it. Your job card is not published");
    expect(projectTaskStatus({ ...handedOff, listed: false, sceneProgression: { state: "completed" } } as never).decision)
      .not.toBe("not_listed");
  });
  it.each(PUBLISHED_SCREENING_OUTCOMES)("the headline and the run say the same sentence for %s (F-03)", outcome => {
    // The run as it is stored, read back as the job page reads it, against that run's own summary.
    const { publication, brief, job } = screeningFixture();
    const value = outcomePublication(publication, outcome);
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const stored = { run_id: value.campaign_id, run_kind: "beta_policy_screening", state: value.status, result_record_id: "result-one",
      team_namespace: scope.teamNamespace, screening_outcome: screeningOutcome(value), created_at_iso: "2026-10-26T12:20:00Z",
      screening_execution_observed: value.candidates.some(row => row.status === "completed"),
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      configuration_digest: value.plan_digest, source_scene_intent_id: value.source.scene_intent_id,
      source_scene_revision_digest: value.source.scene_revision_digest, publication_digest: value.publication_digest,
      publication_revision: value.revision };
    const sceneProgression = projectWebsiteSceneProgression({ state: "completed", pipeline_status: { phase: "scene_prepared" } },
      sceneScreeningResult(sceneScreening([{ id: value.campaign_id, run: stored }], scope.teamNamespace)));
    const headline = projectTaskStatus({ ...base, preparationStatus: { state: "handed_off", correlationId: reference },
      sceneProgression } as never).headline;
    const summary = projectManagedJobEvidence(value.campaign_id, stored, { record_id: "result-one", publication: value },
      brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!.summary;
    const sentence = screeningOutcomeSentence(outcome);
    expect(headline).toBe(`${sentence} Nothing is needed from you.`);
    expect(summary.slice(0, sentence.length)).toBe(headline.slice(0, sentence.length));
    if (outcome === "no_match") expect(headline).toMatch(/^No match: none of the robots we can simulate matched this job\./);
    if (outcome !== "held_capability") expect(headline).not.toMatch(/can't simulate this kind of job/);
    if (outcome !== "estimate") expect(headline).not.toMatch(/estimate is ready/);
  });
  it("an unpublished card keeps the outcome sentence ahead of the publishing step", () => {
    const handedOff = { ...base, listed: false, preparationStatus: { state: "handed_off", correlationId: reference } };
    for (const [sceneProgression, outcome] of [[{ state: "held", heldReason: "no_match" }, "no_match"],
      [{ state: "held", heldReason: "reference_only" }, "reference_only"], [{ state: "evaluated" }, "estimate"]] as const) {
      const status = projectTaskStatus({ ...handedOff, sceneProgression } as never);
      expect(status.decision).toBe("not_listed");
      expect(status.headline.startsWith(`${screeningOutcomeSentence(outcome)} Your job card is not published`)).toBe(true);
    }
  });
  it("consent withdrawal and earlier gates still win over an ending", () => {
    expect(projectTaskStatus({ ...base, consentRevoked: true,
      preparationStatus: { state: "failed_terminal", correlationId: reference, terminalReason: "retry_exhausted" } } as never).headline)
      .toContain("withdrawn");
  });
  it("the shared route adapter carries the watch and scene progression", () => {
    const input = taskStatusInputFrom({ briefDrafted: true, stage: null, site_task_brief_confirmed_at: "2026-10-08T12:00:00Z",
      account_owner_uid: "test-owner", capture_coverage: { covers_scene: true }, hasStoredCapture: true,
      preparationOverdue: true, sceneProgression: { state: "ended" } } as never);
    expect(input).toMatchObject({ preparationOverdue: true, sceneProgression: { state: "ended" } });
  });
});

describe("optional brief confirmation alongside v2 preparation states", () => {
  const unconfirmed = { ...base, briefConfirmed: false };
  it("waiting for capacity, like preparing, remains Blueprint's work", () => {
    const status = projectTaskStatus({ ...unconfirmed,
      preparationStatus: { state: "capacity_delayed", correlationId: reference } } as never);
    expect(status.decision).toBe("assessing");
    expect(status.operatorAction).toBeNull();
  });
  it("an ending keeps its own outcome and does not delegate repair to brief confirmation", () => {
    const status = projectTaskStatus({ ...unconfirmed,
      preparationStatus: { state: "failed_terminal", correlationId: reference, terminalReason: "retry_exhausted" } } as never);
    expect(status.decision).toBe("processing_failure");
    expect(status.operatorAction).toBeNull();
  });
});

describe("the Pipeline's one outcome for the job's scene (C-04)", () => {
  const handedOff = { ...base, preparationStatus: { state: "handed_off", correlationId: reference } };
  const sealed = (kind: string, terminal: boolean, reasonCode: string) => {
    const value = { schema_version: "task_evaluation_scene_intent_outcome.v1", intent_id: "scene-one",
      intent_digest: `sha256:${"d".repeat(64)}`, kind, terminal, reason_category: "blueprint_fault", reason_code: reasonCode,
      decided_at_epoch: 1793000000.25 };
    return { ...value, outcome_digest: crossRuntimeDigest(value) };
  };
  const progression = (kind: string, terminal: boolean, reasonCode: string) => projectWebsiteSceneProgression({
    state: terminal ? "blocked" : "accepted", pipeline_status: { status: "blocked", phase: "preparation",
      blockers: ["anything"], outcome: sealed(kind, terminal, reasonCode) } });
  const project = (sceneProgression: unknown, extra: Record<string, unknown> = {}) =>
    projectTaskStatus({ ...handedOff, ...extra, sceneProgression } as never);

  it.each([
    ["held", "task_family_unsupported", "Held: we can't simulate this kind of job yet. It counts as demand for what we build next. Nothing is needed from you."],
    ["withdrawn", "consent_expired", "Permission to use this video for your job was withdrawn or has expired. You don't need to do anything; this job has stopped."],
    ["setup_repair", "retry_cap_exhausted", "We could not finish preparing your job for robot evaluations, and we have stopped trying. Nothing is needed from you."],
    ["setup_repair", "authority_expired", "We could not finish preparing your job for robot evaluations, and we have stopped trying. Nothing is needed from you."],
  ] as const)("a terminal %s outcome (%s) says on the page exactly what its one email says", async (kind, reasonCode, sentence) => {
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    const outcome = sealed(kind, true, reasonCode);
    const notice = buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "scene_outcome",
      eventId: `${kind}-${outcome.outcome_digest.slice(7)}`, sceneOutcomeKind: kind,
      captureUrl: "https://example.invalid/capture-upload/private-owner-link" });
    for (const scenePreviewReady of [false, true]) {
      const status = project(progression(kind, true, reasonCode), { scenePreviewReady });
      expect(status.headline).toBe(sentence);
      expect(notice.body.startsWith(`${status.headline}\n\n`)).toBe(true);
      expect(status.decision).toBe(kind === "held" ? "assessing" : "footage_received");
      expect(status.operatorAction).toBeNull();
      // No processing-failure card under a withdrawal or a stop it does not describe.
      expect(status.outcome).toBeUndefined();
      expect(`${status.headline} ${notice.subject}`).not.toMatch(/[a-z]+_[a-z]+|budget|retry|expired_/);
    }
    // An ending is said ahead of the optional card; a hold keeps its sentence first, like any evaluation hold.
    const unlisted = project(progression(kind, true, reasonCode), { listed: false, scenePreviewReady: true });
    expect(unlisted.headline.startsWith(kind === "held" ? sentence.replace(" Nothing is needed from you.", "") : sentence)).toBe(true);
    expect(unlisted.decision).toBe(kind === "held" ? "not_listed" : "footage_received");
    // Consent withdrawal still wins over every ending.
    expect(project(progression(kind, true, reasonCode), { consentRevoked: true }).headline).toMatch(/consent was withdrawn/);
  });

  it.each([
    ["setup_repair", "pipeline_fault", "We are fixing a setup problem on our side before your job's simulation can continue. Nothing is needed from you.", null],
    ["setup_repair", "a_later_reason", "We are fixing a setup problem on our side before your job's simulation can continue. Nothing is needed from you.", null],
    ["awaiting_spend_approval", "job_ceiling_reached", "Your job is waiting on an internal budget approval at Blueprint. Nothing is needed from you.", null],
    ["awaiting_site", "site_consent_required", "Your job is waiting for you to confirm permission to process your video.", "hello@tryblueprint.io"],
    ["awaiting_site", "task_brief_required", "Your job is waiting for a description of the job you filmed.", "hello@tryblueprint.io"],
    ["awaiting_site", "a_later_reason", "Your job is waiting for something from you.", "hello@tryblueprint.io"],
  ] as const)("a %s wait (%s) says what it waits on in one plain sentence", (kind, reasonCode, sentence, contact) => {
    const status = project(progression(kind, false, reasonCode));
    expect(status.decision).toBe("assessing");
    expect(status.headline).toBe(sentence);
    expect(project(progression(kind, false, reasonCode), { scenePreviewReady: true }).headline)
      .toBe(`Your scene preview is ready. ${sentence}`);
    if (contact) expect(status.operatorAction).toContain(contact);
    else expect(status.operatorAction).toBeNull();
    expect(`${status.headline} ${status.operatorAction ?? ""}`).not.toContain(reasonCode);
    // A wait on the site is its one step, ahead of the optional card; a wait on us stays behind the card.
    const unlisted = project(progression(kind, false, reasonCode), { listed: false, scenePreviewReady: true });
    expect(unlisted.decision).toBe(kind === "awaiting_site" ? "assessing" : "not_listed");
  });

  it("an older Pipeline's ended or waiting scene reads as it did before", () => {
    const ended = project(projectWebsiteSceneProgression({ state: "accepted", pipeline_status: { status: "blocked",
      phase: "preparation", blockers: ["scene_progression_retry_cap_exhausted"] } }));
    expect(ended).toMatchObject({ decision: "processing_failure", outcome: { actionOwner: "blueprint" } });
    const waiting = project(projectWebsiteSceneProgression({ state: "accepted", pipeline_status: { status: "blocked",
      phase: "preparation", blockers: ["scene_intake_spend_cap_exhausted"] } }));
    expect(waiting.headline).toBe("Preparing the job for simulation is waiting on our team; nothing is needed from you.");
  });
});
