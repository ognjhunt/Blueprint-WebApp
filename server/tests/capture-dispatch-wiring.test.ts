// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decideDispatchForRequest } from "../utils/captureUploadAuthorization";
import { bookingUrl } from "../utils/bookingLink";
import { footageSettlesAll } from "../../client/src/data/siteTaskQualification";
import type { InboundRequest, InboundRequestPayload } from "../types/inbound-request";

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

describe("a person is kept where something is actually being committed", () => {
  const qualified = { recommendation: "qualified_ready", confidence: 0.95 };

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

// Restored (review, 2026-11-11): the link-token checks that went with the ended qualification email, now on the one
// function that issues every job link (`captureUploadUrlFor`).
describe("the job link is a real, verifiable credential", () => {
  it("opens exactly the job's own walkthrough prefix, the same one every time, and nothing once altered", async () => {
    const { captureUploadUrlFor, verifyCaptureUploadToken } = await import("../utils/captureUploadToken");
    const tokenOf = (url: string) => url.split("/capture-upload/")[1];
    const first = captureUploadUrlFor("req-1");
    expect(first).toContain("/capture-upload/");
    expect(verifyCaptureUploadToken(tokenOf(first))).toMatchObject({ kind: "capture_upload", requestId: "req-1",
      sceneId: "site-req-1", captureId: "walkthrough-req-1", scope: "owner" });
    // A second link for the same job points at the same prefix, never a new empty capture.
    const second = verifyCaptureUploadToken(tokenOf(captureUploadUrlFor("req-1")));
    expect({ sceneId: second?.sceneId, captureId: second?.captureId }).toEqual({ sceneId: "site-req-1", captureId: "walkthrough-req-1" });
    // A film link carries only the film scope.
    expect(verifyCaptureUploadToken(tokenOf(captureUploadUrlFor("req-1", "film")))).toMatchObject({ scope: "film", captureId: "walkthrough-req-1" });
    // Altered by one character, it opens nothing.
    const token = tokenOf(first);
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(verifyCaptureUploadToken(tampered)).toBeNull();
  });
});
