// @vitest-environment node
/**
 * The start form's one-line consent (owner, 2026-11-11) is recorded as new statement versions; the server accepts them
 * alongside the versions recorded before, and nothing else.
 */
import { describe, expect, it } from "vitest";

import { hasCurrentDescriptionAuthority } from "../utils/descriptionAuthority";
import { hasCurrentRecordingConsent } from "../utils/recordingConsent";

const grant = (statement_version: string) => ({ granted: true, statement_version, recorded_at_iso: "2026-11-11T10:00:00.000Z" });
const now = Date.parse("2026-11-11T12:00:00.000Z");

describe("the start form's consent versions on the server", () => {
  it("accepts the description authority under v1 and the two one-line versions", () => {
    for (const version of ["2026-10-06.v1", "2026-11-11.v2", "2026-11-11.v3"]) {
      expect(hasCurrentDescriptionAuthority(grant(version), now), version).toBe(true);
    }
    for (const version of ["2026-11-11.v4", "2026-11-02.v2", ""]) {
      expect(hasCurrentDescriptionAuthority(grant(version), now), version).toBe(false);
    }
  });

  it("accepts the recording grant under v1, v2 and the one-line v3", () => {
    for (const version of ["2026-09-18.v1", "2026-11-02.v2", "2026-11-11.v3"]) {
      expect(hasCurrentRecordingConsent(grant(version), now), version).toBe(true);
    }
    for (const version of ["2026-11-11.v2", "2026-10-06.v1", ""]) {
      expect(hasCurrentRecordingConsent(grant(version), now), version).toBe(false);
    }
  });
});
