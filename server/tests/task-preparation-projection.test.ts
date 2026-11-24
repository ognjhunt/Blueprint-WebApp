// @vitest-environment node
import { describe, expect, it } from "vitest";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";
import { simulationHoldSentence } from "../utils/betaPolicyScreeningContract";
import { projectWebsiteSceneProgression, sceneHold } from "../utils/websiteSceneProgression";
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
    ["awaiting_inputs", "We are still preparing your job. Nothing is needed from you now."],
    ["authority_ended", "This job has ended"],
    ["unavailable", "We can't show the latest status of your job right now."],
  ])("%s remains visible without brief confirmation and does not claim success", (state, phrase) => {
    const status = projectTaskStatus({ ...base, briefConfirmed: false,
      preparationStatus: { state, correlationId: reference } } as never);
    expect(status.decision).toBe("footage_received");
    expect(status.stage).toBeNull();
    expect(status.headline).toContain(phrase);
    expect(status.headline).not.toMatch(/recording|needs more information|Reference|bp-prep/);
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
    [{ coversScene: false, missingViews: ["destination"] }, "still preparing your job"],
    [{ disposition: "not_now" }, "still preparing your job"],
    [{ disposition: "needs_conversation" }, "still preparing your job"],
    [{ claimed: false }, "still preparing your job"],
  ])("preserves consent and source evidence while showing observed preparation above old intake hints %j", (override, phrase) => {
    const status = projectTaskStatus({ ...base, ...override,
      preparationStatus: { state: "awaiting_inputs", correlationId: reference } } as never);
    expect(status.headline).toContain(phrase);
    expect(status.headline).not.toContain("hit a problem");
    if ("missingViews" in override) {
      expect(status.missingViews).toEqual(override.missingViews);
      expect(status.operatorAction).toBeNull();
    }
  });
  // Blueprint runs no robot software in the simulation (owner, 2026-11-14): an older run record reads as a ready simulation.
  it.each([
    { teams: 1, queued: 0, running: 0, reported: 1, noResult: 0 },
    { teams: 1, queued: 0, running: 0, reported: 0, noResult: 1 },
    { teams: 1, queued: 1, running: 0, reported: 0, noResult: 0 },
  ])("an older run record outranks a preparation stop %j", screening => {
    const status = projectTaskStatus({ ...base, screening,
      preparationStatus: { state: "failed_retryable", correlationId: reference } } as never);
    expect(status).toMatchObject({ decision: "assessing", headline: "The simulation of your site is ready. Nothing is needed from you." });
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
    expect(status.headline).toBe("Your video is saved and your job is in line for processing on our side. Nothing is needed from you.");
    expect(status.headline).not.toContain("still preparing");
    expect(status.operatorAction).toBeNull();
  });
  it.each([
    ["retry_exhausted", "tried several times"],
    ["budget_exhausted", "Preparation stopped at a limit on our side."],
    ["permanent_invalid", "We could not read this video."],
    ["out_of_scope", "We can't simulate this kind of job yet."],
  ])("failed_terminal %s says preparation could not finish, and why", (terminalReason, phrase) => {
    const status = preparing("failed_terminal", { terminalReason });
    expect(status.decision).toBe("processing_failure");
    expect(status.stage).toBeNull();
    // The headline already says we stopped: no retry mechanics are added to the reason.
    expect(status.outcome?.reason).not.toContain("retries");
    expect(status.outcome?.actionOwner).toBe("blueprint");
    expect(status.headline).not.toContain("our team has been told");
    expect(status.outcome?.reason).toContain(phrase);
    expect(status.outcome?.nextStep).toBe("Nothing is needed from you. Your video is saved; you don't need to send it again.");
    expect(status.outcome?.reference).toBe(reference);
    expect(status.headline).not.toMatch(/budget|we are preparing|needs more information/i);
    expect(status.operatorAction).toBeNull();
  });
  // Rewritten out of the list above (review, 2026-11-12): `capacity_blocked` covers every cause the Pipeline sends it
  // for (disk or staging short through its retries; a job that waited for room until its grant ran out), all ours.
  it("failed_terminal capacity_blocked says we could not prepare the job in time, on our side, and nothing the site did", () => {
    const status = preparing("failed_terminal", { terminalReason: "capacity_blocked", hasStoredCapture: true });
    expect(status.decision).toBe("processing_failure");
    expect(status.headline).toBe("We could not prepare your job in time");
    expect(status.outcome).toMatchObject({ actionOwner: "blueprint", reference,
      reason: "We couldn't finish preparing your job. The problem was on our side, not yours.",
      nextStep: "Nothing is needed from you. Your video is saved; you don't need to send it again." });
    const said = `${status.headline} ${status.outcome?.reason} ${status.outcome?.nextStep}`;
    expect(said).not.toMatch(/budget|limit|capacity|month|retr|consent|permission|expired|resubmit|please send|send (us )?a new/i);
    expect(status.operatorAction).toBeNull();
  });
  it("an unknown or missing reason adds no sentence of its own", () => {
    expect(preparing("failed_terminal", { terminalReason: "provider_failed" }).headline)
      .toBe(preparing("failed_terminal", { terminalReason: null }).headline);
  });
  it("an overdue watch adds 'taking longer' to a live state, never to an ending", () => {
    const overdue = preparing("preparing", { preparationOverdue: true });
    expect(overdue.headline).toBe("We are preparing your job. Nothing is needed from you. This is taking longer than usual.");
    expect(overdue.headline).not.toMatch(/review/);
    expect(overdue.headline).not.toContain("our team has been told");
    expect(preparing("failed_terminal", { preparationOverdue: true }).headline).not.toContain("taking longer");
  });
  it("no status since the upload, past the bound, is said plainly instead of 'preparing'", () => {
    const status = projectTaskStatus({ ...base, preparationOverdue: true } as never);
    expect(status.headline).toBe("Your video is saved. Preparing it is taking longer than usual. You don't need to send it again.");
    expect(status.headline).not.toContain("our team has been told");
    expect(status.headline).not.toContain("We're preparing your job");
    expect(projectTaskStatus({ ...base } as never).headline).toBe("Your video covers the work area. We're preparing your job.");
  });
  // Sharing is the service (2026-11-12): there is no job card to publish, so no status names that step.
  it("a scene that stopped after hand-off says so, and an unlisted job adds no publishing step", () => {
    const ended = projectTaskStatus({ ...base, scenePreviewReady: true, listed: false,
      preparationStatus: { state: "handed_off", correlationId: reference }, sceneProgression: { state: "ended" } } as never);
    expect(ended.decision).toBe("processing_failure");
    expect(ended.outcome?.actionOwner).toBe("blueprint");
    expect(ended.headline).not.toContain("our team has been told");
    const waiting = projectTaskStatus({ ...base, scenePreviewReady: true, listed: false,
      preparationStatus: { state: "handed_off", correlationId: reference }, sceneProgression: { state: "waiting" } } as never);
    expect(waiting.decision).toBe("assessing");
    expect(waiting.headline).not.toMatch(/job card/);
    const open = projectTaskStatus({ ...base, scenePreviewReady: true,
      preparationStatus: { state: "handed_off", correlationId: reference }, sceneProgression: { state: "waiting" } } as never);
    expect(open.headline).toBe("A preview of your site is ready. We're preparing the simulation of your site. Nothing is needed from you.");
    expect(open.headline).not.toMatch(/our team/);
  });
  it("the simulation is ready once its package is published; built alone is still preparing", () => {
    const handedOff = { ...base, preparationStatus: { state: "handed_off", correlationId: reference } };
    const ready = projectTaskStatus({ ...handedOff, sceneProgression: { state: "ready" } } as never);
    expect(ready.decision).toBe("assessing");
    expect(ready.headline).toBe("The simulation of your site is ready. Nothing is needed from you.");
    expect(ready.headline).not.toMatch(/test|estimate|early trial/i);
    expect(ready.operatorAction).toBeNull();
    const held = projectTaskStatus({ ...handedOff, sceneProgression: { state: "held" } } as never);
    expect(held.decision).toBe("assessing");
    expect(held.headline).toBe("We can't simulate this kind of job yet. Your first look stays on your job page. Nothing is needed from you.");
    const built = projectTaskStatus({ ...handedOff, sceneProgression: { state: "completed" } } as never);
    expect(built.decision).toBe("assessing");
    expect(built.headline).toBe("We are preparing your job for simulation. Nothing is needed from you.");
    expect(built.headline).not.toMatch(/ready/i);
    // An unlisted job says the same: there is no card for the site to publish.
    const unlisted = projectTaskStatus({ ...handedOff, listed: false, sceneProgression: { state: "ready" } } as never);
    expect(unlisted).toEqual(ready);
    expect(projectTaskStatus({ ...handedOff, listed: false, sceneProgression: { state: "completed" } } as never).decision)
      .not.toBe("not_listed");
  });
  it.each(["held_capability", "held_setup", "held_scene_check"] as const)(
    "a stored %s hold says the hold's own sentence about the simulation, never that the job is held", outcome => {
      const run = { run_kind: "beta_policy_screening_hold", team_namespace: "team", state: "blocked", screening_outcome: outcome,
        hold_reason_code: "robot_free_probe_failed", hold_detail_code: null };
      const sceneProgression = projectWebsiteSceneProgression({ state: "completed", pipeline_status: { phase: "scene_prepared" } },
        { hold: sceneHold([{ id: "hold-1", run }], "team"), simulationReady: true });
      expect(sceneProgression).toEqual({ state: "held", heldReason: outcome });
      const headline = projectTaskStatus({ ...base, preparationStatus: { state: "handed_off", correlationId: reference },
        sceneProgression } as never).headline;
      expect(headline).toBe(`${simulationHoldSentence(outcome)} Your first look stays on your job page. Nothing is needed from you.`);
      expect(headline).not.toMatch(/^Held|job is held|estimate/);
    });
  it("a campaign record of the retired early trial never speaks for the scene", () => {
    for (const outcome of ["estimate", "held_budget", "reference_only", "awaiting_spend_approval"]) {
      const run = { run_kind: "beta_policy_screening", team_namespace: "team", state: "completed", screening_outcome: outcome };
      expect(sceneHold([{ id: "campaign-1", run }], "team")).toBeNull();
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

  // Review, 2026-11-11 (a real job: 17 of 19 build attempts failed before one succeeded): a failed scene configuration
  // is one attempt the Pipeline retries, never an ending; only the intent's own final outcome ends the scene.
  it("reads a failed build attempt as a wait the Pipeline retries, and only the final intent outcome as the ending", async () => {
    const { jobOutlook } = await import("../utils/jobOutlook");
    const READY = { state: "ready" as const, unsized: false, reason: null };
    const outlookOf = (scene: Record<string, any> | null) => jobOutlook({ consentRevoked: false, closedByOwner: false, answer: READY,
      windowEnded: false, noGrantEnded: false, preparation: { state: "handed_off", geometryOnlyEnd: false },
      scene: scene ? { state: scene.state, attemptFailed: scene.attemptFailed === true } : null, proof: null });
    const failed = projectWebsiteSceneProgression({ state: "accepted",
      pipeline_status: { status: "blocked", phase: "scene_configuration_failed", blockers: ["scene_configuration_failed"] } });
    expect(failed).toEqual({ state: "waiting", attemptFailed: true });
    expect(outlookOf(failed)).toEqual({ phase: "building", reason: "step_failed", sentence: "A step on our side failed. Nothing is needed from you." });
    // The next attempt succeeds: still never an ending.
    const built = projectWebsiteSceneProgression({ state: "accepted", pipeline_status: { status: "running", phase: "configuration" } });
    expect(outlookOf(built).phase).toBe("building");
    // The Pipeline's own final outcome after failed attempts: the ending (the C-04 scene outcome).
    const final = projectWebsiteSceneProgression({ state: "blocked", pipeline_status: { status: "blocked", phase: "scene_configuration_failed",
      blockers: ["scene_configuration_failed"], outcome: sealed("setup_repair", true, "retry_cap_exhausted") } });
    expect(final?.state).toBe("ended");
    expect(outlookOf(final)).toMatchObject({ phase: "no_test", reason: "scene_stopped" });
  });

  it.each([
    ["held", "task_family_unsupported", "We can't simulate this kind of job yet. Your first look stays on your job page. Nothing is needed from you."],
    ["withdrawn", "consent_expired", "Permission to use this video for your job was withdrawn or has expired. You don't need to do anything; this job has stopped."],
    ["setup_repair", "retry_cap_exhausted", "We could not finish building the simulation of your site, and we have stopped trying. Your first look stays on your job page. Nothing is needed from you."],
    ["setup_repair", "authority_expired", "We could not finish building the simulation of your site, and we have stopped trying. Your first look stays on your job page. Nothing is needed from you."],
    ["spending_cap_reached", "spend_cap_reached", "We stopped building the simulation of your site before it was finished. Your first look stays on your job page. Nothing is needed from you."],
    ["spending_cap_reached", "job_ceiling_reached", "We stopped building the simulation of your site before it was finished. Your first look stays on your job page. Nothing is needed from you."],
  ] as const)("a terminal %s outcome (%s) says on the page what the job's ending is", (kind, reasonCode, sentence) => {
    for (const scenePreviewReady of [false, true]) {
      const status = project(progression(kind, true, reasonCode), { scenePreviewReady });
      expect(status.headline).toBe(sentence);
      expect(status.decision).toBe(kind === "held" ? "assessing" : "footage_received");
      expect(status.operatorAction).toBeNull();
      // No processing-failure card under a withdrawal or a stop it does not describe.
      expect(status.outcome).toBeUndefined();
      expect(status.headline).not.toMatch(/[a-z]+_[a-z]+|budget|retry|expired_|spending|cap\b/);
    }
    // An ending is said ahead of the optional card; a hold keeps its sentence first, like any evaluation hold.
    const unlisted = project(progression(kind, true, reasonCode), { listed: false, scenePreviewReady: true });
    expect(unlisted.headline.startsWith(kind === "held" ? sentence.replace(" Nothing is needed from you.", "") : sentence)).toBe(true);
    expect(unlisted.decision).toBe(kind === "held" ? "assessing" : "footage_received");
    // Consent withdrawal still wins over every ending.
    expect(project(progression(kind, true, reasonCode), { consentRevoked: true }).headline).toMatch(/^Permission to use your video was withdrawn\./);
  });

  it.each([
    ["setup_repair", "pipeline_fault", "We are fixing a setup problem on our side before your job's simulation can continue. Nothing is needed from you.", null],
    ["setup_repair", "a_later_reason", "We are fixing a setup problem on our side before your job's simulation can continue. Nothing is needed from you.", null],
    // Round 2 (2026-11-24): the site has no control that confirms permission, and its description is drafted on our
    // side, so neither wait asks the site for anything or says it waits for the site.
    ["awaiting_site", "site_consent_required", "Building the simulation of your site is paused: the permission on record for your video does not cover this step.", null],
    ["awaiting_site", "task_brief_required", "Building the simulation of your site is waiting on our side for your job's description. Nothing is needed from you.", null],
    ["awaiting_site", "a_later_reason", "Your job is waiting for something from you.", "hello@tryblueprint.io"],
    // The account's monthly spending limit: a money wait, said as that under either wait kind.
    ["setup_repair", "account_limit_wait", "Your job is paused on our side for a spending limit. It resumes by itself; nothing is needed from you.", null],
    ["awaiting_site", "account_limit_wait", "Your job is paused on our side for a spending limit. It resumes by itself; nothing is needed from you.", null],
  ] as const)("a %s wait (%s) says what it waits on in one plain sentence", (kind, reasonCode, sentence, contact) => {
    const status = project(progression(kind, false, reasonCode));
    expect(status.decision).toBe("assessing");
    expect(status.headline).toBe(sentence);
    expect(project(progression(kind, false, reasonCode), { scenePreviewReady: true }).headline)
      .toBe(`A preview of your site is ready. ${sentence}`);
    if (contact) expect(status.operatorAction).toContain(contact);
    else expect(status.operatorAction).toBeNull();
    expect(`${status.headline} ${status.operatorAction ?? ""}`).not.toContain(reasonCode);
    // Listed or not, a wait says the same (no card to publish since 2026-11-12).
    const unlisted = project(progression(kind, false, reasonCode), { listed: false, scenePreviewReady: true });
    expect(unlisted.decision).toBe("assessing");
  });

  it("an older Pipeline's ended or waiting scene reads as it did before", () => {
    const ended = project(projectWebsiteSceneProgression({ state: "accepted", pipeline_status: { status: "blocked",
      phase: "preparation", blockers: ["scene_progression_retry_cap_exhausted"] } }));
    expect(ended).toMatchObject({ decision: "processing_failure", outcome: { actionOwner: "blueprint" } });
    const waiting = project(projectWebsiteSceneProgression({ state: "accepted", pipeline_status: { status: "blocked",
      phase: "preparation", blockers: ["scene_intake_spend_cap_exhausted"] } }));
    expect(waiting.headline).toBe("We're preparing the simulation of your site. Nothing is needed from you.");
  });
});
