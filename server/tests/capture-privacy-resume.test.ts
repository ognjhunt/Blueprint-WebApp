// @vitest-environment node
/**
 * The half that makes failing closed safe.
 *
 * The privacy screen used to fail open on every path, defended by the claim
 * that failing closed "would strand every upload in the bucket with no marker
 * and nothing watching". That was true of the state machine as written -- and
 * it was an argument for fixing the state machine, not for copying frames of
 * people nobody had cleared.
 *
 * So the screen holds now, and this is the thing that watches. If these tests
 * did not exist the original objection would be correct.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { resumeHeldPrivacyScreen, grantPrivacyRescreen } = await import("../utils/capturePrivacyResume");
const { findPriorPrivacyReview } = await import("../utils/captureFootageReview");

const CAPTURE = { requestId: "req-1", captureId: "cap-1", sceneId: "scene-1" };

function seed(screen: Record<string, unknown> | null) {
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    requestId: "req-1",
    ...(screen ? { capture_privacy_screen: screen } : {}),
  });
}

/** A screen that returns whatever the test wants, without a model. */
function screener(result: Record<string, unknown>) {
  return vi.fn(async () => result as never);
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  vi.unstubAllEnvs();
});

describe("only our own failure to get an answer is retried", () => {
  it("does nothing when nothing is held", async () => {
    seed({ eligibility: "approved", outcome: "cleared", attempts: 1 });

    const outcome = await resumeHeldPrivacyScreen({ ...CAPTURE, screen: screener({}) });

    expect(outcome.action).toBe("nothing_held");
  });

  it("does not retry a privacy reading, because that needs a person", async () => {
    // Asking the same reviewer the same question about the same video gives
    // the same answer. Retrying it would be a loop that never reaches anybody.
    seed({ eligibility: "rejected", outcome: "privacy_hold", attempts: 1 });

    const screen = screener({ eligibility: "approved" });
    const outcome = await resumeHeldPrivacyScreen({ ...CAPTURE, screen });

    expect(outcome.action).toBe("nothing_held");
    expect(screen).not.toHaveBeenCalled();
  });

  it("does nothing for a submission with no screen on file", async () => {
    seed(null);

    expect((await resumeHeldPrivacyScreen({ ...CAPTURE, screen: screener({}) })).action).toBe(
      "nothing_held",
    );
  });
});

describe("a held capture gets another chance", () => {
  it("clears and tells the caller to write the marker", async () => {
    seed({
      eligibility: "pending",
      outcome: "review_unavailable",
      attempts: 1,
      first_held_at_iso: new Date().toISOString(),
    });

    const outcome = await resumeHeldPrivacyScreen({
      ...CAPTURE,
      screen: screener({
        proceed: true,
        eligibility: "approved",
        outcome: "cleared",
        detail: null,
        evidence: null,
      }),
    });

    expect(outcome.action).toBe("cleared");
  });

  it("counts the attempt so the budget survives a restart", async () => {
    seed({
      eligibility: "pending",
      outcome: "review_unavailable",
      attempts: 2,
      first_held_at_iso: new Date().toISOString(),
    });

    const outcome = await resumeHeldPrivacyScreen({
      ...CAPTURE,
      screen: screener({
        proceed: false,
        eligibility: "pending",
        outcome: "review_unavailable",
        retryable: true,
        detail: "still nothing",
        evidence: null,
      }),
    });

    expect(outcome).toMatchObject({ action: "still_pending", attempts: 3 });
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<
      string,
      Record<string, unknown>
    >;
    expect(stored.capture_privacy_screen.attempts).toBe(3);
  });

  it("spends the attempt before the review runs, so a review that crashes still counts", async () => {
    seed({
      eligibility: "pending",
      outcome: "review_unavailable",
      attempts: 4,
      first_held_at_iso: new Date().toISOString(),
    });

    // The process dies inside the review: nothing after it runs.
    const crash = vi.fn(async () => {
      const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<
        string,
        Record<string, unknown>
      >;
      expect(stored.capture_privacy_screen.attempts).toBe(5);
      throw new Error("process killed");
    });
    await expect(resumeHeldPrivacyScreen({ ...CAPTURE, screen: crash })).rejects.toThrow("process killed");

    // The next poll finds the budget spent and hands it to a person instead of
    // running the review that crashed again.
    const again = screener({ eligibility: "approved" });
    const outcome = await resumeHeldPrivacyScreen({ ...CAPTURE, screen: again });
    expect(outcome).toMatchObject({ action: "escalated", attempts: 5 });
    expect(again).not.toHaveBeenCalled();
  });

  it("reports a reading that came back on the retry", async () => {
    seed({
      eligibility: "pending",
      attempts: 1,
      first_held_at_iso: new Date().toISOString(),
    });

    const outcome = await resumeHeldPrivacyScreen({
      ...CAPTURE,
      screen: screener({
        proceed: false,
        eligibility: "rejected",
        outcome: "privacy_hold",
        retryable: false,
        detail: "people",
        evidence: null,
      }),
    });

    expect(outcome.action).toBe("rejected");
  });
});

describe("and if it never clears, a person gets it", () => {
  it("escalates once the attempts are spent", async () => {
    vi.stubEnv("BLUEPRINT_CAPTURE_PRIVACY_MAX_ATTEMPTS", "3");
    seed({
      eligibility: "pending",
      attempts: 3,
      first_held_at_iso: new Date().toISOString(),
    });

    const screen = screener({ eligibility: "pending" });
    const outcome = await resumeHeldPrivacyScreen({ ...CAPTURE, screen });

    expect(outcome).toMatchObject({ action: "escalated", attempts: 3 });
    // No point asking again; that is what "spent" means.
    expect(screen).not.toHaveBeenCalled();
  });

  it("escalates on age even when attempts are few", async () => {
    // A slow trickle of retries must not hold a capture for days.
    vi.stubEnv("BLUEPRINT_CAPTURE_PRIVACY_MAX_AGE_MS", "1000");
    seed({
      eligibility: "pending",
      attempts: 1,
      first_held_at_iso: new Date(Date.now() - 60_000).toISOString(),
    });

    const outcome = await resumeHeldPrivacyScreen({ ...CAPTURE, screen: screener({}) });

    expect(outcome.action).toBe("escalated");
  });

  it("marks the escalation before notifying, so it cannot loop forever", async () => {
    vi.stubEnv("BLUEPRINT_CAPTURE_PRIVACY_MAX_ATTEMPTS", "1");
    seed({ eligibility: "pending", attempts: 5, first_held_at_iso: new Date().toISOString() });

    await resumeHeldPrivacyScreen({ ...CAPTURE, screen: screener({}) });

    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<
      string,
      Record<string, unknown>
    >;
    expect(stored.capture_privacy_screen.escalated).toBe(true);
    expect(stored.capture_privacy_screen.escalation_reason).toBeTruthy();
  });

  it("stops retrying something already escalated", async () => {
    seed({ eligibility: "pending", attempts: 1, escalated: true });

    const screen = screener({});
    const outcome = await resumeHeldPrivacyScreen({ ...CAPTURE, screen });

    expect(outcome.action).toBe("nothing_held");
    expect(screen).not.toHaveBeenCalled();
  });
});

/** A reading with everything benign except what the test sets. */
function evidence(overrides: Record<string, unknown> = {}) {
  return {
    decision: "clear",
    evidence_seconds: [],
    ...overrides,
  };
}

function seedRun(id: string, run: Record<string, unknown>) {
  sharedFakeFirestoreState.docs.set(`agentRuns/${id}`, {
    task_kind: "capture_video_privacy",
    metadata: { capture_id: "cap-1", scene_id: "scene-1" },
    ...run,
  });
}

const HELD = {
  eligibility: "pending",
  outcome: "review_unavailable",
  attempts: 3,
  first_held_at_iso: new Date().toISOString(),
};

describe("a review that outlived its wait is used, not repeated", () => {
  it("waits on a review still running without spending an attempt", async () => {
    seed(HELD);
    const screen = screener({ eligibility: "approved" });
    const outcome = await resumeHeldPrivacyScreen({
      ...CAPTURE, screen, findPrior: async () => ({ state: "running" }),
    });

    expect(outcome).toMatchObject({ action: "still_pending", attempts: 3 });
    expect(screen).not.toHaveBeenCalled();
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, Record<string, unknown>>;
    expect(stored.capture_privacy_screen.attempts).toBe(3);
  });

  it("clears on a reading that arrived after the screen stopped waiting", async () => {
    seed(HELD);
    const screen = screener({ eligibility: "pending" });
    const outcome = await resumeHeldPrivacyScreen({
      ...CAPTURE, screen, findPrior: async () => ({ state: "completed", output: evidence() as never }),
    });

    expect(outcome.action).toBe("cleared");
    expect(screen).not.toHaveBeenCalled();
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, Record<string, unknown>>;
    expect(stored.capture_privacy_screen).toMatchObject({ eligibility: "approved", outcome: "cleared", attempts: 3 });
  });

  it("settles even when the attempts are spent, because the reading is in", async () => {
    seed({ ...HELD, attempts: 5 });
    const outcome = await resumeHeldPrivacyScreen({
      ...CAPTURE, screen: screener({}), findPrior: async () => ({ state: "completed", output: evidence() as never }),
    });
    expect(outcome.action).toBe("cleared");
  });

  it("routes a late privacy reading to a person like any other", async () => {
    seed(HELD);
    const outcome = await resumeHeldPrivacyScreen({
      ...CAPTURE, screen: screener({}),
      findPrior: async () => ({ state: "completed", output: evidence({ decision: "hold" }) as never }),
    });
    expect(outcome.action).toBe("rejected");
  });
});

describe("finding the earlier review", () => {
  const now = Date.parse("2026-09-24T03:30:00Z");

  it("finds nothing when the capture has no review", async () => {
    expect(await findPriorPrivacyReview("cap-1", now)).toEqual({ state: "none" });
  });

  it("reports a recent running review, and treats an old one as dead", async () => {
    seedRun("r1", { status: "running", started_at: "2026-09-24T03:25:00Z" });
    expect(await findPriorPrivacyReview("cap-1", now)).toEqual({ state: "running" });
    expect(await findPriorPrivacyReview("cap-1", Date.parse("2026-09-24T04:00:00Z"))).toEqual({ state: "none" });
  });

  it("uses the newest review, and only a footage review of this capture", async () => {
    seedRun("old", { status: "completed", started_at: "2026-09-24T03:00:00Z", output: evidence({ evidence_seconds: [1] }) });
    seedRun("new", { status: "completed", started_at: "2026-09-24T03:20:00Z", output: evidence({ evidence_seconds: [2] }) });
    seedRun("coverage", { task_kind: "capture_coverage", status: "running", started_at: "2026-09-24T03:29:00Z" });
    seedRun("other", { status: "running", started_at: "2026-09-24T03:29:00Z", metadata: { capture_id: "cap-2" } });
    seedRun("full", { task_kind: "site_video_evidence", status: "completed",
      started_at: "2026-09-24T03:29:00Z", output: { privacy_flag: false } });
    expect(await findPriorPrivacyReview("cap-1", now)).toMatchObject({ state: "completed", output: { evidence_seconds: [2] } });
  });

  it("does not trust a completed run whose output is not a valid reading", async () => {
    seedRun("bad", { status: "completed", started_at: "2026-09-24T03:20:00Z", output: { privacy_flag: false } });
    expect(await findPriorPrivacyReview("cap-1", now)).toEqual({ state: "none" });
  });

  it("does not reuse a failed review", async () => {
    seedRun("failed", { status: "failed", started_at: "2026-09-24T03:25:00Z", error: "gemini_video_failed" });
    expect(await findPriorPrivacyReview("cap-1", now)).toEqual({ state: "none" });
  });
});

describe("a fresh budget for a hold that was our own failure", () => {
  const GRANT = { requestId: "req-1", captureId: "cap-1", grantedBy: "ops@example.com",
    reason: "Review lane defects fixed in #693-#697; re-ask the reviewer." };
  const screenOf = () => (sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as
    Record<string, Record<string, unknown>>).capture_privacy_screen;

  it("previews without writing", async () => {
    seed({ ...HELD, capture_id: "cap-1", attempts: 5, escalated: true });
    const result = await grantPrivacyRescreen({ ...GRANT, apply: false });
    expect(result).toMatchObject({ applied: false, grant: { previous_attempts: 5, previous_escalated: true } });
    expect(screenOf()).toMatchObject({ attempts: 5, escalated: true });
  });

  it("resets the budget, records who and why, and the next poll asks the reviewer again", async () => {
    seed({ ...HELD, capture_id: "cap-1", attempts: 5, escalated: true });
    await grantPrivacyRescreen({ ...GRANT, apply: true });
    expect(screenOf()).toMatchObject({ attempts: 0, escalated: false, eligibility: "pending" });
    expect(screenOf().rescreens).toEqual([expect.objectContaining({
      previous_attempts: 5, previous_escalated: true, granted_by: "ops@example.com", reason: GRANT.reason })]);

    const screen = screener({ proceed: true, eligibility: "approved", outcome: "cleared", detail: null, evidence: null });
    const outcome = await resumeHeldPrivacyScreen({ ...CAPTURE, screen, findPrior: async () => ({ state: "none" }) });
    expect(outcome.action).toBe("cleared");
    expect(screen).toHaveBeenCalledTimes(1);
  });

  it("never overrides a reading: a flagged capture stays with a person", async () => {
    seed({ eligibility: "rejected", outcome: "privacy_hold", capture_id: "cap-1", attempts: 1 });
    await expect(grantPrivacyRescreen({ ...GRANT, apply: true })).rejects.toThrow("rescreen_refused_rejected");
  });

  it("refuses a capture that is not held, a wrong capture, and a missing reason", async () => {
    seed({ eligibility: "approved", outcome: "cleared", capture_id: "cap-1", attempts: 1 });
    await expect(grantPrivacyRescreen({ ...GRANT, apply: true })).rejects.toThrow("rescreen_refused_approved");
    seed({ ...HELD, capture_id: "cap-9" });
    await expect(grantPrivacyRescreen({ ...GRANT, apply: true })).rejects.toThrow("capture_mismatch");
    seed({ ...HELD, capture_id: "cap-1" });
    await expect(grantPrivacyRescreen({ ...GRANT, reason: "retry", apply: true })).rejects.toThrow("rescreen_reason_required");
  });

  it("stops after three grants", async () => {
    seed({ ...HELD, capture_id: "cap-1" });
    for (let i = 0; i < 3; i += 1) await grantPrivacyRescreen({ ...GRANT, apply: true });
    await expect(grantPrivacyRescreen({ ...GRANT, apply: true })).rejects.toThrow("rescreen_limit_reached");
  });
});
