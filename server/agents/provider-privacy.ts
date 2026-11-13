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
 * - `fixed_text`: text written in the code itself (the runtime smoke test),
 *   carrying no data from anyone.
 */
export type AgentDataClass =
  | "site_job_text"
  | "job_records"
  | "personal_info"
  | "staff_tools"
  | "site_frames"
  | "site_video"
  | "public_material"
  | "fixed_text";

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
  site_task_follow_up: { classes: ["site_job_text"],
    source: "tasks/site-task-follow-up.ts: the site's task statement, its brief summary and item labels" },
  runtime_smoke_test: { classes: ["fixed_text"],
    source: "tasks/runtime-smoke-test.ts: a prompt written in the code; no input is read, no tools" },
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
    // incoming requests" (personal_info). Public material and fixed text are
    // not information collected from anyone. Not "internal work": staff
    // messages with tools that read jobs and company history (staff_tools)
    // are named for no provider in this version (re-check, 2026-11-13).
    classes: ["site_job_text", "site_frames", "job_records", "personal_info", "public_material", "fixed_text"],
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
    classes: ["public_material", "fixed_text"],
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
 * The strictest table: a row permits a class only where every known version
 * permits it. It applies whenever the version of the data is absent or
 * unknown here.
 *
 * Known limit: the version is taken from the caller's task metadata
 * (`privacy_policy_version`), not from the stored job. While every version
 * has the same rows this changes nothing; when a version first differs,
 * reading it from the stored job is Group D's work. Until then an absent or
 * unknown version can only make the gate stricter, never looser.
 */
export const STRICTEST_PRIVACY_TABLE = "strictest_of_known_versions";

function strictestRows(): Record<string, PolicyRow> {
  const versions = Object.values(PRIVACY_POLICY_PROVIDER_ROWS);
  const names = new Set(versions.flatMap((entry) => Object.keys(entry.rows)));
  return Object.fromEntries([...names].map((name) => {
    const rows = versions.map((entry) => entry.rows[name]);
    const classes = rows.every(Boolean) ? rows[0].classes.filter((dataClass) => rows.every((row) => row.classes.includes(dataClass))) : [];
    return [name, { words: rows[0]?.words ?? "", classes }];
  }));
}

function rowsFor(version: string): Record<string, PolicyRow> {
  return version === STRICTEST_PRIVACY_TABLE ? strictestRows() : PRIVACY_POLICY_PROVIDER_ROWS[version].rows;
}

/** The table that applies: the version recorded on the data when known here, otherwise the strictest table. */
export function resolvePrivacyVersion(recorded?: unknown): string {
  const value = typeof recorded === "string" ? recorded.trim() : "";
  return value && PRIVACY_POLICY_PROVIDER_ROWS[value] ? value : STRICTEST_PRIVACY_TABLE;
}

/**
 * Checked when this module loads (the web service and the worker at boot, and
 * CI): the current Privacy Policy version must have its rows here, so a
 * missing version fails at start-up, never on a request.
 */
export function assertPrivacyTableCoversVersion(table: Record<string, unknown>, version: string) {
  if (!table[version]) throw new Error(`privacy_table_missing_version: ${version}`);
}
assertPrivacyTableCoversVersion(PRIVACY_POLICY_PROVIDER_ROWS, PRIVACY_VERSION);

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
};

export function privacyDecisionForClasses(provider: AgentProvider | string, classes: readonly AgentDataClass[],
  version: string = STRICTEST_PRIVACY_TABLE): PrivacyDecision {
  const resolved = resolvePrivacyVersion(version);
  const rowName = PROVIDER_DESTINATIONS[provider as AgentProvider]?.policy_row ?? null;
  const row = rowName ? rowsFor(resolved)[rowName] : undefined;
  const blocked = classes.filter((dataClass) => !row?.classes.includes(dataClass));
  return { permitted: blocked.length === 0, version: resolved, data_classes: classes, blocked_by: blocked, policy_row: rowName };
}

/** Whether a provider may receive a lane's data (a lane with no row is treated as sending everything). */
export function privacyDecision(provider: AgentProvider | string, taskKind: AgentTaskKind,
  version: string = STRICTEST_PRIVACY_TABLE): PrivacyDecision {
  const classes = LANE_DATA_CLASSES[taskKind]?.classes ?? ["site_job_text", "job_records", "personal_info", "staff_tools"];
  return privacyDecisionForClasses(provider, classes, version);
}

/**
 * What would let a lane that fails closed run: the class its data needs a
 * provider for, in words, for the connectivity view.
 */
export const ENABLED_BY: Partial<Record<AgentDataClass, string>> = {
  staff_tools: "a Privacy Policy version that names a provider for internal staff work",
};

/**
 * Sends that are not agent lanes, gated the same way. Each says what it sends
 * and where; the caller checks it before anything leaves.
 */
export const NON_LANE_SENDS = {
  retrieval_embeddings: {
    classes: ["site_job_text", "job_records", "personal_info"] as readonly AgentDataClass[],
    provider: "openai_responses" as AgentProvider,
    source: "retrieval/embeddings.ts embedTexts: venue knowledge, site search text, ops-document chunks and company history, "
      + "sent to OpenAI's embeddings endpoint (OpenAI only; no other provider here offers embeddings)",
  },
  ops_document_extraction: {
    classes: ["site_job_text", "job_records", "personal_info"] as readonly AgentDataClass[],
    provider: "openclaw" as AgentProvider,
    source: "ops-documents.ts extractOpsDocument: the location of a staff-uploaded document, which may contain site or personal "
      + "data, sent to the OpenClaw gateway (integrations/openclaw/client.ts extractPdf) on an admin action",
  },
} as const;

/** The typed failure when no provider the policy names for a lane's data is configured. */
export const NO_PERMITTED_PROVIDER = "no_permitted_provider";
/** The typed failure when the chosen or pinned provider is not named for the lane's data. */
export const PRIVACY_NOT_PERMITTED = "privacy_not_permitted";
