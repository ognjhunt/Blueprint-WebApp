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

  it("publishes a capturer job only for a visit", () => {
    const decision = decideCaptureDispatch({
      disposition: "qualified",
      captureMode: "site_visit",
      unanswered: [],
    });

    expect(decision).toMatchObject({ dispatch: true, channel: "capturer_visit" });
    expect(publishesCapturerJob(decision)).toBe(true);
  });

  it("holds whenever a person was asked for, whatever the gates said", () => {
    const decision = decideCaptureDispatch({
      disposition: "qualified",
      requiresHumanReview: true,
      captureMode: "self_capture",
    });

    expect(decision).toMatchObject({ dispatch: false, holdReason: "human_review_requested" });
  });

  it("holds on needs_conversation", () => {
    const decision = decideCaptureDispatch({
      disposition: "needs_conversation",
      captureMode: "self_capture",
    });

    expect(decision).toMatchObject({ dispatch: false, holdReason: "needs_conversation" });
  });

  it("holds on not_now", () => {
    expect(
      decideCaptureDispatch({ disposition: "not_now", captureMode: "site_visit" }),
    ).toMatchObject({ dispatch: false, holdReason: "not_qualified" });
  });

  it("holds when a gate is unanswered even if something says qualified", () => {
    const decision = decideCaptureDispatch({
      disposition: "qualified",
      captureMode: "self_capture",
      unanswered: ["sceneStability"],
    });

    expect(decision).toMatchObject({ dispatch: false, holdReason: "gates_incomplete" });
  });

  it("holds rather than assuming a visit when no capture mode was recorded", () => {
    // Defaulting to site_visit here would dispatch a capturer to a site that
    // could be anywhere, which is the one mistake this module must not make.
    const decision = decideCaptureDispatch({ disposition: "qualified", captureMode: null });

    expect(decision).toMatchObject({ dispatch: false, holdReason: "capture_mode_missing" });
  });

  it("rejects an unrecognised capture mode rather than coercing it", () => {
    expect(
      decideCaptureDispatch({ disposition: "qualified", captureMode: "drone" }),
    ).toMatchObject({ dispatch: false, holdReason: "capture_mode_missing" });
  });

  it("describes every outcome for the request trail", () => {
    expect(
      describeCaptureDispatch(
        decideCaptureDispatch({ disposition: "qualified", captureMode: "self_capture" }),
      ),
    ).toContain("no visit required");
    expect(
      describeCaptureDispatch(decideCaptureDispatch({ disposition: "not_now" })),
    ).toContain("held (not_qualified)");
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
      disposition: triage.disposition,
      unanswered: triage.unanswered,
      captureMode: "self_capture",
      requiresHumanReview: false,
    });

    expect(decision).toMatchObject({ dispatch: true, channel: "self_capture_upload" });
  });
});
