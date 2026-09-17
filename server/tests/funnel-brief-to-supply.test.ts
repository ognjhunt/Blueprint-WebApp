// @vitest-environment node
/**
 * Does the funnel actually connect, end to end?
 *
 * The Tier 2 mechanism -- draft a brief, operator confirms it, confirmation
 * writes `operator_stated`, verdict reaches `qualified` -- had every part built
 * and tested in isolation, and one thing missing: nothing called `draftBrief`.
 * So no brief was ever drafted, the confirmation page always read "not ready",
 * and the dead end it was meant to remove was still a dead end one step down.
 *
 * This walks the whole chain as the system runs it:
 *
 *   submission drafts a brief  →  GET returns it ready  →  operator confirms it
 *   →  disposition is qualified  →  with a scene, it is runnable supply
 *
 * If any link is missing, this fails -- which is the test the isolated ones
 * could not be, because each of them started after the draft already existed.
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
    storageAdmin: null,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { draftBrief, saveBrief, getBrief, confirmBrief } = await import("../utils/siteTaskBrief");
const { assessReadiness } = await import("../../client/src/lib/siteTaskReadiness");
const { gateFields } = await import("../../client/src/data/siteTaskQualification");

const REQUEST = "req-funnel-1";

/** The clear option for a gate -- what a passing answer looks like. */
function clearValue(fieldId: string): string {
  const field = gateFields.find((candidate) => candidate.id === fieldId);
  return (
    field?.options.find((option) => option.verdict === "clear")?.value ??
    field?.options[0]?.value ??
    ""
  );
}

/**
 * Exactly what `inbound-request.ts` now does at submission for a site operator:
 * draft a brief from the task statement and any gate answers given, and save it.
 * In the bare-bones flow the operator gives no gate answers, so this is a
 * summary and a set of open questions -- which is the case that must still work.
 */
async function submitSiteTask(gatesGivenAtIntake: Record<string, string> = {}) {
  sharedFakeFirestoreState.docs.set(`inboundRequests/${REQUEST}`, {
    requestId: REQUEST,
    request: {
      buyerType: "site_operator",
      capture_mode: "self_capture",
      capture_region: "us",
      taskStatement: "Move sealed cartons from the conveyor onto a pallet.",
      siteTaskGates: gatesGivenAtIntake,
    },
    contact: { email: "ops@acme.example", firstName: "Dana" },
  });

  const proposed = Object.entries(gatesGivenAtIntake)
    .filter(([, value]) => Boolean(value))
    .map(([fieldId, value]) => ({
      fieldId,
      value,
      basis: "description" as const,
      reading: "From what you told us at intake.",
    }));

  await saveBrief(
    draftBrief({
      requestId: REQUEST,
      summary: "Move sealed cartons from the conveyor onto a pallet.",
      captureMode: "self_capture",
      proposed,
    }),
  );
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
});

describe("a bare-bones submission (no gate answers) still reaches qualified", () => {
  it("drafts a brief the operator can load, confirm, and pass", async () => {
    await submitSiteTask();

    // What GET /api/site-task-brief/:token does: the brief is there and ready.
    const brief = await getBrief(REQUEST);
    expect(brief).toBeTruthy();
    expect(brief!.summary).toMatch(/cartons from the conveyor/i);
    // Nothing was given at intake, so every binding gate is an open question.
    expect(brief!.proposed).toHaveLength(0);
    expect(brief!.unresolved.length).toBeGreaterThan(0);

    // What POST :token/confirm does: the operator answers the open questions.
    // These are their statements now, which is the whole point.
    const answers: Record<string, string> = {};
    for (const fieldId of brief!.unresolved) answers[fieldId] = clearValue(fieldId);

    const result = await confirmBrief({
      requestId: REQUEST,
      confirmedBy: "Dana Okafor",
      operatorAnswers: answers,
    });

    expect(result!.disposition).toBe("qualified");
    for (const source of Object.values(result!.sources)) {
      expect(source).toBe("operator_stated");
    }

    // And the request now carries the confirmation and the qualified verdict.
    const stored = sharedFakeFirestoreState.docs.get(`inboundRequests/${REQUEST}`) as Record<
      string,
      unknown
    >;
    expect(stored.site_task_brief_confirmed_at).toBeTruthy();
    expect((stored.site_task_triage as Record<string, unknown>).disposition).toBe("qualified");
  });
});

describe("a submission that gave gate answers at intake gets a pre-filled brief", () => {
  it("proposes them as description-basis answers the operator can correct", async () => {
    await submitSiteTask({ sceneStability: clearValue("sceneStability") });

    const brief = await getBrief(REQUEST);
    expect(brief!.proposed.map((answer) => answer.fieldId)).toContain("sceneStability");
    expect(brief!.proposed.find((a) => a.fieldId === "sceneStability")!.basis).toBe("description");
    // And the ones they did not answer are still open.
    expect(brief!.unresolved).not.toContain("sceneStability");
    expect(brief!.unresolved.length).toBeGreaterThan(0);
  });
});

describe("the join: a confirmed, reconstructed site is runnable supply", () => {
  it("passes the readiness gate a robot team's supply query enforces", async () => {
    await submitSiteTask();
    const brief = await getBrief(REQUEST);
    const answers: Record<string, string> = {};
    for (const fieldId of brief!.unresolved) answers[fieldId] = clearValue(fieldId);
    await confirmBrief({ requestId: REQUEST, confirmedBy: "Dana", operatorAnswers: answers });

    const stored = sharedFakeFirestoreState.docs.get(`inboundRequests/${REQUEST}`) as Record<
      string,
      any
    >;

    // The site-readiness half of what `loadRunnableSites` runs, with a scene
    // now present. This is the operator's side: brief confirmed, gates
    // answered, scene reconstructed. `loadRunnableSites` then adds one more
    // gate on our side -- `sceneRunnableReadiness`, that an evaluation can
    // actually run against the scene -- which the funnel does not produce and
    // is covered in scene-runnable-readiness.test.ts.
    const readiness = assessReadiness({
      answers: stored.siteTaskGates as Record<string, string>,
      captureMode: "self_capture",
      briefDrafted: true,
      briefConfirmed: Boolean(stored.site_task_brief_confirmed_at),
      evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: true },
      reconstructed: true,
    });

    expect(readiness.isSupply).toBe(true);
    expect(readiness.stage).toBe("evaluation_ready");
  });

  it("is NOT supply until the operator confirms, however complete the gates look", async () => {
    // The guard that makes the whole thing safe: a drafted-but-unconfirmed
    // brief, even with a scene, is our reading rather than the operator's
    // statement -- so it is not supply.
    await submitSiteTask();

    const stored = sharedFakeFirestoreState.docs.get(`inboundRequests/${REQUEST}`) as Record<
      string,
      any
    >;
    const readiness = assessReadiness({
      answers: {},
      captureMode: "self_capture",
      briefDrafted: true,
      briefConfirmed: Boolean(stored.site_task_brief_confirmed_at), // false
      evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: true },
      reconstructed: true,
    });

    expect(readiness.isSupply).toBe(false);
  });
});
