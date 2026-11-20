// @vitest-environment node
/**
 * One truth about where a task stands, so two surfaces cannot disagree.
 *
 * The authenticated workspace and the account-free signed-link page both show a
 * site its task. If they projected status separately they would drift -- one
 * saying "we can assess this" while the other still said "in review". So the
 * projection is pure and lives in one place, and these tests pin the ladder and
 * the one line that must never appear: a decision the Pipeline gap means we
 * cannot stand behind.
 */
import { describe, expect, it, vi } from "vitest";
import { AUTHORITY_ENDED_SENTENCE, FOOTAGE_BEFORE_ACCOUNT_SENTENCE, JOB_WINDOW_ENDED_SENTENCE, JOB_WINDOW_ENDING_MESSAGE,
  PREPARATION_ENDED_NEXT, processingFailure, projectPreparationOutcome } from "../utils/taskPreparationOutcome";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));
import { projectWebsiteRunClosure } from "../utils/websiteRunClosure";
import { ownerClosure } from "./fixtures/website-run-closure";

import {
  projectTaskStatus,
  taskStatusInputFrom,
  withoutStoredVideo,
} from "../utils/taskStatusProjection";

/** What an older run record reads as now that no robot software runs in the simulation (owner, 2026-11-14). */
const READY = "The simulation of your site is ready. Nothing is needed from you.";

function base(overrides: Partial<Parameters<typeof projectTaskStatus>[0]> = {}) {
  return {
    briefDrafted: false,
    briefConfirmed: false,
    stage: null,
    coversScene: null,
    missingViews: [],
    supplementWouldFinish: false,
    ...overrides,
  };
}

it("keeps a ready visual reconstruction current when native status and advisory coverage cannot establish the next step", () => {
  const input = taskStatusInputFrom({ briefDrafted: true, hasStoredCapture: true, stage: null,
    visualReconstructionReady: true, preparationStatus: { state: "unavailable", correlationId: null },
    capture_coverage: { covers_scene: false, missing_coverage: ["A closer walkthrough along the shelving units"] } });
  const status = projectTaskStatus(input);
  expect(status).toMatchObject({ decision: "preview_ready", operatorAction: null,
    headline: "A preview of your site is ready. We're working on the next step." });
  expect(status.headline).not.toMatch(/evaluation.*ready|simulation.*ready|record|upload/i);
  expect(status.missingViews).toEqual(["A closer walkthrough along the shelving units"]);
  expect(projectTaskStatus({ ...input, consentRevoked: true }).headline).toMatch(/withdrawn/i);
  expect(projectTaskStatus({ ...input, preparationStatus: { state: "authority_ended", correlationId: null } }).headline).toMatch(/^This job has ended because we no longer have permission to work on it\./);
  const ownerStep = { category: "insufficient_evidence", basis: "missing_evidence", title: "Owner decision needed",
    reason: "A current owner permission is required.", scope: "This recording", nextStep: "Review the recording permission.",
    actionOwner: "site", evidence: [] } as const;
  expect(projectTaskStatus({ ...input, preparationStatus: { state: "awaiting_inputs", correlationId: null,
    outcome: { ...ownerStep, evidence: [] } } })).toMatchObject({ decision: "insufficient_evidence", operatorAction: ownerStep.nextStep });
  // Blueprint runs no robot software in the simulation (owner, 2026-11-14): an older run record reads as a ready simulation.
  expect(projectTaskStatus({ ...input, screening: { teams: 1, queued: 0, running: 0, reported: 1, noResult: 0 } }).headline).toBe(READY);
});

it("tells a geometry-only job its robot fit check is its result, never a request for more information", () => {
  const input = taskStatusInputFrom({ briefDrafted: true, hasStoredCapture: true, stage: null, preparationOverdue: true,
    preparationStatus: { state: "awaiting_inputs", correlationId: null,
      robotFit: { route: "geometry_only", status: "completed" } } });
  const ready = projectTaskStatus(input);
  expect(ready.headline).toMatch(/^Your first look is ready/);
  expect(ready.headline).toMatch(/estimate from published specs/);
  expect(ready.headline).not.toMatch(/still preparing|taking longer|robot fit|no robot has been tried/);
  expect(projectTaskStatus({ ...input, preparationStatus: { state: "awaiting_inputs", correlationId: null,
    robotFit: { route: "geometry_only", status: "not_run" } } }).headline).toBe("We could not give a first look for this job. The reason is below.");
  // A full-route job awaiting inputs keeps its own wording.
  expect(projectTaskStatus({ ...input, preparationStatus: { state: "awaiting_inputs", correlationId: null,
    robotFit: { route: "full", status: "completed" } } }).headline)
    .toBe("We are still preparing your job. Nothing is needed from you now. This is taking longer than usual.");
});

it("keeps owner closure above stale preparation progress and confirmation while preserving withdrawal", () => {
  const outcome = projectWebsiteRunClosure({ website_run_closures: { "walkthrough-req1": ownerClosure() } }, "req1", "walkthrough-req1");
  const input = base({ briefDrafted: true, briefConfirmed: false, scenePreviewReady: true,
    screening: { teams: 1, queued: 1, running: 0, reported: 0, noResult: 0 }, ownerClosureOutcome: outcome });
  expect(projectTaskStatus(input)).toMatchObject({ decision: "insufficient_evidence",
    headline: "Run closed with a conservative abstention", operatorAction: null, outcome });
  expect(projectTaskStatus({ ...input, consentRevoked: true }).headline).toMatch(/withdrawn/i);
});

describe("a persisted preview preparation failure", () => {
  const failed = () => base({ briefDrafted: true, briefConfirmed: true,
    coversScene: true, scenePreparationFailed: true });
  it("distinguishes failed preview preparation from active assessment", () => {
    const projected = projectTaskStatus(failed());
    expect(projected.decision).toBe("processing_failure");
    expect(projected.headline).toBe("We could not finish preparing your job");
    expect(projected.outcome?.reason).toBe("A step on our side stopped before it finished.");
    expect(projected.stage).toBeNull();
    expect(projected.operatorAction).toBeNull();
  });
  it("preserves withdrawal and assigns an internal failure to Blueprint before brief and disposition gates", () => {
    expect(projectTaskStatus({ ...failed(), consentRevoked: true }).headline).toMatch(/withdrawn/i);
    // Fixing our processing problem is not delegated to the site's confirmation.
    const unconfirmed = projectTaskStatus({ ...failed(), briefConfirmed: false });
    expect(unconfirmed.decision).toBe("processing_failure");
    expect(unconfirmed.operatorAction).toBeNull();
    expect(projectTaskStatus({ ...failed(), disposition: "needs_conversation" }).decision).toBe("processing_failure");
    expect(projectTaskStatus({ ...failed(), disposition: "not_now" }).decision).toBe("processing_failure");
    const unclaimed = projectTaskStatus({ ...failed(), disposition: "qualified", claimed: false });
    expect(unclaimed.decision).toBe("processing_failure");
    expect(unclaimed.outcome?.actionOwner).toBe("blueprint");
    expect(unclaimed.headline).not.toMatch(/start building/i);
    expect(projectTaskStatus({ ...failed(), coversScene: false, missingViews: ["infeed"] }).decision).toBe("processing_failure");
  });
  it("reads queued, observed and no-result run records as a ready simulation, above the older preview failure", () => {
    for (const runs of [{ queued: 1, reported: 0, noResult: 0 }, { queued: 0, reported: 1, noResult: 0 }, { queued: 0, reported: 0, noResult: 1 }])
      expect(projectTaskStatus({ ...failed(), screening: { teams: 1, running: 0, ...runs } })).toMatchObject({ decision: "assessing", headline: READY });
  });
  it("leaves a newer current ready state and account requirement usable", () => {
    expect(projectTaskStatus({ ...failed(), scenePreparationFailed: false, scenePreviewReady: true }).headline).toMatch(/^A preview of your site is ready\./);
    expect(projectTaskStatus({ ...failed(), scenePreparationFailed: false, disposition: "qualified", claimed: false }).decision).toBe("save_account");
    expect(taskStatusInputFrom({ briefDrafted: true, stage: null }).scenePreparationFailed).toBe(false);
  });
});

describe("the decision ladder", () => {
  it("starts at received, with nothing asked of the operator", () => {
    const status = projectTaskStatus(base());
    expect(status.decision).toBe("received");
    expect(status.operatorAction).toBeNull();
  });

  it("asks for a confirmation once a brief is drafted", () => {
    const status = projectTaskStatus(base({ briefDrafted: true }));
    expect(status.decision).toBe("confirm_brief");
    // The site's own step, never worded as optional.
    expect(status.headline).toBe("Check your job description and confirm it. You can do this before or after you film.");
    expect(status.headline).not.toMatch(/without confirming|optional/i);
    expect(status.operatorAction).toMatch(/confirm it/i);
  });

  it("keeps reconstruction with Blueprint after footage arrives, including when coverage or the draft is incomplete", () => {
    for (const progress of [{}, { coversScene: false, missingViews: ["infeed"], supplementWouldFinish: true },
      { scenePreviewReady: true }, { preparationStatus: { state: "preparing", correlationId: null } }] as const) {
      const status = projectTaskStatus(base({ briefDrafted: true, hasStoredCapture: true, ...progress }));
      expect(status.decision).not.toBe("confirm_brief");
      expect(status.decision).not.toBe("add_views");
      expect(status.operatorAction).toBeNull();
      expect(status.headline).not.toMatch(/confirm|film|upload|missing view/i);
    }
  });

  it("asks for a recording once the brief is confirmed and coverage is unknown", () => {
    const status = projectTaskStatus(base({ briefDrafted: true, briefConfirmed: true }));
    expect(status.decision).toBe("record");
    // Nothing is claimed about the job before any video: only what is saved and what comes next.
    expect(status.headline).toBe("Your job is saved. A video of the job is the next step.");
  });

  it("reaches assessing when coverage is measured as sufficient", () => {
    const status = projectTaskStatus(
      base({ briefDrafted: true, briefConfirmed: true, coversScene: true }),
    );
    expect(status.decision).toBe("assessing");
    expect(status.operatorAction).toBeNull();
  });

  it("stops telling a satisfied operator to film once a recording has landed", () => {
    const status = projectTaskStatus(
      base({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true }),
    );
    expect(status.decision).toBe("footage_received");
    // Plain words, and no promise of an update or an email the site may never get.
    expect(status.headline).toBe("We have your video. Nothing is needed from you now.");
    expect(status.operatorAction).toBeNull();
  });

  it("promises no person's review or email when the footage reader is off (journey audit, 2026-11-20)", () => {
    // The route used to pass whether the footage reader runs; with it off, the site was told "Our team reviews it and
    // emails you with the next step", which nothing does: the job goes on without the site either way.
    const offRecord = { briefDrafted: true, site_task_brief_confirmed_at: "2026-11-20T10:00:00.000Z", hasStoredCapture: true,
      stage: null, footageReviewAutomated: false } as Parameters<typeof taskStatusInputFrom>[0];
    const off = projectTaskStatus(taskStatusInputFrom(offRecord));
    expect(off.decision).toBe("footage_received");
    expect(off.headline).toBe("We have your video. Nothing is needed from you now.");
    expect(off.headline).not.toMatch(/our team|emails? you|checking/i);
  });

  it("keeps a measured shortfall internal while the saved footage is processed", () => {
    const status = projectTaskStatus(
      base({
        briefDrafted: true,
        briefConfirmed: true,
        hasStoredCapture: true,
        coversScene: false,
        missingViews: ["the conveyor infeed"],
      }),
    );
    expect(status.decision).toBe("footage_received");
    expect(status.operatorAction).toBeNull();
  });
});

describe("source coverage remains an explicit gap without preempting reconstruction", () => {
  it("does not turn an advisory missing view into another customer step", () => {
    const status = projectTaskStatus(base({ briefDrafted: true, hasStoredCapture: true,
      coversScene: false, missingViews: ["a view of the pallet area"], supplementWouldFinish: true }));
    expect(status.decision).toBe("footage_received");
    expect(status.operatorAction).toBeNull();
    expect(status.missingViews).toEqual(["a view of the pallet area"]);
    expect(status.headline).not.toMatch(/film|upload|missing|ready/i);
  });

  it.each([
    {scenePreviewReady: true},
    {preparationStatus: {state: "handed_off" as const, correlationId: null}},
    {screening: {teams: 1, queued: 0, running: 0, reported: 1, noResult: 0}},
  ])("does not hide retained scene or run progress behind an earlier coverage hint: %j", progress => {
    const status = projectTaskStatus(base({briefDrafted: true, briefConfirmed: true, hasStoredCapture: true,
      coversScene: false, missingViews: ["the rear of the shelves"], ...progress}));
    expect(status.decision).not.toBe("add_views");
    expect(status.operatorAction ?? "").not.toMatch(/new job|additional source views/i);
    if ("screening" in progress) expect(status.headline).toBe(READY);
  });

  it("retains broad coverage uncertainty without claiming ready or requesting another recording", () => {
    const status = projectTaskStatus(base({ briefDrafted: true, hasStoredCapture: true,
      coversScene: false, missingViews: ["most of the room"], supplementWouldFinish: false }));
    expect(status.decision).toBe("footage_received");
    expect(status.operatorAction).toBeNull();
    expect(status.missingViews).toEqual(["most of the room"]);
    expect(status.headline).not.toMatch(/ready|film|upload/i);
  });

  it("does not fire on a shortfall with no named views, which nobody could act on", () => {
    const status = projectTaskStatus(
      base({ briefDrafted: true, briefConfirmed: true, coversScene: false, missingViews: [] }),
    );
    expect(status.decision).not.toBe("add_views");
  });
});

describe("what it will not say", () => {
  it("never reaches a decision that needs the Pipeline to have reported", () => {
    // The whole ladder, walked. None of these is "can_evaluate" or "pilot",
    // because surfacing a state we cannot reach is advertising a loop that
    // does not close.
    const reachable = new Set<string>();
    for (const coversScene of [null, true, false] as const) {
      for (const briefDrafted of [false, true]) {
        for (const briefConfirmed of [false, true]) {
          for (const hasStoredCapture of [false, true]) {
            reachable.add(
              projectTaskStatus(
                base({
                  briefDrafted,
                  briefConfirmed,
                  coversScene,
                  hasStoredCapture,
                  missingViews: coversScene === false ? ["x"] : [],
                }),
              ).decision,
            );
          }
        }
      }
    }
    expect([...reachable].sort()).toEqual(
      ["assessing", "confirm_brief", "footage_received", "received", "record"].sort(),
    );
  });

  it("never carries a next-update time, because no timed review runs", () => {
    expect(projectTaskStatus(base()).nextUpdateIso).toBeNull();
    const stored = taskStatusInputFrom({ briefDrafted: true, stage: null,
      ...({ site_task_next_update_iso: "2026-09-20T12:00:00.000Z" } as object) });
    expect(projectTaskStatus(stored).nextUpdateIso).toBeNull();
  });
});

describe("pulling inputs off a stored request", () => {
  it("reads the confirmation timestamp and coverage block", () => {
    const input = taskStatusInputFrom({
      site_task_brief_confirmed_at: "2026-09-17T00:00:00.000Z",
      capture_coverage: {
        covers_scene: false,
        missing_coverage: ["the destination"],
        supplement_would_finish: true,
      },
      briefDrafted: true,
      stage: "capture_needed",
    });

    expect(input.briefConfirmed).toBe(true);
    expect(input.coversScene).toBe(false);
    expect(input.missingViews).toEqual(["the destination"]);
  });

  it("treats an absent coverage block as unknown, not as a shortfall", () => {
    const input = taskStatusInputFrom({
      briefDrafted: true,
      stage: "capture_needed",
      capture_coverage: null,
    });
    expect(input.coversScene).toBeNull();
    expect(input.missingViews).toEqual([]);
  });
});

// Blueprint runs no robot software in the simulation (owner, 2026-11-14). A run record only ever existed against a built,
// runnable simulation, so an older one reads as that, never as an evaluation, a screening or a result.
describe("older run records", () => {
  const assessed = { briefDrafted: true, briefConfirmed: true, coversScene: true as const };
  it.each([
    { teams: 2, queued: 2, running: 0, reported: 0, noResult: 0 },
    { teams: 2, queued: 1, running: 1, reported: 0, noResult: 0 },
    { teams: 3, queued: 0, running: 1, reported: 2, noResult: 0 },
    { teams: 1, queued: 0, running: 0, reported: 0, noResult: 1 },
    { teams: 2, queued: 0, running: 0, reported: 2, noResult: 0, passed: 0, ineligible: 2 },
  ])("say the simulation is ready and nothing is needed: %j", screening => {
    const status = projectTaskStatus(base({ ...assessed, screening }));
    expect(status).toMatchObject({ decision: "assessing", headline: READY, operatorAction: null });
    expect(status.headline).not.toMatch(/screening|evaluation|results|episode|pass|candidate|review/i);
  });

  it("stays at assessing when no run exists", () => {
    const status = projectTaskStatus(
      base({ ...assessed, screening: { teams: 0, queued: 0, running: 0, reported: 0, noResult: 0 } }),
    );
    expect(status.decision).toBe("assessing");
  });

  it("keeps a coverage shortfall visible beside an older run record", () => {
    const status = projectTaskStatus(base({ ...assessed, coversScene: false, missingViews: ["the pallet position"],
      screening: { teams: 1, queued: 1, running: 0, reported: 0, noResult: 0 } }));
    expect(status.headline).toBe(READY);
    expect(status.missingViews).toEqual(["the pallet position"]);
  });

  it("passes screening through taskStatusInputFrom", () => {
    const input = taskStatusInputFrom({
      briefDrafted: true,
      stage: null,
      screening: { teams: 1, queued: 0, running: 0, reported: 1, noResult: 0 },
    });
    expect(input.screening?.reported).toBe(1);
  });
});


it("shows a completed visual preview while keeping simulation readiness separate", () => {
  const input = base({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, scenePreviewReady: true });
  expect(projectTaskStatus(input)).toMatchObject({decision: "assessing", operatorAction: null,
    headline: "A preview of your site is ready. We're preparing the simulation."});
  expect(projectTaskStatus({...input, screening: {teams: 1, queued: 0, running: 0, reported: 1, noResult: 0}}).headline).toBe(READY);
});

describe("what a waiting job is waiting on", () => {
  const ready = base({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, scenePreviewReady: true });
  const none = { teams: 0, queued: 0, running: 0, reported: 0, noResult: 0 };
  const open = { evaluationAvailable: true, reason: null };

  it("says the job is posted for approved deployment companies while none has started", () => {
    const status = projectTaskStatus({ ...ready, ...taskStatusInputFrom({ briefDrafted: true, stage: null, jobAccess: open }), screening: none });
    expect(status.decision).toBe("awaiting_teams");
    // Blueprint tests no robots and no policies (owner, 2026-11-14), and the companies are "deployment companies".
    expect(status.headline).toBe("Your job is posted for approved deployment companies. Nothing is needed from you.");
    expect(status.headline).not.toMatch(/robot teams?|partners|evaluat|tests robots/i);
    expect(projectTaskStatus({ ...ready, openForEvaluations: true, screening: { ...none, teams: 1, queued: 1 } }).headline).toBe(READY);
    // Not told it is open when the caller did not look at the runs.
    expect(projectTaskStatus({ ...ready, openForEvaluations: true }).decision).toBe("assessing");
  });

  it("never asks a site to publish a job card, listed or not", () => {
    const input = taskStatusInputFrom({ briefDrafted: true, stage: null, jobAccess: { evaluationAvailable: false, reason: "not_listed" } });
    expect(input.listed).toBe(false);
    const status = projectTaskStatus({ ...ready, listed: input.listed });
    expect(status.decision).toBe("assessing");
    expect(JSON.stringify(status)).not.toMatch(/publish its job card|job card is not published/);
  });
});

describe("a confirmed site our screen has not cleared", () => {
  // Blueprint builds a scene only for `qualified`, so these must never read as
  // "we are preparing it", however complete the footage looks.
  it("says no scene is coming for not_now, and what the operator can do", () => {
    const status = projectTaskStatus(
      base({ briefDrafted: true, briefConfirmed: true, coversScene: true, disposition: "not_now" }),
    );
    expect(status.decision).toBe("not_now");
    expect(status.headline).toBe("We aren't building a simulation of your site for now, because of one of your answers.");
    expect(status.operatorAction).toBe("Your job description shows which one. If it changes, update it there.");
  });

  // No call is offered: no person stands between a site's video and an introduction (launch copy, 2026-11-20).
  it("asks for written answers for needs_conversation, never a booking link", () => {
    const status = projectTaskStatus(
      base({
        briefDrafted: true,
        briefConfirmed: true,
        coversScene: true,
        disposition: "needs_conversation",
        bookingUrl: "https://calendly.example/30min",
      }),
    );
    expect(status.decision).toBe("call_needed");
    expect(status.headline).not.toMatch(/preparing/);
    expect(status.headline).toBe("A few questions about your site are still open. Answer what you know in your job description; you can leave the rest.");
    expect(status.operatorAction).toBe("Answer the open questions in your job description.");
    expect(JSON.stringify(status)).not.toContain("calendly");
  });

  it("proceeds as before once qualified", () => {
    const status = projectTaskStatus(
      base({ briefDrafted: true, briefConfirmed: true, coversScene: true, disposition: "qualified" }),
    );
    expect(status.decision).toBe("assessing");
  });

  it("reads the verdict off a stored request", () => {
    const input = taskStatusInputFrom({
      site_task_brief_confirmed_at: "2026-09-23T00:00:00.000Z",
      briefDrafted: true,
      stage: null,
      site_task_triage: { disposition: "needs_conversation" },
    });
    expect(input.disposition).toBe("needs_conversation");
    expect(taskStatusInputFrom({ briefDrafted: true, stage: null }).disposition).toBeNull();
  });
});

describe("a cleared site that is not saved to an account yet", () => {
  it("asks the operator to save it, because no scene is built until then", () => {
    const status = projectTaskStatus(
      base({ briefDrafted: true, briefConfirmed: true, coversScene: true, disposition: "qualified", claimed: false }),
    );
    expect(status.decision).toBe("save_account");
    expect(status.headline).toBe("Save this job to your account so we can build the simulation of your site.");
    expect(status.operatorAction).toBe("Save this job to your account and verify your email.");
  });

  it("proceeds once claimed, and is skipped by callers that cannot tell", () => {
    expect(
      projectTaskStatus(base({ briefDrafted: true, briefConfirmed: true, coversScene: true, disposition: "qualified", claimed: true })).decision,
    ).toBe("assessing");
    expect(
      projectTaskStatus(base({ briefDrafted: true, briefConfirmed: true, coversScene: true, disposition: "qualified" })).decision,
    ).toBe("assessing");
  });

  it("reads the owner off a stored request only when the caller passed it", () => {
    expect(taskStatusInputFrom({ briefDrafted: true, stage: null, account_owner_uid: null }).claimed).toBe(false);
    expect(taskStatusInputFrom({ briefDrafted: true, stage: null, account_owner_uid: "uid" }).claimed).toBe(true);
    expect(taskStatusInputFrom({ briefDrafted: true, stage: null }).claimed).toBeUndefined();
  });
});

/** Owner decision 2026-10-18: a video that arrived before the job's account. */
describe("a video that arrived before the job's account", () => {
  const ARRIVED = /^Your video arrived before this job was saved to an account, so we can't use it to build your scene yet\./;
  it("yields to current source-bound preparation but preserves an unowned historical capture", () => {
    const unsaved = projectTaskStatus(base({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true,
      footageBeforeAccount: true, claimed: false, preparationStatus: { state: "preparing", correlationId: "bp-prep-0000000000000000" } as never }));
    expect(unsaved).toMatchObject({ decision: "assessing", operatorAction: null });
    expect(unsaved.headline).toMatch(/preparing your job/i);
    const saved = projectTaskStatus(base({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, footageBeforeAccount: true }));
    expect(saved).toMatchObject({ decision: "footage_before_account", operatorAction: null });
    expect(saved.headline).toBe(FOOTAGE_BEFORE_ACCOUNT_SENTENCE);
    // Nothing sends a later email about this video, so none is promised.
    expect(saved.headline).not.toMatch(/email/i);
  });

  it("yields to a scene or an evaluation, which would prove otherwise", () => {
    expect(projectTaskStatus(base({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true,
      footageBeforeAccount: true, scenePreviewReady: true })).decision).not.toBe("footage_before_account");
    expect(projectTaskStatus(base({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, footageBeforeAccount: true,
      screening: { queued: 1, running: 0, reported: 0, noResult: 0 } as never })).decision).not.toBe("footage_before_account");
  });

  it("asks for the job's sentence only, never its kind, while keeping legacy-source recovery with Blueprint", () => {
    const arrived = { briefDrafted: true, hasStoredCapture: true, footageBeforeAccount: true } as const;
    expect(projectTaskStatus(base({ ...arrived, briefConfirmed: true, briefUnclear: true })).decision).toBe("describe_job");
    expect(projectTaskStatus(base({ ...arrived, briefConfirmed: false })).decision).toBe("footage_before_account");
    expect(projectTaskStatus(base({ ...arrived, briefConfirmed: true, disposition: "qualified", claimed: false })))
      .toMatchObject({ decision: "footage_before_account", operatorAction: null });
  });

  it("never outranks withdrawn consent", () => {
    expect(projectTaskStatus(base({ hasStoredCapture: true, footageBeforeAccount: true, consentRevoked: true })).headline)
      .toBe("Permission to use your video was withdrawn. Companies can no longer see your job.");
  });
});


describe("source-bound preparation supersedes earlier intake hints", () => {
  it.each(["not_now", "needs_conversation"] as const)("shows observed preparation while %s facts stay unresolved", disposition => {
    const status = projectTaskStatus(base({briefDrafted: true, briefConfirmed: true, hasStoredCapture: true,
      claimed: false, disposition, briefUnclear: true,
      preparationStatus: {state: "preparing", correlationId: null}}));
    expect(status.decision).toBe("assessing");
    expect(status.headline).toMatch(/preparing your job/i);
    expect(status.operatorAction).toBeNull();
    expect(status.headline).not.toMatch(/not building|account|call/i);
  });
  it("does not interrupt automatic preparation for brief confirmation or an advisory conversation", () => {
    const status = projectTaskStatus(base({briefDrafted: true, briefConfirmed: false, hasStoredCapture: true,
      claimed: false, disposition: "needs_conversation", preparationStatus: {state: "preparing", correlationId: null}}));
    expect(status.decision).toBe("assessing");
    expect(status.headline).toMatch(/preparing your job/i);
    expect(status.operatorAction).toBeNull();
  });
  it("does not turn unavailable preparation into proof of progress", () => {
    const status = projectTaskStatus(base({briefDrafted: true, briefConfirmed: true, disposition: "needs_conversation",
      preparationStatus: {state: "unavailable", correlationId: null}}));
    expect(status.decision).toBe("call_needed");
  });
  it("does not require an account after a retained authorized upload", () => {
    const status = projectTaskStatus(base({briefDrafted: true, briefConfirmed: true, disposition: "qualified",
      claimed: false, sourceOwned: true, hasStoredCapture: true}));
    expect(status.decision).not.toBe("save_account");
    expect(status.operatorAction ?? "").not.toMatch(/account/i);
  });
});

it("projects guest source ownership without inventing an account claim", () => {
  const input = taskStatusInputFrom({briefDrafted: true, stage: null, capture_owner_uid: "source-owner", account_owner_uid: null});
  expect(input.sourceOwned).toBe(true);
  expect(input.claimed).toBe(false);
});

it("does not present historical coverage as an instruction for the selected recording", () => {
  for (const coverageCapture of ["walkthrough-rq", undefined]) {
    const input = taskStatusInputFrom({ active_capture_id: `supplement-${"a".repeat(40)}`,
      capture_coverage: { capture_id: coverageCapture, covers_scene: false, missing_coverage: ["old view"], supplement_would_finish: true },
      briefDrafted: true, hasStoredCapture: true, stage: null });
    expect(input.missingViews).toEqual([]);
    expect(projectTaskStatus(input).operatorAction).toBeNull();
  }
});

describe("WP-14: a waiting or ended job says what it waits on, and until when", () => {
  const UNTIL = Date.UTC(2026, 10, 24, 18) / 1000; // 2026-11-24
  const view = (extra: Record<string, unknown>) => projectTaskStatus(taskStatusInputFrom({
    briefDrafted: true, site_task_brief_confirmed_at: "2026-11-01T00:00:00Z", hasStoredCapture: true, stage: null,
    scenePreviewReady: true, ...extra } as never));
  it("a ready simulation never carries the work window", () => {
    const text = view({ sceneProgression: { state: "ready" }, jobWorkWindow: { untilEpoch: UNTIL, ended: false } }).headline;
    expect(text).not.toMatch(/keep working on this job until/);
  });
  it("an ended authority is said as an end, never a hold or a check in progress", () => {
    const ended = (jobWorkWindow: unknown) => view({ scenePreviewReady: false, preparationOverdue: true, jobWorkWindow,
      preparationStatus: { state: "authority_ended", correlationId: null } }).headline;
    expect(ended({ untilEpoch: null, ended: true }).startsWith(JOB_WINDOW_ENDED_SENTENCE)).toBe(true);
    expect(ended(null).startsWith(AUTHORITY_ENDED_SENTENCE)).toBe(true);
    for (const text of [ended({ untilEpoch: null, ended: true }), ended(null)]) {
      expect(text).not.toMatch(/on hold|checks its authorization|taking longer/i);
      expect(text).toContain("To try again, start a new job.");
      expect(text).not.toMatch(/authorized/);
    }
  });
});

describe("a job the window sweep ended says so, whatever the Pipeline last said", () => {
  const recorded = { untilEpoch: null, ended: true, endingRecorded: true };
  const view = (extra: Record<string, unknown>) => projectTaskStatus(taskStatusInputFrom({
    briefDrafted: true, site_task_brief_confirmed_at: "2026-11-01T00:00:00Z", hasStoredCapture: true, stage: null,
    jobWorkWindow: recorded, ...extra } as never));
  const terminalScene = { kind: "setup_repair", terminal: true, reasonCode: "authority_expired", digest: `sha256:${"a".repeat(64)}` };

  it("builds on the WP-14 sentences and promises nothing", () => {
    expect(JOB_WINDOW_ENDING_MESSAGE.startsWith(JOB_WINDOW_ENDED_SENTENCE)).toBe(true);
    expect(JOB_WINDOW_ENDING_MESSAGE.endsWith(PREPARATION_ENDED_NEXT)).toBe(true);
    expect(JOB_WINDOW_ENDING_MESSAGE).toBe("The simulation of your site has stopped because the time for this job ran out. "
      + "It was not finished, and no more work will run on this job. Your first look stays on your job page. To try again, start a new job.");
    expect(JOB_WINDOW_ENDING_MESSAGE).not.toMatch(/we will|we'll|our team|review|follow up|email you|on hold|taking longer/i);
  });

  it.each([
    ["the Pipeline cannot be reached", { preparationStatus: { state: "unavailable", correlationId: null } }],
    ["preparation still says preparing", { preparationStatus: { state: "preparing", correlationId: null }, preparationOverdue: true }],
    ["preparation needs our review", { preparationStatus: { state: "failed_retryable", correlationId: null } }],
    ["no preparation status ever arrived", { preparationOverdue: true }],
    ["the scene waits on our team", { preparationStatus: { state: "handed_off", correlationId: null }, sceneProgression: { state: "waiting" } }],
    ["the scene intake ended on our side", { sceneProgression: { state: "ended" } }],
    ["the Pipeline's own ending arrived afterwards", { sceneProgression: { state: "ended", sceneOutcome: terminalScene } }],
    ["the scene was built and never tested", { scenePreviewReady: true, sceneProgression: { state: "completed" } }],
    ["the job is open and waiting for evaluations", { jobAccess: { evaluationAvailable: true, reason: null },
      screening: { teams: 0, queued: 0, running: 0, reported: 0, noResult: 0 } }],
    ["the preview failed", { scenePreparationFailed: true }],
  ])("is final when %s", (_name, extra) => {
    const status = view(extra);
    expect(status).toMatchObject({ decision: "ended", headline: JOB_WINDOW_ENDING_MESSAGE, operatorAction: null, stage: null,
      missingViews: [], nextUpdateIso: null });
    expect(status.outcome).toBeUndefined();
  });

  it("gives way only to a withdrawal, an owner closure and a result", () => {
    expect(view({ consentRevoked: true }).headline).toMatch(/^Permission to use your video was withdrawn\./);
    expect(view({ ownerClosureOutcome: projectWebsiteRunClosure({ website_run_closures: { "walkthrough-req1": ownerClosure() } },
      "req1", "walkthrough-req1") }).headline).toBe("Run closed with a conservative abstention");
    expect(view({ sceneProgression: { state: "held", heldReason: "held_capability" } }).headline)
      .toMatch(/^We can't simulate this kind of job yet\./);
    expect(view({ screening: { teams: 1, queued: 0, running: 0, reported: 1, noResult: 0 } }).headline).toBe(READY);
    for (const result of [{ consentRevoked: true }, { sceneProgression: { state: "held", heldReason: "held_setup" } }])
      expect(view(result).decision).not.toBe("ended");
    // Rewritten (review, 2026-11-11): the sweep records the ending only when no run can still be live (past the window
    // plus the grace the Pipeline takes to stop one), so a run record still saying queued or running is stale here.
    for (const stale of [{ queued: 1, running: 0 }, { queued: 0, running: 1 }])
      expect(view({ screening: { teams: 1, reported: 0, noResult: 0, ...stale } }).decision).toBe("ended");
  });

  it("is not shown without a recorded ending, or once the window is open again", () => {
    for (const jobWorkWindow of [null, { untilEpoch: null, ended: true }, { untilEpoch: 1_800_000_000, ended: false }])
      expect(view({ jobWorkWindow }).decision).not.toBe("ended");
  });
});

/**
 * A stop's next step says "Your video is saved" only where a finished video is stored. Without one the page asks the
 * site to keep its original instead: the matchers in `withoutStoredVideo` follow the sentences in
 * `taskPreparationOutcome.ts`, so a reworded sentence that stopped matching would surface here (launch copy, 2026-11-20).
 */
describe("a stop's next step with no stored video", () => {
  const sha = `sha256:${"d".repeat(64)}`;
  it.each([
    ["the processing fallback", processingFailure(), "Nothing is needed from you. Keep your original video; you don't need to send it again."],
    ["the carry path", projectPreparationOutcome({ reason: "robot_carry_path_rejected", category: "robot_incompatibility",
      basis: "conservative_configuration_check", robot_id: "franka_panda", evidence_digest: sha }), "Nothing is needed from you. Keep your original video."],
    ["missing evidence", projectPreparationOutcome({ reason: "task_evidence_incomplete", category: "insufficient_evidence",
      basis: "missing_evidence", robot_id: null, evidence_digest: sha }), "Nothing is needed from you. Keep your original video."],
    ["the robot fit hold", projectPreparationOutcome({ reason: "robot_fit_none", category: "robot_incompatibility",
      basis: "conservative_pre_spend_fit_check", robot_id: null, evidence_digest: sha } as never),
      "Nothing is needed from you. Your first look stays on your job page. Keep your original video."],
  ])("rewrites %s", (_name, outcome, expected) => {
    expect(outcome.nextStep).toMatch(/[Yy]our video is saved/);
    expect(withoutStoredVideo(outcome.nextStep)).toBe(expected);
    const stored = projectTaskStatus({ ...base({ briefDrafted: true, hasStoredCapture: true }),
      preparationStatus: { state: "awaiting_inputs", correlationId: null, outcome } });
    expect(stored.outcome?.nextStep).toBe(outcome.nextStep);
    const unstored = projectTaskStatus({ ...base({ briefDrafted: true, hasStoredCapture: false }),
      preparationStatus: { state: "awaiting_inputs", correlationId: null, outcome } });
    expect(unstored.outcome?.nextStep).toBe(expected);
    expect(unstored.outcome?.nextStep).not.toMatch(/[Yy]our video is saved|recording/);
  });
  it("adds the ending's reason, and nothing about retries, to a final stop", () => {
    const status = projectTaskStatus({ ...base({ briefDrafted: true, hasStoredCapture: true }),
      preparationStatus: { state: "failed_terminal", terminalReason: "out_of_scope", correlationId: "bp-prep-0123456789abcdef" } });
    expect(status.outcome?.reason).toBe("A step on our side stopped before it finished. We can't simulate this kind of job yet.");
    expect(status.outcome?.reason).not.toMatch(/retries/);
    expect(status.headline).not.toMatch(/Reference|bp-prep/);
  });
});
