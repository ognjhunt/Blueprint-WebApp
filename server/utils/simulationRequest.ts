/**
 * The simulation on request (owner, 2026-11-28): the simulation of the site is built only when an approved deployment
 * company asks for it on that job. A video is still required to post a job; everything else about a job is unchanged,
 * and the sound-free clip reaches companies as promptly as before (the Pipeline makes it with no grant and no paid step).
 *
 * - **Which jobs.** A job created from this change on carries `SIMULATION_ON_REQUEST_FIELD` (`simulation_on_request:
 *   true`), written once in the create that makes it (`inbound-request.ts`), for a site's job and an internal test job
 *   alike. It is never set on, or removed from, an existing job: the field is projected into the sealed task context
 *   (`websiteTaskContext.ts`, `simulation_on_request: true` at the top level), so adding or removing it would change the
 *   context's digest and the Pipeline would refuse the job's grant and preparation. A job without it builds at once, as
 *   before, and its pages keep their words. The Pipeline makes only a job whose context says so wait
 *   (`BlueprintCapturePipeline/src/blueprint_pipeline/website_simulation_request.py`).
 * - **The request.** A company's "Ask for a simulation" press (`askForSimulation`, route
 *   `POST /api/site-worlds/jobs/:taskId/simulation-request`) writes, in one transaction, its row
 *   `inboundRequests/{id}/simulationRequests/{companyId}`, the job's summary `SIMULATION_REQUEST_FIELD` and, on the first
 *   request only, the push (`SIMULATION_REQUEST_PUSH_FIELD`). One request builds it for every company: a later press
 *   records its row and is told the simulation was already asked for. An internal test job asks for its own at creation
 *   unless the door says `simulation: "on_request"` (`recordInternalTestSimulationRequest`).
 * - **The push.** `deliverSimulationRequestPush` sends the Pipeline's signed route
 *   `POST /api/live-pipeline/website-simulation-requests/{capture_id}` with exactly five keys (`simulationRequestPushBody`):
 *   the job, its scene, the digest of the job's first request row, who asked (`company` or `internal_test`) and when. No
 *   company name, no person and no free text leaves this repo. The queue is the job-evidence bridge's pattern
 *   (`jobEvidenceForwardWorker.ts`): a lease, a backoff, and a due time on the job that a single-field query finds; it runs
 *   in the same worker lane loop (`taskEvaluationLaunchForwardWorker.ts`). `202` ends it; `capture_unknown` (also before
 *   the hand-off has kept the capture) and any other answer try again later; `capture_withdrawn` and `invalid` stop it.
 * - **The grant window (a rights question for the owner).** The job's scene grant is issued at upload and runs at most
 *   seven days from then (`websiteJobWindow.ts`); the Pipeline refuses a grant stretched past that, and a build that meets
 *   an expired grant gets `consent_expired`, which ends the job. Nothing here creates, widens or extends a grant: the one
 *   renewal path (`renewExpiredWebsiteSceneSponsorship`) was removed on 2026-11-23 ("No person re-issues an expired grant
 *   any more"; `site-assessment-preparation.test.ts` pins its absence), and the owner's time-only extension is a door step
 *   for a scene intake, not a company's press. So a request is recorded and pushed only while the job's grant still has
 *   `SIMULATION_BUILD_MIN_REMAINING_SECONDS` to run (or the job has no grant yet, so the one the Pipeline issues at the
 *   hand-off is new). Past that the press is refused with one plain sentence, the company's page offers no button and
 *   says there is no simulation, and the site's page says none will be built. A queued push re-checks the same before
 *   every try and stops rather than send a request that would end the job.
 * - **Withdrawal.** A withdrawn job is not listed, so the press is refused; a queued push stops on a withdrawal before it
 *   sends anything, and the Pipeline refuses one for a withdrawn capture.
 */
import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";
import { recordedWebsiteJobNoGrantEnding } from "./websiteJobWindowEnding";
import { SIMULATION_ON_REQUEST_FIELD, SIMULATION_ALREADY_ASKED, SIMULATION_ASKED, SIMULATION_ASK_NOT_SHARED, SIMULATION_CANNOT_BE_ASKED,
  SIMULATION_NOT_ON_REQUEST, SIMULATION_ON_REQUEST_COMPANY, simulationAskedLine, type CompanySimulationRequest }
  from "../../client/src/lib/simulationRequest";
import { SIMULATION_STATUS } from "../../client/src/lib/companyJobPage";
import type { LibraryJobStage } from "../../client/src/types/taskBrowse";

export { SIMULATION_ON_REQUEST_FIELD };
/** On the job record: the first request, and how many companies have asked. */
export const SIMULATION_REQUEST_FIELD = "simulation_request";
/** On the job record: the push of the first request to the Pipeline. */
export const SIMULATION_REQUEST_PUSH_FIELD = "simulation_request_push";
/** Top-level number, so a single-field range query (automatic index) finds a push that is due; `Number.MAX_SAFE_INTEGER`
 * once none is (the job-evidence bridge's convention). */
export const SIMULATION_REQUEST_PUSH_DUE_FIELD = "simulation_request_push_next_at_ms";
/** `inboundRequests/{id}/simulationRequests/{companyId}`: one row per company that asked. */
export const SIMULATION_REQUESTS_COLLECTION = "simulationRequests";
/** The row id of an internal test job's own request at creation (never a company id, which is 64 hex). */
export const INTERNAL_TEST_SIMULATION_REQUEST_ROW = "blueprint_internal_test";

/**
 * How long the job's grant must still run for a request to be recorded and pushed: the room the build is given before
 * the grant ends. Blueprint's choice, for the owner to review: no record says how long a build takes, and a build that
 * meets the grant's end ends the job (`consent_expired`), so it is set well inside the seven-day window.
 */
export const SIMULATION_BUILD_MIN_REMAINING_SECONDS = 3 * 86400;

const PUSH_LEASE_MS = 90_000;
const PUSH_TIMEOUT_MS = 10_000;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const COMPANY_ID = /^[a-f0-9]{64}$/;

/** Who asked, as the Pipeline's body names it: a company's press, or an internal test job's own request at creation. */
export const INTERNAL_TEST_SOURCE = "internal_test" as const;
export type SimulationRequestSource = "company" | typeof INTERNAL_TEST_SOURCE;

/** The job's summary of its requests. */
export interface StoredSimulationRequest {
  schema_version: "simulation_request.v1";
  first_requested_at_iso: string;
  /** The id of the first row (`SIMULATION_REQUESTS_COLLECTION`): the row `request_digest` is over. */
  first_row_id: string;
  source: SimulationRequestSource;
  request_digest: string;
  count: number;
}

/** One company's request (or the internal test job's own). */
export interface SimulationRequestRow {
  schema_version: "simulation_request_row.v1";
  request_id: string;
  row_id: string;
  source: SimulationRequestSource;
  capture_id: string;
  requested_at_iso: string;
}

/** The push's state on the job. */
export interface SimulationRequestPush {
  schema_version: "simulation_request_push.v1";
  state: "pending" | "delivered" | "stopped";
  attempts: number;
  lease_id: string | null;
  lease_until_ms: number;
  /** The last answer, as a code: `recorded`, `already_recorded`, `capture_unknown`, `http_<status>`, `not_configured`, ... */
  last_result: string | null;
  delivered_at_iso?: string;
  stopped_reason?: string;
}

/** Whether this job's simulation is built only on request: the field written at its creation, nothing else. */
export const simulationOnRequest = (record: Record<string, any> | null | undefined): boolean =>
  record?.[SIMULATION_ON_REQUEST_FIELD] === true;

/** The job's summary of its requests, or null when none was made (or it does not read). */
export function storedSimulationRequest(record: Record<string, any> | null | undefined): StoredSimulationRequest | null {
  const value = record?.[SIMULATION_REQUEST_FIELD];
  return value && value.schema_version === "simulation_request.v1" && typeof value.first_requested_at_iso === "string"
    && Number.isFinite(Date.parse(value.first_requested_at_iso)) && typeof value.first_row_id === "string"
    && (value.source === "company" || value.source === INTERNAL_TEST_SOURCE)
    && typeof value.request_digest === "string" && /^sha256:[0-9a-f]{64}$/.test(value.request_digest) ? value : null;
}

/** The push's state on the job, or null. */
export function storedSimulationRequestPush(record: Record<string, any> | null | undefined): SimulationRequestPush | null {
  const value = record?.[SIMULATION_REQUEST_PUSH_FIELD];
  return value && value.schema_version === "simulation_request_push.v1"
    && ["pending", "delivered", "stopped"].includes(value.state) ? value : null;
}

/** The digest of a request row, the `request_digest` the Pipeline keeps: sha256 over the row's canonical JSON. */
export const simulationRequestRowDigest = (row: SimulationRequestRow): string => crossRuntimeDigest(row);

const withdrawn = (record: Record<string, any>) => Boolean(record.capture_withdrawal)
  || projectWebsiteCaptureRights(record).consent_revoked;

/**
 * Whether the job's grant still covers a build started now: no grant yet (the Pipeline issues one at the hand-off, new,
 * so a request it records before then builds under a fresh window), or a grant for this job that still runs for at least
 * `SIMULATION_BUILD_MIN_REMAINING_SECONDS`. A job whose wait for a grant has ended (`websiteJobWindowSweep`) is not
 * covered. Never creates, widens or extends a grant.
 */
export function grantCoversSimulationBuild(record: Record<string, any>, requestId: string, nowEpoch = Date.now() / 1000): boolean {
  const grant = record.website_scene_sponsorship;
  if (!grant) return !recordedWebsiteJobNoGrantEnding(record, requestId);
  return grant.request_id === requestId && typeof grant.expires_at_epoch === "number" && Number.isFinite(grant.expires_at_epoch)
    && grant.expires_at_epoch - nowEpoch >= SIMULATION_BUILD_MIN_REMAINING_SECONDS;
}

/**
 * Where a job stands on its simulation request:
 * - `not_on_request`: a job created before this change (or one whose simulation is otherwise built at once);
 * - `can_ask`: no request yet, and the job's grant covers a build;
 * - `asked`: a request is recorded and its push has not stopped;
 * - `cannot_ask`: no request can be built for now (the grant's window is past the room a build needs, or the push of the
 *   request stopped). The pages say no simulation will be built.
 */
export type SimulationRequestState = "not_on_request" | "can_ask" | "asked" | "cannot_ask";
export function simulationRequestState(record: Record<string, any> | null | undefined, requestId: string,
  nowEpoch = Date.now() / 1000): SimulationRequestState {
  if (!record || !simulationOnRequest(record)) return "not_on_request";
  if (storedSimulationRequest(record)) return storedSimulationRequestPush(record)?.state === "stopped" ? "cannot_ask" : "asked";
  return grantCoversSimulationBuild(record, requestId, nowEpoch) ? "can_ask" : "cannot_ask";
}

/**
 * The company page's line about the simulation while neither its viewer nor its download is ready, and the request part
 * that offers the button. A job whose simulation is not on request keeps `SIMULATION_STATUS[stage]` exactly; so does a
 * job on request once its simulation is built or has ended (`simulation_built`, `no_simulation`).
 */
export function companySimulationStatus(record: Record<string, any> | null | undefined, requestId: string,
  stage: LibraryJobStage | null, nowEpoch = Date.now() / 1000): { simulationStatus: string; simulationRequest?: CompanySimulationRequest } {
  const state = simulationRequestState(record, requestId, nowEpoch);
  const settled = stage === "simulation_built" || stage === "no_simulation";
  if (state === "not_on_request" || settled) return { simulationStatus: SIMULATION_STATUS[stage ?? "unknown"] };
  if (state === "asked") return { simulationStatus: simulationAskedLine(storedSimulationRequest(record)!.first_requested_at_iso),
    simulationRequest: { state: "asked", askedAtIso: storedSimulationRequest(record)!.first_requested_at_iso } };
  if (state === "can_ask") return { simulationStatus: SIMULATION_ON_REQUEST_COMPANY, simulationRequest: { state: "can_ask" } };
  return { simulationStatus: SIMULATION_STATUS.no_simulation };
}

/** The body the Pipeline's route takes, exactly its five keys. */
export function simulationRequestPushBody(requestId: string, summary: StoredSimulationRequest) {
  return { request_id: requestId, scene_id: `site-${requestId}`, request_digest: summary.request_digest,
    source: summary.source, requested_at_epoch: Math.floor(Date.parse(summary.first_requested_at_iso) / 1000) };
}

/**
 * The writes of a new request, planned from the job as the transaction read it: the row (when this company has none),
 * the summary, and, for the first request only, the push, due now. Pure; the caller writes them.
 */
function planRequest(record: Record<string, any>, requestId: string, rowId: string, source: SimulationRequestSource,
  prior: Record<string, any> | undefined, nowMs: number) {
  const atIso = new Date(nowMs).toISOString();
  const row: SimulationRequestRow = { schema_version: "simulation_request_row.v1", request_id: requestId, row_id: rowId, source,
    capture_id: siteWalkthroughIdentity(requestId, record).captureId, requested_at_iso: atIso };
  const summary = storedSimulationRequest(record);
  if (summary) return { first: false, row: prior ? null : row, job: prior ? null : { [SIMULATION_REQUEST_FIELD]: {
    ...summary, count: (Number(summary.count) || 1) + 1 } }, summary };
  const created: StoredSimulationRequest = { schema_version: "simulation_request.v1", first_requested_at_iso: atIso,
    first_row_id: rowId, source, request_digest: simulationRequestRowDigest(row), count: 1 };
  const push: SimulationRequestPush = { schema_version: "simulation_request_push.v1", state: "pending", attempts: 0,
    lease_id: null, lease_until_ms: 0, last_result: null };
  return { first: true, row, job: { [SIMULATION_REQUEST_FIELD]: created, [SIMULATION_REQUEST_PUSH_FIELD]: push,
    [SIMULATION_REQUEST_PUSH_DUE_FIELD]: nowMs }, summary: created };
}

export type AskForSimulationResult =
  | { ok: true; already: boolean; askedAtIso: string; message: string }
  | { ok: false; status: 409; error: string };

/**
 * A company's press on a job's page. The caller checked the company as the answer route does (approved, not a
 * technology partner, current Terms; or Blueprint's internal test company on an internal test job); the transaction
 * checks it again with the whole sharing rule (`loadCompanyJobAccess`), so a withdrawn or unlisted job is refused.
 * Idempotent: a second press by the same company writes nothing.
 */
export async function askForSimulation(input: { taskId: string; companyId: string; internalTestCompany: boolean; nowMs?: number }):
  Promise<AskForSimulationResult> {
  if (!db) throw new Error("simulation_request_store_unavailable");
  const store = db;
  const { taskId, companyId } = input;
  if (!ID.test(taskId) || !COMPANY_ID.test(companyId)) return { ok: false, status: 409, error: SIMULATION_ASK_NOT_SHARED };
  const [{ loadCompanyJobAccess }, { companyMaySeeJobs }, { isInternalTestCompanyRow }] = await Promise.all([
    import("./teamJobAccess"), import("./companyTerms"), import("./internalTestCompany")]);
  const options = input.internalTestCompany ? { internalTestCompany: true } : undefined;
  const nowMs = input.nowMs ?? Date.now();
  const jobRef = store.collection("inboundRequests").doc(taskId);
  const result = await store.runTransaction(async (tx): Promise<AskForSimulationResult & { first?: boolean }> => {
    const { record, access } = await loadCompanyJobAccess(taskId, undefined, tx, options);
    const company = (await tx.get(store.collection("robotTeamAccess").doc(companyId))).data();
    const mayAct = input.internalTestCompany ? isInternalTestCompanyRow(companyId, company) : companyMaySeeJobs(company as never);
    if (!record || !access.listed || !mayAct || withdrawn(record)) return { ok: false, status: 409, error: SIMULATION_ASK_NOT_SHARED };
    if (!simulationOnRequest(record)) return { ok: false, status: 409, error: SIMULATION_NOT_ON_REQUEST };
    const state = simulationRequestState(record, taskId, nowMs / 1000);
    if (state === "cannot_ask") return { ok: false, status: 409, error: SIMULATION_CANNOT_BE_ASKED };
    const rowRef = jobRef.collection(SIMULATION_REQUESTS_COLLECTION).doc(companyId);
    const prior = (await tx.get(rowRef)).data();
    const plan = planRequest(record, taskId, companyId, "company", prior, nowMs);
    if (plan.row) tx.create(rowRef, plan.row);
    if (plan.job) tx.update(jobRef, plan.job);
    return { ok: true, already: !plan.first, first: plan.first, askedAtIso: plan.summary.first_requested_at_iso,
      message: plan.first ? SIMULATION_ASKED : SIMULATION_ALREADY_ASKED };
  });
  if (result.ok && result.first) pushSoon(taskId);
  if (result.ok) return { ok: true, already: result.already, askedAtIso: result.askedAtIso, message: result.message };
  return result;
}

/**
 * An internal test job asks for its own simulation when it is made (the door's `simulation` absent or `"now"`), so the
 * full path still runs for operators: an `internal_test` request, and the same push (which meets `capture_unknown` until
 * the hand-off lands, and tries again). Only for an internal test job that carries the field, once; a job past the room
 * its grant leaves for a build records nothing. Returns whether a request is now on record.
 */
export async function recordInternalTestSimulationRequest(requestId: string, nowMs = Date.now()): Promise<boolean> {
  if (!db) throw new Error("simulation_request_store_unavailable");
  const store = db;
  const { isInternalTestJob } = await import("./internalTestJob");
  const jobRef = store.collection("inboundRequests").doc(requestId);
  const first = await store.runTransaction(async tx => {
    const record = (await tx.get(jobRef)).data();
    if (!record || !isInternalTestJob(record) || !simulationOnRequest(record) || withdrawn(record)) return null;
    if (storedSimulationRequest(record)) return false;
    if (!grantCoversSimulationBuild(record, requestId, nowMs / 1000)) return null;
    const rowRef = jobRef.collection(SIMULATION_REQUESTS_COLLECTION).doc(INTERNAL_TEST_SIMULATION_REQUEST_ROW);
    const plan = planRequest(record, requestId, INTERNAL_TEST_SIMULATION_REQUEST_ROW, INTERNAL_TEST_SOURCE, (await tx.get(rowRef)).data(), nowMs);
    if (plan.row) tx.set(rowRef, plan.row);
    if (plan.job) tx.update(jobRef, plan.job);
    return true;
  });
  if (first) pushSoon(requestId);
  return first !== null;
}

const isPullRequestPreview = () => process.env.IS_PULL_REQUEST?.trim().toLowerCase() === "true";

/** One try now, without waiting; the queue tries again if it does not land. */
function pushSoon(requestId: string) {
  void deliverSimulationRequestPush(requestId).catch(error =>
    logger.warn({ error, requestId }, "The simulation request was not pushed yet; the queue will try again"));
}

/** The next try's delay: the job-evidence bridge's backoff (30 s doubling, at most 15 minutes). */
export const simulationRequestRetryDelayMs = (attempts: number) => Math.min(900_000, 30_000 * 2 ** Math.min(Math.max(attempts - 1, 0), 5));

type Fetch = (url: string | URL, init: RequestInit) => Promise<{ status: number; text(): Promise<string> }>;

/** What one try's answer means: `delivered`, `retry` or `stop`, with its code. */
export function simulationRequestAnswer(status: number | null, detail: string | null): { outcome: "delivered" | "retry" | "stop"; code: string } {
  if (status === 202) return { outcome: "delivered", code: detail === "already_recorded" ? "already_recorded" : "recorded" };
  if (status === 404 && detail === "capture_withdrawn") return { outcome: "stop", code: "capture_withdrawn" };
  if (status === 404 && detail === "capture_unknown") return { outcome: "retry", code: "capture_unknown" };
  if (status === 400) return { outcome: "stop", code: "invalid" };
  return { outcome: "retry", code: status === null ? "unreachable" : `http_${status}` };
}

/**
 * One try of a job's push, under a lease. Re-checks the job first: a withdrawal, or a grant that no longer covers a build,
 * stops it before anything is sent. Never throws for an answer; returns what happened.
 */
export async function deliverSimulationRequestPush(requestId: string, options: { fetch?: Fetch; nowMs?: number } = {}):
  Promise<"delivered" | "retry" | "stopped" | "skipped"> {
  if (!db || isPullRequestPreview()) return "skipped";
  const store = db;
  const now = options.nowMs ?? Date.now();
  const jobRef = store.collection("inboundRequests").doc(requestId);
  const lease = randomUUID();
  const claimed = await store.runTransaction(async tx => {
    const record = (await tx.get(jobRef)).data();
    const push = storedSimulationRequestPush(record);
    if (!record || push?.state !== "pending" || Number(record[SIMULATION_REQUEST_PUSH_DUE_FIELD]) > now
      || push.lease_until_ms > now) return null;
    tx.update(jobRef, { [SIMULATION_REQUEST_PUSH_FIELD]: { ...push, attempts: push.attempts + 1, lease_id: lease,
      lease_until_ms: now + PUSH_LEASE_MS }, [SIMULATION_REQUEST_PUSH_DUE_FIELD]: now + PUSH_LEASE_MS });
    return { record, push: { ...push, attempts: push.attempts + 1 } };
  });
  if (!claimed) return "skipped";
  const { record, push } = claimed;
  const summary = storedSimulationRequest(record);
  let outcome: "delivered" | "retry" | "stop", code: string;
  if (!summary) ({ outcome, code } = { outcome: "stop", code: "invalid" });
  else if (withdrawn(record)) ({ outcome, code } = { outcome: "stop", code: "withdrawn" });
  else if (!grantCoversSimulationBuild(record, requestId, now / 1000)) ({ outcome, code } = { outcome: "stop", code: "grant_window_passed" });
  else {
    const captureId = siteWalkthroughIdentity(requestId, record).captureId;
    const body = JSON.stringify(simulationRequestPushBody(requestId, summary));
    const signed = ID.test(captureId) ? signedWebsitePipelineRequest(
      `/api/live-pipeline/website-simulation-requests/${encodeURIComponent(captureId)}`, body) : null;
    if (!signed) ({ outcome, code } = { outcome: "retry", code: "not_configured" });
    else {
      let status: number | null = null, detail: string | null = null;
      try {
        const response = await (options.fetch ?? (fetch as unknown as Fetch))(signed.url, { method: "POST",
          headers: { ...signed.headers, "content-type": "application/json" }, body, redirect: "error",
          signal: AbortSignal.timeout(PUSH_TIMEOUT_MS) });
        status = response.status;
        const parsed = await response.text().then(text => JSON.parse(text)).catch(() => null);
        detail = typeof parsed?.status === "string" ? parsed.status : typeof parsed?.detail === "string" ? parsed.detail : null;
      } catch { status = null; }
      ({ outcome, code } = simulationRequestAnswer(status, detail));
    }
  }
  const next: SimulationRequestPush = { ...push, lease_id: null, lease_until_ms: 0, last_result: code,
    state: outcome === "delivered" ? "delivered" : outcome === "stop" ? "stopped" : "pending",
    ...(outcome === "delivered" ? { delivered_at_iso: new Date(now).toISOString() } : {}),
    ...(outcome === "stop" ? { stopped_reason: code } : {}) };
  const due = outcome === "retry" ? now + simulationRequestRetryDelayMs(push.attempts) : Number.MAX_SAFE_INTEGER;
  const written = await store.runTransaction(async tx => {
    const current = storedSimulationRequestPush((await tx.get(jobRef)).data());
    if (current?.lease_id !== lease) return false;
    tx.update(jobRef, { [SIMULATION_REQUEST_PUSH_FIELD]: next, [SIMULATION_REQUEST_PUSH_DUE_FIELD]: due });
    return true;
  });
  if (!written) return "skipped";
  if (outcome !== "delivered") logger.info({ requestId, result: code, outcome }, "A simulation request push did not land");
  return outcome === "delivered" ? "delivered" : outcome === "stop" ? "stopped" : "retry";
}

/** One pass over the jobs whose push is due (a single-field range query on the job; no composite index). */
export async function processSimulationRequestPushQueue(limit = 10, options: { fetch?: Fetch; nowMs?: number } = {}):
  Promise<{ processed: number }> {
  if (!db || isPullRequestPreview()) return { processed: 0 };
  const now = options.nowMs ?? Date.now();
  const due = await db.collection("inboundRequests").where(SIMULATION_REQUEST_PUSH_DUE_FIELD, "<=", now).limit(limit).get();
  let processed = 0;
  for (const job of due.docs) {
    try {
      if (await deliverSimulationRequestPush(job.id, options) !== "skipped") processed += 1;
    } catch (error) {
      logger.warn({ error, requestId: job.id }, "A simulation request push could not be tried; the next pass tries again");
    }
  }
  return { processed };
}
