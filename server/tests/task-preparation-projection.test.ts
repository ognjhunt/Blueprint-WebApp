import { describe, expect, it } from "vitest";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";

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
    // Teams evaluate only a confirmed job, so the problem carries the site's step.
    expect(status.operatorAction).toMatch(/confirm it/i);
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
    [{ coversScene: false, missingViews: ["destination"] }, "coverage"],
    [{ disposition: "not_now" }, "Not yet"],
    [{ disposition: "needs_conversation" }, "specific open questions"],
    [{ claimed: false }, "Save it"],
  ])("preserves earlier consent, evidence and admission gates %j", (override, phrase) => {
    const status = projectTaskStatus({ ...base, ...override,
      preparationStatus: { state: "awaiting_inputs", correlationId: reference } } as never);
    expect(status.headline).toContain(phrase);
    expect(status.headline).not.toContain("encountered a problem");
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
    expect(evaluated.headline).toBe("Your job's simulation estimate is ready on your job page. It is a bounded estimate from a simulation of your site, not a certified result. Nothing is needed from you.");
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

describe("the site's brief confirmation alongside v2 preparation states", () => {
  const unconfirmed = { ...base, briefConfirmed: false };
  it("waiting for capacity, like preparing, leaves the confirmation as the site's step", () => {
    const status = projectTaskStatus({ ...unconfirmed,
      preparationStatus: { state: "capacity_delayed", correlationId: reference } } as never);
    expect(status.decision).toBe("confirm_brief");
  });
  it("an ending keeps its own outcome and does not delegate repair to brief confirmation", () => {
    const status = projectTaskStatus({ ...unconfirmed,
      preparationStatus: { state: "failed_terminal", correlationId: reference, terminalReason: "retry_exhausted" } } as never);
    expect(status.decision).toBe("processing_failure");
    expect(status.operatorAction).toBeNull();
  });
});
