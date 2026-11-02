/**
 * The recording-rights sentence a site attests before Blueprint takes its
 * video, quoted verbatim where it is attested: next to the Start button when a
 * job starts with footage (SiteCaptureStart), and as the recording-permission
 * checkbox label on the private job link (SelfCaptureUpload).
 *
 * It restates the recording-authority clause of the Terms in force
 * (2026-11-02.1, section 3: "authorized to record the site and to let Blueprint
 * use the recording as these Terms describe") with the uses those Terms
 * describe, and adds no promise of its own. The anonymized job card has its
 * own Terms clause and is not part of this grant.
 *
 * A stored attestation names the exact sentence the site saw: changing a word
 * means a new version, added to the closed set below.
 */
export const RECORDING_RIGHTS_STATEMENT_VERSION = "2026-11-02.v2";
export const RECORDING_RIGHTS_STATEMENT =
  "I am authorized to record this site and to let Blueprint use the recording to draft the job brief, "
  + "build a simulation of the work area and run candidate robot policies in it.";

/**
 * Every version a submitted or stored grant may name, and no other. 2026-09-18.v1
 * ("I am authorized to record this site and to let Blueprint use the recording
 * to build a scene robot teams can evaluate against.") stays valid for records
 * made under it and for pages opened before v2. The Pipeline's owner read
 * (`capture_original_owner_observer.py`) accepts the same two.
 */
export const RECORDING_RIGHTS_STATEMENT_VERSIONS = ["2026-09-18.v1", RECORDING_RIGHTS_STATEMENT_VERSION] as const;
export type RecordingRightsStatementVersion = (typeof RECORDING_RIGHTS_STATEMENT_VERSIONS)[number];

export function isRecordingRightsStatementVersion(value: unknown): value is RecordingRightsStatementVersion {
  return typeof value === "string" && (RECORDING_RIGHTS_STATEMENT_VERSIONS as readonly string[]).includes(value);
}
