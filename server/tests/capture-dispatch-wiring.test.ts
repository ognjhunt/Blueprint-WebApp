// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createInboundEmailPolicy,
  decideDispatchForRequest,
  nextStepForDispatch,
} from "../agents/workflows";
import { INBOUND_POLICY } from "../agents/action-policies";
import {
  buildLetsTalkEmail,
  buildMatchEmail,
  buildQualificationEmail,
} from "../utils/qualificationEmails";
import { bookingUrl } from "../utils/bookingLink";
import { footageSettlesAll } from "../../client/src/data/siteTaskQualification";
import { verifyCaptureUploadToken } from "../utils/captureUploadToken";
import type { InboundRequest, InboundRequestPayload } from "../types/inbound-request";
import type { MatchSummary } from "../../client/src/lib/robotMatch";
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
    request: { capture_mode: "self_capture" },
    ...overrides,
  } as unknown as InboundRequest;
}

const MATCHES: MatchSummary = { matched: [{}], provisional: [] } as unknown as MatchSummary;

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

  it("holds a submission stored before capture mode was asked, rather than assuming a visit", () => {
    // The stricter reading. Defaulting here would send somebody driving to an
    // address on the strength of a field that was never filled in.
    const decision = decideDispatchForRequest(
      request({ request: {} as InboundRequest["request"] }),
      false,
    );
    expect(decision).toMatchObject({ dispatch: false, holdReason: "capture_mode_missing" });
  });

  it("refuses to dispatch a converted outbound request on gates nobody confirmed", () => {
    const decision = decideDispatchForRequest(
      request({ site_task_gate_sources: { sceneStability: "inferred" } }),
      false,
    );
    expect(decision).toMatchObject({ dispatch: false, holdReason: "gates_inferred" });
  });
});

describe("the link in the email is a real, verifiable credential", () => {
  it("issues a token that opens exactly one capture prefix", () => {
    const step = nextStepForDispatch(request(), {
      dispatch: true,
      channel: "self_capture_upload",
      captureMode: "self_capture",
    });

    expect(step.kind).toBe("self_capture");
    const url = step.kind === "self_capture" ? step.uploadUrl : "";
    expect(url).toContain("/capture-upload/");

    const token = url.split("/capture-upload/")[1];
    const payload = verifyCaptureUploadToken(token);
    expect(payload).toMatchObject({
      kind: "capture_upload",
      requestId: "req-1",
      sceneId: "site-req-1",
      captureId: "walkthrough-req-1",
    });
  });

  it("points a re-run at the same prefix instead of scattering empty captures", () => {
    const first = nextStepForDispatch(request(), {
      dispatch: true,
      channel: "self_capture_upload",
      captureMode: "self_capture",
    });
    const second = nextStepForDispatch(request(), {
      dispatch: true,
      channel: "self_capture_upload",
      captureMode: "self_capture",
    });

    const idsOf = (step: typeof first) => {
      const url = step.kind === "self_capture" ? step.uploadUrl : "";
      const payload = verifyCaptureUploadToken(url.split("/capture-upload/")[1]);
      return { sceneId: payload?.sceneId, captureId: payload?.captureId };
    };

    expect(idsOf(first)).toEqual(idsOf(second));
  });

  it("issues no link at all when the decision was a hold", () => {
    const step = nextStepForDispatch(request(), {
      dispatch: false,
      holdReason: "needs_conversation",
      detail: "marginal",
    });
    expect(step).toEqual({ kind: "held" });
  });
});

describe("the email names the step the system actually took", () => {
  it("sends the upload link instead of asking a qualified site to book a call", () => {
    const email = buildMatchEmail({
      firstName: "Ada",
      siteName: "Durham DC",
      summary: MATCHES,
      nextStep: { kind: "self_capture", uploadUrl: "https://example.test/capture-upload/abc" },
    });

    expect(email.body).toContain("https://example.test/capture-upload/abc");
    expect(email.body).not.toContain("calendly");
    expect(email.body.toLowerCase()).not.toContain("short call");
  });

  it("promises nothing when dispatch held", () => {
    const email = buildMatchEmail({
      firstName: "Ada",
      summary: MATCHES,
      nextStep: { kind: "held" },
    });

    expect(email.body).not.toContain("calendly");
    expect(email.body).not.toContain("capture-upload");
    expect(email.body).toContain("reviewing");
  });

  it("still books a call for callers that pass no decision", () => {
    // Legacy rows and the non-intake paths dispatch nothing, so a booking link
    // remains the honest fallback there.
    const email = buildMatchEmail({ firstName: "Ada", summary: MATCHES });
    expect(email.body).toContain(bookingUrl());
  });

  it("threads the decision through the top-level dispatcher", () => {
    const email = buildQualificationEmail({
      firstName: "Ada",
      triage: QUALIFIED,
      matches: MATCHES,
      nextStep: { kind: "self_capture", uploadUrl: "https://example.test/capture-upload/xyz" },
    });

    expect(email?.variant).toBe("match_found");
    expect(email?.body).toContain("https://example.test/capture-upload/xyz");
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

  it("asks for 45 seconds of video when every open question is about the room", () => {
    const email = buildLetsTalkEmail({
      firstName: "Ada",
      siteName: "Durham DC",
      triage: {
        open_questions: ["How stable is the scene? Mixed — it moves weekly"],
        open_question_field_ids: ["sceneStability"],
        incomplete: false,
      },
    });

    expect(email.body).not.toContain("calendly");
    expect(email.subject).toContain("45 seconds");
    expect(email.body).toContain("45 seconds");
  });

  it("keeps the call when an open question is about the business", () => {
    const email = buildLetsTalkEmail({
      firstName: "Ada",
      triage: {
        open_questions: ["When can we get in? Evenings only"],
        open_question_field_ids: ["accessWindow"],
        incomplete: false,
      },
    });

    expect(email.body).toContain(bookingUrl());
  });

  it("keeps the call for an incomplete submission, whatever the open questions look like", () => {
    // A blank gate is not a marginal answer. Nobody has described the thing we
    // would be asking them to film.
    const email = buildLetsTalkEmail({
      firstName: "Ada",
      triage: {
        open_questions: ["How stable is the scene? Mixed"],
        open_question_field_ids: ["sceneStability"],
        incomplete: true,
      },
    });

    expect(email.body).toContain(bookingUrl());
  });

  it("keeps the call for a row stored before open-question ids existed", () => {
    // Absent means cannot tell, and cannot tell keeps the cheaper mistake.
    const email = buildLetsTalkEmail({
      firstName: "Ada",
      triage: { open_questions: ["How stable is the scene?"], incomplete: false },
    });

    expect(email.body).toContain(bookingUrl());
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
    expect(bookingUrl()).toBe("https://calendly.com/blueprintar/30min");
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
  const SELF_CAPTURE = {
    dispatch: true as const,
    channel: "self_capture_upload" as const,
    captureMode: "self_capture" as const,
  };
  const VISIT = {
    dispatch: true as const,
    channel: "capturer_visit" as const,
    captureMode: "site_visit" as const,
  };
  const qualified = { recommendation: "qualified_ready", confidence: 0.95 };

  it("stops queueing a fixed email that carries a free link", () => {
    // The gate this replaces held every qualified site, which is the one case
    // the whole self-capture path exists for. Nothing is committed here: the
    // link expires and either side can ignore it.
    const policy = createInboundEmailPolicy({ deterministic: true, dispatch: SELF_CAPTURE });

    expect(policy.alwaysHumanReview(qualified)).toBe(false);
    expect(policy.autoApproveCriteria(qualified)).toBe(true);
  });

  it("keeps the person when somebody has to drive", () => {
    const policy = createInboundEmailPolicy({ deterministic: true, dispatch: VISIT });
    expect(policy.alwaysHumanReview(qualified)).toBe(true);
  });

  it("keeps the person when the body is model prose rather than fixed copy", () => {
    // `buyer_follow_up` is written by a model, so the review-the-copy-once
    // argument does not apply to it.
    const policy = createInboundEmailPolicy({ deterministic: false, dispatch: SELF_CAPTURE });
    expect(policy.alwaysHumanReview(qualified)).toBe(true);
  });

  it("never overrides a concern raised upstream", () => {
    const policy = createInboundEmailPolicy({ deterministic: true, dispatch: SELF_CAPTURE });

    expect(policy.alwaysHumanReview({ ...qualified, requires_human_review: true })).toBe(true);
    expect(policy.alwaysHumanReview({ ...qualified, automation_status: "blocked" })).toBe(true);
    expect(policy.alwaysHumanReview({ recommendation: "escalated_to_geometry" })).toBe(true);
    expect(
      policy.autoApproveCriteria({ ...qualified, requires_human_review: true }),
    ).toBe(false);
  });

  it("leaves the shared lane policy alone for every other caller", () => {
    // Only this one email narrows. INBOUND_POLICY stays the conservative
    // default, so nothing else in the lane loosens by accident.
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
