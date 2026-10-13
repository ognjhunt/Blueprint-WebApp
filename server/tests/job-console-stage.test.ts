// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null }));

import { deriveJobStage, JOB_STAGES, JOB_STAGE_LABELS, type JobFacts } from "../utils/jobConsoleStage";
import { buildJobTimeline, projectJobFacts, type RawJobInputs } from "../utils/jobConsoleFacts";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

function facts(overrides: DeepPartial<JobFacts> = {}): JobFacts {
  const base: JobFacts = {
    requestId: "job-1",
    createdAtIso: "2026-10-01T00:00:00.000Z",
    siteName: "Dock 4",
    siteLocation: "Austin, TX",
    company: "Acme",
    claimed: true,
    archived: false,
    brief: { state: "confirmed", unresolvedGates: 0 },
    capture: { state: "covered", missingViews: [] },
    listing: { state: "live" },
    evaluations: { total: 0, pendingAdmission: 0, admitted: 0, pending: [] },
    runs: { queued: 0, running: 0, reported: 0, noResult: 0, passing: 0, belowTarget: 0, untargeted: 0, best: null },
    recommendation: { state: "none", recommendationId: null, teamId: null, teamName: null, evaluationRunId: null },
    booking: { state: "none", startsAt: null },
    withdrawal: { state: "none" },
    opsNotice: null,
    lastActivityIso: null,
  };
  const merged = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    const current = (base as unknown as Record<string, unknown>)[key];
    merged[key] = value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object"
      ? { ...(current as object), ...(value as object) }
      : value;
  }
  return merged as unknown as JobFacts;
}

describe("deriveJobStage", () => {
  it("labels every stage", () => {
    for (const stage of JOB_STAGES) expect(JOB_STAGE_LABELS[stage]).toBeTruthy();
  });

  describe("before any team asks", () => {
    it("asks Blueprint to draft a brief when nothing has arrived", () => {
      const result = deriveJobStage(facts({ brief: { state: "none" }, capture: { state: "none" }, listing: { state: "none" } }));
      expect(result).toMatchObject({ stage: "intake", actionOwner: "blueprint", nextAction: "Draft the task brief from the intake" });
    });

    it("tracks a queued brief review as Blueprint's", () => {
      const result = deriveJobStage(facts({ brief: { state: "review_pending" }, capture: { state: "none" } }));
      expect(result.stage).toBe("intake");
      expect(result.nextAction).toMatch(/Brief review is queued/);
    });

    it("waits on the site to confirm a draft brief and film", () => {
      const result = deriveJobStage(facts({ brief: { state: "draft" }, capture: { state: "none" } }));
      expect(result).toMatchObject({ stage: "brief_review", actionOwner: "site" });
    });

    it("waits on the site to film once the brief is confirmed", () => {
      expect(deriveJobStage(facts({ capture: { state: "none" } }))).toMatchObject({
        stage: "capture", actionOwner: "site", nextAction: "Waiting on site to film the work area" });
    });

    it("asks Blueprint to review coverage of an uploaded capture", () => {
      expect(deriveJobStage(facts({ capture: { state: "uploaded" } }))).toMatchObject({ stage: "capture", actionOwner: "blueprint" });
    });

    it("names the missing views when coverage is short", () => {
      const result = deriveJobStage(facts({ capture: { state: "coverage_short", missingViews: ["shelf end", "dock door", "aisle 3", "aisle 4"] } }));
      expect(result).toMatchObject({ stage: "capture", actionOwner: "site" });
      expect(result.nextAction).toBe("Waiting on site to add views: shelf end, dock door, aisle 3");
    });

    it("flags a failed scene for Blueprint", () => {
      expect(deriveJobStage(facts({ capture: { state: "scene_failed" } }))).toMatchObject({ stage: "capture", actionOwner: "blueprint" });
    });

    it("waits on the site to publish, re-approve or resume the public card", () => {
      expect(deriveJobStage(facts({ listing: { state: "hidden" } }))).toMatchObject({ stage: "listing", actionOwner: "site" });
      expect(deriveJobStage(facts({ listing: { state: "review_required" } })).nextAction).toMatch(/re-approve/);
      expect(deriveJobStage(facts({ listing: { state: "paused" } })).nextAction).toBe("Listing paused by the site");
    });

    it("asks Blueprint to invite teams once the card is live", () => {
      expect(deriveJobStage(facts({ capture: { state: "scene_ready" } }))).toMatchObject({ stage: "awaiting_teams", actionOwner: "blueprint" });
    });
  });

  describe("evaluation loop", () => {
    it("names the team awaiting admission and counts the rest", () => {
      const result = deriveJobStage(facts({
        listing: { state: "none" },
        evaluations: { total: 2, pendingAdmission: 2, admitted: 0, pending: [
          { requestId: "eval-1", teamName: "Atlas Robotics", setupName: "Arm v2" },
          { requestId: "eval-2", teamName: null, setupName: null },
        ] },
      }));
      expect(result).toMatchObject({ stage: "admission", actionOwner: "blueprint",
        nextAction: "Admit evaluation for Atlas Robotics (+1 more)" });
    });

    it("falls back to a generic team label", () => {
      const result = deriveJobStage(facts({ evaluations: { total: 1, pendingAdmission: 1, admitted: 0,
        pending: [{ requestId: "eval-1", teamName: null, setupName: null }] } }));
      expect(result.nextAction).toBe("Admit evaluation for the requesting team");
    });

    it("waits while runs are queued or running", () => {
      const result = deriveJobStage(facts({ evaluations: { total: 1, pendingAdmission: 0, admitted: 1, pending: [] },
        runs: { queued: 1, running: 2 } }));
      expect(result).toMatchObject({ stage: "evaluating", actionOwner: "none", nextAction: "Evaluation in progress (2 running, 1 queued)" });
    });

    it("waits for an admitted run that is not recorded yet", () => {
      expect(deriveJobStage(facts({ evaluations: { total: 1, pendingAdmission: 0, admitted: 1, pending: [] } })))
        .toMatchObject({ stage: "evaluating", nextAction: "Admitted; waiting for the run to be recorded" });
    });

    it("asks for a recommendation with passing runs counted", () => {
      const result = deriveJobStage(facts({ evaluations: { total: 2, pendingAdmission: 1, admitted: 1, pending: [
        { requestId: "eval-2", teamName: "B", setupName: null }] }, runs: { reported: 3, passing: 2, belowTarget: 1 } }));
      expect(result).toMatchObject({ stage: "recommend", actionOwner: "blueprint", nextAction: "Recommend a team (2 passing runs)" });
      expect(result.attention).toContain("1 evaluation request awaiting admission");
    });

    it("says when reported runs have no site target to compare", () => {
      const result = deriveJobStage(facts({ runs: { reported: 1, untargeted: 1 } }));
      expect(result.nextAction).toBe("Recommend a team (1 reported run, no site target to compare)");
    });

    it("reports when no run passed", () => {
      expect(deriveJobStage(facts({ runs: { reported: 2, belowTarget: 2 } }))).toMatchObject({
        stage: "no_passing_run", nextAction: "No passing evaluation yet (2 runs below the site's target): invite or admit another team" });
      expect(deriveJobStage(facts({ runs: { noResult: 1 } })).nextAction).toMatch(/1 run without a result/);
    });

    it("lets a pending admission lead when nothing has passed", () => {
      expect(deriveJobStage(facts({ runs: { reported: 1, belowTarget: 1 }, evaluations: { total: 2, pendingAdmission: 1,
        admitted: 1, pending: [{ requestId: "e", teamName: "Nova", setupName: null }] } })).stage).toBe("admission");
    });
  });

  describe("recommendation and booking", () => {
    const recommended = { state: "recommended" as const, recommendationId: "rec_1", teamId: "team-1", teamName: "Atlas", evaluationRunId: "run_1" };

    it("waits on the site to book a recommendation", () => {
      expect(deriveJobStage(facts({ recommendation: recommended, runs: { reported: 1, passing: 1 } })))
        .toMatchObject({ stage: "awaiting_booking", actionOwner: "site", nextAction: "Waiting on site to book Atlas" });
    });

    it("asks Blueprint to review a recommendation after the brief changed", () => {
      expect(deriveJobStage(facts({ recommendation: { ...recommended, state: "review_required" } })))
        .toMatchObject({ stage: "recommendation_review", actionOwner: "blueprint" });
    });

    it("asks Blueprint to schedule a booked pilot", () => {
      expect(deriveJobStage(facts({ recommendation: recommended, booking: { state: "awaiting_coordination" } })))
        .toMatchObject({ stage: "coordination", nextAction: "Schedule pilot with Atlas" });
    });

    it("reconciles a booking whose job changed", () => {
      expect(deriveJobStage(facts({ recommendation: { ...recommended, state: "review_required" }, booking: { state: "awaiting_coordination" } })).nextAction)
        .toMatch(/Reconcile the changed job/);
      expect(deriveJobStage(facts({ recommendation: recommended, booking: { state: "booked" } })).nextAction)
        .toMatch(/Reconcile the booking/);
    });

    it("shows a scheduled pilot's date", () => {
      expect(deriveJobStage(facts({ recommendation: recommended, booking: { state: "scheduled", startsAt: "2026-11-02T15:00:00.000Z" } })))
        .toMatchObject({ stage: "scheduled", actionOwner: "none", nextAction: "Pilot scheduled for 2026-11-02" });
    });
  });

  describe("overrides and attention", () => {
    it("puts withdrawal above every downstream state", () => {
      const result = deriveJobStage(facts({ withdrawal: { state: "cleanup_pending" }, booking: { state: "scheduled" },
        recommendation: { state: "recommended" } }));
      expect(result).toMatchObject({ stage: "withdrawn", actionOwner: "blueprint", nextAction: "Confirm capture withdrawal cleanup" });
      expect(deriveJobStage(facts({ withdrawal: { state: "legal_hold" } })).actionOwner).toBe("none");
      expect(deriveJobStage(facts({ withdrawal: { state: "complete" } })).actionOwner).toBe("none");
    });

    it("closes an archived job", () => {
      expect(deriveJobStage(facts({ archived: true, runs: { reported: 1, passing: 1 } })).stage).toBe("closed");
    });

    it("surfaces open ops notices and unclaimed jobs without changing the stage", () => {
      const result = deriveJobStage(facts({ claimed: false, opsNotice: { state: "open", summary: "Contact bounced" } }));
      expect(result.stage).toBe("awaiting_teams");
      expect(result.attention).toEqual(["Ops notice: Contact bounced", "Site has not claimed the job in an account"]);
      expect(deriveJobStage(facts({ opsNotice: { state: "resolved", summary: null } })).attention).toEqual([]);
    });
  });
});

describe("projectJobFacts", () => {
  function inputs(overrides: Partial<RawJobInputs> = {}): RawJobInputs {
    return {
      requestId: "job-1",
      record: {
        createdAt: "2026-10-01T00:00:00.000Z",
        account_owner_uid: "owner-1",
        request: { buyerType: "site_operator", consent_attestation: { granted: true } },
        workspace_task: { terms: { successRate: 80, cycleTimeSeconds: null } },
        public_task_listing: { enabled: true, wentLiveIso: "2026-10-03T00:00:00.000Z" },
        capture_coverage: { covers_scene: true },
      },
      site: { siteName: "Dock 4", siteLocation: "Austin, TX", company: "Acme" },
      brief: { confirmedAtIso: "2026-10-02T00:00:00.000Z", unresolved: [] },
      captureSession: null,
      evaluationRequests: [],
      runs: [],
      teamNames: new Map([["team-a", "Atlas"], ["team-b", "Nova"]]),
      ...overrides,
    };
  }

  it("projects a covered, live job with no requests", () => {
    const result = projectJobFacts(inputs());
    expect(result).toMatchObject({
      siteName: "Dock 4", claimed: true,
      brief: { state: "confirmed" }, capture: { state: "covered" }, listing: { state: "live" },
      recommendation: { state: "none" }, booking: { state: "none" }, withdrawal: { state: "none" },
    });
    expect(deriveJobStage(result).stage).toBe("awaiting_teams");
  });

  it("counts admitted and pending evaluation requests", () => {
    const result = projectJobFacts(inputs({ evaluationRequests: [
      { id: "eval-1", teamName: "Atlas", record: { workspace_evaluation: { opportunityId: "job-1", setupName: "Arm v2" } } },
      { id: "eval-2", teamName: "Nova", record: { workspace_evaluation: { opportunityId: "job-1" }, free_evaluation_handoff: { runId: "run_free_x" } } },
    ] }));
    expect(result.evaluations).toEqual({ total: 2, pendingAdmission: 1, admitted: 1,
      pending: [{ requestId: "eval-1", teamName: "Atlas", setupName: "Arm v2" }] });
    expect(deriveJobStage(result).nextAction).toBe("Admit evaluation for Atlas");
  });

  it("classifies runs against the site's target and picks the best", () => {
    const result = projectJobFacts(inputs({ runs: [
      { runId: "r1", teamId: "team-a", state: "completed", requestedAtIso: "2026-10-04T00:00:00.000Z",
        result: { evidenceScope: "development_only", observed: { episodesRun: 50, episodesSucceeded: 45, successRate: 0.9, medianCycleSeconds: 12 } } },
      { runId: "r2", teamId: "team-b", state: "completed", requestedAtIso: "2026-10-05T00:00:00.000Z",
        result: { observed: { episodesRun: 50, episodesSucceeded: 20, successRate: 0.4, medianCycleSeconds: 30 } } },
      { runId: "r3", teamId: "team-b", state: "requested", dispatch: { startedAtIso: "2026-10-06T00:00:00.000Z" } },
      { runId: "r4", teamId: "team-b", state: "requested" },
      { runId: "r5", teamId: "team-a", state: "blocked" },
      { runId: "r6", teamId: "team-a", state: "abandoned" },
      { runId: "r7", teamId: "team-a", state: "completed", evaluationPurpose: "private",
        result: { observed: { episodesRun: 50, episodesSucceeded: 50, successRate: 1, medianCycleSeconds: 5 } } },
    ] }));
    expect(result.runs).toMatchObject({ queued: 1, running: 1, reported: 2, noResult: 1, passing: 1, belowTarget: 1, untargeted: 0 });
    expect(result.runs.best).toMatchObject({ runId: "r1", teamName: "Atlas", successRatePct: 90, meetsTarget: true });
    expect(deriveJobStage(result).nextAction).toBe("Recommend a team (1 passing run)");
  });

  it("reads recommendation, booking, coordination and withdrawal from the record", () => {
    const recommendation = { id: "rec_1", teamId: "team-a", teamName: "Atlas", recommendedAtIso: "2026-10-07T00:00:00.000Z", evaluationRunId: "r1" };
    const booked = projectJobFacts(inputs({ record: { ...inputs().record, pilot_recommendation: recommendation,
      pilot_booking: { recommendationId: "rec_1", state: "awaiting_coordination", acceptedAtIso: "2026-10-08T00:00:00.000Z" } } }));
    expect(booked.recommendation).toEqual({ state: "recommended", recommendationId: "rec_1", teamId: "team-a", teamName: "Atlas", evaluationRunId: "r1" });
    expect(booked.booking.state).toBe("awaiting_coordination");
    expect(booked.lastActivityIso).toBe("2026-10-08T00:00:00.000Z");

    const withdrawn = projectJobFacts(inputs({ record: { ...inputs().record, consent_revoked: true,
      capture_withdrawal: { state: "cleanup_retained_legal_hold", requestedAtIso: "2026-10-09T00:00:00.000Z" } } }));
    expect(withdrawn.withdrawal.state).toBe("legal_hold");
    expect(buildJobTimeline(inputs({ record: { ...inputs().record, consent_revoked: true } }), withdrawn).at(-1)).toMatchObject({ key: "withdrawn", done: true });
  });

  it("reads an ops notice defensively", () => {
    expect(projectJobFacts(inputs({ record: { ...inputs().record, ops_notice: { status: "open", message: "Call back" } } })).opsNotice)
      .toEqual({ state: "open", summary: "Call back" });
    expect(projectJobFacts(inputs({ record: { ...inputs().record, ops_notice: "Check contact" } })).opsNotice)
      .toEqual({ state: "open", summary: "Check contact" });
    expect(projectJobFacts(inputs()).opsNotice).toBeNull();
  });

  it("never invents a site name it could not decrypt", () => {
    expect(projectJobFacts(inputs({ site: null })).siteName).toBe("Unreadable site name");
  });

  it("derives brief, capture and listing states from what is recorded", () => {
    const record = { ...inputs().record, capture_coverage: null, public_task_listing: null };
    expect(projectJobFacts(inputs({ record, brief: null })).brief.state).toBe("none");
    expect(projectJobFacts(inputs({ record, brief: { confirmedAtIso: null } })).brief.state).toBe("draft");
    expect(projectJobFacts(inputs({ record: { ...record, briefReviewPending: true } })).brief.state).toBe("review_pending");
    expect(projectJobFacts(inputs({ record })).capture.state).toBe("none");
    expect(projectJobFacts(inputs({ record, captureSession: { immutable_upload_identity: {} } })).capture.state).toBe("uploaded");
    expect(projectJobFacts(inputs({ record, captureSession: { world_reconstruction: { state: "ready" } } })).capture.state).toBe("scene_ready");
    expect(projectJobFacts(inputs({ record: { ...record, capture_coverage: { covers_scene: false, missing_coverage: ["dock"] } } })).capture)
      .toEqual({ state: "coverage_short", missingViews: ["dock"] });
    expect(projectJobFacts(inputs({ record })).listing.state).toBe("none");
    expect(projectJobFacts(inputs({ record: { ...record, public_task_listing: { enabled: false } } })).listing.state).toBe("hidden");
    expect(projectJobFacts(inputs({ record: { ...record, workspace_task: { paused: true } } })).listing.state).toBe("paused");
  });
});
