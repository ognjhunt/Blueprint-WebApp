import { describe, expect, it } from "vitest";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";

const reference = "bp-prep-0123456789abcdef";
const base = { briefDrafted: true, briefConfirmed: true, stage: null,
  coversScene: true, missingViews: [], supplementWouldFinish: false,
  hasStoredCapture: true, disposition: "qualified" as const, claimed: true,
  nextUpdateIso: null };

describe("current source-bound preparation projection", () => {
  it.each([
    ["failed_retryable", "encountered a problem"],
    ["awaiting_inputs", "needs more information"],
    ["authority_ended", "on hold"],
    ["unavailable", "could not verify"],
  ])("%s does not claim preparation is continuing or complete", (state, phrase) => {
    const status = projectTaskStatus({ ...base,
      preparationStatus: { state, correlationId: reference } } as never);
    expect(status.decision).toBe("footage_received");
    expect(status.stage).toBeNull();
    expect(status.headline).toContain(phrase);
    expect(status.headline).toContain("Keep your original recording");
    expect(status.headline).not.toContain("we are preparing it");
    expect(status.operatorAction).toBeNull();
  });
  it("includes only a host-validated correlation reference", () => {
    const status = projectTaskStatus({ ...base,
      preparationStatus: { state: "failed_retryable", correlationId: reference } } as never);
    expect(status.headline).toContain(reference);
    const unsafe = projectTaskStatus({ ...base,
      preparationStatus: { state: "failed_retryable", correlationId: "https://private.invalid/bearer" } } as never);
    expect(unsafe.headline).not.toContain("private.invalid");
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
    [{ briefConfirmed: false }, "Check it"],
    [{ coversScene: false, missingViews: ["destination"] }, "coverage"],
    [{ disposition: "not_now" }, "Not yet"],
    [{ disposition: "needs_conversation" }, "short call"],
    [{ claimed: false }, "Save it"],
  ])("preserves earlier consent, evidence and admission gates %j", (override, phrase) => {
    const status = projectTaskStatus({ ...base, ...override,
      preparationStatus: { state: "failed_retryable", correlationId: reference } } as never);
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
    expect(status.decision).toBe("footage_received");
    expect(status.headline).toContain("encountered a problem");
  });
  it("the shared route adapter preserves the verified preparation observation", () => {
    const input = taskStatusInputFrom({ briefDrafted: true, stage: null,
      site_task_brief_confirmed_at: "2026-10-08T12:00:00Z", account_owner_uid: "test-owner",
      capture_coverage: { covers_scene: true },
      preparationStatus: { state: "failed_retryable", correlationId: reference } } as never);
    expect(projectTaskStatus(input).headline).toContain("encountered a problem");
  });
});
