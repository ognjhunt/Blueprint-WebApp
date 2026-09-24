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

const { resumeHeldPrivacyScreen } = await import("../utils/capturePrivacyResume");
const { findPriorFootageReview } = await import("../utils/captureFootageReview");

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
    footage_status: "usable",
    footage_status_reason: null,
    summary: "A dishwasher door is opened and closed.",
    observations: [],
    cycle_measurement: { cycles: [], median_cycle_seconds: null, implied_band: null, note: "" },
    people_present: { max_visible_at_once: 0, relationship_to_work: "none_visible", note: "" },
    not_evidenced: [],
    privacy_flag: false,
    ...overrides,
  };
}

function seedRun(id: string, run: Record<string, unknown>) {
  sharedFakeFirestoreState.docs.set(`agentRuns/${id}`, {
    task_kind: "site_video_evidence",
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
      findPrior: async () => ({ state: "completed", output: evidence({ privacy_flag: true }) as never }),
    });
    expect(outcome.action).toBe("rejected");
  });
});

describe("finding the earlier review", () => {
  const now = Date.parse("2026-09-24T03:30:00Z");

  it("finds nothing when the capture has no review", async () => {
    expect(await findPriorFootageReview("cap-1", now)).toEqual({ state: "none" });
  });

  it("reports a recent running review, and treats an old one as dead", async () => {
    seedRun("r1", { status: "running", started_at: "2026-09-24T03:25:00Z" });
    expect(await findPriorFootageReview("cap-1", now)).toEqual({ state: "running" });
    expect(await findPriorFootageReview("cap-1", Date.parse("2026-09-24T04:00:00Z"))).toEqual({ state: "none" });
  });

  it("uses the newest review, and only a footage review of this capture", async () => {
    seedRun("old", { status: "completed", started_at: "2026-09-24T03:00:00Z", output: evidence({ summary: "old" }) });
    seedRun("new", { status: "completed", started_at: "2026-09-24T03:20:00Z", output: evidence({ summary: "new" }) });
    seedRun("coverage", { task_kind: "capture_coverage", status: "running", started_at: "2026-09-24T03:29:00Z" });
    seedRun("other", { status: "running", started_at: "2026-09-24T03:29:00Z", metadata: { capture_id: "cap-2" } });
    expect(await findPriorFootageReview("cap-1", now)).toMatchObject({ state: "completed", output: { summary: "new" } });
  });

  it("does not trust a completed run whose output is not a valid reading", async () => {
    seedRun("bad", { status: "completed", started_at: "2026-09-24T03:20:00Z", output: { privacy_flag: false } });
    expect(await findPriorFootageReview("cap-1", now)).toEqual({ state: "none" });
  });

  it("does not reuse a failed review", async () => {
    seedRun("failed", { status: "failed", started_at: "2026-09-24T03:25:00Z", error: "gemini_video_failed" });
    expect(await findPriorFootageReview("cap-1", now)).toEqual({ state: "none" });
  });
});
