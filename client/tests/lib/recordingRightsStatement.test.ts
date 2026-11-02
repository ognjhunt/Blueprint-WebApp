import { describe, expect, it } from "vitest";

import {
  RECORDING_RIGHTS_STATEMENT,
  RECORDING_RIGHTS_STATEMENT_VERSION,
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

  it("accepts exactly v1 and v2, so v1 records and older pages stay valid", () => {
    expect(RECORDING_RIGHTS_STATEMENT_VERSIONS).toEqual(["2026-09-18.v1", "2026-11-02.v2"]);
    for (const version of RECORDING_RIGHTS_STATEMENT_VERSIONS) expect(isRecordingRightsStatementVersion(version)).toBe(true);
    for (const other of ["2026-11-02.v3", "2026-09-18.v2", "2026-11-02.V2", " 2026-11-02.v2", "2026-11-02.v2 ", "",
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
    expect(terms).toContain("We rebuild the work area as a simulated scene, run candidate robot policies in that simulation ourselves");
    // Robot teams do not evaluate, and the anonymized job card has its own clause.
    expect(RECORDING_RIGHTS_STATEMENT).not.toMatch(/robot teams?|job card|anonymi[sz]ed|partner|listing/i);
  });
});
