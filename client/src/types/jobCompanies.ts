import type { CompanyResponseState } from "../lib/companyResponses";

/**
 * Why a job is not in front of companies: `teamJobAccess`'s reasons (`server/utils/teamJobAccess.ts`).
 * `sharingInWords` (`server/utils/jobCompanies.ts`) stops compiling if that predicate gains a reason this list does not name.
 */
export type TeamAccessReason =
  | "internal_test_job"
  | "not_a_site_job"
  | "pipeline_placeholder"
  | "task_not_yet_supported"
  | "not_listed"
  | "kept_private"
  | "restricted_to_named_teams"
  | "operator_paused"
  | "older_statement"
  | "privacy_screen_pending"
  | "no_job_sentence"
  | "authority_ended"
  | "closed_by_site"
  | "consent_withdrawn"
  | "blueprint_hold"
  | "development_only"
  | "rights_blocked"
  | "rights_needs_review"
  | "recording_consent_missing"
  | "scene_not_runnable";

/**
 * The operator's "Deployment companies" panel on `/admin/jobs` (`GET /api/admin/jobs/:id/companies`). Admin only: it
 * carries company names, emails and their own words, which never reach the site (`server/utils/jobCompanies.ts`).
 */
export interface AdminJobCompanies {
  sharing: { state: "shared_visible" | "shared_not_visible" | "not_shared"; words: string; reason: TeamAccessReason | null };
  hold: { atIso: string; by: string | null; reason: string | null } | null;
  consentRevoked: boolean;
  /** The job in the job library, for the operator to paste into their own email. */
  libraryUrl: string;
  /** Approved deployment companies a send can be recorded for. */
  companies: Array<{ id: string; company: string; email: string }>;
  sends: Array<{ sendId: string; companyId: string; company: string | null; alias: string | null; sentAtIso: string;
    sentBy: string | null; voidedAtIso: string | null; voidedBy: string | null }>;
  responses: Array<{ companyId: string; company: string | null; email: string | null; alias: string | null;
    state: CompanyResponseState | null; inputs: string; updatedAtIso: string | null;
    /** `before_c1`: an answer given before the site could see answers; it is never shown to the site. */
    recordedBy: "company" | "operator" | "before_c1";
    /** The line the company answered under (`company-response-2026-11-12`), or null for an older or operator-recorded answer. */
    statementVersion?: string | null }>;
  /** The automatic send (package E, E4): when the job went to every approved deployment company, and to how many. */
  autoSend?: { sentAtIso: string; count: number } | null;
  /** Introductions the site asked for (E6), each with its latest outcome answer (E8). */
  introductions?: Array<{ companyId: string; company: string | null; alias: string | null; requestedAtIso: string;
    /** Set when the introduction was cancelled at dispatch: its emails not yet sent were cancelled. */
    cancelledAtIso?: string; cancelReason?: string | null;
    latestOutcome: { by: "site" | "company"; state: string; label: string; atIso: string } | null }>;
  /** Billable events (E7): recorded, never priced or charged. */
  billableEvents?: Array<{ id: string; kind: "introduction"; companyId: string; company: string | null; atIso: string;
    priceUsd: null; status: "recorded_no_price" | "void" }>;
}
