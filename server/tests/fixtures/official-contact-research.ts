import { createHash } from "node:crypto";
import { COMMUNICATIONS_CRM_ID, type ReviewedResearchInput } from "../../agents/communications-reviewed-research";

/** Source-backed regression examples checked 2026-10-01. These are public
 * routing inboxes, not named buyers or interest. Default artifact is synthetic;
 * an offline staging rehearsal supplies the actual unchanged Library report. */
export const officialContactCases = [
  { key: "suds-city-la", organization: "Suds City LA", site: "West Temple laundry", url: "https://sudscityla.com/contact/",
    address: "2538 W Temple St, Los Angeles, CA 90026", email: "info@sudscityla.com", task: "towel folding",
    taskUrl: "https://sudscityla.com/commercial-laundry-los-angeles/", claim: "Suds City LA offers washing and folding towels for commercial clients.",
    taskQuote: "Towel Laundry Service", contactQuote: "Contact Us. Email Address info@sudscityla.com", method: "rendered" as const },
  { key: "debourgh", organization: "DeBourgh", site: "La Junta manufacturing site", url: "https://www.debourgh.com/",
    address: "27505 Otero Avenue, La Junta, CO 81050-9403", email: "info@debourgh.com", task: "locker panel welding",
    taskUrl: "https://www.debourgh.com/", claim: "DeBourgh makes all-welded steel lockers at its La Junta factory.",
    taskQuote: "all-welded steel lockers", contactQuote: "Contact info@debourgh.com", method: "rendered" as const },
  { key: "p4swiss-lindel", organization: "P4Swiss / Lindel CNC Machining", site: "Tucson machining shop", url: "https://precisioncncmachining.com/cnc-quote/",
    address: "3380 E Elvira Road, Tucson, Arizona, 85756", email: "sales@lindelengineering.com", task: "CNC part handling",
    taskUrl: "https://precisioncncmachining.com/facilities/", claim: "P4Swiss / Lindel offers CNC milling and turning at its Tucson shop.",
    taskQuote: "CNC Milling and Turning", contactQuote: "send us an email to: sales@lindelengineering.com", method: "rendered" as const },
  { key: "capacity-midwest", organization: "Capacity", site: "Capacity Midwest Whitestown", url: "https://www.capacityllc.com/locations/indianapolis/",
    address: "4330 S. County Road 500 E, Whitestown, IN 46075", email: "info@capacityllc.com", task: "packaged-item kitting",
    taskUrl: "https://www.capacityllc.com/locations/indianapolis/", claim: "Capacity offers kitting and assembly at its Whitestown facility.",
    taskQuote: "Kitting, gift set assembly", contactQuote: "Book your strategy call now. info@capacityllc.com", method: "rendered" as const },
];
export function officialResearchInput(key = "suds-city-la", raw = Buffer.from("Synthetic offline report fixture; no hosted API execution."),
  rows: string[][] = [], checkedAt = "2026-10-01T20:30:00Z"): ReviewedResearchInput {
  const c = officialContactCases.find(item => item.key === key)!;
  const missing = "No public business contact has been identified.";
  const entry = (role: "task" | "contact" | "geography", claim: string, quote: string, url: string) => ({
    role, claim, quote, url, publisher: c.organization, source_date: null, source_checked_at: "2026-10-01", checked_date: "2026-10-01",
    classification: "operator" as const, claim_kind: "fact" as const, origin: "live" as const,
    assertion_scope: "current_operational" as const, retrieval: c.method, visibility: "public" as const,
  });
  return { date: "2026-10-01", artifact: { kind: "codex_report", reference: "synthetic:offline-source-regression",
    sourceRecordUrl: c.url, rawBase64: raw.toString("base64"), sha256: createHash("sha256").update(raw).digest("hex") },
    candidate: { candidate_key: c.key, organization: c.organization, organization_url: new URL(c.url).origin,
      site: c.site, location: c.address, task: c.task,
      unknowns: [missing, "Interest, current automation and permission to share site data remain unknown."],
      evidence: [entry("task", c.claim, c.taskQuote, c.taskUrl), entry("contact", `${c.organization} publishes ${c.email} as its contact route.`, c.contactQuote, c.url),
        entry("geography", `${c.organization} identifies the selected site at ${c.address}.`, c.address, c.url)] },
    assessment: { rationale: "The official operator publishes this site's recurring work and contact route; robotic fit and interest remain unknown.",
      contact: { evidenceIndex: 1, email: c.email, scope: "organization_business_route", purpose: "business_inquiries",
        selection: { kind: "general_inbox", role: "General business routing team; decision maker not verified",
          relevance: "The operator offers this route for business questions about its advertised task. Ability to route to site operations is inferred; task or purchasing ownership is not established.", authorityBasis: "inferred_routing",
          searchSummary: "Offline fixture: official contact, company and task pages checked for a relevant named public professional route or introduction. None verified in the checked material; this is a bounded general-inbox fallback.",
          sourceRefs: [c.url, c.taskUrl] },
        rationale: "The visible official Contact or sales route is offered for business questions, with no unsolicited-contact prohibition observed. This is a routing inbox, not a verified decision maker." },
      geography: { evidenceIndex: 2, countryCode: "US", address: c.address,
        rationale: "The operator address belongs to the selected operating site. The city, state and ZIP identify a US postal address; it is not another headquarters or service-area location." },
      resolvedGaps: [{ unknown: missing, rationale: "The current visible official Contact/email publication resolves only the prior missing recipient gap." }], conflicts: [] },
    crm: { spreadsheetId: COMMUNICATIONS_CRM_ID, range: "Prospects!A1:Z1000", checkedAt, rows,
      rationale: "Organization, exact site/address and public contact were checked against the canonical CRM rows; no match was found." } };
}
