import { ANNOUNCED_SUPERSEDED_VERSION, PREVIOUS_PRIVACY_VERSION, PRIVACY_VERSION } from "../../client/src/lib/legalAcceptance";
import type { AgentProvider, AgentTaskKind } from "./types";

/**
 * The data-class gate: which model provider may receive which kind of data,
 * under which Privacy Policy version. It is always on. Privacy is a hard stop:
 * a provider the policy does not name for every kind of data a lane sends is
 * never chosen for that lane, by any route (default order, fallback, a lane or
 * global setting, the shadow setting, a saved session, a profile, a caller's
 * pin), and no call is made to it.
 *
 * Three tables, each read by the gate and checked by tests:
 * 1. LANE_DATA_CLASSES and PROFILE_DATA_CLASSES: what each lane and each
 *    built-in agent profile sends, from its task definition and prompt builder.
 * 2. PROVIDER_DESTINATIONS: which company receives what a provider id sends.
 * 3. PRIVACY_POLICY_PROVIDER_ROWS: per Privacy Policy version, the provider
 *    rows of "AI, 3D processing and compute" and the kinds of data each row's
 *    words name. A drift test compares the words with the legal pages.
 */

/**
 * - `site_job_text`: a site's own words about its job (the description, the
 *   task statement, the site's answers).
 * - `job_records`: records of a site's job that Blueprint produced (preview
 *   runs, statuses, briefs, research notes matched to the job).
 * - `personal_info`: personal information (a person's name, email, phone, or
 *   their own words in a request or message).
 * - `staff_tools`: a staff member's messages to an agent whose tools read jobs
 *   and company history (records of companies and the people Blueprint wrote to).
 * - `site_frames`, `site_video`: frames or footage from a site's capture.
 * - `public_material`: material already public (a robot company's published
 *   pages), with no site data and no personal information about a user.
 */
export type AgentDataClass =
  | "site_job_text"
  | "job_records"
  | "personal_info"
  | "staff_tools"
  | "site_frames"
  | "site_video"
  | "public_material";

export type DataClassRow = { classes: readonly AgentDataClass[]; source: string };

/** Table 1a. Every lane; the type makes a new lane add its row. */
export const LANE_DATA_CLASSES: Record<AgentTaskKind, DataClassRow> = {
  waitlist_triage: { classes: ["personal_info"],
    source: "tasks/waitlist-triage.ts: the submission's email, role, location type and market" },
  inbound_qualification: { classes: ["personal_info", "site_job_text"],
    source: "tasks/inbound-qualification.ts: the requester's company, role, site name and location, and their own description of the job" },
  post_signup_scheduling: { classes: ["personal_info"],
    source: "tasks/post-signup-scheduling.ts: the contact's name, email, phone, company and address" },
  support_triage: { classes: ["personal_info"],
    source: "tasks/support-triage.ts: the requester's name, email and message" },
  preview_diagnosis: { classes: ["job_records"],
    source: "tasks/preview-diagnosis.ts: the job's request id, preview status, failure reason and manifest locations" },
  operator_thread: { classes: ["staff_tools", "job_records", "personal_info", "site_job_text"],
    source: "tasks/operator-thread.ts with operator-tools.ts: staff messages; tools read jobs, requests and company history" },
  external_harness_thread: { classes: ["staff_tools", "job_records", "personal_info", "site_job_text"],
    source: "tasks/external-harness-thread.ts: a staff message and its context, sent to an outside harness" },
  adp_run_operator: { classes: ["job_records", "site_job_text"],
    source: "tasks/adp-run-operator.ts: an admitted Task Evaluation task and its records" },
  site_video_evidence: { classes: ["site_video", "site_job_text"],
    source: "tasks/site-video-evidence.ts: the footage with the job's description" },
  capture_video_privacy: { classes: ["site_video"],
    source: "tasks/capture-video-privacy.ts: the uploaded footage, for the privacy question only" },
  capture_coverage: { classes: ["site_video", "site_job_text"],
    source: "tasks/capture-coverage.ts: the footage with the job's description" },
  site_assessment: { classes: ["site_frames", "site_video", "site_job_text", "job_records"],
    source: "tasks/site-assessment.ts (retired 2026-11-11): footage, frames, the brief and the job's records" },
  site_task_brief_reading: { classes: ["site_job_text"],
    source: "tasks/site-task-brief-reading.ts: the site's own task description" },
  robot_capability_extraction: { classes: ["public_material"],
    source: "tasks/robot-capability-extraction.ts: a robot company's public pages, already fetched" },
  robot_fit_ranking: { classes: ["site_job_text", "job_records", "public_material"],
    source: "tasks/robot-fit-ranking.ts: one site's job with Blueprint's research notes on robot teams" },
  capture_dispatch: { classes: ["site_job_text"],
    source: "tasks/capture-dispatch.ts: what the site typed, its gate answers and site description" },
  outbound_outreach: { classes: ["personal_info"],
    source: "tasks/outbound-outreach.ts: a prospect facility's name, address and sourced facts, for the email drafted to it" },
};

/**
 * Table 1b. Every built-in agent profile, by key: its lane's data plus what
 * its environment adds. A profile is gated on these classes.
 */
export const PROFILE_DATA_CLASSES: Record<string, DataClassRow> = {
  "ops-operator": { classes: ["staff_tools", "job_records", "personal_info", "site_job_text"],
    source: "operator_thread; tools: company-history search and fetch, growth-campaign drafts and queued sends" },
  "support-triage-specialist": { classes: ["personal_info"], source: "support_triage" },
  "preview-diagnosis-specialist": { classes: ["job_records"], source: "preview_diagnosis, with browser evidence of the preview" },
  "research-subagent": { classes: ["staff_tools", "job_records", "personal_info", "site_job_text", "public_material"],
    source: "operator_thread with web research" },
  "browser-research-subagent": { classes: ["staff_tools", "job_records", "personal_info", "site_job_text", "public_material"],
    source: "operator_thread with read-only browser research" },
  "implementation-subagent": { classes: ["staff_tools", "job_records", "personal_info", "site_job_text"],
    source: "external_harness_thread through the ACP harness" },
  "launch-qa-subagent": { classes: ["staff_tools", "job_records", "personal_info", "site_job_text"],
    source: "operator_thread with launch-surface browser checks" },
  "review-subagent": { classes: ["staff_tools", "job_records", "personal_info", "site_job_text"],
    source: "operator_thread reviewing earlier work" },
  "adp-run-operator": { classes: ["job_records", "site_job_text"], source: "adp_run_operator" },
};

/** The policy row that names a company, or null when the policy names none for it. */
export type ProviderDestination = { company: string; policy_row: string | null; how: string };

/** Table 2. Every provider id and who receives what it sends, from the adapters. */
export const PROVIDER_DESTINATIONS: Record<AgentProvider, ProviderDestination> = {
  openai_responses: { company: "OpenAI", policy_row: "OpenAI",
    how: "adapters/openai-responses.ts: OpenAI's API at api.openai.com (pinned; utils/openaiApiHost.ts)" },
  openai_agents_api: { company: "OpenAI", policy_row: "OpenAI",
    how: "the Pipeline's admitted-task controller on OpenAI's agents API" },
  openai_agents_sdk: { company: "OpenAI", policy_row: "OpenAI", how: "OpenAI's agents SDK on OpenAI's API" },
  anthropic_agent_sdk: { company: "Anthropic", policy_row: "Anthropic",
    how: "adapters/anthropic-agent-sdk.ts: Anthropic's API at api.anthropic.com (pinned; provider-config.ts)" },
  gemini_video: { company: "Google", policy_row: "Google Gemini", how: "adapters/gemini-video.ts: Google's Gemini API" },
  // The Codex command-line tool on the machine that runs the server, signed in
  // with its own login (~/.codex/auth.json): it sends to OpenAI under that
  // login's terms, not under the API account the policy's OpenAI row covers.
  codex_local: { company: "OpenAI, through the local Codex login", policy_row: null,
    how: "adapters/codex-local.ts: runs the codex command on this machine" },
  // A service at ACP_HARNESS_URL that runs a coding harness (codex,
  // claude_code, claude_agent_sdk or custom); which company finally receives
  // the text depends on that service and harness. The policy names neither.
  acp_harness: { company: "whoever runs the service at ACP_HARNESS_URL, and its harness's model company", policy_row: null,
    how: "adapters/acp-harness.ts: POSTs the task to ACP_HARNESS_URL" },
  // A gateway at OPENCLAW_BASE_URL that runs browser actions and a model of
  // whichever company the gateway is set up with. The policy names neither.
  openclaw: { company: "whoever runs the gateway at OPENCLAW_BASE_URL, and its model company", policy_row: null,
    how: "runtime.ts startActionSession: sends the task to the OpenClaw gateway" },
};

export type PolicyRow = { words: string; classes: readonly AgentDataClass[] };

/**
 * The provider rows of "AI, 3D processing and compute" in one Privacy Policy
 * version, with the kinds of data each row's words name. A row for a company
 * that is not an agent provider here (Meta, World Labs, Vast.ai) names no
 * class; so does the DeepSeek row, whose provider the website no longer has.
 */
const AI_ROWS_2026_11: Record<string, PolicyRow> = {
  OpenAI: {
    words: "Reading the job description and frames from a site capture to draft the job brief and prepare the simulated scene, drafting replies, and sorting incoming requests",
    // "the job description" (site_job_text), "frames from a site capture"
    // (site_frames), "prepare the simulated scene" (the job's records, which
    // preview diagnosis and the ranking read), "drafting replies, and sorting
    // incoming requests" (personal_info). Public material is not information
    // collected from anyone.
    // staff_tools (planner decision 2026-11-13, on the owner's list): a staff
    // thread's tools return "the job description", the job's records and the
    // requests and replies the row names ("drafting replies, and sorting
    // incoming requests"), and the staff thread ran on OpenAI before this
    // change in an OpenAI-only deployment. The new Privacy version must name
    // internal staff work for OpenAI in words (Group D).
    classes: ["site_job_text", "site_frames", "job_records", "personal_info", "public_material", "staff_tools"],
  },
  "Google Gemini": {
    words: "Watching site footage, with its sound removed, and frames from it to draft and check the job brief and to find what the simulated scene needs",
    classes: ["site_video", "site_frames", "site_job_text"],
  },
  Meta: { words: "Outlining objects and areas in site footage, with its sound removed, to prepare the simulated scene", classes: [] },
  Anthropic: {
    words: "Drafting the job brief from capture frames only when a site explicitly chooses that option, and drafting and sorting internal work where we configure it",
    // Frames only on a site's explicit choice: a consent of its own, not a
    // permission for any lane here. "Internal work" is read as work carrying
    // no site data and no one's personal information; staff_tools carries
    // both through its tools, so it is not named here either.
    classes: ["public_material"],
  },
  DeepSeek: { words: "Drafting and sorting internal work, where we configure it", classes: [] },
  "World Labs": { words: "Rebuilding a work area as a 3D scene from site footage, with its sound removed", classes: [] },
  "Vast.ai": { words: "Cloud GPU servers that rebuild scenes and run simulated evaluations", classes: [] },
};

/**
 * Table 3, keyed by Privacy Policy version: the versions data can have been
 * received under. Data received under a version keeps that version's
 * promises, so a new version is added here, never edited into an old one.
 * Group D adds the next version as one more entry.
 */
export const PRIVACY_POLICY_PROVIDER_ROWS: Record<string, { page: string; rows: Record<string, PolicyRow> }> = {
  [PREVIOUS_PRIVACY_VERSION]: { page: "client/src/pages/PrivacyPrevious.tsx", rows: AI_ROWS_2026_11 },
  [PRIVACY_VERSION]: { page: "client/src/pages/Privacy.tsx", rows: AI_ROWS_2026_11 },
  [ANNOUNCED_SUPERSEDED_VERSION]: { page: "client/src/pages/PrivacyAnnounced.tsx", rows: AI_ROWS_2026_11 },
};

/**
 * A lane kept, unchanged, on a destination the policy does not name, because
 * it runs there today and only where the owner configured it. Not a general
 * permission: the lane may use this provider and nothing else, and no other
 * lane may use this provider for restricted data. The connectivity view warns
 * with `code` whenever the lane is configured. The next Privacy version must
 * either name this destination or end the exception.
 */
export type StatusQuoException = {
  status: "status_quo_exception";
  task_kind: AgentTaskKind;
  provider: AgentProvider;
  code: "privacy_destination_not_named";
  why: string;
};

const STATUS_QUO_EXCEPTIONS_2026_11: readonly StatusQuoException[] = [
  { status: "status_quo_exception", task_kind: "external_harness_thread", provider: "acp_harness",
    code: "privacy_destination_not_named",
    why: "Pinned to the ACP harness in tasks/external-harness-thread.ts; runs only where ACP_HARNESS_URL is configured. "
      + "The new Privacy version must name the harness's destination or end this lane." },
];

/** The exceptions per Privacy Policy version (the same versions as the provider rows). */
export const PRIVACY_STATUS_QUO_EXCEPTIONS: Record<string, readonly StatusQuoException[]> = {
  [PREVIOUS_PRIVACY_VERSION]: STATUS_QUO_EXCEPTIONS_2026_11,
  [PRIVACY_VERSION]: STATUS_QUO_EXCEPTIONS_2026_11,
  [ANNOUNCED_SUPERSEDED_VERSION]: STATUS_QUO_EXCEPTIONS_2026_11,
};

export function statusQuoExceptionForLane(taskKind: AgentTaskKind, version = PRIVACY_VERSION): StatusQuoException | null {
  return PRIVACY_STATUS_QUO_EXCEPTIONS[resolvePrivacyVersion(version)]?.find((entry) => entry.task_kind === taskKind) ?? null;
}

/** The version whose promises apply: the one recorded on the data when known here, otherwise the current one. */
export function resolvePrivacyVersion(recorded?: unknown): string {
  const value = typeof recorded === "string" ? recorded.trim() : "";
  return value && PRIVACY_POLICY_PROVIDER_ROWS[value] ? value : PRIVACY_VERSION;
}

export function privacyVersionForTask(task: { metadata?: Record<string, unknown> | null }): string {
  const metadata = task.metadata && typeof task.metadata === "object" ? task.metadata : {};
  return resolvePrivacyVersion(metadata.privacy_policy_version);
}

export type PrivacyDecision = {
  permitted: boolean;
  version: string;
  data_classes: readonly AgentDataClass[];
  /** The kinds of data the provider's policy row does not name. */
  blocked_by: AgentDataClass[];
  policy_row: string | null;
  /** Set when the decision is a lane's status-quo exception, not a policy row. */
  status_quo_exception?: StatusQuoException;
};

export function privacyDecisionForClasses(provider: AgentProvider | string, classes: readonly AgentDataClass[],
  version = PRIVACY_VERSION): PrivacyDecision {
  const resolved = resolvePrivacyVersion(version);
  const rowName = PROVIDER_DESTINATIONS[provider as AgentProvider]?.policy_row ?? null;
  const row = rowName ? PRIVACY_POLICY_PROVIDER_ROWS[resolved].rows[rowName] : undefined;
  const blocked = classes.filter((dataClass) => !row?.classes.includes(dataClass));
  return { permitted: blocked.length === 0, version: resolved, data_classes: classes, blocked_by: blocked, policy_row: rowName };
}

/**
 * A lane with a status-quo exception may use its one provider and nothing
 * else; otherwise the decision is the policy rows' for the classes given.
 */
export function privacyDecisionForLane(provider: AgentProvider | string, taskKind: AgentTaskKind,
  classes: readonly AgentDataClass[], version = PRIVACY_VERSION): PrivacyDecision {
  const exception = statusQuoExceptionForLane(taskKind, version);
  if (exception) {
    const permitted = exception.provider === provider;
    return { permitted, version: resolvePrivacyVersion(version), data_classes: classes,
      blocked_by: permitted ? [] : [...classes], policy_row: PROVIDER_DESTINATIONS[provider as AgentProvider]?.policy_row ?? null,
      ...(permitted ? { status_quo_exception: exception } : {}) };
  }
  return privacyDecisionForClasses(provider, classes, version);
}

/** Whether a provider may receive a lane's data (a lane with no row is treated as sending everything). */
export function privacyDecision(provider: AgentProvider | string, taskKind: AgentTaskKind, version = PRIVACY_VERSION): PrivacyDecision {
  const classes = LANE_DATA_CLASSES[taskKind]?.classes ?? ["site_job_text", "job_records", "personal_info", "staff_tools"];
  return privacyDecisionForLane(provider, taskKind, classes, version);
}

/** The typed failure when no provider the policy names for a lane's data is configured. */
export const NO_PERMITTED_PROVIDER = "no_permitted_provider";
/** The typed failure when the chosen or pinned provider is not named for the lane's data. */
export const PRIVACY_NOT_PERMITTED = "privacy_not_permitted";
