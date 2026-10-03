import { createHash } from "node:crypto";
import { verificationDigest } from "../../agents/research-digest";
import { evaluateLeadVerification, LEAD_VERIFICATION_VERSION } from "../../agents/lead-verification";
import { COMMUNICATIONS_CRM_ID, type ReviewedResearchInput } from "../../agents/communications-reviewed-research";

/** Explicitly invented evidence for hermetic control tests. Never attach this
 * assessment to a real report or treat this fixture as web verification. */
export function syntheticLeadVerification(candidate: any, assessedAt = "2026-09-30T21:00:00Z") {
  const reason = `Synthetic operator ${candidate.organization} identifies ${candidate.site}, ${candidate.location}, and staff performing ${candidate.task}; exact scope is invented for this offline test.`;
  return { version: LEAD_VERIFICATION_VERSION, candidate_digest: verificationDigest(candidate),
    assessed_at: assessedAt, valid_until: new Date(Date.parse(assessedAt) + 8 * 86400000).toISOString(),
    claims: Object.fromEntries(["operator", "physical_site", "site_task", "human_workflow", "plausible_fit"].map(name => [name,
      { status: name === "plausible_fit" ? "inference" : "verified_fact", reason, source_refs: ["synthetic-operator"] }])),
    sources: [{ id: "synthetic-operator", url: "https://facility.example/test-evidence", publisher: "Synthetic fixture operator",
      source_date: null, event_date: null, checked_at: assessedAt, retrieval: "rendered", classification: "operator", quote: reason,
      freshness: "current", freshness_reason: "Invented current workflow in this deterministic fixture only." }],
    counterevidence: { status: "checked", reason: "Synthetic search found no conflicting automation, closure or task statements; commercial and robot fit remain unknown.",
      source_refs: ["synthetic-operator"], searches: ["Synthetic operator/site/task automation and contradiction search (no real network call)."] },
  };
}
export function syntheticVerificationCohort(candidate: any, assessment: any, now: number) {
  return { results: [evaluateLeadVerification(candidate, assessment, now)] };
}
export function syntheticReviewedResearchInput(): ReviewedResearchInput {
  const raw = Buffer.from("Invented offline research fixture. No real sources, operator or paid execution.");
  const organization = "Synthetic fixture operator", site = "Synthetic packing site", location = "10 Synthetic Lane, Boston, MA 02101", task = "packing";
  const missing = "No public business contact has been identified.";
  const entry = (role: "task" | "contact" | "geography", claim: string, quote: string) => ({ role, claim, quote,
    url: `https://facility.example/${role}`, publisher: organization, source_date: null, source_checked_at: "2026-10-01", checked_date: "2026-10-01",
    classification: "operator" as const, claim_kind: "fact" as const, origin: "live" as const,
    assertion_scope: "current_operational" as const, retrieval: "rendered" as const, visibility: "public" as const });
  const candidate = { candidate_key: "synthetic-packing", organization, organization_url: "https://facility.example", site, location, task,
    unknowns: [missing, "Interest, current automation and permission to share site data remain unknown."], evidence: [
      entry("task", "The synthetic operator describes staff packing at its synthetic site.", "Synthetic staff pack objects at this invented site."),
      entry("contact", "The synthetic operator publishes its business contact.", "Business inquiries: operations@facility.example"),
      entry("geography", "The synthetic operator identifies its selected site.", location)] };
  return { date: "2026-10-01", candidate, leadVerification: syntheticLeadVerification(candidate, "2026-10-01T21:00:00Z"),
    artifact: { kind: "codex_report", reference: "synthetic:offline-lead-verification", sourceRecordUrl: "https://facility.example/test-evidence",
      rawBase64: raw.toString("base64"), sha256: createHash("sha256").update(raw).digest("hex") },
    assessment: { rationale: "Synthetic contact/geography regression assessment; no real operator or rights are established.",
      contact: { evidenceIndex: 1, email: "operations@facility.example", scope: "organization_business_route", purpose: "business_inquiries",
        rationale: "Invented visible operator contact; no prohibited contact use.", selection: { kind: "general_inbox", role: "Synthetic business route",
          relevance: "Invented route for the packing question; buying authority is unknown.", authorityBasis: "inferred_routing",
          searchSummary: "Synthetic named contact search only; no real browsing.", sourceRefs: ["https://facility.example/contact"] } },
      geography: { evidenceIndex: 2, countryCode: "US", address: location, rationale: "Invented exact site/address scope." },
      resolvedGaps: [{ unknown: missing, rationale: "Invented contact publication resolves this test gap." }], conflicts: [] },
    crm: { spreadsheetId: COMMUNICATIONS_CRM_ID, range: "Prospects!A1:Z1000", checkedAt: "2026-10-01T20:30:00Z", rows: [],
      rationale: "Synthetic empty CRM snapshot; no live read." } };
}
