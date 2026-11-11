// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decideDispatchForRequest } from "../agents/workflows";
import { INBOUND_POLICY } from "../agents/action-policies";
import { bookingUrl } from "../utils/bookingLink";
import { footageSettlesAll } from "../../client/src/data/siteTaskQualification";
import type { InboundRequest, InboundRequestPayload } from "../types/inbound-request";
import { convertProspectToRequestPayload } from "../utils/outboundProspects";

const QUALIFIED = {
  disposition: "qualified" as const,
  blocking_field_ids: [],
  blockers: [],
  open_questions: [],
  unanswered_field_ids: [],
  incomplete: false,
  evaluated_at: "2026-09-16T00:00:00.000Z",
};

function request(overrides: Partial<InboundRequest> = {}): InboundRequest {
  return {
    requestId: "req-1",
    site_task_triage: QUALIFIED,
    request: { capture_mode: "self_capture", capture_region: "us" },
    ...overrides,
  } as unknown as InboundRequest;
}

describe("capture starts without anybody noticing a queue", () => {
  it("dispatches a self-capture upload for a qualified site that films its own room", () => {
    expect(decideDispatchForRequest(request(), false)).toMatchObject({
      dispatch: true,
      channel: "self_capture_upload",
    });
  });

  it("holds when an upstream check asked for a person, whatever the gates said", () => {
    expect(decideDispatchForRequest(request(), true)).toMatchObject({
      dispatch: false,
      holdReason: "human_review_requested",
    });
  });

  it("offers the upload link to a submission stored before capture mode was asked", () => {
    // Visits are retired (2026-11-11): nobody is sent anywhere, so there is no
    // stricter reading to fall back to.
    const decision = decideDispatchForRequest(
      request({ request: { capture_region: "us" } as InboundRequest["request"] }),
      false,
    );
    expect(decision).toMatchObject({ dispatch: true, channel: "self_capture_upload" });
  });

  it("refuses to dispatch a converted outbound request on gates nobody confirmed", () => {
    const decision = decideDispatchForRequest(
      request({ site_task_gate_sources: { sceneStability: "inferred" } }),
      false,
    );
    expect(decision).toMatchObject({ dispatch: false, holdReason: "gates_inferred" });
  });
});

describe("a call is for what a camera cannot answer", () => {
  it("knows which gates footage settles", () => {
    expect(footageSettlesAll(["sceneStability", "taskShape", "objectVariety"])).toBe(true);
    expect(footageSettlesAll(["sceneStability", "accessWindow"])).toBe(false);
    expect(footageSettlesAll(["serviceArea"])).toBe(false);
    // No open questions is not a reason to ask for a video.
    expect(footageSettlesAll([])).toBe(false);
    expect(footageSettlesAll(["somethingWeDoNotKnow"])).toBe(false);
  });
});

describe("the booking link has one home", () => {
  const original = process.env.BLUEPRINT_CALENDLY_URL;

  beforeEach(() => {
    delete process.env.BLUEPRINT_CALENDLY_URL;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.BLUEPRINT_CALENDLY_URL;
    else process.env.BLUEPRINT_CALENDLY_URL = original;
  });

  it("falls back to the published link", () => {
    expect(bookingUrl()).toBe("https://calendly.com/blueprintrobotics/30min");
  });

  it("takes configuration without a redeploy of the copy", () => {
    process.env.BLUEPRINT_CALENDLY_URL = "https://cal.example.test/blueprint";
    expect(bookingUrl()).toBe("https://cal.example.test/blueprint");
  });
});

describe("an outbound reply can actually reach the intake it is meant for", () => {
  it("emits the exact keys intake reads, so a rename cannot silently break the guard", () => {
    // These two ends are joined by a person copying the payload into the intake
    // during the beta, so nothing type-checks the join. If `gateAnswerSources`
    // or `captureMode` were renamed on either side, provenance would simply
    // stop arriving -- and absent provenance reads as operator-stated, which
    // means a guess would start dispatching captures. Silent, and the exact
    // failure the provenance field exists to prevent.
    const payload = convertProspectToRequestPayload({
      prospect: {
        prospectId: "p-1",
        facilityName: "Example DC",
        facilityAddress: "100 Industrial Way",
        contactEmail: "ops@example.com",
        observations: [],
        hypothesisedTask: "Totes to pallets.",
        inferredGates: { sceneStability: "stable" },
        gateAnswerSources: { sceneStability: "inferred" },
        stage: "replied",
        reasonForContact: "Single-shift DC.",
        createdAtIso: "2026-09-16T00:00:00.000Z",
      },
      statedGates: {},
      taskStatement: "Totes to pallets.",
      captureMode: "self_capture",
    });

    // Assigning to the intake payload type is the compile-time half of the
    // check; the runtime half is that the values actually survive the hop.
    const intake: Pick<InboundRequestPayload, "gateAnswerSources" | "captureMode"> = {
      gateAnswerSources: payload.gateAnswerSources,
      captureMode: payload.captureMode,
    };

    expect(intake.gateAnswerSources).toEqual({ sceneStability: "inferred" });
    expect(intake.captureMode).toBe("self_capture");
  });
});

describe("a person is kept where something is actually being committed", () => {
  const qualified = { recommendation: "qualified_ready", confidence: 0.95 };

  it("leaves the shared lane policy alone for every other caller", () => {
    // INBOUND_POLICY stays the conservative default for the lane.
    expect(INBOUND_POLICY.alwaysHumanReview(qualified)).toBe(true);
  });

  it("dispatches a qualified self-capture site now that the prompt stopped flagging it", () => {
    // The end-to-end point of the change: the flag the prompt used to set on
    // every qualified site fed straight into this, so dispatch held for exactly
    // the submissions it exists to serve.
    expect(decideDispatchForRequest(request(), false)).toMatchObject({
      dispatch: true,
      channel: "self_capture_upload",
    });
  });
});
