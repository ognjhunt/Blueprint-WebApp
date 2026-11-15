// @vitest-environment node
/**
 * The internal test job's marker and its grant (owner, 2026-11-15).
 *
 * - W1: `internal_test` is written once, by the internal route that creates the job, and by nothing else: a scan of the
 *   code for every way a field is written (an object key, a quoted key or update path, the field-name constant).
 * - W2 (the predicate itself): a job that is otherwise fully listed is refused with its own reason, before every
 *   other stop.
 * - W3: the test job's grant version `internal_test.v1` is in no sharing list and on no form, so with the marker check
 *   taken away the job is still not shared; it is accepted as a recording grant only in the shape the route builds.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RECORDING_VERSIONS_THAT_SHARE, teamJobAccess } from "../utils/teamJobAccess";
import { hasCurrentRecordingConsent } from "../utils/recordingConsent";
import { projectWebsiteCaptureRights } from "../utils/websiteCaptureRights";
import { RECORDING_RIGHTS_STATEMENT_VERSIONS } from "../../client/src/lib/recordingRightsStatement";
import { INTERNAL_TEST_RECORDING_STATEMENT_VERSION, isInternalTestJob } from "../utils/internalTestJob";
import { passedPrivacyScreen, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";

const ROOT = path.resolve(__dirname, "../..");
function sources(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "tests" || entry.name === "node_modules" ? [] : sources(relative);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [relative] : [];
  });
}
const code = () => [...sources("server"), ...sources("client/src"), ...sources("scripts")]
  .map(file => ({ file, text: fs.readFileSync(path.join(ROOT, file), "utf8") }));

const ID = "req-marker";
const MARKER = { label: "rigid pick", footage_id: "pexels-854533", created_by: "pipeline_sync_signature",
  created_at_iso: "2026-11-15T12:00:00.000Z" };
/** A job every company would see today: v4 granted, the listing record, the privacy screen passed, a sentence. */
const listed = (extra: Record<string, unknown> = {}) => ({ requestId: ID,
  request: { buyerType: "site_operator", capture_mode: "self_capture", consent_attestation: sharedRecordingGrant() },
  public_task_listing: sharedJobListing(), capture_privacy_screen: passedPrivacyScreen(ID), ...extra });
const BRIEF = { brief: { summary: "Stack cartons onto the pallet", confirmedAtIso: "2026-11-15T12:00:00.000Z" }, preparationState: null };
const INTERNAL_GRANT = { granted: true, statement_version: INTERNAL_TEST_RECORDING_STATEMENT_VERSION,
  recorded_at_iso: "2026-11-15T12:00:00.000Z", basis: "blueprint_internal_test" };

describe("the marker is written once, by the internal route (W1)", () => {
  it("has exactly one writer in the server, the client and the scripts", () => {
    const writes = [
      /\binternal_test\s*:/, // an object key
      /["']internal_test["']\s*[:,\])]/, // a quoted key, an update path or a merge field
      /["']internal_test\.(?!v1["'])[A-Za-z_]+["']/, // a dotted update path into the marker
      /\[\s*INTERNAL_TEST_FIELD\s*\]\s*:/, // the field-name constant as a key
    ];
    const writers = code().filter(({ text }) => writes.some(pattern => pattern.test(text))).map(({ file }) => file);
    // The one writer of the job record's field, and the places that name it in documents that are not the job record:
    // the read-only copy beside the capture rights and in the task context the Pipeline reads (W11), and the
    // `internal_test` permission basis of a company clip or simulation the Pipeline publishes for one.
    const DERIVED = ["server/utils/internalTestJob.ts", "server/utils/websiteTaskContext.ts",
      "server/utils/websiteCompanyClip.ts", "server/utils/websiteCompanySimulation.ts"];
    expect(writers.sort()).toEqual(["server/routes/internal-test-jobs.ts", ...DERIVED].sort());
    // None of those writes to the job record at all.
    for (const { file, text } of code().filter(({ file }) => DERIVED.includes(file)))
      expect(text, file).not.toMatch(/collection\(["']inboundRequests["']\)[^;]*\.(set|update|create)\(/);
  });

  it("is written inside the job's one create, never by an update", () => {
    const route = fs.readFileSync(path.join(ROOT, "server/routes/internal-test-jobs.ts"), "utf8");
    // The route hands it to the start form's handler, which creates the job with an absence precondition.
    expect(route).toMatch(/recordFields: \{ internal_test: marker,/);
    expect(route).not.toMatch(/\.(update|set)\([^)]*internal_test/);
    const intake = fs.readFileSync(path.join(ROOT, "server/routes/inbound-request.ts"), "utf8");
    expect(intake).toMatch(/\.\.\.\(internalTest \? internalTest\.recordFields : \{\}\),/);
    const commit = fs.readFileSync(path.join(ROOT, "server/utils/inboundRequestCommit.ts"), "utf8");
    expect(commit).toMatch(/batch\.create\(requestRef, record\)/);
  });

  it("any present marker counts, so a malformed one still closes the job", () => {
    for (const marker of [MARKER, {}, "x", 1, true]) expect(isInternalTestJob({ internal_test: marker })).toBe(true);
    for (const marker of [undefined, null, false]) expect(isInternalTestJob({ internal_test: marker })).toBe(false);
  });
});

describe("the predicate refuses a test job first (W2)", () => {
  it("lists the job without the marker, and refuses it with the marker, with its own reason", () => {
    expect(teamJobAccess(listed(), BRIEF).listed).toBe(true);
    expect(teamJobAccess(listed({ internal_test: MARKER }), BRIEF))
      .toEqual({ listed: false, evaluationAvailable: false, reason: "internal_test_job", details: null });
  });

  it("refuses it before every other stop", () => {
    const stops: Record<string, unknown>[] = [
      { request: { buyerType: "robot_team" } },
      { debug: { autoCreatedByPipeline: true } },
      { capture_withdrawal: { requestedAtIso: "2026-11-15T13:00:00.000Z" } },
      { operator_listing_hold: { held: true } },
      { evidence_tier: "development_only" },
      { public_task_listing: null },
    ];
    for (const stop of stops) {
      expect(teamJobAccess(listed(stop), BRIEF).reason).not.toBe("internal_test_job");
      expect(teamJobAccess(listed({ ...stop, internal_test: MARKER }), BRIEF).reason).toBe("internal_test_job");
    }
  });
});

describe("the test job's grant shares nothing on its own (W3)", () => {
  it("is in no sharing list and on no form", () => {
    expect(RECORDING_VERSIONS_THAT_SHARE).not.toContain(INTERNAL_TEST_RECORDING_STATEMENT_VERSION);
    expect(RECORDING_RIGHTS_STATEMENT_VERSIONS as readonly string[]).not.toContain(INTERNAL_TEST_RECORDING_STATEMENT_VERSION);
    // Named as a value in one server module only: no page, no copy, no form offers it.
    const naming = code().filter(({ text }) => /["']internal_test\.v1["']/.test(text)).map(({ file }) => file);
    expect(naming).toEqual(["server/utils/internalTestJob.ts"]);
    // The client knows only the admin console's closed reason (`internal_test_job`), never the version or the marker.
    expect(code().filter(({ file, text }) => file.startsWith("client/") && /internal_test(?!_job)/.test(text))
      .map(({ file }) => file)).toEqual([]);
  });

  it("with the marker check taken away, the job is not shared: an older statement", () => {
    const job = listed({ request: { buyerType: "site_operator", capture_mode: "self_capture", consent_attestation: INTERNAL_GRANT } });
    // No marker on this record: only the grant stands between it and every company.
    expect(teamJobAccess(job, BRIEF)).toMatchObject({ listed: false, reason: "older_statement" });
  });

  it("is a recording grant only in the shape the internal route builds", () => {
    expect(hasCurrentRecordingConsent(INTERNAL_GRANT)).toBe(true);
    expect(projectWebsiteCaptureRights({ request: { consent_attestation: INTERNAL_GRANT } }).derived_scene_generation_allowed).toBe(true);
    // What a form could send: the version without the basis, or another basis.
    const { basis: _basis, ...withoutBasis } = INTERNAL_GRANT;
    expect(hasCurrentRecordingConsent(withoutBasis)).toBe(false);
    expect(hasCurrentRecordingConsent({ ...INTERNAL_GRANT, basis: "site" })).toBe(false);
    expect(hasCurrentRecordingConsent({ ...INTERNAL_GRANT, withdrawn_at_iso: "2026-11-15T13:00:00.000Z" })).toBe(false);
  });
});
