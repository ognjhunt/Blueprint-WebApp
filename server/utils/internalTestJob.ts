/**
 * Internal test jobs: whole jobs that engineering sessions start through the signed internal route
 * (`server/routes/internal-test-jobs.ts`) from Blueprint's own test footage, to test many kinds of job end to end.
 *
 * The condition they exist under (owner, 2026-11-15; planner): a test job stays internal. It is never listed or
 * shown to a deployment company, and nothing about it is sent to anyone.
 *
 * - The marker is the record's top-level `internal_test` field. It is written once, by the internal route, in the
 *   same create that makes the job, and by nothing else (`server/tests/internal-test-job-marker.test.ts` scans the
 *   code for writers). Any present value counts: a malformed marker still closes the job.
 * - The one company predicate refuses a marked job before any other stop (`teamJobAccess`, `internal_test_job`).
 * - Its recording grant names `internal_test.v1`, a version that is not a public statement and is not in the
 *   sharing list, so the job is not shared even without the marker check. Only a grant the internal route builds
 *   (with `basis: blueprint_internal_test`) is accepted under that version; no form can send that basis.
 * - It has no contact address, so every notice addressed to the site finds no one, and the outbox checks the marker
 *   before every send. Blueprint's own ops notices about it are internal and go as for any job.
 *
 * No person accepted anything for a test job: its footage is Blueprint's own test material.
 */
import type { ConsentAttestationRecord, InboundRequest } from "../types/inbound-request";

export const INTERNAL_TEST_FIELD = "internal_test" as const;

/** The recording grant version of a test job. Not a statement anyone is shown; never offered on a form. */
export const INTERNAL_TEST_RECORDING_STATEMENT_VERSION = "internal_test.v1";

/** What the grant and the Privacy version of a test job rest on: Blueprint's own decision for its own test. */
export const INTERNAL_TEST_BASIS = "blueprint_internal_test" as const;

/** `res.locals` key the internal route sets before it calls the start form's own handler. Server code only. */
export const INTERNAL_TEST_INTAKE_LOCAL = "internalTestIntake";

/** The marker as the internal route writes it. */
export interface InternalTestMarker {
  label: string;
  footage_id: string;
  /** Who asked: the only identity the route can prove is the Pipeline sync signature it verified. */
  created_by: string;
  created_at_iso: string;
}

/** What the internal route hands the start form's handler (`res.locals[INTERNAL_TEST_INTAKE_LOCAL]`). */
export interface InternalTestIntake {
  consentAttestation: ConsentAttestationRecord;
  recordFields: Pick<InboundRequest, "internal_test" | "privacy_version_at_submission">;
}

/** Whether a stored job is an internal test job. Any present marker counts, so a malformed one fails closed. */
export function isInternalTestJob(record: unknown): boolean {
  if (!record || typeof record !== "object") return false;
  const marker = (record as Record<string, unknown>)[INTERNAL_TEST_FIELD];
  return marker !== undefined && marker !== null && marker !== false;
}

/**
 * What a test job's capture rights carry beside the grant version, for the Pipeline (`websiteCaptureRights.ts`):
 * `{ internal_test: { label, footage_id } }`, or nothing for any other job (so no other job's rights or digests change).
 */
export function internalTestRightsMarker(record: unknown): { internal_test?: { label: string | null; footage_id: string | null } } {
  if (!isInternalTestJob(record)) return {};
  const marker = (record as Record<string, any>)[INTERNAL_TEST_FIELD];
  const text = (value: unknown) => typeof value === "string" ? value : null;
  return { internal_test: { label: text(marker?.label), footage_id: text(marker?.footage_id) } };
}

/** A recording grant the internal route built for a test job: the one shape `internal_test.v1` is accepted in. */
export function isInternalTestRecordingGrant(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const grant = value as Record<string, unknown>;
  return grant.granted === true && grant.statement_version === INTERNAL_TEST_RECORDING_STATEMENT_VERSION
    && grant.basis === INTERNAL_TEST_BASIS;
}

type Readable = { collection(name: string): { doc(id: string): any } };

/**
 * Whether the job with this id is an internal test job, read from the store (inside `tx` when given). A missing job
 * is not one. Throws when the read fails, so a caller that decides a send on it keeps the send for a later pass.
 */
export async function loadIsInternalTestJob(store: Readable | null | undefined, requestId: unknown,
  tx?: { get(ref: any): Promise<any> }): Promise<boolean> {
  if (!store || typeof requestId !== "string" || !requestId || requestId.includes("/")) return false;
  const ref = store.collection("inboundRequests").doc(requestId);
  const snapshot = tx ? await tx.get(ref) : await ref.get();
  return isInternalTestJob(snapshot?.data?.());
}
