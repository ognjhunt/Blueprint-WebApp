// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null }));

import { hasCurrentRecordingConsent, RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { projectWebsiteCaptureRights } from "../utils/websiteCaptureRights";

const grant = (statement_version: unknown) => ({ granted: true, statement_version, recorded_at_iso: "2026-10-01T00:00:00Z" });

/**
 * A site attests one exact sentence, named by its version. The set is closed:
 * records made under v1 stay valid, v2 is the sentence shown now, and no other
 * version can grant recording rights.
 */
describe("recording consent statement versions", () => {
  it("records new grants under the v2 sentence", () => {
    expect(RECORDING_CONSENT_VERSION).toBe("2026-11-02.v2");
  });

  it.each(["2026-09-18.v1", "2026-11-02.v2"])("accepts a grant attested under %s", version => {
    expect(hasCurrentRecordingConsent(grant(version))).toBe(true);
    expect(projectWebsiteCaptureRights({ request: { consent_attestation: grant(version) } })).toMatchObject({
      derived_scene_generation_allowed: true, consent_status: "granted", statement_version: version,
      consent_scope: ["derived_scene_generation", "robot_evaluation"] });
  });

  it.each(["2026-11-02.v3", "2026-09-18.v2", "2026-11-02.V2", " 2026-11-02.v2", "2026-10-06.v1", "2026-09-24.v1",
    "", null, undefined, 2, ["2026-11-02.v2"]])("refuses a grant attested under %j", version => {
    expect(hasCurrentRecordingConsent(grant(version))).toBe(false);
    expect(projectWebsiteCaptureRights({ request: { consent_attestation: grant(version) } })).toMatchObject({
      derived_scene_generation_allowed: false, consent_status: "unknown", consent_scope: [] });
  });

  it("keeps a withdrawn v2 grant withdrawn", () => {
    expect(hasCurrentRecordingConsent({ ...grant("2026-11-02.v2"), withdrawn_at_iso: "2026-10-02T00:00:00Z" })).toBe(false);
    expect(projectWebsiteCaptureRights({ request: { consent_attestation: { ...grant("2026-11-02.v2"),
      withdrawn_at_iso: "2026-10-02T00:00:00Z" } } })).toMatchObject({ consent_status: "revoked", consent_revoked: true });
  });
});
