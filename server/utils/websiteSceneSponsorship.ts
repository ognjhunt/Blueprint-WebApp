import { websitePreparationCaptureId, websitePreparationRenewal, websitePreparationRevision } from "./websitePreparationRevision";
import { sceneScreenGateEnded } from "./sceneScreenGate";
import { websiteCaptureOwnerUid } from "./websiteCaptureOwner";
import { MULTI_STEP_TASK_HOLD, multiStepTaskHold } from "./siteTaskScope";
import { websiteDevelopmentTestEnvironment } from "./websiteDevelopmentTest";
/** Blueprint funds preparation; capture consent never authorizes a site-owner charge. */
import { z } from "zod";
import { assertWebsiteRunOpen } from "./websiteRunClosure";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { TASK_BRIEFS_COLLECTION, isPlaceholderSummary, type SiteTaskBriefRecord } from "./siteTaskBrief";
import { preparationGrantFollowsBrief, UNNAMED_TASK_GRANT_FIELD } from "./preparationGrantTask";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext, legacySuggestedTaskContextDigest, legacyRoutingTaskContextDigest, preparationGrantContextDigest } from "./websiteTaskContext";
import { crossRuntimeDigest as digest } from "./crossRuntimeCanonical";
import { withTaskEvaluationLaunchStoreTimeout as storeTimeout } from "./taskEvaluationLaunchStore";
import { sceneProviderTerms } from "./taskEvaluationSceneIntake";
import { websiteAtlasRuntimePolicy, atlasAllowanceUsage, resolveWebsiteAtlasGrant, websiteAtlasAutomaticLane,
  websiteAtlasGrantOwner, websiteAtlasGrantPolicy, websiteAtlasSourceVideoIdentity, type AtlasAuxiliaryProvider,
  parseWebsiteAtlasStoredGrant, WEBSITE_ATLAS_STORED_GRANT_MAXIMUM_COST_USD } from "./websiteAtlasAuthorization";
import { triageGateAnswers } from "../../client/src/lib/gateTriage";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import { assertWebsiteCaptureBindingInTransaction, resolveWebsiteCaptureBinding } from "./websiteCaptureBinding";
import { isTaskFamilyStrategy, websiteFamilySourceBinding } from "./taskFamilySceneIntake";
import { isNavigationStrategy, navigationIntakeTask } from "./navigationSceneIntake";
import { websitePreparationAccounting } from "./websitePreparationAccounting";
import { websiteCaptureInferenceAccounting } from "./websiteCaptureInferenceAccounting";
import { checkWebsiteJobCeiling, transactionJobLedgerReader, websiteJobCeiling, websiteJobCeilingSummary,
  websiteJobSpend } from "./websiteJobCeiling";
import { SCENE_EXECUTION_WINDOW_MAX_SECONDS, sponsorshipExecutionWindowUntil,
  sponsorshipWindowIntake } from "./sceneExecutionWindowExtension";
import { WEBSITE_JOB_WINDOW_DEFAULT_SECONDS, WEBSITE_JOB_WINDOW_MAX_SECONDS, WEBSITE_JOB_WINDOW_MIN_SECONDS,
  issuedWebsiteJobWindowSeconds } from "./websiteJobWindow";
import { recordedWebsiteJobNoGrantEnding, recordedWebsiteJobWindowEnding } from "./websiteJobWindowEnding";
import { resolvePrivacyVersion } from "../agents/provider-privacy";

/**
 * The trial statements on the site start form that name a provider and a model
 * (version 2026-09-24.v1, worded in `SiteCaptureStart.tsx`), keyed by the field
 * the accepted statement is stored under on the request, with the model id the
 * statement names. A grant lists in `site_consents` exactly the statements the
 * site accepted. The start form accepts at most one of the two (the intake
 * refuses both together), so a real grant's `site_consents` is `[]`, the Claude
 * entry alone or the Sol entry alone. The issuing checks read the statement
 * version from here. A new statement version needs its own entry here.
 */
export const SITE_CONSENT_STATEMENTS = {
  claude_authoring_consent: { statement_version: "2026-09-24.v1", provider: "anthropic", model: "claude-opus-5-5" },
  sol_agents_api_consent: { statement_version: "2026-09-24.v1", provider: "openai", model: "gpt-6.1-sol" },
} as const;

/** The trial statements this job's site accepted on its start form; empty for a site that accepted neither. */
export function websiteSiteConsents(record: Record<string, any>) {
  return (Object.entries(SITE_CONSENT_STATEMENTS) as Array<[keyof typeof SITE_CONSENT_STATEMENTS,
    (typeof SITE_CONSENT_STATEMENTS)[keyof typeof SITE_CONSENT_STATEMENTS]]>)
    .filter(([field, statement]) => record.request?.[field]?.granted === true
      && record.request[field].statement_version === statement.statement_version)
    .map(([, statement]) => ({ statement_version: statement.statement_version, provider: statement.provider, model: statement.model }));
}

/**
 * The Privacy Policy version the job was submitted under: the `privacy_version_at_submission` the intake wrote once
 * when it created the job (`server/routes/inbound-request.ts`), the field the runtime gate reads. None when it is
 * absent, malformed or a version this service does not know, which the Pipeline reads as an older job. Every job
 * stored before the field existed has none.
 */
export function websiteJobPrivacyPolicyVersion(record: Record<string, any>): string | null {
  const recorded = record.privacy_version_at_submission;
  return typeof recorded === "string" && resolvePrivacyVersion(recorded) === recorded ? recorded : null;
}

function continuationAuthority(authority: Record<string, any>, input: {
  brief: SiteTaskBriefRecord; record: Record<string, any>; inventory?: TaskItemInventoryRecord | null;
  captureId?: string; captureBinding?: Record<string, any>;
}) {
  const context = projectWebsiteTaskContext(input.brief, projectWebsiteCaptureRights(input.record), {
    inventory: input.inventory, captureId: input.captureId, captureBinding: input.captureBinding, purpose: authority.purpose,
    preparationGrantContextDigest: preparationGrantContextDigest(input.record) });
  if (authority.capture_id === context.capture_id && authority.task_context_digest === context.context_digest) return authority;
  const { authority_digest: parentDigest, assessment_preparation_proposal: _legacyProposal, ...retained } = authority;
  const value = { ...retained, capture_id: context.capture_id, task_context_digest: context.context_digest,
    consent: { ...retained.consent, task_confirmed: context.confirmed },
    ...(input.captureBinding ? { continuation_parent_authority_digest: parentDigest } : { assessment_parent_authority_digest: parentDigest }) };
  return { ...value, authority_digest: digest(value) };
}

function routingProjectionMatches(context: ReturnType<typeof projectWebsiteTaskContext>,
  authority: Record<string, any> | undefined) {
  return authority?.purpose === "scene_preparation"
    && authority.task_context_digest !== context.context_digest
    && authority.task_context_digest === legacyRoutingTaskContextDigest(context);
}

const money = z.number().finite().positive().max(1000);
/** The `execution.max_retries` a Website scene intent may carry. 0 is every intent
 * issued before 2026-11-10 (still accepted); 1 lets the Pipeline give a scene whose
 * rented machine was lost mid-run one more attempt, inside the same dollar cap and
 * `max_paid_attempts`. A new grant names 1 (`scene_configuration_max_retries`); the
 * Pipeline builds the intent's request from the grant it signs against, so a grant
 * issued before this names nothing and its request stays 0. */
export const WEBSITE_SCENE_MAX_RETRIES: readonly number[] = [0, 1];
export const WEBSITE_SCENE_CONFIGURATION_MAX_RETRIES = 1;
/**
 * Owner decision 2026-11-10: one hard money stop, the account's monthly limit. A new grant
 * names `automatic_budget_extension: true`, so the job's inner dollar figures (the upstream
 * preparation cap and its Atlas allowance) are its expected budget, not a wall: a reservation
 * the Pipeline asks for, after its own account-limit precheck, is admitted past them with a
 * note, and ops is told once per job and grant. The job ceiling is passed the same way, up to the
 * job's safety limit (owner decision 2026-11-11, `websiteJobSafetyLimitUsd`), which nothing passes
 * (`WEBSITE_JOB_SAFETY_LIMIT_REACHED`). Grant expiry, the
 * per-reservation limit, rights, consent and terms are unchanged. On by default; the
 * non-secret setting `BLUEPRINT_WEBSITE_AUTOMATIC_BUDGET_EXTENSION=false` turns it off for
 * new grants. It is read only when a grant is first issued and is never part of the hashed
 * sponsorship policy, so no grant already issued changes. A grant issued before it names none.
 */
export const WEBSITE_AUTOMATIC_BUDGET_EXTENSION_SETTING = "BLUEPRINT_WEBSITE_AUTOMATIC_BUDGET_EXTENSION";
export function websiteAutomaticBudgetExtensionEnabled() {
  return (process.env[WEBSITE_AUTOMATIC_BUDGET_EXTENSION_SETTING] ?? "").trim().toLowerCase() !== "false";
}
/** The job's retained grant names the extension, verifies, and is still valid at `now`. */
export function automaticBudgetExtensionGrant(grant: Record<string, any> | undefined, validUntil: number | undefined, now: number) {
  if (grant?.automatic_budget_extension !== true || typeof grant.authority_digest !== "string") return false;
  const { authority_digest: retainedDigest, ...payload } = grant;
  return digest(payload) === retainedDigest && (validUntil ?? grant.expires_at_epoch) > now;
}
const OVER_BUDGET_ALERT_COLLECTION = "opsWebsiteJobOverBudgetAlerts";
export const websiteJobOverBudgetAlertId = (requestId: string, sponsorshipDigest: string) =>
  `${requestId}-${sponsorshipDigest.slice(7, 23)}`;
/** Reads (inside the caller's transaction, before its writes) whether this job and grant
 * already have their one over-budget alert, and returns the write that records it if not. */
export async function websiteJobOverBudgetAlert(store: { collection(name: string): any },
  transaction: { get(reference: any): Promise<any>; set(reference: any, value: any): void }, requestId: string,
  overBudget: { sponsorship_digest: string } & Record<string, unknown>, source: Record<string, string>) {
  const alertRef = store.collection(OVER_BUDGET_ALERT_COLLECTION)
    .doc(websiteJobOverBudgetAlertId(requestId, overBudget.sponsorship_digest));
  if ((await transaction.get(alertRef)).exists) return () => {};
  return () => transaction.set(alertRef, { request_id: requestId, sponsorship_digest: overBudget.sponsorship_digest,
    ...source, over_budget: overBudget, delivery: null, next_attempt_at_ms: Date.now(), alerted_at_iso: null });
}
/**
 * Owner decision 2026-11-11: each job has one safety limit (`websiteJobSafetyLimitUsd`), whose only
 * purpose is to stop a bug from burning the month in one job. A build reservation or intake on a grant
 * naming the automatic budget extension that would take the job's counted total past it is refused;
 * every other rule is as before. The refusal keeps the code the Pipeline already reads as the job's
 * ceiling reached (`job_ceiling_reached`) and ends preparation on; a new code would be an unknown
 * refusal to a released Pipeline.
 */
export const WEBSITE_JOB_SAFETY_LIMIT_REACHED = "website_scene_preparation_budget_exhausted";
const SAFETY_LIMIT_REACHED = Symbol("website_job_safety_limit_reached");
/**
 * One ops alert per job and kind, each a job a person needs to look at: `safety_limit`, spend refused at
 * the job's safety limit; `screening_over_safety_limit`, the Pipeline reported testing above it;
 * `screening_job_ceiling`, testing held robots back at the job's limit; `spend_unreadable`, a record the
 * job's spend is counted from cannot be read, so a person needs to look at it.
 */
export const WEBSITE_JOB_ALERT_KINDS = ["safety_limit", "screening_over_safety_limit", "screening_job_ceiling", "spend_unreadable"] as const;
export type WebsiteJobAlertKind = typeof WEBSITE_JOB_ALERT_KINDS[number];
export const websiteJobAlertId = (requestId: string, kind: WebsiteJobAlertKind) => `${requestId}-${kind.replace(/_/g, "-")}`;
export const websiteJobSafetyLimitAlertId = (requestId: string) => websiteJobAlertId(requestId, "safety_limit");
export function websiteJobSafetyLimitRecord(job: { ceiling: { maximum_cost_usd: number; source: string };
  spend: { readable_total_micros: number }; safetyLimitUsd: number }, at: Record<string, string | number>) {
  return { schema_version: "website_job_safety_limit.v1", safety_limit_usd: job.safetyLimitUsd,
    job_ceiling_usd: job.ceiling.maximum_cost_usd, job_ceiling_source: job.ceiling.source,
    // What the records that can be read add up to: the figure the safety limit refused on.
    job_reserved_or_settled_before_usd: job.spend.readable_total_micros / 1_000_000,
    ...at, recorded_at_epoch: Date.now() / 1000 };
}
/** Reads (inside the caller's transaction, before its writes) whether this job already has its one
 * alert of this kind, and returns the write that records it if not. */
export async function websiteJobAlert(store: { collection(name: string): any },
  transaction: { get(reference: any): Promise<any>; set(reference: any, value: any): void }, requestId: string,
  kind: WebsiteJobAlertKind, value: Record<string, unknown>) {
  const alertRef = store.collection(OVER_BUDGET_ALERT_COLLECTION).doc(websiteJobAlertId(requestId, kind));
  if ((await transaction.get(alertRef)).exists) return () => {};
  return () => transaction.set(alertRef, { request_id: requestId, [kind]: value, delivery: null,
    next_attempt_at_ms: Date.now(), alerted_at_iso: null });
}
/** The job's one `spend_unreadable` alert, when any record its spend is counted from cannot be read. */
export async function websiteJobSpendUnreadableAlert(store: { collection(name: string): any },
  transaction: { get(reference: any): Promise<any>; set(reference: any, value: any): void }, requestId: string,
  spend: { unreadable: string[] }, at: Record<string, string>) {
  if (!spend.unreadable.length) return () => {};
  return websiteJobAlert(store, transaction, requestId, "spend_unreadable", { schema_version: "website_job_spend_unreadable.v1",
    records: spend.unreadable.slice(0, 20), record_count: spend.unreadable.length, ...at, recorded_at_epoch: Date.now() / 1000 });
}
export const websiteJobSafetyLimitAlert = (store: { collection(name: string): any },
  transaction: { get(reference: any): Promise<any>; set(reference: any, value: any): void }, requestId: string,
  safetyLimit: Record<string, unknown>) => websiteJobAlert(store, transaction, requestId, "safety_limit", safetyLimit);
const policySchema = z.object({
  owner: z.object({ user_id: z.string().trim().min(1), organization_id: z.string().trim().min(1) }).strict(),
  upstream_max_spend_usd: money,
  native_max_spend_usd: money,
  max_total_spend_usd: money,
  max_paid_attempts: z.number().int().min(1).max(32),
  // The website job window (websiteJobWindow.ts): this grant and its scene intent
  // share one expiry, at most the bound the Pipeline mirrors.
  ttl_seconds: z.number().int().min(WEBSITE_JOB_WINDOW_MIN_SECONDS).max(WEBSITE_JOB_WINDOW_MAX_SECONDS)
    .default(WEBSITE_JOB_WINDOW_DEFAULT_SECONDS),
  provider_terms_reference: z.string().regex(/^sha256:[0-9a-f]{64}$/),
}).strict().refine(p => p.upstream_max_spend_usd + p.native_max_spend_usd <= p.max_total_spend_usd);

const agentsApiPolicySchema = z.object({
  schema_version: z.literal("scene_configuration_agents_api_policy.v1"),
  disclosure_scope: z.literal("task_asset_source_frames_and_metric_envelope"),
  session_retention: z.literal("until_deleted"),
  trace_retention: z.literal("provider_default"),
  region: z.literal("us"),
  budget_policy: z.literal("project_guard_accepted_uncertainty"),
  project_guard_receipt_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  ttl_seconds: z.number().int().min(60).max(1800),
  maximum_review_cycles: z.number().int().min(1).max(3),
}).strict();

function policy() {
  try { return policySchema.parse(JSON.parse(process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON || "null")); }
  catch { throw new Error("website_scene_sponsorship_not_configured"); }
}

/**
 * How long a grant issued now would stay valid: the policy's `ttl_seconds`, or the default window
 * when the policy is not configured (an unconfigured policy is itself one reason no grant is issued).
 * The clock of a job that never received a grant runs this long (`websiteJobWindowSweep`).
 */
export function websiteJobWindowSeconds(): number {
  try { return policy().ttl_seconds; } catch { return WEBSITE_JOB_WINDOW_DEFAULT_SECONDS; }
}

function agentsApiPolicy() {
  try { return agentsApiPolicySchema.parse(JSON.parse(process.env.BLUEPRINT_WEBSITE_AGENTS_API_POLICY_JSON || "null")); }
  catch { throw new Error("website_agents_api_policy_not_configured"); }
}

function agentsApiTaskAuthorized(contextDigest: string) {
  let allowed: unknown;
  try { allowed = JSON.parse(process.env.BLUEPRINT_WEBSITE_AGENTS_API_TASK_DIGESTS || "[]"); }
  catch { return false; }
  return Array.isArray(allowed) && allowed.includes(contextDigest);
}

/**
 * An owner-approved development test may use an exploratory self-captured site
 * without claiming that site is qualified for a robot-team deployment. The
 * allowlist is scoped to the confirmed task context, never to a user or model.
 * Scene stability and access window may stay unknown for this test; that
 * absence remains in triage and bars captured-room or deployment readiness.
 * It is separate from the allowlist for an authored fixture later in the run.
 */
export function developmentTestSiteEligible(record: Record<string, any>) {
  if (record.request?.capture_mode !== "self_capture") return false;
  const gates = record.siteTaskGates;
  if (!gates || typeof gates !== "object" || gates.deploymentTimeline !== "exploratory") return false;
  const verified = triageGateAnswers(gates, undefined, "self_capture");
  const retained = record.site_task_triage;
  const allowedUnknowns = new Set(["sceneStability", "accessWindow"]);
  const unknowns = verified.unanswered;
  return verified.disposition === "not_now"
    && verified.blockers.length === 1
    && verified.blockers[0].fieldId === "deploymentTimeline"
    && verified.openQuestions.length === 0
    && unknowns.every(field => allowedUnknowns.has(field))
    && retained?.disposition === "not_now"
    && retained.blocking_field_ids?.length === 1
    && retained.blocking_field_ids[0] === "deploymentTimeline"
    && retained.open_question_field_ids?.length === 0
    && Array.isArray(retained.unanswered_field_ids)
    && digest(retained.unanswered_field_ids) === digest(unknowns);
}

function developmentTestSiteAuthorized(record: Record<string, any>, contextDigest: string) {
  let allowed: unknown;
  try { allowed = JSON.parse(process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS || "[]"); }
  catch { return false; }
  return Array.isArray(allowed) && allowed.includes(contextDigest)
    && developmentTestSiteEligible(record);
}

/** A job whose description names more than one step is held before any spend, by name: no grant,
 * Atlas allowance, reservation or scene intake is admitted for it, so the Pipeline never narrows it to
 * one move. The site splits the task, or the job stays held. Settling spend already admitted is
 * unaffected. An owner-listed development test site keeps its own authorization. */
export function assertNoMultiStepTaskHold(input: { brief: SiteTaskBriefRecord; record: Record<string, any>;
  inventory?: TaskItemInventoryRecord | null; purpose?: "scene_preparation" }) {
  if (!multiStepTaskHold(input.brief)) return;
  const purpose = "purpose" in input ? input.purpose : retainedWebsiteScenePurpose(input.record) ?? "scene_preparation";
  const context = projectWebsiteTaskContext(input.brief, projectWebsiteCaptureRights(input.record),
    { inventory: input.inventory, purpose, preparationGrantContextDigest: preparationGrantContextDigest(input.record) });
  const retained = input.record.website_scene_sponsorship?.task_context_digest;
  if (!developmentTestSiteAuthorized(input.record, context.context_digest)
    && !(typeof retained === "string" && developmentTestSiteAuthorized(input.record, retained)))
    throw new Error(MULTI_STEP_TASK_HOLD);
}

/** When a retained grant stops being valid: its own expiry, or the verified time-only
 * window of its bound scene intent (sponsorshipExecutionWindowUntil), never past
 * the grant's expiry + 7 days. The grant itself is unchanged. */
export function sponsorshipValidUntil(grant: Record<string, any>, executionWindowUntil?: number): number {
  return executionWindowUntil === undefined ? grant.expires_at_epoch
    : Math.min(Math.max(grant.expires_at_epoch, executionWindowUntil),
      grant.expires_at_epoch + SCENE_EXECUTION_WINDOW_MAX_SECONDS);
}

/**
 * What a job page may say about the time Blueprint is authorized to work on a job: the retained
 * grant's "still valid until", with the owner's one allowed extension when it verifies. Never a
 * guess: no grant, an unreadable extension or a date already past gives no date. `ended` is a
 * passed window while the rights still allow the work, so the end was the window and not the rights.
 * It is what holds today, not a promise that the job stops on that date. `endingRecorded` is the
 * WebApp's own stored ending for this exact grant (`websiteJobWindowSweep`), read only while the
 * window is still past: an extension granted afterwards reopens the job and hides it. A job that never
 * received a grant has no window; `endingRecorded` with `noGrantWaitingOn` is the same sweep's ending
 * for it, read only while the job still has no grant.
 */
export async function websiteJobWorkWindow(record: Record<string, any> | undefined,
  nowEpoch = Date.now() / 1000): Promise<{ untilEpoch: number | null; ended: boolean; endedAtEpoch?: number; endingRecorded?: true;
    noGrantWaitingOn?: "site" | "blueprint"; noGrantReason?: "video_over_ingest_limit" }> {
  const none = { untilEpoch: null, ended: false };
  const grant = record?.website_scene_sponsorship;
  const noGrantEnding = recordedWebsiteJobNoGrantEnding(record);
  if (noGrantEnding) return { ...none, endingRecorded: true, noGrantWaitingOn: noGrantEnding.waiting_on,
    ...(noGrantEnding.reason ? { noGrantReason: noGrantEnding.reason } : {}) };
  if (!grant || typeof grant.expires_at_epoch !== "number" || !Number.isFinite(grant.expires_at_epoch)) return none;
  let executionWindowUntil: number | undefined;
  if (record!.website_scene_sponsorship_execution_window) {
    try {
      executionWindowUntil = sponsorshipExecutionWindowUntil(grant, record,
        await sponsorshipWindowIntake({ get: (ref: any) => ref.get() }, record));
    } catch { return none; }
  }
  const until = sponsorshipValidUntil(grant, executionWindowUntil);
  if (until > nowEpoch) return { untilEpoch: until, ended: false };
  return { untilEpoch: null, ended: projectWebsiteCaptureRights(record).derived_scene_generation_allowed, endedAtEpoch: until,
    ...(recordedWebsiteJobWindowEnding(record) ? { endingRecorded: true as const } : {}) };
}

/**
 * The host asked to read a job's grant, or to reserve spend under it, and the job has none. When the
 * job's no-grant ending is recorded (`websiteJobWindowSweep`), the answer says the job has ended, by
 * that ending: the Pipeline then ends its own preparation as it does for `consent_expired`. Otherwise
 * it is today's `website_scene_sponsorship_missing`. Only answers that never create a grant use it, so a
 * grant issued later (which the ending stops speaking for) still reopens the job.
 */
export const WEBSITE_JOB_NO_GRANT_ENDED_CODE = "website_scene_job_no_grant_ended";
function noGrantRefusal(record: Record<string, any>, requestId: string): Error {
  return new Error(recordedWebsiteJobNoGrantEnding(record, requestId) ? WEBSITE_JOB_NO_GRANT_ENDED_CODE
    : "website_scene_sponsorship_missing");
}

export function websiteSceneSponsorship(input: {
  requestId: string; brief: SiteTaskBriefRecord; record: Record<string, any>; now: number;
  inventory?: TaskItemInventoryRecord | null; captureId?: string; captureBinding?: Record<string, any>;
  purpose?: "scene_preparation"; expected_task_context_digest?: string;
  retainedPolicy?: z.infer<typeof policySchema>; renewal?: SponsorshipRenewal;
  /** A verified time-only extension of the bound scene intent: the non-creating read and
   * native/Marble paid reservations only, never a new grant. */
  executionWindowUntil?: number;
}) {
  const configured = input.retainedPolicy ?? policy();
  const rights = projectWebsiteCaptureRights(input.record);
  if (!rights.derived_scene_generation_allowed) throw new Error("source_revoked");
  if (input.purpose !== undefined && input.purpose !== "scene_preparation") throw new Error("website_scene_sponsorship_changed");
  const preparationOnly = input.purpose === "scene_preparation";
  const sealed = preparationGrantContextDigest(input.record);
  const context = projectWebsiteTaskContext(input.brief, rights, { inventory: input.inventory, purpose: input.purpose,
    preparationGrantContextDigest: sealed });
  const current = projectWebsiteTaskContext(input.brief, rights, { inventory: input.inventory,
    captureId: input.captureId, captureBinding: input.captureBinding, purpose: input.purpose, preparationGrantContextDigest: sealed });
  if (input.expected_task_context_digest !== undefined && input.expected_task_context_digest !== current.context_digest
    || preparationOnly && !input.record.website_scene_sponsorship && input.expected_task_context_digest !== current.context_digest)
    throw new Error("website_task_context_changed");
  // Preparation uses the received, consented source; advisory completion is not admission.
  if (!context.confirmed && !preparationOnly) throw new Error("website_task_context_not_confirmed");
  const previous = input.record.website_scene_sponsorship;
  const sourceContinuation = preparationOnly && input.captureBinding && previous
    && input.captureBinding.original_capture_id === `walkthrough-${input.requestId}`
    && input.captureBinding.capture_id === current.capture_id
    && (previous.source_task_context_digest ?? previous.task_context_digest) === context.context_digest
    && input.captureBinding.lineage?.some((entry: any) => entry.parent?.capture_id === previous.capture_id
      || entry.child?.capture_id === previous.capture_id)
    && previous.consent?.rights_reference === digest(rights);
  // Rebind verified source updates while retaining this job's allowance, clock and spending history.
  const grantContextDigest = sourceContinuation || preparationOnly && (routingProjectionMatches(context, previous)
    || preparationGrantFollowsBrief(previous, input)) ? previous.task_context_digest : context.context_digest;
  const managedConsent = input.record.request?.sol_agents_api_consent;
  const managedAgents = managedConsent !== undefined && managedConsent !== null;
  if (managedAgents && (managedConsent.granted !== true
    || managedConsent.statement_version !== SITE_CONSENT_STATEMENTS.sol_agents_api_consent.statement_version
    || input.record.request?.capture_region !== "us"
    || input.record.request?.capture_mode !== "self_capture"
    || input.record.request?.claude_authoring_consent))
    throw new Error("website_agents_api_disclosure_authority_invalid");
  if (managedAgents && !agentsApiTaskAuthorized(grantContextDigest))
    throw new Error("website_agents_api_task_not_authorized");
  const managedPolicy = managedAgents ? agentsApiPolicy() : null;
  const developmentSiteTest = developmentTestSiteAuthorized(input.record, grantContextDigest);
  const policyDigestFor = (sponsorPolicy: z.infer<typeof policySchema>) => developmentSiteTest
    ? digest({ policy: sponsorPolicy, development_test_site_context_digest: grantContextDigest,
      ...(managedPolicy ? { agents_api_policy: managedPolicy } : {}),
      development_test_site_gates: input.record.siteTaskGates,
      development_test_site_triage: {
        disposition: input.record.site_task_triage.disposition,
        blocking_field_ids: input.record.site_task_triage.blocking_field_ids,
        unanswered_field_ids: input.record.site_task_triage.unanswered_field_ids,
      } })
    : digest(managedPolicy ? { policy: sponsorPolicy, agents_api_policy: managedPolicy } : sponsorPolicy);
  const policyDigest = policyDigestFor(configured);
  if (previous) {
    const { authority_digest: retainedDigest, ...payload } = previous;
    // A change to the window length alone leaves an issued grant on the window it
    // was issued with; any other policy change still refuses it.
    const issuedWindow = issuedWebsiteJobWindowSeconds(previous);
    const issuedUnderThisPolicy = previous.policy_digest === policyDigest || issuedWindow !== null
      && previous.policy_digest === policyDigestFor({ ...configured, ttl_seconds: issuedWindow });
    if (digest(payload) !== retainedDigest || !issuedUnderThisPolicy
      || previous.request_id !== input.requestId || previous.task_context_digest !== grantContextDigest
      || previous.purpose !== input.purpose)
      throw new Error("website_scene_sponsorship_changed");
    // Only "still valid now" moves with an owner-approved extension; the grant,
    // its caps and its issued window are returned exactly as retained.
    if (sponsorshipValidUntil(previous, input.executionWindowUntil) <= input.now) throw new Error("consent_expired");
    return continuationAuthority(previous, input);
  }
  // Scene preparation proceeds while site questions remain open. This does not
  // update triage or qualify a robot deployment.
  // The four-conditions screen no longer gates the simulation (owner decision
  // 2026-11-11): a job whose video arrived after the change gets its grant
  // whatever the screen's disposition, which stays a note for staff. A job
  // uploaded before it keeps the old refusal, typed so the Pipeline holds the
  // capture and retries, until the owner decides about it. Checked when the
  // grant is first made, never on an existing grant, so spend already
  // authorized still settles.
  if (input.record.site_task_triage?.disposition !== "qualified"
    && !developmentSiteTest && !preparationOnly && !sceneScreenGateEnded(input.record, input.requestId)) {
    throw new Error("website_scene_site_not_qualified");
  }
  // The brief screen's task-kind reading (`site_task_scope`) is a display and demand hint,
  // never a spend gate: the Pipeline decides from the job's compiled task what it can
  // simulate and score, and holds with a typed code naming the missing piece.
  // Source ownership and spending remain distinct from optional account setup.
  const sourceOwner = websiteCaptureOwnerUid(input.record);
  if (!preparationOnly && (typeof sourceOwner !== "string" || !sourceOwner)) {
    throw new Error("website_scene_site_unclaimed");
  }
  const claudeConsent = input.record.request?.claude_authoring_consent;
  const authoringProvider = claudeConsent ? "anthropic" : "openai";
  if (claudeConsent && (claudeConsent.granted !== true
    || claudeConsent.statement_version !== SITE_CONSENT_STATEMENTS.claude_authoring_consent.statement_version
    || input.record.request?.capture_region !== "us"))
    throw new Error("website_anthropic_disclosure_authority_invalid");
  const privacyPolicyVersion = websiteJobPrivacyPolicyVersion(input.record);
  // Only a Claude-authored grant carries Anthropic terms: today's Pipeline refuses an OpenAI grant that names them.
  const anthropicTerms = authoringProvider === "anthropic" ? sceneProviderTerms().anthropic?.digest : null;
  if (authoringProvider === "anthropic" && !anthropicTerms)
    throw new Error("website_anthropic_provider_terms_not_configured");
  const value = {
    schema_version: "website_scene_sponsorship.v1", sponsor: "blueprint",
    ...(input.purpose ? { purpose: input.purpose } : {}),
    request_id: input.requestId, capture_id: context.capture_id, scene_id: context.scene_id,
    task_context_digest: context.context_digest, policy_digest: policyDigest,
    ...(input.captureBinding ? { source_task_context_digest: context.context_digest } : {}),
    ...(developmentSiteTest ? { development_test_site: {
      claim_scope: "development_only", commercial_site_qualification: false,
      captured_room_readiness: false,
      unresolved_gate_ids: input.record.site_task_triage.unanswered_field_ids,
    } } : {}),
    authoring_provider: authoringProvider,
    ...(managedPolicy ? { authoring_agent_runtime: "openai_agents_api",
      authoring_model: SITE_CONSENT_STATEMENTS.sol_agents_api_consent.model, agents_api_policy: managedPolicy } : {}),
    ...(privacyPolicyVersion ? { privacy_policy_version: privacyPolicyVersion } : {}),
    site_consents: websiteSiteConsents(input.record),
    ...(anthropicTerms ? { anthropic_provider_terms_reference: anthropicTerms } : {}),
    owner: configured.owner,
    // These are disjoint caps, not two authorizations for the whole budget.
    preparation_max_total_spend_usd: configured.max_total_spend_usd,
    upstream_max_spend_usd: configured.upstream_max_spend_usd,
    max_total_spend_usd: configured.native_max_spend_usd,
    max_paid_attempts: configured.max_paid_attempts,
    scene_configuration_max_retries: WEBSITE_SCENE_CONFIGURATION_MAX_RETRIES,
    ...(websiteAutomaticBudgetExtensionEnabled() ? { automatic_budget_extension: true as const } : {}),
    ...(input.renewal ? { renewal: input.renewal } : {}),
    expires_at_epoch: input.now + configured.ttl_seconds,
    consent: {
      rights_reference: digest(rights), provider_terms_reference: configured.provider_terms_reference,
      accepted_by: configured.owner.user_id, accepted_at_epoch: input.now,
      private_processing_authorized: true, provider_training_authorized: false,
      task_confirmed: context.confirmed, spend_authorized: true,
    },
  };
  return continuationAuthority({ ...value, authority_digest: digest(value) }, input);
}

/** Existing signed publication checks: a purpose label alone never grants processing. */
export function currentWebsiteSceneContext(input: {
  requestId: string; captureId: string; brief: SiteTaskBriefRecord; record: Record<string, any>;
  inventory?: TaskItemInventoryRecord | null; captureBinding?: Record<string, any>;
}) {
  assertWebsiteRunOpen(input.record, input.requestId, input.captureId);
  const purpose = retainedWebsiteScenePurpose(input.record);
  const context = projectWebsiteTaskContext(input.brief, projectWebsiteCaptureRights(input.record), {
    inventory: input.inventory, captureId: input.captureId, captureBinding: input.captureBinding, purpose,
    preparationGrantContextDigest: preparationGrantContextDigest(input.record) });
  if (purpose === "scene_preparation") {
    const authority = websiteSceneSponsorship({ ...input, purpose, now: Date.now() / 1000 });
    if (authority.task_context_digest !== context.context_digest) throw new Error("website_task_context_changed");
  } else if (!context.confirmed) throw new Error("website_task_context_not_confirmed");
  return context;
}

/** Status/closeout evidence only. An expired retained grant never gains a new clock or dispatch. */
export function currentWebsitePreparationStatusContext(input: {
  requestId: string; captureId: string; brief: SiteTaskBriefRecord; record: Record<string, any>;
  inventory?: TaskItemInventoryRecord | null; captureBinding?: Record<string, any>;
}) {
  const purpose = retainedWebsiteScenePurpose(input.record);
  const context = projectWebsiteTaskContext(input.brief, projectWebsiteCaptureRights(input.record), {
    inventory: input.inventory, captureId: input.captureId, captureBinding: input.captureBinding, purpose,
    preparationGrantContextDigest: preparationGrantContextDigest(input.record) });
  if (purpose !== "scene_preparation") {
    if (!context.confirmed) throw new Error("website_task_context_not_confirmed");
    return context;
  }
  const retained = input.record.website_scene_sponsorship;
  const baseContext = projectWebsiteTaskContext(input.brief, projectWebsiteCaptureRights(input.record), {inventory: input.inventory, purpose,
    preparationGrantContextDigest: preparationGrantContextDigest(input.record)});
  const {authority_digest: retainedDigest, ...retainedPayload} = retained ?? {};
  if (retainedDigest !== digest(retainedPayload)) throw new Error("website_scene_sponsorship_binding_invalid");
  const sourceContinuation = input.captureBinding
    && input.captureBinding.original_capture_id === `walkthrough-${input.requestId}`
    && input.captureBinding.capture_id === context.capture_id
    && (retained.source_task_context_digest ?? retained.task_context_digest) === baseContext.context_digest
    && input.captureBinding.lineage?.some((entry: any) => entry.parent?.capture_id === retained.capture_id
      || entry.child?.capture_id === retained.capture_id)
    && retained.consent?.rights_reference === digest(context.capture_rights);
  const authority = sourceContinuation || routingProjectionMatches(baseContext, retained)
    || preparationGrantFollowsBrief(retained, input) ? continuationAuthority(retained, input) : retained;
  const {authority_digest, ...payload} = authority;
  if (authority_digest !== digest(payload) || authority.schema_version !== "website_scene_sponsorship.v1"
    || authority.sponsor !== "blueprint" || authority.request_id !== input.requestId || authority.capture_id !== context.capture_id
    || authority.scene_id !== context.scene_id || authority.task_context_digest !== context.context_digest
    || authority.consent?.task_confirmed !== context.confirmed || authority.consent?.private_processing_authorized !== true
    || authority.consent?.provider_training_authorized !== false || authority.consent?.spend_authorized !== true
    || !context.capture_rights.derived_scene_generation_allowed)
    throw new Error("website_scene_sponsorship_binding_invalid");
  return context;
}

/** One retained grant per upload. Replays never renew its clock or its budget.
 * `honour_execution_window` (the Pipeline's non-creating read only) lets a
 * verified time-only extension of the bound scene intent keep the grant readable;
 * a native/Marble paid reservation follows the same window (reserveWebsitePreparationSpend). */
export type WebsiteSceneSponsorshipRequest = { purpose?: "scene_preparation"; expected_task_context_digest?: string;
  honour_execution_window?: true };
/** Trusted background reads reuse stored scope; explicit signed requests never infer new authority. */
export function retainedWebsiteScenePurpose(record: Record<string, any> | undefined): "scene_preparation" | undefined {
  const purpose = record?.website_scene_sponsorship?.purpose;
  if (purpose !== undefined && purpose !== "scene_preparation") throw new Error("website_scene_sponsorship_changed");
  return purpose;
}
export async function loadWebsiteSceneSponsorship(requestId: string, create = false, captureId = `walkthrough-${requestId}`,
  options?: WebsiteSceneSponsorshipRequest) {
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  const captureBinding = await resolveWebsiteCaptureBinding(requestId, `site-${requestId}`, captureId);
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const [request, brief, inventory] = await Promise.all([
      transaction.get(ref), transaction.get(store.collection(TASK_BRIEFS_COLLECTION).doc(requestId)),
      transaction.get(store.collection("siteTaskItemInventories").doc(requestId)),
    ]);
    if (!request.exists || !brief.exists) throw new Error("task_brief_missing");
    await assertWebsiteCaptureBindingInTransaction(transaction, requestId, captureBinding);
    const record = request.data()!;
    if (!create && !record.website_scene_sponsorship) throw noGrantRefusal(record, requestId);
    const purpose = options ? options.purpose : !create ? retainedWebsiteScenePurpose(record) : undefined;
    const executionWindowUntil = !create && options?.honour_execution_window === true
      && record.website_scene_sponsorship_execution_window
      ? sponsorshipExecutionWindowUntil(record.website_scene_sponsorship, record,
        await sponsorshipWindowIntake(transaction, record)) : undefined;
    const input = { requestId, record, purpose, brief: brief.data() as SiteTaskBriefRecord,
      inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
      ...(executionWindowUntil === undefined ? {} : { executionWindowUntil }) };
    const current = projectWebsiteTaskContext(input.brief, projectWebsiteCaptureRights(record), {
      inventory: input.inventory, captureId, captureBinding, purpose, preparationGrantContextDigest: preparationGrantContextDigest(record) });
    if (options?.expected_task_context_digest !== undefined && options.expected_task_context_digest !== current.context_digest
      || purpose === "scene_preparation" && create && options?.expected_task_context_digest !== current.context_digest)
      throw new Error("website_task_context_changed");
    // Validate the caller's full child snapshot BEFORE creating the immutable
    // original allowance. Only the returned continuation binds the child.
    const authority = websiteSceneSponsorship({...input, ...(purpose === "scene_preparation" ? { captureId, captureBinding } : {}), now: Date.now() / 1000,
      ...(options?.expected_task_context_digest !== undefined ? {expected_task_context_digest: purpose === "scene_preparation" ? current.context_digest
        : projectWebsiteTaskContext(input.brief, projectWebsiteCaptureRights(record), {inventory: input.inventory, purpose,
          preparationGrantContextDigest: preparationGrantContextDigest(record)}).context_digest} : {})});
    // Before the grant is stored or returned: a job held for its several steps gets no spending authority.
    if (create) assertNoMultiStepTaskHold(input);
    if (!record.website_scene_sponsorship) transaction.update(ref, { website_scene_sponsorship: authority,
      ...(authority.purpose === "scene_preparation" && isPlaceholderSummary(input.brief.summary)
        ? { [UNNAMED_TASK_GRANT_FIELD]: authority.authority_digest } : {}) });
    return continuationAuthority(authority, {...input, captureId, captureBinding});
  }));
}

type SponsorshipRenewal = { parent_authority_digest: string; parent_expires_at_epoch: number;
  approved_by: string; approval_reference: string };
export const SPONSORSHIP_RENEWAL_ACK = "renew-expired-blueprint-preparation-sponsorship";

/** The sponsor's explicit re-issue of its own expired preparation grant.
 *
 * Expiry still ends the grant for every automatic caller; only this call
 * re-issues it. The policy is rebuilt from the expired grant and must hash to
 * its recorded digest, so caps, attempts and window cannot change here, and
 * every later use revalidates that digest against the configured policy.
 * Reservations stay on the request, so spend already reserved keeps counting,
 * and the owner's amendments are re-bound to the renewed grant, never widened. */
export async function renewExpiredWebsiteSceneSponsorship(requestId: string, input: {
  approved_by: string; approval_reference: string; ack: string; apply: boolean; captureId?: string;
}) {
  if (input.ack !== SPONSORSHIP_RENEWAL_ACK) throw new Error("website_scene_sponsorship_renewal_unacknowledged");
  if (!input.approval_reference.trim() || input.approval_reference.length > 500)
    throw new Error("website_scene_sponsorship_renewal_reference_invalid");
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  const captureId = input.captureId ?? `walkthrough-${requestId}`;
  const captureBinding = await resolveWebsiteCaptureBinding(requestId, `site-${requestId}`, captureId);
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const [request, brief, inventory] = await Promise.all([
      transaction.get(ref), transaction.get(store.collection(TASK_BRIEFS_COLLECTION).doc(requestId)),
      transaction.get(store.collection("siteTaskItemInventories").doc(requestId)),
    ]);
    if (!request.exists || !brief.exists) throw new Error("task_brief_missing");
    await assertWebsiteCaptureBindingInTransaction(transaction, requestId, captureBinding);
    const record = request.data()!;
    const previous = record.website_scene_sponsorship;
    if (!previous) throw new Error("website_scene_sponsorship_missing");
    const { authority_digest: parentDigest, ...payload } = previous;
    if (digest(payload) !== parentDigest || previous.purpose !== "scene_preparation")
      throw new Error("website_scene_sponsorship_changed");
    const now = Date.now() / 1000;
    if (previous.expires_at_epoch > now) throw new Error("website_scene_sponsorship_renewal_not_expired");
    if (input.approved_by !== previous.owner?.user_id) throw new Error("website_scene_sponsorship_renewal_unauthorized");
    // Amendments are bound to the expired grant's digest. Each must still be the
    // owner's valid amendment of that grant; below it is re-bound to the renewal.
    if (record.website_preparation_limit_extension && !record.website_preparation_limit_amendment)
      throw new Error("website_preparation_amendment_invalid");
    preparationRequestLimit(record, previous);
    preparationSpendLimit(record, previous);
    const retained = policySchema.safeParse({ owner: previous.owner,
      upstream_max_spend_usd: previous.upstream_max_spend_usd, native_max_spend_usd: previous.max_total_spend_usd,
      max_total_spend_usd: previous.preparation_max_total_spend_usd, max_paid_attempts: previous.max_paid_attempts,
      // Epoch floats subtract inexactly; the digest check below proves the rounded window.
      ttl_seconds: Math.round(previous.expires_at_epoch - previous.consent?.accepted_at_epoch),
      provider_terms_reference: previous.consent?.provider_terms_reference });
    if (!retained.success || digest(retained.data) !== previous.policy_digest)
      throw new Error("website_scene_sponsorship_renewal_policy_unproven");
    const inputs = { brief: brief.data() as SiteTaskBriefRecord,
      inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null };
    const base = projectWebsiteTaskContext(inputs.brief, projectWebsiteCaptureRights(record),
      {inventory: inputs.inventory, purpose: "scene_preparation"});
    const { website_scene_sponsorship: _expired, ...unsponsored } = record;
    const issued = websiteSceneSponsorship({ requestId, record: unsponsored, ...inputs, now,
      purpose: "scene_preparation", expected_task_context_digest: base.context_digest,
      retainedPolicy: retained.data, renewal: { parent_authority_digest: parentDigest,
        parent_expires_at_epoch: previous.expires_at_epoch, approved_by: input.approved_by,
        approval_reference: input.approval_reference.trim() } });
    // A grant issued while preparation still waited on an assessment keeps its
    // recorded proposal as advisory context. The renewal never reads or needs one.
    // The retry allowance and the automatic budget extension are restored as the expired
    // grant named them (none before 2026-11-10), whatever the setting says now.
    // So are the job's Privacy version and the site's accepted statements: a grant issued before they were
    // recorded is renewed without them.
    const { authority_digest: _issuedDigest, scene_configuration_max_retries: _retries,
      automatic_budget_extension: _extension, privacy_policy_version: _privacy, site_consents: _consents,
      ...issuedRest } = issued as Record<string, any>;
    const issuedPayload = { ...issuedRest,
      ...(previous.privacy_policy_version === undefined ? {} : { privacy_policy_version: previous.privacy_policy_version }),
      ...(previous.site_consents === undefined ? {} : { site_consents: previous.site_consents }),
      ...(previous.scene_configuration_max_retries === undefined ? {}
        : { scene_configuration_max_retries: previous.scene_configuration_max_retries }),
      ...(previous.automatic_budget_extension === undefined ? {}
        : { automatic_budget_extension: previous.automatic_budget_extension }) };
    const renewedPayload = previous.assessment_preparation_proposal
      ? { ...issuedPayload, assessment_preparation_proposal: previous.assessment_preparation_proposal } : issuedPayload;
    const renewed = { ...renewedPayload, authority_digest: digest(renewedPayload) };
    // A renewal restores the same allowance for a new window. Any change to the
    // task, rights or provider needs a fresh grant, never this path.
    const scope = (grant: Record<string, any>) => {
      const { authority_digest: _d, expires_at_epoch: _e, renewal: _r, consent, ...rest } = grant;
      const { accepted_at_epoch: _a, ...terms } = consent ?? {};
      return digest({ ...rest, consent: terms });
    };
    const projectionMigration = previous.task_context_digest !== base.context_digest
      && previous.task_context_digest === legacySuggestedTaskContextDigest(base, inputs.inventory);
    // Compare every other bound field unchanged. Only the byte-proven legacy
    // projection may drop an unphotographed suggestion under the current rule.
    if (scope(renewed) !== scope(projectionMigration ? { ...previous, task_context_digest: base.context_digest } : previous))
      throw new Error("website_scene_sponsorship_renewal_scope_changed");
    const carried = carriedPreparationAmendments(record, renewed.authority_digest, input, now);
    if (input.apply) transaction.update(ref, { website_scene_sponsorship: renewed,
      website_scene_sponsorship_history: [...(record.website_scene_sponsorship_history ?? []), previous],
      ...carried.updates, ...(carried.archived.length ? { website_preparation_amendment_history:
        [...(record.website_preparation_amendment_history ?? []), ...carried.archived] } : {}) });
    const carriedRecord = { ...record, ...carried.updates };
    return { ...renewed, task_context_projection_migration: projectionMigration ? {
      from: previous.task_context_digest, to: base.context_digest, basis: "unphotographed_suggestions_excluded",
    } : null, preparation_amendments: {
      carried: carried.updates, archived: carried.archived,
      effective_limits: { max_requests: preparationRequestLimit(carriedRecord, renewed),
        upstream_max_spend_usd: preparationSpendLimit(carriedRecord, renewed) },
      history_length_before: (record.website_preparation_amendment_history ?? []).length,
      history_length_after: (record.website_preparation_amendment_history ?? []).length + carried.archived.length,
    } };
  }));
}

export const preparationSpendRequest = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  resource_class: z.enum(["evaluator_api", "openai_api_candidate", "provider_reconstruction_api", "gpu_render"]),
  provider: z.enum(["meta", "google", "openai", "world_labs", "world_labs_atlas", "vast"]),
  source_video_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  atlas_auxiliary: z.literal(true).optional(),
  maximum_cost_usd: money, request_count: z.number().int().min(1).max(32),
}).strict().refine(value => (["meta", "google"].includes(value.provider) && value.resource_class === "evaluator_api")
  || (value.provider === "openai" && value.resource_class === "openai_api_candidate")
  || (["world_labs", "world_labs_atlas"].includes(value.provider) && value.resource_class === "provider_reconstruction_api")
  || (value.provider === "vast" && value.resource_class === "gpu_render"),
  "website_preparation_provider_resource_mismatch").refine(value => !value.atlas_auxiliary ||
    (["meta", "google"].includes(value.provider) && Boolean(value.source_video_digest)),
    "website_atlas_auxiliary_binding_invalid");

const completedPreparationSettlement = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider: z.literal("world_labs"), operation_id: z.string().min(1).max(200),
  operation_done: z.literal(true), total_credits: z.number().int().min(0).max(1_250_000),
  provider_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
const rejectedPreparationSettlement = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider: z.literal("world_labs"),
  rejection_code: z.literal("insufficient_api_credits_before_generation"),
  provider_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
const vastSettlementRequest = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider: z.literal("vast"), instance_id: z.string().regex(/^[1-9][0-9]{0,17}$/),
  provider_charge_source: z.string().regex(/^instance-[1-9][0-9]{0,17}$/),
  provider_charge_amount_usd: z.number().finite().min(0).max(1000),
  provider_charge_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  execution_result_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  teardown_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider_zero_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict().refine(value => value.provider_charge_source === `instance-${value.instance_id}`);
// Vast's instance API reports no charge for a short rental, so a terminal run
// with no posted bill settles at its adapter's budget-ledger estimate (observed
// all-in hourly rate over the observed live time, plus the priced transfer),
// labelled as an estimate, never as a provider charge. It is accepted only for
// one torn-down instance with no continuing spend and nothing left staged; like
// every settlement it is written once and never above the reservation's quote.
const vastEstimatedSettlementRequest = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider: z.literal("vast"), instance_id: z.string().regex(/^[1-9][0-9]{0,17}$/),
  provider_charge_basis: z.literal("adapter_budget_ledger_estimate"),
  provider_charge_amount_usd: z.number().finite().min(0).max(1000),
  budget_ledger_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  execution_result_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  teardown_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider_zero_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  continuing_spend_from_this_run: z.literal(false), all_staged_objects_absent: z.literal(true),
}).strict();
// A signed allocator refusal can release a hold without inventing an instance
// or billing receipt. The original admission and request count stay retained.
const vastNoAllocationSettlementRequest = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider: z.literal("vast"), allocation_status: z.literal("not_created"),
  provider_create_attempted: z.literal(false), provider_mutations_performed: z.literal(0),
  provider_instance_ids: z.array(z.never()).max(0),
  provider_charge_amount_usd: z.literal(0),
  all_staged_objects_absent: z.literal(true), continuing_spend_from_this_run: z.literal(false),
  execution_result_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  adapter_result_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  teardown_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  staged_object_absence_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  watchdog_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
// Image edits are billed per request from the provider's usage. Release the
// unused quote only once every request the reservation covered has a completed
// receipt, so an uncertain in-flight request keeps its full hold.
const openaiImageSettlementRequest = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider: z.literal("openai"), completed_request_count: z.number().int().min(1).max(64),
  provider_charge_amount_usd: z.number().finite().min(0).max(100),
  usage_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
// World Labs exposes no per-operation bill for Atlas. The Pipeline reports each
// closed attempt's outcome from its retained provider record: a completed
// operation settles at the reviewed price it was reserved at, and a failed
// operation or a refused submission bought nothing and releases its hold. An
// attempt whose outcome is unknown reports nothing and keeps its full hold.
const atlasSettlementRequest = z.object({
  task_context_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  allocation_binding_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider: z.literal("world_labs_atlas"), outcome: z.enum(["completed", "failed", "refused"]),
  operation_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/).nullable(),
  outcome_receipt_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict().refine(value => (value.outcome === "refused") === (value.operation_id === null),
  "website_atlas_settlement_operation_invalid");
export const preparationSettlementRequest = z.union([
  completedPreparationSettlement, rejectedPreparationSettlement, vastSettlementRequest, vastEstimatedSettlementRequest,
  vastNoAllocationSettlementRequest, openaiImageSettlementRequest, atlasSettlementRequest,
]);
type PreparationSettlement = z.infer<typeof preparationSettlementRequest>;

/** The debit a settlement records against its reservation's quote. */
export function preparationSettlementCost(command: PreparationSettlement, reservedMaximumUsd: number) {
  if (command.provider === "vast" || command.provider === "openai") return command.provider_charge_amount_usd;
  if (command.provider === "world_labs_atlas") return command.outcome === "completed" ? reservedMaximumUsd : 0;
  return "total_credits" in command ? command.total_credits / 1250 : 0;
}

/** Pipeline-signed final provider billing releases only the unused reservation. */
export async function settleWebsitePreparationSpend(requestId: string, input: z.infer<typeof preparationSettlementRequest>) {
  const command = preparationSettlementRequest.parse(input);
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const record = (await transaction.get(ref)).data();
    const key = command.allocation_binding_digest.slice(7);
    const row = record?.website_preparation_reservations?.[key];
    const resourceClass = { vast: "gpu_render", openai: "openai_api_candidate", world_labs: "provider_reconstruction_api",
      world_labs_atlas: "provider_reconstruction_api" }[command.provider];
    if (!row || row.admission.provider !== command.provider
      || row.admission.resource_class !== resourceClass
      || row.admission.task_context_digest !== command.task_context_digest
      || (command.provider === "openai" && command.completed_request_count !== row.admission.request_count))
      throw new Error("website_scene_preparation_settlement_invalid");
    const actualCost = preparationSettlementCost(command, row.admission.maximum_cost_usd);
    if (!(actualCost <= row.admission.maximum_cost_usd)) throw new Error("website_scene_preparation_settlement_invalid");
    const settlement = { ...command, actual_cost_usd: actualCost, status: "settled" };
    if (row.settlement) {
      if (digest(row.settlement) !== digest(settlement)) throw new Error("idempotency_conflict");
      return row.settlement;
    }
    transaction.update(ref, { website_preparation_reservations: {
      ...record!.website_preparation_reservations, [key]: { ...row, settlement },
    } });
    return settlement;
  }));
}

const preparationLimitAmendment = z.object({
  authority_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  max_requests: z.number().int().min(1).max(64),
  approved_by: z.string().trim().min(1),
  approval_reference: z.string().trim().min(1).max(1000),
}).strict();

function preparationRequestLimit(record: Record<string, any>, authority: Record<string, any>) {
  const amendment = record.website_preparation_limit_amendment;
  if (!amendment) return authority.max_paid_attempts;
  const { amendment_digest, approved_at_epoch, ...raw } = amendment;
  const value = preparationLimitAmendment.parse(raw);
  if (digest({ ...value, approved_at_epoch }) !== amendment_digest
    || !Number.isFinite(approved_at_epoch)
    || value.authority_digest !== authority.authority_digest
    || value.approved_by !== authority.owner.user_id
    || value.max_requests < authority.max_paid_attempts)
    throw new Error("website_preparation_amendment_invalid");
  const extension = record.website_preparation_limit_extension;
  if (!extension) return value.max_requests;
  const { extension_digest, approved_at_epoch: extendedAt, prior_amendment_digest, ...extendedRaw } = extension;
  const extended = preparationLimitAmendment.parse(extendedRaw);
  if (digest({ ...extended, approved_at_epoch: extendedAt, prior_amendment_digest }) !== extension_digest
    || !Number.isFinite(extendedAt) || prior_amendment_digest !== amendment_digest
    || extended.authority_digest !== authority.authority_digest
    || extended.approved_by !== authority.owner.user_id
    || extended.max_requests <= value.max_requests)
    throw new Error("website_preparation_amendment_invalid");
  return extended.max_requests;
}

const preparationSpendAmendment = z.object({
  authority_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  upstream_max_spend_usd: money,
  approved_by: z.string().trim().min(1),
  approval_reference: z.string().trim().min(1).max(1000),
}).strict();

/** The owner-approved upstream preparation cap, bounded by three times the grant. */
function preparationSpendLimit(record: Record<string, any>, authority: Record<string, any>) {
  const amendment = record.website_preparation_spend_amendment;
  if (!amendment) return authority.upstream_max_spend_usd;
  const { amendment_digest, approved_at_epoch, ...raw } = amendment;
  const value = preparationSpendAmendment.parse(raw);
  if (digest({ ...value, approved_at_epoch }) !== amendment_digest
    || !Number.isFinite(approved_at_epoch)
    || value.authority_digest !== authority.authority_digest
    || value.approved_by !== authority.owner.user_id
    || value.upstream_max_spend_usd <= authority.upstream_max_spend_usd
    || value.upstream_max_spend_usd > authority.upstream_max_spend_usd * 3)
    throw new Error("website_preparation_spend_amendment_invalid");
  return value.upstream_max_spend_usd;
}

/** The renewal's owner approval re-issues each amendment, unchanged in value, bound
 * to the renewed grant; the originals move to history. Reservations already
 * count against the same caps, so carrying an amendment never adds allowance. */
function carriedPreparationAmendments(record: Record<string, any>, authorityDigest: string,
  approval: { approved_by: string; approval_reference: string }, now: number) {
  const reference = (original: Record<string, any>, from: string) => (`Carried forward on owner-approved renewal `
    + `(${approval.approval_reference.trim()}) from ${from}: ${original.approval_reference}`).slice(0, 1000).trim();
  const updates: Record<string, any> = {}, archived: Record<string, any>[] = [];
  const limit = record.website_preparation_limit_amendment;
  if (limit) {
    const value = { ...preparationLimitAmendment.parse({ authority_digest: authorityDigest, max_requests: limit.max_requests,
      approved_by: approval.approved_by, approval_reference: reference(limit, limit.amendment_digest) }), approved_at_epoch: now };
    updates.website_preparation_limit_amendment = { ...value, amendment_digest: digest(value) };
    archived.push(limit);
    const extension = record.website_preparation_limit_extension;
    if (extension) {
      const extended = { ...preparationLimitAmendment.parse({ authority_digest: authorityDigest,
        max_requests: extension.max_requests, approved_by: approval.approved_by,
        approval_reference: reference(extension, extension.extension_digest) }), approved_at_epoch: now,
        prior_amendment_digest: updates.website_preparation_limit_amendment.amendment_digest };
      updates.website_preparation_limit_extension = { ...extended, extension_digest: digest(extended) };
      archived.push(extension);
    }
  }
  const spend = record.website_preparation_spend_amendment;
  if (spend) {
    const value = { ...preparationSpendAmendment.parse({ authority_digest: authorityDigest,
      upstream_max_spend_usd: spend.upstream_max_spend_usd, approved_by: approval.approved_by,
      approval_reference: reference(spend, spend.amendment_digest) }), approved_at_epoch: now };
    updates.website_preparation_spend_amendment = { ...value, amendment_digest: digest(value) };
    archived.push(spend);
  }
  return { updates, archived };
}

/** Operator-only: raises only the upstream preparation cap. The native
 * cap, expiry, request limit and existing reservations are unchanged. */
export async function amendWebsitePreparationSpendLimit(
  requestId: string, input: z.infer<typeof preparationSpendAmendment>, apply = false,
) {
  const command = preparationSpendAmendment.parse(input);
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const record = (await transaction.get(ref)).data();
    const authority = record?.website_scene_sponsorship;
    if (!authority) throw new Error("website_scene_sponsorship_missing");
    const { authority_digest, ...payload } = authority;
    if (digest(payload) !== authority_digest || command.authority_digest !== authority_digest
      || authority.request_id !== requestId || command.approved_by !== authority.owner.user_id)
      throw new Error("website_scene_sponsorship_binding_invalid");
    if (authority.expires_at_epoch <= Date.now() / 1000) throw new Error("consent_expired");
    if (!projectWebsiteCaptureRights(record!).derived_scene_generation_allowed) throw new Error("source_revoked");
    const previous = record!.website_preparation_spend_amendment;
    const current = preparationSpendLimit(record!, authority);
    if (previous) {
      if (previous.upstream_max_spend_usd === command.upstream_max_spend_usd
          && previous.approval_reference === command.approval_reference) return previous;
      if (command.upstream_max_spend_usd <= current) throw new Error("website_preparation_amendment_conflict");
    }
    if (command.upstream_max_spend_usd <= authority.upstream_max_spend_usd
        || command.upstream_max_spend_usd > authority.upstream_max_spend_usd * 3)
      throw new Error("website_preparation_spend_amendment_out_of_bounds");
    const value = { ...command, approved_at_epoch: Date.now() / 1000 };
    const receipt = { ...value, amendment_digest: digest(value) };
    if (apply) transaction.update(ref, { website_preparation_spend_amendment: receipt,
      ...(previous ? { website_preparation_amendment_history:
        [...(record!.website_preparation_amendment_history ?? []), previous] } : {}) });
    return receipt;
  }));
}

/** Operator-only amendment: never exposed as a public or Pipeline API. */
export async function amendWebsitePreparationRequestLimit(
  requestId: string, input: z.infer<typeof preparationLimitAmendment>, apply = false,
) {
  const command = preparationLimitAmendment.parse(input);
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const snapshot = await transaction.get(ref);
    const record = snapshot.data();
    const authority = record?.website_scene_sponsorship;
    if (!authority) throw new Error("website_scene_sponsorship_missing");
    const { authority_digest, ...payload } = authority;
    if (digest(payload) !== authority_digest || command.authority_digest !== authority_digest
      || authority.request_id !== requestId || command.approved_by !== authority.owner.user_id)
      throw new Error("website_scene_sponsorship_binding_invalid");
    if (authority.expires_at_epoch <= Date.now() / 1000) throw new Error("consent_expired");
    if (!projectWebsiteCaptureRights(record!).derived_scene_generation_allowed) throw new Error("source_revoked");
    const previous = record!.website_preparation_limit_amendment;
    const current = preparationRequestLimit(record!, authority);
    if (previous) {
      const extension = record!.website_preparation_limit_extension;
      if (extension?.max_requests === command.max_requests && extension.approval_reference === command.approval_reference)
        return extension;
      if (!extension && previous.max_requests === command.max_requests && previous.approval_reference === command.approval_reference)
        return previous;
      if (command.max_requests <= current) throw new Error("website_preparation_amendment_conflict");
      // Further owner-approved increases preserve both prior signed records.
      // Carry the last approved limit forward without replenishing usage or
      // changing the sponsorship, dollar allowance, expiry, or reservations.
      let base = previous;
      let history: Record<string, any>[] | undefined;
      if (extension) {
        const { extension_digest: _extensionDigest, prior_amendment_digest: _priorDigest, ...payload } = extension;
        base = { ...payload, amendment_digest: digest(payload) };
        history = [...(record!.website_preparation_amendment_history ?? []), previous, extension];
      }
      const value = { ...command, approved_at_epoch: Date.now() / 1000,
        prior_amendment_digest: base.amendment_digest };
      const receipt = { ...value, extension_digest: digest(value) };
      if (apply) transaction.update(ref, { website_preparation_limit_extension: receipt,
        ...(history ? { website_preparation_limit_amendment: base,
          website_preparation_amendment_history: history } : {}) });
      return receipt;
    }
    if (command.max_requests <= current) throw new Error("website_preparation_limit_not_increased");
    const value = { ...command, approved_at_epoch: Date.now() / 1000 };
    const receipt = { ...value, amendment_digest: digest(value) };
    if (apply) transaction.update(ref, { website_preparation_limit_amendment: receipt });
    return receipt;
  }));
}

const atlasGrantFigureAmendment = z.object({
  capture_id: z.string().trim().min(1).max(200),
  authorization_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  maximum_cost_usd: z.number().finite().positive().max(WEBSITE_ATLAS_STORED_GRANT_MAXIMUM_COST_USD),
  approved_by: z.string().trim().min(1),
  approval_reference: z.string().trim().min(1).max(1000),
  // When the owner approved it (a date, or a date and time), recorded apart from when it was applied.
  approved_at_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}(T[0-9:.]+(Z|[+-]\d{2}:\d{2}))?$/)
    .refine(value => Number.isFinite(Date.parse(value)), "approved_at_iso must be a date"),
}).strict();
export const WEBSITE_ATLAS_GRANT_AMENDMENT_SCHEMA = "website_atlas_grant_figure_amendment.v1";

/**
 * Operator-only owner amendment (owner decision 2026-11-11): raises one job's stored automatic
 * Atlas grant figure, and with it the job's stored ceiling, up to the stored grant schema's maximum
 * ($100). The job's safety limit, max(stored ceiling, $100), does not change. Nothing else in the grant changes: its consent, terms, source, owner, request
 * count, approval reference and expiry stay as issued, so the Pipeline's resume check
 * (`website_atlas_pipeline._same_authority`) reads it as the same grant with a raised figure and
 * continues the job. An owner authorization row would replace the grant instead and stop the job's
 * remaining Atlas work. The owner's approval is recorded in the job's amendment list with the prior
 * and new figure and digest. Never a public or Pipeline API. `apply` false changes nothing and
 * returns what would change; the same amendment applied again returns the stored receipt.
 */
export async function amendWebsiteAtlasGrantFigure(
  requestId: string, input: z.infer<typeof atlasGrantFigureAmendment>, apply = false,
) {
  const command = atlasGrantFigureAmendment.parse(input);
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const record = (await transaction.get(ref)).data();
    const stored = record?.website_atlas_grants?.[command.capture_id];
    if (!record || stored === undefined) throw new Error("website_atlas_grant_missing");
    const grant = parseWebsiteAtlasStoredGrant(stored);
    if (!grant || grant.request_id !== requestId || grant.capture_id !== command.capture_id)
      throw new Error("website_atlas_authorization_invalid");
    const amendments: Record<string, any>[] = Array.isArray(record.website_atlas_grant_amendments)
      ? record.website_atlas_grant_amendments : [];
    const last = [...amendments].reverse().find(row => row?.capture_id === command.capture_id);
    // The same owner amendment again: the grant already carries it.
    if (last && last.to_maximum_cost_usd === command.maximum_cost_usd && last.approval_reference === command.approval_reference
      && last.authorization_digest === digest(grant) && grant.maximum_cost_usd === command.maximum_cost_usd)
      return { status: "already_applied" as const, receipt: last };
    if (digest(grant) !== command.authorization_digest
      || command.approved_by !== record.website_scene_sponsorship?.owner?.user_id)
      throw new Error("website_atlas_grant_amendment_binding_invalid");
    if (grant.expires_at_epoch <= Date.now() / 1000) throw new Error("website_atlas_consent_expired");
    if (!projectWebsiteCaptureRights(record).derived_scene_generation_allowed) throw new Error("source_revoked");
    // A run the owner closed (or a capture another one replaced) is not raised.
    assertWebsiteRunOpen(record, requestId, command.capture_id);
    const approvedAt = Date.parse(command.approved_at_iso) / 1000;
    if (approvedAt > Date.now() / 1000) throw new Error("website_atlas_grant_amendment_approval_in_future");
    if (command.maximum_cost_usd <= grant.maximum_cost_usd) throw new Error("website_atlas_grant_amendment_not_increased");
    const amended = parseWebsiteAtlasStoredGrant({ ...grant, maximum_cost_usd: command.maximum_cost_usd });
    if (!amended) throw new Error("website_atlas_grant_amendment_out_of_bounds");
    const value = { schema_version: WEBSITE_ATLAS_GRANT_AMENDMENT_SCHEMA, request_id: requestId,
      capture_id: command.capture_id, approved_by: command.approved_by, approval_reference: command.approval_reference,
      from_maximum_cost_usd: grant.maximum_cost_usd, to_maximum_cost_usd: command.maximum_cost_usd,
      prior_authorization_digest: command.authorization_digest, authorization_digest: digest(amended),
      approved_at_iso: command.approved_at_iso, approved_at_epoch: approvedAt, applied_at_epoch: Date.now() / 1000 };
    const receipt = { ...value, amendment_digest: digest(value) };
    const change = { path: `inboundRequests/${requestId}.website_atlas_grants.${command.capture_id}.maximum_cost_usd`,
      from: grant.maximum_cost_usd, to: command.maximum_cost_usd };
    if (apply) transaction.update(ref, {
      website_atlas_grants: { ...record.website_atlas_grants, [command.capture_id]: amended },
      website_atlas_grant_amendments: [...amendments, receipt] });
    return { status: apply ? "applied" as const : "preview" as const, change, receipt };
  }));
}

function preparationObservationBinding(requestId: string, captureId: string, command: z.infer<typeof preparationSpendRequest>) {
  return { request_id: requestId, scene_id: `site-${requestId}`, capture_id: captureId,
    command_digest: digest(command), task_context_digest: command.task_context_digest,
    ...(command.source_video_digest ? { source_video_digest: command.source_video_digest } : {}) };
}

/** Historical accounting only. Neither absence nor a retained admission fences
 * an earlier in-flight reservation RPC or authorizes dispatch, retry or release.
 * This transaction deliberately has no writes and checks no current grant clock.
 */
export async function observeWebsitePreparationSpend(requestId: string, input: z.infer<typeof preparationSpendRequest>,
  captureId = `walkthrough-${requestId}`) {
  const command = preparationSpendRequest.parse(input);
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  const captureBinding = await resolveWebsiteCaptureBinding(requestId, `site-${requestId}`, captureId);
  return storeTimeout(store.runTransaction(async transaction => {
    const [request, brief, inventory] = await Promise.all([
      transaction.get(store.collection("inboundRequests").doc(requestId)),
      transaction.get(store.collection(TASK_BRIEFS_COLLECTION).doc(requestId)),
      transaction.get(store.collection("siteTaskItemInventories").doc(requestId)),
    ]);
    if (!request.exists) throw new Error("task_brief_missing");
    await assertWebsiteCaptureBindingInTransaction(transaction, requestId, captureBinding);
    const record = request.data()!;
    const reservations = record.website_preparation_reservations === undefined ? {} : record.website_preparation_reservations;
    const ledgerPrototype = reservations && typeof reservations === "object" ? Object.getPrototypeOf(reservations) : undefined;
    // Firestore maps are plain records; Timestamp and other native scalar
    // classes cannot establish that an exact reservation key is absent.
    if (!reservations || typeof reservations !== "object"
      || ledgerPrototype !== Object.prototype && ledgerPrototype !== null)
      throw new Error("website_scene_preparation_observation_invalid");
    const key = command.allocation_binding_digest.slice(7), row = reservations[key];
    const commandDigest = digest(command);
    if (Object.hasOwn(reservations, key) && (!row || typeof row !== "object" || Array.isArray(row)))
      throw new Error("website_scene_preparation_observation_invalid");
    if (row && row.command_digest !== commandDigest) throw new Error("idempotency_conflict");
    if (row) {
      const retainedCommand = preparationSpendRequest.safeParse(Object.fromEntries(
        Object.keys(preparationSpendRequest.shape).filter(field => Object.hasOwn(row.admission ?? {}, field))
          .map(field => [field, row.admission[field]])));
      if (!retainedCommand.success || digest(retainedCommand.data) !== commandDigest
        || row.admission.schema_version !== "paid_lane_admission.v1" || row.admission.status !== "admitted"
        || digest(row.admission.blockers) !== digest([]) || row.admission.external_disclosure_allowed !== true
        || !/^sha256:[a-f0-9]{64}$/.test(row.admission.sponsorship_digest)
        || !Number.isFinite(row.admission.expires_at_epoch) || row.admission.expires_at_epoch <= 0)
        throw new Error("website_scene_preparation_observation_invalid");
      if (row.settlement !== undefined) {
        const { actual_cost_usd: actual, status, ...settledCommand } = row.settlement ?? {};
        const settled = preparationSettlementRequest.safeParse(settledCommand);
        const expected = settled.success ? preparationSettlementCost(settled.data, command.maximum_cost_usd) : null;
        if (!settled.success || status !== "settled" || actual !== expected || actual > command.maximum_cost_usd
          || settled.data.task_context_digest !== command.task_context_digest
          || settled.data.allocation_binding_digest !== command.allocation_binding_digest || settled.data.provider !== command.provider
          || settled.data.provider === "openai" && settled.data.completed_request_count !== command.request_count)
          throw new Error("website_scene_preparation_observation_invalid");
      }
    }
    // New rows retain their exact capture mapping. Legacy rows need a retained
    // native grant/history, an exact Atlas grant, or the current source projection.
    // Missing provenance is unknown, never an authoritative not_reserved result.
    const binding = preparationObservationBinding(requestId, captureId, command);
    let sourceKnown = false;
    if (row?.observation_binding !== undefined) {
      if (digest(row.observation_binding) !== digest(binding))
        throw new Error("website_scene_preparation_observation_source_mismatch");
      sourceKnown = true;
    } else {
      const grants = [record.website_scene_sponsorship, ...(record.website_scene_sponsorship_history ?? [])];
      const native = grants.some(grant => {
        if (!grant || typeof grant !== "object") return false;
        const { authority_digest, ...payload } = grant;
        return authority_digest === digest(payload) && grant.schema_version === "website_scene_sponsorship.v1"
          && grant.request_id === requestId && grant.scene_id === binding.scene_id && grant.capture_id === captureId
          && grant.task_context_digest === command.task_context_digest
          && (!row || row.admission.sponsorship_digest === authority_digest);
      });
      const atlas = record.website_atlas_grants?.[captureId];
      const sourceIdentity = command.source_video_digest ? websiteAtlasSourceVideoIdentity(
        (await transaction.get(store.collection("captureUploadSessions").doc(captureId))).data()) : null;
      const atlasMatches = atlas?.schema_version === "website_atlas_authorization.v2" && atlas.request_id === requestId
        && atlas.capture_id === captureId && Boolean(command.source_video_digest)
        && atlas.source_video_digest === command.source_video_digest
        && sourceIdentity !== null && digest(atlas.source_video_identity) === digest(sourceIdentity)
        && (!row || row.admission.atlas_authorization_digest === digest(atlas));
      sourceKnown = native && !command.source_video_digest || Boolean(row && atlasMatches);
      if (!sourceKnown && brief.exists && brief.data()!.requestId === requestId) {
        const items = inventory.exists ? inventory.data() as TaskItemInventoryRecord : null;
        if (items && (items.requestId !== requestId || !Array.isArray(items.items)))
          throw new Error("website_task_item_inventory_invalid");
        const context = projectWebsiteTaskContext(brief.data() as SiteTaskBriefRecord, projectWebsiteCaptureRights(record), {
          inventory: items, captureId, captureBinding, purpose: retainedWebsiteScenePurpose(record),
          preparationGrantContextDigest: preparationGrantContextDigest(record) });
        sourceKnown = context.context_digest === command.task_context_digest && (!command.source_video_digest || atlasMatches);
      }
    }
    if (!sourceKnown) throw new Error("website_scene_preparation_observation_source_unknown");
    const observation = { schema_version: "website_preparation_spend_observation.v1", request_id: requestId,
      scene_id: binding.scene_id, capture_id: captureId, command_digest: commandDigest,
      allocation_binding_digest: command.allocation_binding_digest,
      status: row ? "reserved" : "not_reserved", dispatch_authorized: false, observed_at_epoch: Date.now() / 1000,
      ...(row ? { admission: row.admission, ...(row.settlement === undefined ? {} : { settlement: row.settlement }) } : {}) };
    if (Buffer.byteLength(JSON.stringify(observation), "utf8") > 200_000)
      throw new Error("website_scene_preparation_observation_too_large");
    return observation;
  }));
}

/** Reserve the full quote once; retries never replenish the preparation cap. */
export async function reserveWebsitePreparationSpend(requestId: string, input: z.infer<typeof preparationSpendRequest>,
  captureId = `walkthrough-${requestId}`,
  /** Set only by the Pipeline's signed preparation-spend route: the host checked the
   * account's monthly limit before asking. Every other caller keeps every refusal. */
  options: { hostRequested?: true } = {}) {
  const command = preparationSpendRequest.parse(input);
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const store = db;
  const captureBinding = await resolveWebsiteCaptureBinding(requestId, `site-${requestId}`, captureId);
  const atlasRequested = command.provider === "world_labs_atlas" || command.provider === "openai" && Boolean(command.source_video_digest)
    || command.atlas_auxiliary === true;
  // An automatic Atlas grant is a side lane: it needs no native/Marble
  // sponsorship. Without the grant policy, or when an explicit env row applies,
  // this is exactly the existing path.
  const automaticAtlas = atlasRequested && websiteAtlasAutomaticLane({ requestId, captureId,
    taskContextDigest: command.task_context_digest, sourceVideoDigest: command.source_video_digest });
  const result = await storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const [request, brief, inventory] = await Promise.all([
      transaction.get(ref), transaction.get(store.collection(TASK_BRIEFS_COLLECTION).doc(requestId)),
      transaction.get(store.collection("siteTaskItemInventories").doc(requestId)),
    ]);
    if (!request.exists || !brief.exists) throw new Error("task_brief_missing");
    await assertWebsiteCaptureBindingInTransaction(transaction, requestId, captureBinding);
    const record = request.data()!;
    assertWebsiteRunOpen(record, requestId, captureId);
    if (!record.website_scene_sponsorship && !automaticAtlas) throw noGrantRefusal(record, requestId);
    // Reservations never create a grant; only atlas-configuration does.
    const atlas = atlasRequested ? (await resolveWebsiteAtlasGrant({
      requestId, captureId, taskContextDigest: command.task_context_digest,
      sourceVideoDigest: command.source_video_digest, termsDigest: sceneProviderTerms().world_labs_atlas?.digest,
      now: Date.now() / 1000,
      planning: command.provider === "openai", plannerTermsDigest: sceneProviderTerms().openai?.digest,
      record, captureRights: projectWebsiteCaptureRights(record), create: false,
      readSession: async () => (await transaction.get(store.collection("captureUploadSessions").doc(captureId))).data(),
    })).grant : null;
    const rights = projectWebsiteCaptureRights(record);
    if (!rights.derived_scene_generation_allowed) throw new Error("source_revoked");
    if (atlas && atlas.accepted_by !== websiteAtlasGrantOwner(record, atlas))
      throw new Error("website_atlas_source_owner_mismatch");
    const atlasContext = atlas ? projectWebsiteTaskContext(brief.data() as SiteTaskBriefRecord, rights, {
      inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
      purpose: retainedWebsiteScenePurpose(record), captureId, captureBinding,
      preparationGrantContextDigest: preparationGrantContextDigest(record),
    }) : null;
    // The native/Marble grant stays spendable inside an owner-approved, time-only
    // window of its bound scene intent (operator door -> Pipeline -> signed notice,
    // mirrored on this job), re-verified here against the intake in this transaction.
    // Only the clock moves: caps, attempts, request limits, provider terms, rights and
    // the run-open check below are unchanged. Atlas grants keep their own clock.
    const executionWindowUntil = !atlas && record.website_scene_sponsorship_execution_window
      ? sponsorshipExecutionWindowUntil(record.website_scene_sponsorship, record,
        await sponsorshipWindowIntake(transaction, record)) : undefined;
    // This fresh Atlas-only grant does not renew the expired native/Marble
    // sponsorship or reopen any other preparation work.
    const authority = atlas ? { task_context_digest: atlasContext!.context_digest,
      authority_digest: atlas.authorization_digest, expires_at_epoch: atlas.expires_at_epoch } : websiteSceneSponsorship({ requestId, record, purpose: retainedWebsiteScenePurpose(record),
      brief: brief.data() as SiteTaskBriefRecord, inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
      captureId, captureBinding, now: Date.now() / 1000,
      ...(executionWindowUntil === undefined ? {} : { executionWindowUntil }) });
    if (command.task_context_digest !== authority.task_context_digest)
      throw new Error("website_scene_sponsorship_binding_invalid");
    if (!atlas && sceneProviderTerms()[command.provider]?.digest !== (authority as Record<string, any>).consent.provider_terms_reference)
      throw new Error("provider_terms_not_configured_or_changed");
    // Atlas auxiliary work shares the Atlas source cap, but never inherits Atlas's
    // provider disclosure. An automatic preview grant carries its own consent for
    // Meta segmentation and Google independent review, pinned to their terms when
    // it was made; every other grant keeps the native sponsorship/terms check.
    let auxiliaryTerms: string | undefined;
    let auxiliaryConsentDigest: string | undefined;
    let auxiliaryExpiresAt = Infinity;
    const automaticAuxiliary = atlas && "grant_basis" in atlas && atlas.grant_basis === "automatic_consented_preview"
      ? atlas.auxiliary?.[command.provider as AtlasAuxiliaryProvider] : undefined;
    if (automaticAuxiliary) {
      auxiliaryTerms = sceneProviderTerms()[command.provider]?.digest;
      if (!auxiliaryTerms || auxiliaryTerms !== automaticAuxiliary.provider_terms_reference)
        throw new Error("provider_terms_not_configured_or_changed");
      auxiliaryConsentDigest = atlas!.authorization_digest;
    } else if (atlas && ["meta", "google"].includes(command.provider)) {
      if (!record.website_scene_sponsorship) throw noGrantRefusal(record, requestId);
      const auxiliary = websiteSceneSponsorship({ requestId, record, purpose: retainedWebsiteScenePurpose(record),
        brief: brief.data() as SiteTaskBriefRecord, inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
        captureId, captureBinding, now: Date.now() / 1000 });
      auxiliaryConsentDigest = auxiliary.authority_digest;
      auxiliaryExpiresAt = auxiliary.expires_at_epoch;
      if (auxiliary.task_context_digest !== authority.task_context_digest)
        throw new Error("website_scene_sponsorship_binding_invalid");
      auxiliaryTerms = sceneProviderTerms()[command.provider]?.digest;
      if (!auxiliaryTerms || auxiliaryTerms !== auxiliary.consent.provider_terms_reference)
        throw new Error("provider_terms_not_configured_or_changed");
    }
    const reservations: Record<string, any> = record.website_preparation_reservations || {};
    const key = command.allocation_binding_digest.slice(7);
    if (reservations[key]) {
      if (reservations[key].command_digest !== digest(command)) throw new Error("idempotency_conflict");
      // Only the first transaction may dispatch. A retry on another worker
      // cannot spend again just because it lacks the first worker's files.
      return { ...reservations[key].admission, status: "already_reserved" };
    }
    assertNoMultiStepTaskHold({ brief: brief.data() as SiteTaskBriefRecord, record,
      inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null });
    // Atlas beta authorization is a separate explicit owner allowance. Its rows
    // never replenish the pre-existing preparation budget, or vice versa.
    const previous = Object.values(reservations).filter(row => !atlas && !row.admission.atlas_authorization_digest
      && row.admission.provider !== "world_labs_atlas");
    const micros = (amount: number) => Math.ceil(amount * 1_000_000);
    const usage = atlas ? atlasAllowanceUsage(reservations) : null;
    const reserved = usage ? micros(usage.cost) : previous.reduce((sum, row) => sum + micros(row.settlement?.actual_cost_usd ?? row.admission.maximum_cost_usd), 0);
    // Amendments and reservations belong to the original retained allowance.
    const rootAuthority = record.website_scene_sponsorship;
    const nowEpoch = Date.now() / 1000;
    // Owner decision 2026-11-10: on a grant naming the automatic budget extension, a
    // reservation the Pipeline asked for (after its account-limit precheck) is not stopped
    // by this job's own dollar figures. It needs the grant itself, verified and unexpired.
    const extended = options.hostRequested === true && automaticBudgetExtensionGrant(rootAuthority,
      atlas ? undefined : sponsorshipValidUntil(rootAuthority, executionWindowUntil), nowEpoch);
    const allowanceUsd = atlas?.maximum_cost_usd ?? preparationSpendLimit(record, rootAuthority);
    const pastAllowance = reserved + micros(command.maximum_cost_usd) > Math.floor(allowanceUsd * 1_000_000);
    // Owner decision 2026-10-30: money is the Atlas allowance's hard stop. Its
    // request counts are recorded on every reservation, never a separate ceiling.
    // The native ledger keeps its amendable request limit for now; it refuses on every
    // grant, the automatic budget extension included.
    if (pastAllowance && !extended
        || (!atlas && previous.reduce((sum, row) => sum + row.admission.request_count, 0) + command.request_count
          > preparationRequestLimit(record, rootAuthority)))
      throw new Error("website_scene_preparation_budget_exhausted");
    // Owner decision 2026-10-30: one dollar ceiling per job. The caps above stay;
    // every ledger this job spends from must also fit under the job's ceiling.
    const job = await checkWebsiteJobCeiling({ record, captureId, requestId, atlas,
      reader: transactionJobLedgerReader(store, transaction, requestId), additionalCostUsd: command.maximum_cost_usd });
    // Owner decision 2026-11-11: a record whose figure cannot be read is counted as before and
    // reported once per job, whatever this admission decides (so a refusal records it too).
    const recordUnreadable = await websiteJobSpendUnreadableAlert(store, transaction, requestId, job.spend,
      { stage: "preparation_reservation", reservation_key: key });
    if (job.exceeded && !extended) { recordUnreadable(); return SAFETY_LIMIT_REACHED; }
    // Owner decision 2026-11-11: past the job's ceiling a flagged grant still builds with a note, but
    // never past its safety limit, a fuse against a bug burning the month in one job. The job's one
    // safety-limit alert is recorded and the refusal is thrown once this transaction commits.
    if (extended && job.pastSafetyLimit) {
      const recordSafety = await websiteJobSafetyLimitAlert(store, transaction, requestId, websiteJobSafetyLimitRecord(job,
        { stage: "preparation_reservation", reservation_key: key, additional_cost_usd: command.maximum_cost_usd }));
      recordSafety(); recordUnreadable();
      return SAFETY_LIMIT_REACHED;
    }
    const overBudget = extended && (pastAllowance || job.exceeded) ? {
      schema_version: "website_job_over_budget.v1", basis: "automatic_budget_extension",
      sponsorship_digest: rootAuthority.authority_digest,
      allowance: atlas ? "atlas_allowance" : "preparation_upstream_cap", allowance_usd: allowanceUsd,
      allowance_exceeded: pastAllowance, job_ceiling_usd: job.ceiling.maximum_cost_usd,
      job_ceiling_source: job.ceiling.source, job_ceiling_exceeded: job.exceeded,
      // An unreadable earlier hold is unknown, never a figure.
      job_reserved_or_settled_before_usd: Number.isFinite(job.spend.total_micros) ? job.spend.total_micros / 1_000_000 : null,
      recorded_at_epoch: nowEpoch } : null;
    // One ops alert per job and grant, the first time it passes its original budget.
    const recordAlert = overBudget
      ? await websiteJobOverBudgetAlert(store, transaction, requestId, overBudget, { reservation_key: key }) : () => {};
    const admission = { ...command, schema_version: "paid_lane_admission.v1", status: "admitted",
      blockers: [], external_disclosure_allowed: true, sponsorship_digest: authority.authority_digest,
      ...(atlas ? { atlas_authorization_digest: atlas.authorization_digest,
        provider_terms_reference: auxiliaryTerms ?? (command.provider === "openai" ? atlas.planner!.provider_terms_reference : atlas.provider_terms_reference),
        provider_retention: auxiliaryTerms ? "accepted_auxiliary_provider_terms" : atlas.provider_retention,
        ...(auxiliaryConsentDigest ? { auxiliary_consent_digest: auxiliaryConsentDigest } : {}),
        provider_training_authorized: command.provider === "openai" || Boolean(auxiliaryTerms) ? false : atlas.provider_training_authorized } : {}),
      // The native grant's window (its own expiry unless a verified intent window
      // extends it, never past expiry + 7 days), inside every other bound.
      expires_at_epoch: Math.min(sponsorshipValidUntil(authority, executionWindowUntil),
        atlas?.expires_at_epoch ?? Infinity, auxiliaryExpiresAt) };
    transaction.update(ref, { website_preparation_reservations: { ...reservations,
      [key]: { command_digest: digest(command), admission,
        observation_binding: preparationObservationBinding(requestId, captureId, command),
        ...(overBudget ? { over_budget: overBudget } : {}) } } });
    recordAlert();
    recordUnreadable();
    return admission;
  }));
  if (result === SAFETY_LIMIT_REACHED) throw new Error(WEBSITE_JOB_SAFETY_LIMIT_REACHED);
  return result;
}

/** Planning configuration, never dispatch authority. create:false is strictly
 * non-authorizing; existing callers may still create the first automatic grant. */
export async function loadWebsiteAtlasConfiguration(requestId: string, captureId: string,
  input: { task_context_digest: string; source_video_digest: string; create?: false }) {
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const binding = await resolveWebsiteCaptureBinding(requestId, `site-${requestId}`, captureId);
  const store = db;
  return storeTimeout(store.runTransaction(async transaction => {
    const ref = store.collection("inboundRequests").doc(requestId);
    const [request, brief, inventory] = await Promise.all([
      transaction.get(ref),
      transaction.get(store.collection(TASK_BRIEFS_COLLECTION).doc(requestId)),
      transaction.get(store.collection("siteTaskItemInventories").doc(requestId)),
    ]);
    await assertWebsiteCaptureBindingInTransaction(transaction, requestId, binding);
    const record = request.data();
    if (!record || !brief.exists || !record.website_scene_sponsorship && !websiteAtlasGrantPolicy())
      throw new Error("task_brief_missing");
    const rights = projectWebsiteCaptureRights(record);
    if (!rights.derived_scene_generation_allowed) throw new Error("source_revoked");
    if (input.create !== false) assertNoMultiStepTaskHold({ brief: brief.data() as SiteTaskBriefRecord, record,
      inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null });
    const context = projectWebsiteTaskContext(brief.data() as SiteTaskBriefRecord, rights, {
      inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
      purpose: retainedWebsiteScenePurpose(record), captureId, captureBinding: binding,
      preparationGrantContextDigest: preparationGrantContextDigest(record) });
    if (context.context_digest !== input.task_context_digest) throw new Error("website_scene_sponsorship_binding_invalid");
    const { grant: authority, created } = await resolveWebsiteAtlasGrant({ requestId, captureId,
      taskContextDigest: context.context_digest, sourceVideoDigest: input.source_video_digest,
      termsDigest: sceneProviderTerms().world_labs_atlas?.digest,
      plannerTermsDigest: sceneProviderTerms().openai?.digest, planning: true, now: Date.now() / 1000,
      auxiliaryTermsDigests: { meta: sceneProviderTerms().meta?.digest, google: sceneProviderTerms().google?.digest },
      record, captureRights: rights, create: input.create !== false,
      readSession: async () => (await transaction.get(store.collection("captureUploadSessions").doc(captureId))).data() });
    if (authority.accepted_by !== websiteAtlasGrantOwner(record, authority))
      throw new Error("website_atlas_source_owner_mismatch");
    const accounting = input.create === false
      ? websitePreparationAccounting(record.website_preparation_reservations ?? {}) : null;
    const inferenceAccounting = input.create === false ? await websiteCaptureInferenceAccounting({
      requestId, captureId, sourceVideoDigest: input.source_video_digest, record,
      reader: {
        document: async (collection, id) => (await transaction.get(store.collection(collection).doc(id))).data() ?? null,
        calls: async (budgetId, limit) => (await transaction.get(store.collection("captureCoverageReviews").doc(budgetId)
          .collection("calls").orderBy("__name__").limit(limit))).docs.map(row => ({ id: row.id, value: row.data() })),
      },
    }) : null;
    const usage = atlasAllowanceUsage(record.website_preparation_reservations || {});
    const policy = websiteAtlasRuntimePolicy();
    // The job's one ceiling across all of its ledgers; the allowance figures above stay Atlas-only.
    const ceiling = websiteJobCeiling({ record, captureId, requestId, atlas: authority });
    const jobCeiling = websiteJobCeilingSummary(ceiling,
      await websiteJobSpend({ record, reader: transactionJobLedgerReader(store, transaction, requestId) }));
    // First writer wins: a concurrent creation retries this transaction and then reads it.
    if (created && input.create !== false)
      transaction.update(ref, { website_atlas_grants: { ...(record.website_atlas_grants ?? {}), [captureId]: created } });
    const configuration = { schema_version: "website_atlas_configuration.v1", authority, policy,
      reserved_or_settled_cost_usd: usage.cost, remaining_cost_usd: Math.max(0, authority.maximum_cost_usd - usage.cost),
      job_ceiling: jobCeiling, task_context_digest: context.context_digest,
      source_video_digest: input.source_video_digest, dispatch_authorized: false,
      ...(accounting ? { grant_creation_allowed: false, ...accounting, capture_inference_accounting: inferenceAccounting } : {}) };
    // Authority/policy strings are configuration-owned and not all have schema
    // maxima. Bound the entire read without omitting any reservation or hold.
    if (input.create === false && Buffer.byteLength(JSON.stringify(configuration), "utf8") > 200_000)
      throw new Error("website_atlas_accounting_response_too_large");
    return configuration;
  }));
}

/** The subject was removed from the capture before reconstruction, or is a designed object the task adds
 * to the preserved capture (the Pipeline's website_synthetic_subject). Either way the scene is the capture's own. */
const WEBSITE_SUBJECT_ORIGINS = new Set(["removed_before_reconstruction", "synthetic_design"]);

export function validateWebsiteSponsoredIntake(request: Record<string, any>, authority: Record<string, any>) {
  const preparationOnly = request.execution?.purpose === "scene_preparation";
  // A correction or a renewal is a derivative of a preparation grant's own capture.
  const revision = websitePreparationRevision(request) ?? websitePreparationRenewal(request);
  if (revision && authority.purpose !== "scene_preparation") throw new Error("website_scene_sponsorship_binding_invalid");
  const family = isTaskFamilyStrategy(request.task?.strategy);
  if (family) {
    websiteFamilySourceBinding(request.task, authority as Parameters<typeof websiteFamilySourceBinding>[1]);
    if (!preparationOnly || request.execution.policy_candidates?.length !== 0)
      throw new Error("website_scene_sponsorship_family_binding_invalid");
  }
  // A navigation intake keeps its scene as filmed: preparation only, no policies, the
  // same task, capture, owner, consent and rights binding as any other intake below,
  // and only for a brief the site confirmed (the consent is the sponsorship's own, so
  // its task_confirmed is the website's reading of the brief, never the caller's).
  const navigation = isNavigationStrategy(request.task?.strategy);
  if (navigation) {
    if (!navigationIntakeTask.safeParse(request.task).success || !preparationOnly
      || request.execution.policy_candidates?.length !== 0)
      throw new Error("website_scene_sponsorship_navigation_binding_invalid");
    if (authority.consent?.task_confirmed !== true) throw new Error("website_task_context_not_confirmed");
    // The site's brief is confirmed but the request still says otherwise: a stale request, not an
    // unconfirmed brief.
    if (request.consent?.task_confirmed !== true) throw new Error("website_scene_sponsorship_binding_invalid");
  }
  // An unconfirmed task binds only a Blueprint preparation grant's own scope.
  if (authority.purpose === "scene_preparation" && !preparationOnly
    || request.consent?.task_confirmed !== true && !(preparationOnly && authority.purpose === "scene_preparation"
      && request.consent?.task_confirmed === false)
    || preparationOnly && (request.execution.policy_candidates?.length !== 0
      || [request.task, request.execution].some(value => ["robot_binding_id", "robot_profile_id", "evaluation_run_id", "evaluation_binding_id", "evaluation_source"]
        .some(key => Object.hasOwn(value ?? {}, key)))))
    throw new Error("website_scene_sponsorship_binding_invalid");
  const test = request.task?.subject?.test_environment;
  const development = test !== undefined;
  if (development) {
    const parsed = websiteDevelopmentTestEnvironment.safeParse(test);
    let allowed: unknown;
    try { allowed = JSON.parse(process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_TASK_DIGESTS || "[]"); }
    catch { throw new Error("website_scene_development_test_not_authorized"); }
    if (!parsed.success || !Array.isArray(allowed) || !allowed.includes(authority.task_context_digest)
      || test.source_task_context_digest !== authority.task_context_digest)
      throw new Error("website_scene_development_test_not_authorized");
  }
  const prefix = development ? "website-development-" : "website-splat-";

  if (websitePreparationCaptureId(request) !== authority.capture_id
    || digest(request.owner) !== digest(authority.owner)
    || digest(request.consent) !== digest(authority.consent)
    || request.source?.kind !== (development ? "mesh" : "gaussian_splat")
    || typeof request.source?.binding_id !== "string"
    || !/^sha256:[0-9a-f]{64}$/.test(request.source?.content_digest || "")
    || request.source.binding_id !== `${prefix}${request.source.content_digest.slice(7, 39)}`
    || request.task?.task_id !== `website-${authority.task_context_digest.slice(7, 27)}${development ? "-development" : ""}`
    || !family && !navigation && !WEBSITE_SUBJECT_ORIGINS.has(request.task?.subject?.geometry_origin)
    || request.execution?.max_total_spend_usd !== authority.max_total_spend_usd
    || request.execution?.max_paid_attempts !== authority.max_paid_attempts
    || request.execution?.expires_at_epoch !== authority.expires_at_epoch
    // At most what THIS grant allows: a grant issued before the allowance names none, so only 0 passes.
    || !WEBSITE_SCENE_MAX_RETRIES.includes(request.execution?.max_retries)
    || request.execution.max_retries > (authority.scene_configuration_max_retries ?? 0)
    // Like the retry allowance: an intent names the extension only when its grant does.
    || request.execution.automatic_budget_extension !== undefined
      && (request.execution.automatic_budget_extension !== true || authority.automatic_budget_extension !== true)
    || request.execution?.claim_scope !== "development_only"
    || digest(request.execution?.allowed_providers) !== digest(authority.authoring_provider === "anthropic"
      ? ["vast", "openai", "anthropic"] : ["vast", "openai"]))
    throw new Error("website_scene_sponsorship_binding_invalid");
}

/** Sponsored Claude disclosure has its own signed terms reference. */
export function validateWebsiteSponsoredProviderTerms(
  command: { execution: { allowed_providers: string[] }; consent: { provider_terms_reference: string } },
  authority: Record<string, any>,
) {
  const terms = sceneProviderTerms();
  if (!command.execution.allowed_providers.every(provider => provider === "anthropic"
    ? authority.authoring_provider === "anthropic"
      && terms.anthropic?.digest === authority.anthropic_provider_terms_reference
    : terms[provider]?.digest === command.consent.provider_terms_reference))
    throw new Error("provider_terms_not_configured_or_changed");
}
