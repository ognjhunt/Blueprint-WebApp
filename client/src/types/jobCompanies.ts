import type { CompanyResponseState } from "../lib/companyResponses";
import type { TeamAccessReason } from "./jobConsole";

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
    state: CompanyResponseState | null; inputs: string; noteForSite: string | null; updatedAtIso: string | null;
    recordedBy: "company" | "operator" }>;
}
