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
import { describe, expect, it } from "vitest";

import {
  projectTaskStatus,
  taskStatusInputFrom,
} from "../utils/taskStatusProjection";

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

describe("a persisted preview preparation failure", () => {
  const failed = () => base({ briefDrafted: true, briefConfirmed: true,
    coversScene: true, scenePreparationFailed: true });
  it("distinguishes failed preview preparation from active assessment", () => {
    const projected = projectTaskStatus(failed());
    expect(projected.decision).toBe("footage_received");
    expect(projected.headline).toMatch(/scene preview preparation could not finish/i);
    expect(projected.stage).toBeNull();
    expect(projected.operatorAction).toBeNull();
  });
  it("preserves withdrawal, brief and disposition gates", () => {
    expect(projectTaskStatus({ ...failed(), consentRevoked: true }).headline).toMatch(/withdrawn/i);
    // The preparation problem stays the headline; the confirmation rides with it.
    const unconfirmed = projectTaskStatus({ ...failed(), briefConfirmed: false });
    expect(unconfirmed.decision).toBe("footage_received");
    expect(unconfirmed.operatorAction).toMatch(/confirm it/i);
    expect(projectTaskStatus({ ...failed(), disposition: "needs_conversation" }).decision).toBe("call_needed");
    expect(projectTaskStatus({ ...failed(), disposition: "not_now" }).decision).toBe("not_now");
    const unclaimed = projectTaskStatus({ ...failed(), disposition: "qualified", claimed: false });
    expect(unclaimed.decision).toBe("save_account");
    expect(unclaimed.headline).toMatch(/review the scene preview preparation issue/i);
    expect(unclaimed.headline).not.toMatch(/start building/i);
    expect(projectTaskStatus({ ...failed(), coversScene: false, missingViews: ["infeed"] }).decision).toBe("add_views");
  });
  it("preserves queued, observed and no-result screening runs", () => {
    expect(projectTaskStatus({ ...failed(), screening: { teams: 1, queued: 1, running: 0, reported: 0, noResult: 0 } }).decision).toBe("screening");
    expect(projectTaskStatus({ ...failed(), screening: { teams: 1, queued: 0, running: 0, reported: 1, noResult: 0 } }).decision).toBe("results");
    expect(projectTaskStatus({ ...failed(), screening: { teams: 1, queued: 0, running: 0, reported: 0, noResult: 1 } }).decision).toBe("results");
  });
  it("leaves a newer current ready state and account requirement usable", () => {
    expect(projectTaskStatus({ ...failed(), scenePreparationFailed: false, scenePreviewReady: true }).headline).toMatch(/preview is ready/i);
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
    // Robot teams evaluate only a confirmed job, so the step is never optional.
    expect(status.headline).toMatch(/robot teams can evaluate your job/i);
    expect(status.headline).not.toMatch(/without confirming|optional/i);
    expect(status.operatorAction).toMatch(/confirm it/i);
  });

  it("keeps asking for the confirmation once a recording lands, whatever is waiting on us", () => {
    for (const filmed of [{ hasStoredCapture: true }, { coversScene: true }, { scenePreviewReady: true },
      { hasStoredCapture: true, preparationStatus: { state: "preparing", correlationId: null } }] as const) {
      const status = projectTaskStatus(base({ briefDrafted: true, ...filmed }));
      expect(status.decision).toBe("confirm_brief");
      expect(status.headline).toMatch(/confirm your job brief/i);
      expect(status.operatorAction).toMatch(/confirm it/i);
    }
    // A named coverage gap is still the most actionable step.
    expect(projectTaskStatus(base({ briefDrafted: true, hasStoredCapture: true, coversScene: false,
      missingViews: ["infeed"] })).decision).toBe("add_views");
  });

  it("asks for a recording once the brief is confirmed and coverage is unknown", () => {
    const status = projectTaskStatus(base({ briefDrafted: true, briefConfirmed: true }));
    expect(status.decision).toBe("record");
    expect(status.headline).toMatch(/we can assess this job/i);
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
    expect(status.headline).toMatch(/we have your recording/i);
    expect(status.operatorAction).toBeNull();
  });

  it("never claims an automated check when a person reviews the footage", () => {
    const manual = projectTaskStatus(
      base({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, footageReviewAutomated: false }),
    );
    expect(manual.decision).toBe("footage_received");
    expect(manual.headline).toMatch(/our team reviews it and emails you/i);
    expect(manual.headline).not.toMatch(/checking/i);
  });

  it("keeps a measured shortfall above the footage-received state", () => {
    const status = projectTaskStatus(
      base({
        briefDrafted: true,
        briefConfirmed: true,
        hasStoredCapture: true,
        coversScene: false,
        missingViews: ["the conveyor infeed"],
      }),
    );
    expect(status.decision).toBe("add_views");
  });
});

describe("a measured coverage shortfall takes priority, because it is the most actionable", () => {
  it("names the views and says a supplement will finish it", () => {
    const status = projectTaskStatus(
      base({
        briefDrafted: true,
        briefConfirmed: true,
        coversScene: false,
        missingViews: ["a view of the pallet area"],
        supplementWouldFinish: true,
      }),
    );

    expect(status.decision).toBe("add_views");
    expect(status.operatorAction).toContain("a view of the pallet area");
    expect(status.headline).toMatch(/would finish the scene/i);
  });

  it("does not claim a supplement will finish it when it would not", () => {
    const status = projectTaskStatus(
      base({
        briefDrafted: true,
        briefConfirmed: true,
        coversScene: false,
        missingViews: ["most of the room"],
        supplementWouldFinish: false,
      }),
    );

    expect(status.decision).toBe("add_views");
    expect(status.headline).not.toMatch(/would finish/i);
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
      ["add_views", "assessing", "confirm_brief", "footage_received", "received", "record"].sort(),
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

describe("screening and results rungs", () => {
  const assessed = { briefDrafted: true, briefConfirmed: true, coversScene: true as const };

  it("reports accepted work as waiting when no screening run has started", () => {
    const status = projectTaskStatus(base({ ...assessed,
      screening: { teams: 2, queued: 2, running: 0, reported: 0, noResult: 0 },
    }));
    expect(status.decision).toBe("screening");
    expect(status.headline).toMatch(/screening has not started/i);
    expect(status.headline).toMatch(/results are not available yet/i);
    expect(status.headline).not.toMatch(/being screened|is running/i);
    expect(status.operatorAction).toBeNull();
  });

  it("reports screening once runs are queued or running against the scene", () => {
    const status = projectTaskStatus(
      base({
        ...assessed,
        screening: { teams: 2, queued: 1, running: 1, reported: 0, noResult: 0 },
      }),
    );
    expect(status.decision).toBe("screening");
    expect(status.headline).toContain("Robot screening is in progress");
    expect(status.operatorAction).toBeNull();
  });

  it("reports results without comparing observations from different runs", () => {
    const status = projectTaskStatus(
      base({
        ...assessed,
        screening: { teams: 3, queued: 0, running: 1, reported: 2, noResult: 0 },
      }),
    );
    expect(status.decision).toBe("results");
    expect(status.headline).toContain("Review each run's observed episodes separately");
    expect(status.operatorAction).toBe("Review the results.");
  });

  it("keeps internal team and queue counts out of customer status", () => {
    const status = projectTaskStatus(
      base({ ...assessed, screening: { teams: 1, queued: 1, running: 0, reported: 0, noResult: 0 } }),
    );
    expect(status.headline).toContain("Robot screening has not started");
  });

  it("stays at assessing when no run exists", () => {
    const status = projectTaskStatus(
      base({ ...assessed, screening: { teams: 0, queued: 0, running: 0, reported: 0, noResult: 0 } }),
    );
    expect(status.decision).toBe("assessing");
  });

  it("still puts a coverage shortfall ahead of screening", () => {
    const status = projectTaskStatus(
      base({
        ...assessed,
        coversScene: false,
        missingViews: ["the pallet position"],
        screening: { teams: 1, queued: 1, running: 0, reported: 0, noResult: 0 },
      }),
    );
    expect(status.decision).toBe("add_views");
  });

  it("passes screening through taskStatusInputFrom", () => {
    const input = taskStatusInputFrom({
      briefDrafted: true,
      stage: null,
      screening: { teams: 1, queued: 0, running: 0, reported: 1, noResult: 0 },
    });
    expect(input.screening?.reported).toBe(1);
  });

  it("reports a concluded zero-episode run as no result", () => {
    const status = projectTaskStatus(
      base({ ...assessed, screening: { teams: 1, queued: 0, running: 0, reported: 0, noResult: 1 } }),
    );
    expect(status.decision).toBe("results");
    expect(status.headline).toContain("without an observed episode");
    expect(status.operatorAction).toBe("Review the run status.");
  });
});


it("shows a completed visual preview while keeping simulation readiness separate", () => {
  const input = base({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, scenePreviewReady: true });
  expect(projectTaskStatus(input)).toMatchObject({decision: "assessing", operatorAction: null,
    headline: "Your scene preview is ready. We are preparing the job for simulation."});
  expect(projectTaskStatus({...input, screening: {teams: 1, queued: 0, running: 0, reported: 1, noResult: 0}}).decision).toBe("results");
});

describe("what a waiting job is waiting on", () => {
  const ready = base({ briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, scenePreviewReady: true });
  const none = { teams: 0, queued: 0, running: 0, reported: 0, noResult: 0 };
  const open = { evaluationAvailable: true, reason: null };

  it("says the job is open to robot teams while none has asked", () => {
    const status = projectTaskStatus({ ...ready, ...taskStatusInputFrom({ briefDrafted: true, stage: null, jobAccess: open }), screening: none });
    expect(status.decision).toBe("awaiting_teams");
    expect(status.headline).toMatch(/open to robot teams approved for the beta\. No team has started an evaluation yet/);
    expect(projectTaskStatus({ ...ready, openForEvaluations: true, screening: { ...none, teams: 1, queued: 1 } }).decision).toBe("screening");
    // Not told it is open when the caller did not look at the runs.
    expect(projectTaskStatus({ ...ready, openForEvaluations: true }).decision).toBe("assessing");
  });

  it("says plainly when every evaluation finished and none passed", () => {
    const settled = { ...none, teams: 2, reported: 2, noResult: 0, passed: 0, ineligible: 0 };
    const status = projectTaskStatus({ ...ready, openForEvaluations: true, recommended: false, screening: settled });
    expect(status.decision).toBe("no_team_passed");
    expect(status.headline).toMatch(/^No team's evaluation has passed yet\. 2 evaluation runs/);
    expect(status.headline).toMatch(/we email you when one starts an evaluation/);
    // A pass, a run still in flight, an uncounted pass mark or a recommendation keeps the results rung.
    expect(projectTaskStatus({ ...ready, recommended: false, screening: { ...settled, passed: 1 } }).decision).toBe("results");
    expect(projectTaskStatus({ ...ready, recommended: false, screening: { ...settled, running: 1 } }).decision).toBe("results");
    expect(projectTaskStatus({ ...ready, recommended: false, screening: { ...settled, passed: undefined } }).decision).toBe("results");
    expect(projectTaskStatus({ ...ready, recommended: true, screening: settled }).decision).toBe("results");
    expect(projectTaskStatus({ ...ready, recommended: false, screening: { ...settled, ineligible: 1 } }).decision).toBe("results");
    expect(projectTaskStatus({ ...ready, recommended: false, screening: { ...settled, noResult: 1 } }).decision).toBe("results");
  });

  // Audit A (2026-10-18): a diagnostic or unqualified run is never a failure,
  // and a site whose evaluations all ended that way is still told where it stands.
  it("says evaluations finished with none able to support a recommendation, never calling them failures", () => {
    const unqualified = { ...none, teams: 2, reported: 2, noResult: 0, passed: 0, ineligible: 2 };
    const status = projectTaskStatus({ ...ready, openForEvaluations: true, recommended: false, screening: unqualified });
    expect(status.decision).toBe("no_qualified_evaluation");
    expect(status.headline).toMatch(/^Evaluations on your job have finished, but none can support a recommendation yet/);
    expect(status.headline).toMatch(/2 runs could not be scored against your job's pass mark/);
    expect(status.headline).toMatch(/We email you when a qualified evaluation finishes\.$/);
    expect(status.headline).not.toMatch(/passed|failed|without passing/i);
    expect(status.operatorAction).toBeNull();
    // Runs that ended without an observed episode cannot support one either.
    const noResult = projectTaskStatus({ ...ready, recommended: false,
      screening: { ...none, teams: 1, noResult: 1, passed: 0, ineligible: 0 } });
    expect(noResult.decision).toBe("no_qualified_evaluation");
    expect(noResult.headline).toMatch(/1 run ended without an observed episode/);
    // Still in flight, a recommendation, or an uncounted pass mark keeps the earlier rungs.
    expect(projectTaskStatus({ ...ready, recommended: false, screening: { ...unqualified, running: 1 } }).decision).toBe("results");
    expect(projectTaskStatus({ ...ready, recommended: true, screening: unqualified }).decision).toBe("results");
    expect(projectTaskStatus({ ...ready, recommended: false, screening: { ...unqualified, passed: undefined, ineligible: undefined } }).decision)
      .toBe("results");
    // A qualified failure next to an unqualified run is neither: the results rung stands (the rule is kept).
    expect(projectTaskStatus({ ...ready, recommended: false, screening: { ...unqualified, ineligible: 1 } }).decision).toBe("results");
  });

  it("says what would change a qualified evaluation that did not pass", () => {
    const settled = { ...none, teams: 1, reported: 1, noResult: 0, passed: 0, ineligible: 0,
      closestQualified: { episodesRun: 200, episodesSucceeded: 172, medianCycleSeconds: 34, passMarkRate: 0.95,
        cycleTimeSeconds: 30, belowPassMark: true, cycleTimeMissed: true } };
    const status = projectTaskStatus({ ...ready, openForEvaluations: true, recommended: false, screening: settled });
    expect(status.decision).toBe("no_team_passed");
    expect(status.headline).toMatch(/The closest qualified evaluation succeeded in 172 of 200 episodes \(86%\), against your pass mark of 95%/);
    expect(status.headline).toMatch(/its median cycle time was 34 s against your target of 30 s/);
    expect(status.headline).toMatch(/A recommendation needs one team's evaluation to reach 95% with a median cycle time of 30 s or less/);
    const rateOnly = projectTaskStatus({ ...ready, recommended: false, screening: { ...settled,
      closestQualified: { ...settled.closestQualified, medianCycleSeconds: null, cycleTimeSeconds: null, cycleTimeMissed: false } } });
    expect(rateOnly.headline).toMatch(/A recommendation needs one team's evaluation to reach 95%\./);
    expect(rateOnly.headline).not.toMatch(/cycle time/);
  });

  it("tells a site whose card is not published that no team can evaluate the job", () => {
    const input = taskStatusInputFrom({ briefDrafted: true, stage: null, jobAccess: { evaluationAvailable: false, reason: "not_listed" } });
    expect(input.listed).toBe(false);
    const status = projectTaskStatus({ ...ready, listed: input.listed });
    expect(status.decision).toBe("not_listed");
    expect(status.headline).toMatch(/robot teams cannot see or evaluate this job/);
    expect(status.operatorAction).toMatch(/publish its job card/);
    expect(projectTaskStatus({ ...ready, listed: true }).decision).toBe("assessing");
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
    expect(status.headline).toMatch(/not building a scene/);
    expect(status.operatorAction).toMatch(/update the brief/);
  });

  it("asks for the call for needs_conversation, with the booking link", () => {
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
    expect(status.operatorAction).toContain("https://calendly.example/30min");
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
    expect(status.operatorAction).toMatch(/Save this site to your account/);
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
