import { describe, expect, it } from "vitest";

import {
  RECORDING_RIGHTS_STATEMENT,
  RECORDING_RIGHTS_STATEMENT_SHORT,
  RECORDING_RIGHTS_STATEMENT_SHORT_VERSION,
  RECORDING_RIGHTS_STATEMENT_V4,
  RECORDING_RIGHTS_STATEMENT_V4_VERSION,
  RECORDING_RIGHTS_STATEMENT_VERSION,
  isSharingRecordingStatementVersion,
  RECORDING_RIGHTS_STATEMENT_VERSIONS,
  isRecordingRightsStatementVersion,
} from "@/lib/recordingRightsStatement";
import { termsSections } from "@/pages/Terms";

/**
 * A stored attestation names the exact sentence the site saw, so the wording
 * and its version move together: changing a word needs a new version.
 */
describe("recording-rights statement", () => {
  it("pins the v2 sentence to its version", () => {
    expect(RECORDING_RIGHTS_STATEMENT_VERSION).toBe("2026-11-02.v2");
    expect(RECORDING_RIGHTS_STATEMENT).toBe(
      "I am authorized to record this site and to let Blueprint use the recording to draft the job brief, "
      + "build a simulation of the work area and run candidate robot policies in it.",
    );
  });

  // The start form's one line under "Send video" (owner, 2026-11-11) is what the site sees where it presses, so it is
  // its own version; the full v2 sentence is one tap away, word for word.
  it("pins the start form's one line to its own version", () => {
    expect(RECORDING_RIGHTS_STATEMENT_SHORT_VERSION).toBe("2026-11-11.v3");
    expect(RECORDING_RIGHTS_STATEMENT_SHORT).toBe(
      "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site.",
    );
  });

  // Sharing is the service (owner, 2026-11-12): one sentence says the job is shared, and only it shares a job.
  it("pins v4, the sentence that shares the job, and only v4 shares it", () => {
    expect(RECORDING_RIGHTS_STATEMENT_V4_VERSION).toBe("2026-11-12.v4");
    expect(RECORDING_RIGHTS_STATEMENT_V4).toBe("By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. "
      + "We share your job, including this video and the simulation we build from it, with robot deployment companies we've approved.");
    expect(isSharingRecordingStatementVersion("2026-11-12.v4")).toBe(true);
    for (const older of ["2026-09-18.v1", "2026-11-02.v2", "2026-11-11.v3", "2026-11-12.v5", "", null]) expect(isSharingRecordingStatementVersion(older)).toBe(false);
  });

  it("accepts exactly v1, v2, the start form's v3 and v4, so older records and pages stay valid", () => {
    expect(RECORDING_RIGHTS_STATEMENT_VERSIONS).toEqual(["2026-09-18.v1", "2026-11-02.v2", "2026-11-11.v3", "2026-11-12.v4"]);
    for (const version of RECORDING_RIGHTS_STATEMENT_VERSIONS) expect(isRecordingRightsStatementVersion(version)).toBe(true);
    for (const other of ["2026-11-02.v3", "2026-11-11.v2", "2026-09-18.v2", "2026-11-02.V2", " 2026-11-02.v2", "2026-11-02.v2 ", "",
      "2026-10-06.v1", "2026-09-24.v1", null, undefined, 2, ["2026-11-02.v2"], { version: "2026-11-02.v2" }]) {
      expect(isRecordingRightsStatementVersion(other)).toBe(false);
    }
  });

  it("restates the recording-authority clause of the Terms in force and adds no promise of its own", () => {
    const terms = termsSections.flatMap(section => [...(section.paragraphs ?? []), ...(section.items ?? [])]).join("\n");
    // The clause the sentence comes from, and the uses the Terms describe.
    expect(terms).toContain("When you start a capture with footage, you confirm that you are authorized to record the site "
      + "and to let Blueprint use the recording as these Terms describe.");
    expect(terms).toContain("to draft the job brief");
    expect(terms).toContain("We rebuild the work area as a simulated scene and, where we can, run openly available robot software in that simulation ourselves");
    // The sharing has its own clause in the Terms (and its own statement, v4); the older sentence names none.
    expect(terms).toContain("Starting a job means we share it with robot deployment companies we've approved");
    expect(RECORDING_RIGHTS_STATEMENT).not.toMatch(/robot teams?|job card|anonymi[sz]ed|partner|listing/i);
  });
});
