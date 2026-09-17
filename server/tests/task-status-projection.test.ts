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
    nextUpdateIso: null,
    ...overrides,
  };
}

describe("the decision ladder", () => {
  it("starts at received, with nothing asked of the operator", () => {
    const status = projectTaskStatus(base());
    expect(status.decision).toBe("received");
    expect(status.operatorAction).toBeNull();
  });

  it("asks for a confirmation once a brief is drafted", () => {
    const status = projectTaskStatus(base({ briefDrafted: true }));
    expect(status.decision).toBe("confirm_brief");
    expect(status.operatorAction).toMatch(/confirm the brief/i);
  });

  it("asks for a recording once the brief is confirmed and coverage is unknown", () => {
    const status = projectTaskStatus(base({ briefDrafted: true, briefConfirmed: true }));
    expect(status.decision).toBe("record");
    expect(status.headline).toMatch(/we can assess this task/i);
  });

  it("reaches assessing when coverage is measured as sufficient", () => {
    const status = projectTaskStatus(
      base({ briefDrafted: true, briefConfirmed: true, coversScene: true }),
    );
    expect(status.decision).toBe("assessing");
    expect(status.operatorAction).toBeNull();
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
          reachable.add(
            projectTaskStatus(
              base({ briefDrafted, briefConfirmed, coversScene, missingViews: coversScene === false ? ["x"] : [] }),
            ).decision,
          );
        }
      }
    }
    expect([...reachable].sort()).toEqual(
      ["add_views", "assessing", "confirm_brief", "received", "record"].sort(),
    );
  });

  it("carries a next-update time only when one was committed", () => {
    expect(projectTaskStatus(base()).nextUpdateIso).toBeNull();
    expect(
      projectTaskStatus(base({ nextUpdateIso: "2026-09-20T12:00:00.000Z" })).nextUpdateIso,
    ).toBe("2026-09-20T12:00:00.000Z");
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
      site_task_next_update_iso: "2026-09-20T00:00:00.000Z",
      briefDrafted: true,
      stage: "capture_needed",
    });

    expect(input.briefConfirmed).toBe(true);
    expect(input.coversScene).toBe(false);
    expect(input.missingViews).toEqual(["the destination"]);
    expect(input.nextUpdateIso).toBe("2026-09-20T00:00:00.000Z");
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
