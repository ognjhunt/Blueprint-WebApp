// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  auditInferredGates,
  gateAnswerSource,
  withOperatorStatedAnswers,
} from "../../client/src/lib/gateProvenance";
import { decideCaptureDispatch } from "../utils/captureDispatch";
import { bindingGateFieldIds } from "../../client/src/data/siteTaskQualification";
import { triageGateAnswers } from "../../client/src/lib/gateTriage";
import {
  convertProspectToRequestPayload,
  guardProspectSend,
  type OutboundProspect,
} from "../utils/outboundProspects";

const BINDING = ["sceneStability", "taskShape", "objectVariety", "accessWindow"];

function prospect(overrides: Partial<OutboundProspect> = {}): OutboundProspect {
  return {
    prospectId: "p-1",
    facilityName: "Example Distribution Center",
    facilityAddress: "100 Industrial Way, Columbus OH",
    contactEmail: "ops@example.com",
    observations: [{ claim: "Runs a single day shift", source: "https://example.com/careers" }],
    hypothesisedTask: "Totes come off the line and get stacked onto pallets.",
    inferredGates: { sceneStability: "stable", taskShape: "single" },
    gateAnswerSources: { sceneStability: "inferred", taskShape: "inferred" },
    stage: "drafted",
    reasonForContact: "Single-shift DC within the pilot corridor.",
    createdAtIso: "2026-09-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("a guess can never qualify a site", () => {
  it("treats an answer with no recorded provenance as operator-stated", () => {
    // Every inbound request predates provenance, so absence must mean the
    // operator said it -- otherwise shipping this field would freeze the
    // existing funnel.
    expect(gateAnswerSource(undefined, "sceneStability")).toBe("operator_stated");
    expect(gateAnswerSource({}, "sceneStability")).toBe("operator_stated");
  });

  it("names exactly which binding gates are still guesses", () => {
    const audit = auditInferredGates(BINDING, {
      sceneStability: "inferred",
      taskShape: "operator_stated",
    });

    expect(audit.inferredFieldIds).toEqual(["sceneStability"]);
    expect(audit.allOperatorStated).toBe(false);
  });

  it("ignores an inferred gate that does not bind under this capture mode", () => {
    // Nobody was asked, so nobody has to confirm it.
    const audit = auditInferredGates(BINDING, { serviceArea: "inferred" });
    expect(audit.allOperatorStated).toBe(true);
  });

  it("refuses to dispatch capture on inferred gates, even when everything else passes", () => {
    // The whole safety property in one assertion: an outbound hypothesis is
    // enough to start a conversation and never enough to send a capturer to an
    // address or commit a paid reconstruction.
    const decision = decideCaptureDispatch({
      captureRegion: "us",
      disposition: "qualified",
      captureMode: "self_capture",
      unanswered: [],
      bindingFieldIds: BINDING,
      gateAnswerSources: { sceneStability: "inferred" },
    });

    expect(decision).toMatchObject({ dispatch: false, holdReason: "gates_inferred" });
    expect(decision.dispatch === false && decision.detail).toContain("sceneStability");
  });

  it("dispatches once the operator has stated the binding gates themselves", () => {
    const decision = decideCaptureDispatch({
      captureRegion: "us",
      disposition: "qualified",
      captureMode: "self_capture",
      unanswered: [],
      bindingFieldIds: BINDING,
      gateAnswerSources: Object.fromEntries(
        BINDING.map((field) => [field, "operator_stated" as const]),
      ),
    });

    expect(decision).toMatchObject({ dispatch: true, channel: "self_capture_upload" });
  });

  it("leaves inbound requests working exactly as before", () => {
    // No provenance and no binding list: the inbound caller passes neither.
    expect(
      decideCaptureDispatch({ captureRegion: "us", disposition: "qualified", captureMode: "self_capture" }),
    ).toMatchObject({ dispatch: true });
  });

  it("promotes only the gates a reply actually addressed", () => {
    // A warm reply that answers one question does not ratify the other five.
    const promoted = withOperatorStatedAnswers(
      { sceneStability: "inferred", taskShape: "inferred" },
      ["taskShape"],
    );

    expect(promoted).toEqual({ sceneStability: "inferred", taskShape: "operator_stated" });
  });
});

describe("nothing leaves the building unsourced or unwanted", () => {
  it("sends when the hypothesis is specific and sourced", async () => {
    const result = await guardProspectSend(prospect(), { isSuppressed: async () => false });
    expect(result).toEqual({ send: true, email: "ops@example.com" });
  });

  it("refuses a recipient who opted out", async () => {
    const result = await guardProspectSend(prospect(), { isSuppressed: async () => true });
    expect(result).toMatchObject({ send: false, blocker: "email_suppressed" });
  });

  it("treats an unreadable suppression list as suppressed", async () => {
    // Not knowing whether someone opted out is not permission.
    const result = await guardProspectSend(prospect(), {
      isSuppressed: async () => {
        throw new Error("firestore unavailable");
      },
    });

    expect(result).toMatchObject({ send: false, blocker: "email_suppressed" });
  });

  it("refuses an observation with no source", async () => {
    // A hallucinated detail about a stranger's building is checkable in one
    // second and unforgettable.
    const result = await guardProspectSend(
      prospect({ observations: [{ claim: "Runs three shifts", source: "  " }] }),
      { isSuppressed: async () => false },
    );

    expect(result).toMatchObject({ send: false, blocker: "unsourced_observation" });
    expect(result.send === false && result.detail).toContain("Runs three shifts");
  });

  it("refuses to send with nothing checkable behind the claim", async () => {
    const result = await guardProspectSend(prospect({ observations: [] }), {
      isSuppressed: async () => false,
    });
    expect(result).toMatchObject({ send: false, blocker: "no_sourced_observations" });
  });

  it("refuses a generic send with no specific hypothesis", async () => {
    const result = await guardProspectSend(prospect({ hypothesisedTask: "   " }), {
      isSuppressed: async () => false,
    });
    expect(result).toMatchObject({ send: false, blocker: "hypothesis_missing" });
  });

  it("does not contact the same prospect twice in a beta", async () => {
    const result = await guardProspectSend(prospect({ stage: "contacted" }), {
      isSuppressed: async () => false,
    });
    expect(result).toMatchObject({ send: false, blocker: "already_contacted" });
  });

  it("refuses a closed prospect with its own blocker, not the redraftable one", async () => {
    // The draft route lets `already_contacted` through so a message nobody
    // approved can be rewritten. Someone who asked us to stop must not ride in
    // on that allowance, so the blocker has to be distinguishable.
    const result = await guardProspectSend(
      prospect({ stage: "closed", closedReason: "Asked not to be contacted." }),
      { isSuppressed: async () => false },
    );

    expect(result).toMatchObject({ send: false, blocker: "prospect_closed" });
    expect(result.send === false && result.detail).toContain("Asked not to be contacted.");
  });

  it("refuses a closed prospect even if the suppression list has not caught up", async () => {
    // Closing writes a suppression entry, but the stage is the local fact and
    // must stand on its own rather than depending on a second read succeeding.
    const result = await guardProspectSend(prospect({ stage: "closed" }), {
      isSuppressed: async () => false,
    });
    expect(result).toMatchObject({ send: false, blocker: "prospect_closed" });
  });
});

describe("the gates that bind follow the capture mode", () => {
  it("drops the service-area gate when the site holds the phone", () => {
    // The one gate about our driving rather than their room.
    expect(bindingGateFieldIds("self_capture")).not.toContain("serviceArea");
    expect(bindingGateFieldIds("site_visit")).toContain("serviceArea");
  });

  it("agrees exactly with what triage actually scores", () => {
    // Two implementations of one rule is how they drift, and a drift here is
    // silent: provenance would audit a gate triage never asked about, or miss
    // one it did. Given no answers at all, every binding gate lands in
    // `unanswered` -- so triage names its own binding set, and the two lists
    // have to be the same list.
    for (const mode of ["self_capture", "site_visit"] as const) {
      expect([...triageGateAnswers({}, undefined, mode).unanswered].sort()).toEqual(
        [...bindingGateFieldIds(mode)].sort(),
      );
    }
  });
});

describe("a reply rejoins the inbound funnel", () => {
  it("keeps our guesses only where the operator did not correct them", () => {
    const payload = convertProspectToRequestPayload({
      prospect: prospect(),
      statedGates: { taskShape: "few_variants", accessWindow: "scheduled" },
      taskStatement: "We move totes to pallets, plus some shrink-wrapping.",
      captureMode: "self_capture",
    });

    expect(payload.siteTaskGates).toEqual({
      sceneStability: "stable", // still ours
      taskShape: "few_variants", // theirs, overriding ours
      accessWindow: "scheduled", // theirs
    });
    expect(payload.gateAnswerSources).toEqual({
      sceneStability: "inferred",
      taskShape: "operator_stated",
      accessWindow: "operator_stated",
    });
  });

  it("still holds dispatch on the gates the reply did not mention", () => {
    const payload = convertProspectToRequestPayload({
      prospect: prospect(),
      statedGates: { taskShape: "single" },
      taskStatement: "Totes to pallets.",
    });

    const decision = decideCaptureDispatch({
      captureRegion: "us",
      disposition: "qualified",
      captureMode: "self_capture",
      bindingFieldIds: BINDING,
      gateAnswerSources: payload.gateAnswerSources,
    });

    expect(decision).toMatchObject({ dispatch: false, holdReason: "gates_inferred" });
  });

  it("marks the request as outbound so it can be told from one that arrived alone", () => {
    const payload = convertProspectToRequestPayload({
      prospect: prospect(),
      statedGates: {},
      taskStatement: "Totes to pallets.",
    });

    expect(payload.acquisitionSource).toBe("outbound");
    expect(payload.outboundProspectId).toBe("p-1");
  });
});
