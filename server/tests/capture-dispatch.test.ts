// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  decideCaptureDispatch,
  describeCaptureDispatch,
  publishesCapturerJob,
} from "../utils/captureDispatch";
import { triageGateAnswers } from "../../client/src/lib/gateTriage";
import {
  defaultCaptureMode,
  gateFields,
  preferredCaptureMode,
} from "../../client/src/data/siteTaskQualification";

/** Every gate answered with its clear option, except the ones overridden. */
function clearAnswers(overrides: Record<string, string> = {}) {
  const answers: Record<string, string> = {};
  for (const field of gateFields) {
    const clear = field.options.find((option) => option.verdict === "clear");
    if (clear) {
      answers[field.id] = clear.value;
    }
  }
  return { ...answers, ...overrides };
}

describe("geography binds a visit, not the site", () => {
  it("blocks a site outside Texas when it wants someone to come", () => {
    const result = triageGateAnswers(
      clearAnswers({ serviceArea: "outside_texas" }),
      gateFields,
      "site_visit",
    );

    expect(result.disposition).toBe("not_now");
    expect(result.blockers.map((b) => b.fieldId)).toContain("serviceArea");
  });

  it("qualifies that same site when it records the walkthrough itself", () => {
    // The whole point. The service area gate is a fact about our driving; when
    // nobody drives, an Ohio warehouse is as evaluable as an Austin one.
    const result = triageGateAnswers(
      clearAnswers({ serviceArea: "outside_texas" }),
      gateFields,
      "self_capture",
    );

    expect(result.disposition).toBe("qualified");
    expect(result.blockers).toHaveLength(0);
  });

  it("does not hold a self-capture submission that simply left service area blank", () => {
    const answers = clearAnswers();
    delete (answers as Record<string, string | undefined>).serviceArea;

    const result = triageGateAnswers(answers, gateFields, "self_capture");

    expect(result.disposition).toBe("qualified");
    expect(result.unanswered).not.toContain("serviceArea");
  });

  it("still blocks a self-capture site on gates about the room", () => {
    // Relaxing geography must not relax anything else. A scene that gets
    // rearranged is just as unevaluable whoever holds the phone.
    const rearranged = gateFields
      .find((field) => field.id === "sceneStability")
      ?.options.find((option) => option.verdict === "blocking");
    expect(rearranged).toBeDefined();

    const result = triageGateAnswers(
      clearAnswers({ sceneStability: rearranged!.value, serviceArea: "outside_texas" }),
      gateFields,
      "self_capture",
    );

    expect(result.disposition).toBe("not_now");
    expect(result.blockers.map((b) => b.fieldId)).toContain("sceneStability");
  });

  it("scores a submission stored before the question existed exactly as before", () => {
    // Defaulting to the stricter mode means no historical record silently
    // becomes eligible because we shipped a new field.
    const withoutMode = triageGateAnswers(clearAnswers({ serviceArea: "texas_other" }), gateFields);
    const asVisit = triageGateAnswers(
      clearAnswers({ serviceArea: "texas_other" }),
      gateFields,
      "site_visit",
    );

    expect(withoutMode.disposition).toBe("not_now");
    expect(withoutMode).toEqual(asVisit);
  });
});

describe("which mode a site is offered first", () => {
  it("offers self-capture by default but still scores a blank record strictly", () => {
    // Two defaults that point opposite ways, on purpose. A new site is offered
    // the path that works everywhere; a stored record with no answer is scored
    // as the visit it would have been, so nothing is relaxed retroactively.
    expect(preferredCaptureMode).toBe("self_capture");
    expect(defaultCaptureMode).toBe("site_visit");
  });
});

describe("dispatching capture without a person", () => {
  it("dispatches a qualified self-capture site to an upload link", () => {
    const decision = decideCaptureDispatch({
      captureRegion: "us",
      disposition: "qualified",
      captureMode: "self_capture",
      unanswered: [],
    });

    expect(decision).toEqual({
      dispatch: true,
      channel: "self_capture_upload",
      captureMode: "self_capture",
    });
    expect(publishesCapturerJob(decision)).toBe(false);
  });

  it("never publishes a capturer job: a stored visit request films itself (visits retired 2026-11-11)", () => {
    for (const disposition of ["qualified", "needs_conversation", "not_now", undefined] as const) {
      const decision = decideCaptureDispatch({
        captureRegion: "us",
        disposition,
        captureMode: "site_visit",
        unanswered: ["sceneStability"],
      });
      expect(decision).toMatchObject({ dispatch: true, channel: "self_capture_upload", captureMode: "self_capture" });
      expect(publishesCapturerJob(decision)).toBe(false);
    }
  });

  it("holds whenever a person was asked for, whatever the gates said", () => {
    const decision = decideCaptureDispatch({
      captureRegion: "us",
      disposition: "qualified",
      requiresHumanReview: true,
      captureMode: "self_capture",
    });

    expect(decision).toMatchObject({ dispatch: false, holdReason: "human_review_requested" });
  });

  /* ------------------------------------------ receiving a video is free */

  it("lets an unscreened site record itself", () => {
    // The asymmetry this module was missing. Every check it makes exists to
    // stop us spending -- a person travelling, a paid reconstruction -- and a
    // site uploading a phone video triggers none of that. Requiring a clean
    // screen first meant a site had to pass a screen before we would accept
    // the one artifact that makes the screen answerable.
    for (const disposition of ["not_now", "needs_conversation", undefined] as const) {
      expect(
        decideCaptureDispatch({ captureRegion: "us", disposition, captureMode: "self_capture" }),
      ).toMatchObject({ dispatch: true, channel: "self_capture_upload" });
    }
  });

  it("lets an unscreened site record with gates it never answered", () => {
    expect(
      decideCaptureDispatch({
        captureRegion: "us",
        disposition: "not_now",
        captureMode: "self_capture",
        unanswered: ["sceneStability", "taskShape", "objectVariety", "accessWindow"],
      }),
    ).toMatchObject({ dispatch: true, channel: "self_capture_upload" });
  });

  it("still refuses a self-capture invitation built on gates nobody stated", () => {
    // Not a cost question, so "this one is free" does not excuse it: inferred
    // gates mean the operator has never spoken to us, and inviting someone to
    // film a site they never asked us about is wrong at any price.
    expect(
      decideCaptureDispatch({
        captureRegion: "us",
        disposition: "qualified",
        captureMode: "self_capture",
        bindingFieldIds: ["sceneStability"],
        gateAnswerSources: { sceneStability: "inferred" },
      }),
    ).toMatchObject({ dispatch: false, holdReason: "gates_inferred" });
  });

  it("still refuses a self-capture invitation a human parked", () => {
    expect(
      decideCaptureDispatch({
        captureRegion: "us",
        disposition: "qualified",
        captureMode: "self_capture",
        requiresHumanReview: true,
      }),
    ).toMatchObject({ dispatch: false, holdReason: "human_review_requested" });
  });

  it("offers the upload link when no capture mode was recorded, or an unknown one", () => {
    // With one way to film there is nothing to assume: nobody is sent anywhere.
    for (const captureMode of [null, "drone"]) {
      expect(
        decideCaptureDispatch({ captureRegion: "us", disposition: "qualified", captureMode }),
      ).toMatchObject({ dispatch: true, channel: "self_capture_upload" });
    }
  });

  it("describes every outcome for the request trail", () => {
    expect(
      describeCaptureDispatch(
        decideCaptureDispatch({ captureRegion: "us", disposition: "qualified", captureMode: "self_capture" }),
      ),
    ).toContain("no visit required");
    expect(
      describeCaptureDispatch(decideCaptureDispatch({ captureRegion: "non_us", disposition: "not_now" })),
    ).toContain("held (capture_region_unapproved)");
  });
});

describe("end to end: the form's verdict is the dispatch decision", () => {
  it("takes an out-of-state self-capture submission from answers to dispatch with nobody involved", () => {
    const triage = triageGateAnswers(
      clearAnswers({ serviceArea: "outside_texas" }),
      gateFields,
      "self_capture",
    );

    const decision = decideCaptureDispatch({
      captureRegion: "us",
      disposition: triage.disposition,
      unanswered: triage.unanswered,
      captureMode: "self_capture",
      requiresHumanReview: false,
    });

    expect(decision).toMatchObject({ dispatch: true, channel: "self_capture_upload" });
  });
});

describe("where we are cleared to collect binds before anything about cost", () => {
  it("refuses to invite an out-of-region site to film, however clean its gates", () => {
    const decision = decideCaptureDispatch({
      disposition: "qualified",
      captureMode: "self_capture",
      unanswered: [],
      captureRegion: "non_us",
    });

    // The rule the old header got wrong. "Self-capture is dispatchable
    // anywhere" conflated where a capturer can drive with where we are cleared
    // to receive footage. The first does not bind an upload. This does.
    expect(decision).toMatchObject({
      dispatch: false,
      holdReason: "capture_region_unapproved",
    });
  });

  it("refuses when nobody recorded a region, rather than assuming the common case", () => {
    const decision = decideCaptureDispatch({
      disposition: "qualified",
      captureMode: "self_capture",
      unanswered: [],
    });

    // Absent is not "probably the US". A capture invitation starts collection,
    // and an unrecorded region means there is no basis to point at.
    expect(decision).toMatchObject({
      dispatch: false,
      holdReason: "capture_region_unknown",
    });
  });

  it("binds a visit too, because the basis does not depend on who holds the phone", () => {
    const decision = decideCaptureDispatch({
      disposition: "qualified",
      captureMode: "site_visit",
      unanswered: [],
      captureRegion: "non_us",
    });

    expect(decision).toMatchObject({
      dispatch: false,
      holdReason: "capture_region_unapproved",
    });
  });

  it("still lets a human-review request and inferred gates answer first", () => {
    // Order matters for what an operator is told to do. A site nobody has
    // spoken to should read as "confirm the gates", not as "check the region".
    expect(
      decideCaptureDispatch({
        disposition: "qualified",
        captureMode: "self_capture",
        requiresHumanReview: true,
        captureRegion: "non_us",
      }),
    ).toMatchObject({ dispatch: false, holdReason: "human_review_requested" });

    expect(
      decideCaptureDispatch({
        disposition: "qualified",
        captureMode: "self_capture",
        bindingFieldIds: ["sceneStability"],
        gateAnswerSources: { sceneStability: "inferred" },
        captureRegion: "non_us",
      }),
    ).toMatchObject({ dispatch: false, holdReason: "gates_inferred" });
  });

  it("dispatches once the region is one we are cleared for", () => {
    expect(
      decideCaptureDispatch({
        disposition: "qualified",
        captureMode: "self_capture",
        unanswered: [],
        captureRegion: "us",
      }),
    ).toMatchObject({ dispatch: true, channel: "self_capture_upload" });
  });
});
