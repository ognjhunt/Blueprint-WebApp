// @vitest-environment node
import { describe, expect, it } from "vitest";

import { stableIdForExternalReport } from "../utils/gap-closure";
import { listActiveReadinessFindings } from "../utils/launch-readiness";

describe("gap registry helpers", () => {
  it("stableIdForExternalReport respects explicit stable_id", () => {
    expect(
      stableIdForExternalReport({
        stable_id: "external:manual-1",
        source: "ci",
        title: "Build failed",
      }),
    ).toBe("external:manual-1");
  });

  it("stableIdForExternalReport hashes when stable_id omitted", () => {
    const a = stableIdForExternalReport({
      repo: "Blueprint-WebApp",
      failure_family: "webapp_build_failure",
      source: "ci",
      title: "fail",
      detail: "x",
    });
    const b = stableIdForExternalReport({
      repo: "BlueprintPipeline",
      failure_family: "pipeline_build_failure",
      source: "ci",
      title: "fail",
      detail: "y",
    });
    expect(a).toMatch(/^external:[a-f0-9]{24}$/);
    expect(a).not.toBe(b);
  });

  it("listActiveReadinessFindings skips optional checks and automationFlags", () => {
    const snapshot = {
      dependencies: {
        launchChecks: {
          firebaseAdmin: {
            required: true,
            ready: false,
            detail: "Firebase Admin auth/firestore is unavailable.",
          },
          voiceConcierge: {
            required: false,
            ready: false,
            detail: "Voice not configured.",
          },
          automationFlags: { waitlist: true, inbound: false },
        },
      },
    } as unknown as ReturnType<
      typeof import("../utils/launch-readiness").buildLaunchReadinessSnapshot
    >;

    const findings = listActiveReadinessFindings(snapshot);
    expect(findings.map((f) => f.checkKey)).toEqual(["firebaseAdmin"]);
    expect(findings[0]?.stableId).toBe("readiness:firebaseAdmin");
  });
});
