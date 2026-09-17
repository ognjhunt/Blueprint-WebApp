// @vitest-environment node
/**
 * The confirmation that replaced the questionnaire.
 *
 * The site page stopped leading with a screen and the verdict downstream did
 * not move with it: a blank gate never qualifies, footage may only lower a
 * disposition, and supply requires `qualified`. So a site could submit, film,
 * and be reconstructed, and nothing in the system could promote it.
 *
 * The fix is not a looser verdict. It is a brief we draft from their evidence
 * and they correct, whose confirmation writes their answers as
 * `operator_stated` -- the provenance a verdict needs. These tests pin the two
 * things that makes load-bearing: that confirming reaches `qualified`, and that
 * it cannot launder one of our own guesses into their statement.
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

const { confirmBrief, draftBrief, saveBrief, CONFIRMABLE_BASES } = await import(
  "../utils/siteTaskBrief"
);
const { gateFields } = await import("../../client/src/data/siteTaskQualification");

const REQUEST = "req-1";

/** The clear option for a gate, which is what a passing answer looks like. */
function clearValue(fieldId: string): string {
  const field = gateFields.find((candidate) => candidate.id === fieldId);
  const clear = field?.options.find((option) => option.verdict === "clear");
  return clear?.value ?? field?.options[0]?.value ?? "";
}

/** Every self-capture gate proposed from evidence, all of it confirmable. */
function fullyProposed() {
  return gateFields
    .filter((field) => !field.bindsForCaptureModes?.includes("site_visit") || field.id !== "serviceArea")
    .filter((field) => field.id !== "serviceArea")
    .map((field) => ({
      fieldId: field.id,
      value: clearValue(field.id),
      basis: "observation" as const,
      reading: `Seen in the walkthrough: ${field.id}`,
    }));
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
});

describe("drafting a brief", () => {
  it("leaves a gate we only assumed in the unresolved list", async () => {
    // The line that stops the brief filling itself in. An assumption is a
    // question wearing an answer's clothes.
    const brief = draftBrief({
      requestId: REQUEST,
      summary: "Cartons from a conveyor onto a pallet",
      captureMode: "self_capture",
      proposed: [
        {
          fieldId: "sceneStability",
          value: clearValue("sceneStability"),
          basis: "observation",
          reading: "The pallet station does not move between the clips",
        },
        {
          fieldId: "taskShape",
          value: clearValue("taskShape"),
          basis: "assumption",
          reading: "Probably one repeated job, going by the description",
        },
      ],
    });

    expect(brief.unresolved).toContain("taskShape");
    expect(brief.unresolved).not.toContain("sceneStability");
  });

  it("asks the capture-blocking questions first", async () => {
    // Order is the whole difference between a form and a next action. Only the
    // gates that change what to film are worth holding a recording for.
    const brief = draftBrief({
      requestId: REQUEST,
      summary: "Cartons",
      captureMode: "self_capture",
      proposed: [],
    });

    const firstThree = brief.unresolved.slice(0, 3);
    expect(firstThree).toContain("sceneStability");
    expect(firstThree).toContain("taskShape");
    expect(firstThree).toContain("objectVariety");
    // The business facts come after, because no camera answers them.
    expect(brief.unresolved.indexOf("deploymentTimeline")).toBeGreaterThan(2);
  });

  it("drops a proposal for a gate that does not bind this capture mode", async () => {
    const brief = draftBrief({
      requestId: REQUEST,
      summary: "Cartons",
      captureMode: "self_capture",
      proposed: [
        {
          fieldId: "serviceArea",
          value: clearValue("serviceArea"),
          basis: "description",
          reading: "They told us where it is",
        },
      ],
    });

    // Service area is about our driving, not their room, and a self-capture is
    // not held to it.
    expect(brief.proposed.map((answer) => answer.fieldId)).not.toContain("serviceArea");
  });
});

describe("confirming a brief is the attestation", () => {
  it("writes every answer as operator-stated and reaches a verdict", async () => {
    // The dead end, closed. Before this there was no path from an unscreened
    // submission to `qualified` -- not through footage, not through anything.
    sharedFakeFirestoreState.docs.set(`inboundRequests/${REQUEST}`, {
      requestId: REQUEST,
      request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us" },
    });
    await saveBrief(
      draftBrief({
        requestId: REQUEST,
        summary: "Cartons from a conveyor onto a pallet",
        captureMode: "self_capture",
        proposed: fullyProposed(),
      }),
    );

    const result = await confirmBrief({ requestId: REQUEST, confirmedBy: "Dana Okafor" });

    expect(result).toBeTruthy();
    expect(result!.disposition).toBe("qualified");
    for (const source of Object.values(result!.sources)) {
      expect(source).toBe("operator_stated");
    }

    const stored = sharedFakeFirestoreState.docs.get(`inboundRequests/${REQUEST}`) as Record<
      string,
      unknown
    >;
    expect(stored.site_task_brief_confirmed_at).toBeTruthy();
    expect((stored.site_task_triage as Record<string, unknown>).disposition).toBe("qualified");
  });

  it("refuses to turn one of our assumptions into their answer", async () => {
    // The worst outcome available here would be a `qualified` verdict nobody
    // actually made. An assumption has to be answered, not accepted.
    sharedFakeFirestoreState.docs.set(`inboundRequests/${REQUEST}`, {
      requestId: REQUEST,
      request: { buyerType: "site_operator", capture_mode: "self_capture" },
    });
    const proposed = fullyProposed().map((answer) =>
      answer.fieldId === "objectVariety" ? { ...answer, basis: "assumption" as const } : answer,
    );
    await saveBrief(
      draftBrief({ requestId: REQUEST, summary: "Cartons", captureMode: "self_capture", proposed }),
    );

    const result = await confirmBrief({ requestId: REQUEST, confirmedBy: "Dana Okafor" });

    expect(result!.answers.objectVariety).toBeUndefined();
    expect(result!.disposition).not.toBe("qualified");
    expect(CONFIRMABLE_BASES).not.toContain("assumption");
  });

  it("lets the operator's correction win over our reading", async () => {
    sharedFakeFirestoreState.docs.set(`inboundRequests/${REQUEST}`, {
      requestId: REQUEST,
      request: { buyerType: "site_operator", capture_mode: "self_capture" },
    });
    const wrongValue = gateFields
      .find((field) => field.id === "sceneStability")!
      .options.find((option) => option.verdict !== "clear")!.value;

    await saveBrief(
      draftBrief({
        requestId: REQUEST,
        summary: "Cartons",
        captureMode: "self_capture",
        proposed: fullyProposed().map((answer) =>
          answer.fieldId === "sceneStability" ? { ...answer, value: wrongValue } : answer,
        ),
      }),
    );

    const result = await confirmBrief({
      requestId: REQUEST,
      confirmedBy: "Dana Okafor",
      operatorAnswers: { sceneStability: clearValue("sceneStability") },
    });

    expect(result!.answers.sceneStability).toBe(clearValue("sceneStability"));
  });

  it("treats 'I do not know' as an outstanding question, not a loop", async () => {
    sharedFakeFirestoreState.docs.set(`inboundRequests/${REQUEST}`, {
      requestId: REQUEST,
      request: { buyerType: "site_operator", capture_mode: "self_capture" },
    });
    await saveBrief(
      draftBrief({
        requestId: REQUEST,
        summary: "Cartons",
        captureMode: "self_capture",
        proposed: fullyProposed(),
      }),
    );

    const result = await confirmBrief({
      requestId: REQUEST,
      confirmedBy: "Dana Okafor",
      operatorUnknown: ["accessWindow"],
    });

    // Blank, recorded, and blocking exactly what it blocks -- and the
    // confirmation still succeeded rather than bouncing them back to the form.
    expect(result!.answers.accessWindow).toBeUndefined();
    expect(result!.brief.operatorUnknown).toContain("accessWindow");
    expect(result!.readiness.blockingEvaluation).toContain("accessWindow");
    // It does not block a recording, so they can still film.
    expect(result!.readiness.blockingCapture).not.toContain("accessWindow");
  });

  it("ignores an answer for a field that is not a gate", async () => {
    sharedFakeFirestoreState.docs.set(`inboundRequests/${REQUEST}`, {
      requestId: REQUEST,
      request: { buyerType: "site_operator", capture_mode: "self_capture" },
    });
    await saveBrief(
      draftBrief({
        requestId: REQUEST,
        summary: "Cartons",
        captureMode: "self_capture",
        proposed: fullyProposed(),
      }),
    );

    const result = await confirmBrief({
      requestId: REQUEST,
      confirmedBy: "Dana Okafor",
      operatorAnswers: { notAGate: "whatever", sceneStability: clearValue("sceneStability") },
    });

    expect(result!.answers.notAGate).toBeUndefined();
  });

  it("returns null when there is no brief to confirm", async () => {
    expect(await confirmBrief({ requestId: "req-nobody", confirmedBy: "Dana" })).toBeNull();
  });
});
