import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { researchDigest } from "./research-digest";
import { communicationsDigest, OUTREACH_READY_OPEN_CHECKS, verifyCommunicationsHandoff, type CommunicationsBrief } from "./communications-contract";
import { OUTREACH_RULE_VERSION } from "./lead-verification";
import { COMMUNICATIONS_CRM_ID } from "./communications-reviewed-research";
import { isLinkedInUrl } from "./communications-contact-evidence";
import { screenRecipientProblem, verifyScreenContactResolution } from "./communications-screen-contact";

/** Host-owned site-screen admissions (design section 3; owner decisions 2026-10-05, screen-to-crm-and-contacts and
 * first-outreach-batch). The Pipeline worker wrote each admitted site to the CRM as a row labelled Hypothesis, then
 * `screenWorkItems/<admission_id>`; this module reads one admission with the research Store (`screenSnapshot`) and
 * verifies it end to end before any site is recorded: the bundle is exactly the bytes whose SHA-256 is the admission id,
 * every result's digest over its input, answers and checks recomputes, every proving quote matches its SHA-256, the
 * owner direction the worker admitted it under is the bundle's, and the CRM rows and receipt are exactly what the bundle
 * and its payload produce. A site is then a hypothesis exactly like a published daily one: draft only, never verified,
 * and refused by every send path. Reads only. */
export const SCREEN_WORK_ITEMS = "blueprintDailyResearch/sites-first/screenWorkItems";
export const SCREEN_SNAPSHOT_VERSION = "blueprint.site-screen-admission-snapshot.v1";
const BUNDLE_VERSION = "blueprint.site-screen-admission.v1", STATE_VERSION = "blueprint.site-screen-admission-state.v1";
const WORK_ITEM_VERSION = "blueprint.site-screen-work-item.v1", PAYLOAD_VERSION = "blueprint.site-screen-sheets-payload.v1";
const SOURCE_VERSION = "blueprint.communications-screen-source.v1" as const;
/** The screen and contact rules this release reads (Pipeline tools/daily_research/site_screen.py). A bundle made under
 * any other rule is refused until the list is reviewed; the record's own question is reused, never rebuilt here. */
export const SCREEN_RULES: readonly string[] = ["blueprint.site-screen-rule.v2"];
export const SCREEN_CONTACT_RULES: readonly string[] = ["blueprint.site-contact-rule.v3"];
/** The owner record that moves screened sites into the CRM and on to drafting. */
export const SCREEN_OWNER_DECISION_REFERENCE =
  "gs://blueprint-8c1ca.appspot.com/operations/recovery/2026-10-05/owner-decisions/owner-decision-screen-to-crm-and-contacts-20261005.json";
const MAX_BUNDLE_BYTES = 1024 * 1024, MAX_RESULTS = 50;
const DIRECTION_URI = /^gs:\/\/blueprint-8c1ca\.appspot\.com\/operations\/research\/outreach-ready\/([a-f0-9]{64})\/direction\.json$/;
const PERSON_ROUTES = ["published_person_email", "quoted_person_looked_up_email", "provider_sourced_corroborated", "provider_sourced_uncorroborated"];
const ALWAYS_OPEN = ["existing_automation", "fit", "interest"];

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const nonblank = (value: unknown, max = 2000): value is string => typeof value === "string" && !!value.trim() && value.length <= max;
const keysAre = (value: unknown, keys: string[]) => !!value && typeof value === "object" && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const same = (a: unknown, b: unknown) => communicationsDigest(a) === communicationsDigest(b);
const fail = (code: string): never => { throw new Error(code); };
const publicUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !isLinkedInUrl(value);
  } catch { return false; }
};
const oneQuestion = (value: unknown): value is string => nonblank(value, 600) && !value.includes("\n")
  && value.indexOf("?") === value.length - 1 && value.split("?").length === 2;

export type ScreenSnapshotReader = (admissionId: string) => Promise<unknown>;
/** The research owner's Store reads its own records; this reader writes nothing and never takes the worker's lease.
 * An older vendored package without `screenSnapshot` refuses rather than guessing. */
export async function readScreenAdmissionSnapshot(db: FirebaseFirestore.Firestore, admissionId: string) {
  if (!hex(admissionId)) throw new Error("screen_admission_identity_invalid");
  const modulePath = pathToFileURL(resolve("dist/daily-research/release/tools/daily_research/firestore_bridge.mjs"));
  const { Store } = await import(/* @vite-ignore */ modulePath.href);
  const store = new Store(db);
  if (typeof store.screenSnapshot !== "function") throw new Error("screen_admission_reader_unavailable");
  return store.screenSnapshot(admissionId);
}

/** Sheets columns E, F and H for one recipient, as the Pipeline wrote them (screen_admission.contact_cells). */
export function screenContactCells(recipient: any) {
  if (!recipient) return { name: "", details: "", source_url: "" };
  const person = recipient.person ?? {};
  return { name: PERSON_ROUTES.includes(recipient.route) ? person.name ?? "" : "", details: `${recipient.address} (${recipient.label})`,
    source_url: recipient.published?.url || person.corroboration?.url || person.url || "" };
}

/** None for one bundle result whose digest, checks, question, proving quotes and recipient hold, else a stable code. */
function resultProblem(result: any, rules: { screen: string; outreach: string }): string | null {
  try {
    if (!keysAre(result, ["answers", "calibration", "candidate", "checked_on", "checks", "contact", "evidence_sha256", "hypothesis", "input",
      "origin", "proofs", "recipient", "result_digest", "result_sha256", "run_id", "site_key", "task_focus"])
      || !hex(result.site_key) || !hex(result.result_sha256) || !hex(result.evidence_sha256) || !nonblank(result.run_id, 128)) return "screen_admission_result_invalid";
    if (researchDigest({ input: result.input, answers: result.answers, checks: result.checks }) !== result.result_digest) {
      return "screen_admission_result_digest_mismatch";
    }
    const checks = result.checks, candidate = result.candidate, answers = result.answers ?? {}, input = result.input ?? {};
    if (!keysAre(checks, ["blockers", "choices", "gates", "open_checks", "question", "question_template", "rule_version", "task_scope", "tier",
      "verification"]) || checks.tier !== "outreach_ready" || !Array.isArray(checks.blockers) || checks.blockers.length
      || checks.rule_version !== rules.screen || !keysAre(candidate, ["checked_on", "location", "organization", "site", "task", "task_url"])
      || !["checked_on", "location", "organization", "site", "task", "task_url"].every(key => nonblank(candidate[key]))
      || !publicUrl(candidate.task_url) || candidate.organization !== answers.operator_identity || candidate.task !== answers.target_task
      || candidate.task_url !== answers.target_task_url || candidate.checked_on !== result.checked_on
      || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.checked_on) || candidate.location !== (input.location || candidate.site)) return "screen_admission_result_invalid";
    const ordered = OUTREACH_READY_OPEN_CHECKS.filter(check => Array.isArray(checks.open_checks) && checks.open_checks.includes(check));
    if (!Array.isArray(checks.open_checks) || ordered.length !== checks.open_checks.length || !ALWAYS_OPEN.every(check => ordered.includes(check as any))
      || !oneQuestion(checks.question) || !/^[A-Z]$/.test(String(checks.question_template))
      || !same(result.hypothesis, { tier: "outreach_ready", label: "hypothesis", rule_version: rules.screen, outreach_rule_version: rules.outreach,
        open_checks: ordered, question_template: checks.question_template, question: checks.question })) return "screen_admission_question_mismatch";
    const proofs = result.proofs;
    if (!Array.isArray(proofs) || proofs.map((proof: any) => proof?.claim).join() !== "operator,physical_site,site_task") return "screen_admission_proof_invalid";
    for (const proof of proofs) {
      if (proof.level === "government_record") {
        if (proof.claim !== "physical_site" || proof.source_id !== "government_record") return "screen_admission_proof_invalid";
      } else if (!["verified_on_page", "in_citation_excerpt"].includes(proof.level) || !nonblank(proof.quote) || sha256(proof.quote) !== proof.quote_sha256
        || !publicUrl(proof.url) || !hex(proof.text_sha256)) return "screen_admission_proof_invalid";
    }
    return screenRecipientProblem({ recipient: result.recipient, proofs, answers });
  } catch {
    return "screen_admission_result_invalid";
  }
}

export type ScreenSite = { result: any; entry: any; sheetsProspectId: string };
/** One completed admission, verified end to end; any failure throws a stable code and no site of it is used. */
export function screenAdmission(snapshot: any) {
  if (snapshot?.schema_version !== SCREEN_SNAPSHOT_VERSION || !hex(snapshot.admission_id)) fail("screen_admission_snapshot_invalid");
  const id: string = snapshot.admission_id, item = snapshot.work_item, state = snapshot.state;
  if (item?.schema_version !== WORK_ITEM_VERSION || item.admission_id !== id || item.stage !== "completed" || item.sends_authorized !== false
    || item.scope !== "hypothesis_draft_only_no_send" || item.bundle_blob !== id || !nonblank(item.completed_at, 64)
    || !/^\d{4}-\d{2}-\d{2}T/.test(item.completed_at) || !Number.isFinite(Date.parse(item.completed_at))) fail("screen_admission_work_item_invalid");
  // The bundle is exactly the bytes whose SHA-256 is the admission id, in the Pipeline's canonical JSON.
  const raw = typeof snapshot.bundle === "string" ? Buffer.from(snapshot.bundle, "base64") : Buffer.alloc(0);
  if (!raw.length || raw.length > MAX_BUNDLE_BYTES || sha256(raw) !== id) fail("screen_admission_digest_mismatch");
  let bundle: any = null;
  try { bundle = JSON.parse(raw.toString("utf8")); } catch { fail("screen_admission_bundle_invalid"); }
  let canonical: string | null = null;
  try { canonical = researchDigest(bundle); } catch { canonical = null; }
  if (canonical !== id) fail("screen_admission_bundle_not_canonical");
  const manifest = bundle?.manifest, results = bundle?.results;
  if (!keysAre(bundle, ["direction", "manifest", "results"]) || manifest?.schema_version !== BUNDLE_VERSION || manifest.label !== "hypothesis"
    || manifest.path !== "site_screen" || manifest.sends_authorized !== false || !Array.isArray(results) || !results.length
    || results.length > MAX_RESULTS || manifest.records !== results.length) fail("screen_admission_bundle_invalid");
  const rules = manifest.rules;
  if (!keysAre(rules, ["contact", "outreach", "screen"]) || !SCREEN_RULES.includes(rules.screen) || !SCREEN_CONTACT_RULES.includes(rules.contact)
    || rules.outreach !== OUTREACH_RULE_VERSION) fail("screen_admission_rule_mismatch");
  // The owner direction the worker admitted this bundle under, recorded under its lease, is the bundle's own.
  const direction = state?.direction, pinned = bundle.direction, match = typeof direction?.uri === "string" ? DIRECTION_URI.exec(direction.uri) : null;
  if (!keysAre(direction, ["approval_reference", "effective_from", "expires_at", "generation", "label", "max_rows_per_batch", "paths", "rule_version",
    "sends_authorized", "sha256", "uri", "version"]) || !keysAre(pinned, ["generation", "sha256", "uri"]) || !match || match[1] !== direction.sha256
    || direction.sha256 !== pinned.sha256 || direction.generation !== pinned.generation || direction.uri !== pinned.uri
    || !/^[1-9][0-9]{0,18}$/.test(direction.generation) || direction.sends_authorized !== false || direction.label !== "hypothesis"
    || !Array.isArray(direction.paths) || !direction.paths.includes("site_screen") || direction.rule_version !== OUTREACH_RULE_VERSION
    || !Number.isSafeInteger(direction.max_rows_per_batch) || direction.max_rows_per_batch < results.length || direction.max_rows_per_batch > MAX_RESULTS
    || !(Date.parse(direction.effective_from) < Date.parse(direction.expires_at))) fail("screen_admission_direction_invalid");
  if (!keysAre(state, ["acknowledged_at", "admission_id", "approval_reference", "bundle_blob", "direction", "generation", "payload", "plan",
    "planned_at", "receipt", "schema_version"]) || state.schema_version !== STATE_VERSION || state.admission_id !== id || state.bundle_blob !== id
    || !/^[1-9][0-9]{0,18}$/.test(state.generation)) fail("screen_admission_state_invalid");
  // The payload names every result once: the rows written, in bundle order, then the CRM duplicates.
  const payload = state.payload, entries = payload?.entries, duplicates = payload?.duplicates, order = results.map((r: any) => r?.site_key);
  if (!keysAre(payload, ["admission_id", "duplicates", "entries", "schema_version", "sheet_id", "tab"]) || payload.schema_version !== PAYLOAD_VERSION
    || payload.admission_id !== id || payload.sheet_id !== COMMUNICATIONS_CRM_ID || payload.tab !== "Prospects" || !Array.isArray(entries)
    || !Array.isArray(duplicates)) fail("screen_admission_payload_invalid");
  const named = [...entries.map((entry: any) => entry?.site_key), ...duplicates.map((item: any) => item?.site_key)];
  if (named.length !== results.length || new Set(named).size !== named.length || named.some(key => !order.includes(key))
    || entries.some((entry: any, index: number) => index > 0 && order.indexOf(entries[index - 1].site_key) > order.indexOf(entry.site_key))
    || duplicates.some((item: any) => !keysAre(item, ["code", "site_key"]) || !/^screen_admission_[a-z_]{1,80}$/.test(String(item.code)))) {
    fail("screen_admission_payload_invalid");
  }
  const plan = state.plan, rows = plan?.sheet_rows;
  if (!keysAre(plan, ["admission_id", "body_json", "crm_values", "destination", "kind", "marker", "payload_digest", "request_digest", "sheet_rows"])
    || plan.destination !== "sheets" || plan.kind !== "screen" || plan.admission_id !== id || plan.marker !== `[screen:${id};`
    || plan.payload_digest !== researchDigest(payload) || !Array.isArray(rows) || rows.length !== entries.length
    || plan.body_json !== JSON.stringify({ majorDimension: "ROWS", values: rows }) || plan.request_digest !== sha256(plan.body_json)) {
    fail("screen_admission_plan_invalid");
  }
  const ids = rows.map((row: unknown) => Array.isArray(row) ? row[0] : null), receipt = state.receipt;
  if (ids.some((value: unknown) => typeof value !== "string" || !/^BP-\d{6}$/.test(value)) || new Set(ids).size !== ids.length) {
    fail("screen_admission_sheet_identity_invalid");
  }
  if (!keysAre(receipt, ["admission_id", "destination", "kind", "payload_digest", "readback_verified", "reference"]) || receipt.destination !== "sheets"
    || receipt.kind !== "screen" || receipt.admission_id !== id || receipt.payload_digest !== plan.payload_digest || receipt.readback_verified !== true
    || receipt.reference !== `sheets:${COMMUNICATIONS_CRM_ID}:Prospects:${ids.join(",") || "no_candidates"}` || item.sheets_receipt !== receipt.reference) {
    fail("screen_admission_receipt_invalid");
  }
  for (const result of results) {
    const problem = resultProblem(result, rules);
    if (problem) fail(problem);
  }
  // Each row is exactly what its entry and bundle result produce in the existing 19 columns.
  const sites = new Map<string, ScreenSite>();
  entries.forEach((entry: any, position: number) => {
    const result = results.find((item: any) => item.site_key === entry.site_key), candidate = result.candidate, cells = screenContactCells(result.recipient);
    if (!keysAre(entry, ["checked_on", "contact", "identity", "location", "organization", "question", "result_digest", "site", "site_key", "task",
      "task_url"]) || entry.result_digest !== result.result_digest || entry.question !== result.hypothesis.question || !hex(entry.identity)
      || ["organization", "site", "location", "task", "task_url", "checked_on"].some(key => entry[key] !== candidate[key]) || !same(entry.contact, cells)) {
      fail("screen_admission_payload_binding_invalid");
    }
    const expected = [ids[position], candidate.organization, "Facility / site", candidate.site, cells.name, cells.details, "Hypothesis",
      cells.source_url, "unknown", candidate.task_url, "Research", "", `First email asks: ${result.hypothesis.question}\n[screen:${id};${result.result_digest}]`,
      "", candidate.task, "", "Outreach-ready: operator, site, task proven", candidate.location, candidate.checked_on];
    if (!same(rows[position], expected)) fail("screen_admission_sheet_row_invalid");
    sites.set(entry.site_key, { result, entry, sheetsProspectId: ids[position] });
  });
  return { id, bundle, state, item, date: item.completed_at.slice(0, 10) as string, sites };
}

export type ScreenHypothesisEntry = { siteKey: string; sheetsProspectId: string; resultDigest: string; openChecks: string[];
  openQuestions: string[]; questionTemplate: string; recipientRoute: string | null; recipientLabel: string | null };
/** Every site the verified admission wrote to the CRM, in CRM order; CRM duplicates are not hypotheses here. */
export function screenPublicationHypotheses(snapshot: any): ScreenHypothesisEntry[] {
  return [...screenAdmission(snapshot).sites.entries()].map(([siteKey, site]) => ({ siteKey, sheetsProspectId: site.sheetsProspectId,
    resultDigest: site.result.result_digest, openChecks: site.result.hypothesis.open_checks, openQuestions: [site.result.hypothesis.question],
    questionTemplate: site.result.hypothesis.question_template, recipientRoute: site.result.recipient?.route ?? null,
    recipientLabel: site.result.recipient?.label ?? null }));
}

/** The owner direction for drafting at `now`: the one the worker admitted this bundle under, effective and unexpired. */
function screenDirection(direction: any, now: number) {
  if (now < Date.parse(direction.effective_from)) fail("outreach_ready_direction_not_yet_effective");
  if (Date.parse(direction.expires_at) <= now) fail("outreach_ready_direction_expired");
  return { uri: direction.uri as string, generation: direction.generation as string, sha256: direction.sha256 as string,
    approvalReference: direction.approval_reference as string, validUntil: direction.expires_at as string };
}

/** One admitted site as a hypothesis source for drafting, re-verified from a fresh snapshot at `now`: the admission,
 * its CRM row and the owner direction. Never under a verified row; never a send authority. */
export function screenPublicationSource(snapshot: any, siteKey: string, now: number) {
  const admission = screenAdmission(snapshot), site = admission.sites.get(siteKey);
  if (!site) fail("research_hypothesis_not_published");
  const direction = screenDirection(admission.state.direction, now), result = site!.result;
  const source = {
    version: SOURCE_VERSION, screenAdmissionId: admission.id, date: admission.date, runKey: `blueprint-screen-admission:${admission.id}`,
    candidateKey: siteKey, packetDigest: admission.id, rawArtifactDigest: result.result_sha256 as string, resultDigest: result.result_digest as string,
    runId: result.run_id as string,
    candidate: { candidate_key: siteKey, organization: result.candidate.organization as string, site: result.candidate.site as string,
      location: result.candidate.location as string, task: result.candidate.task as string, task_url: result.candidate.task_url as string,
      unknowns: [] as string[] },
    hypothesis: { tier: "outreach_ready" as const, label: "hypothesis" as const, ruleVersion: OUTREACH_RULE_VERSION,
      screenRuleVersion: result.checks.rule_version as string, openChecks: result.hypothesis.open_checks as string[],
      openQuestions: [result.hypothesis.question as string], questionTemplate: result.hypothesis.question_template as string,
      validUntil: null, checkedOn: result.checked_on as string, provingSources: result.proofs as any[], direction },
    answers: { website: result.answers.website, operator_identity: result.answers.operator_identity },
    recipient: result.recipient, contactStage: result.contact,
    sheetsId: COMMUNICATIONS_CRM_ID, sheetsProspectId: site!.sheetsProspectId, sheetsReceipt: admission.state.receipt.reference as string,
    notionReceipt: null, sourceRecordUrl: `https://docs.google.com/spreadsheets/d/${COMMUNICATIONS_CRM_ID}/edit`,
  };
  return { source, site: site! };
}
export type ScreenSource = ReturnType<typeof screenPublicationSource>["source"];

/** The draft's proven facts: each quote that proved the operator and the site task, at its page, as dated background
 * checked on the day the screen read it. A government record proves the address and carries no quote. */
export function screenFacts(source: ScreenSource): CommunicationsBrief["facts"] {
  const facts: CommunicationsBrief["facts"] = [], seen = new Set<string>();
  for (const proof of source.hypothesis.provingSources) {
    if (proof.level === "government_record") continue;
    const claim = String(proof.quote).trim(), key = communicationsDigest([claim, proof.url]);
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push({ id: `screen-fact-${communicationsDigest({ candidateKey: source.candidateKey, sourceId: proof.source_id, url: proof.url, quote: proof.quote })}`,
      claim, sourceUrl: proof.url, evidenceClass: "primary", sourceCheckedAt: source.hypothesis.checkedOn, publishedAt: null, eventAt: null,
      assertionScope: "as_of_background", consequential: true });
  }
  if (!facts.length) fail("outreach_ready_proving_source_missing");
  return facts;
}

/** The brief's qualification block: the screen record's tier, label, open checks, its own one question and the owner
 * direction the admission ran under. */
export function screenQualification(source: ScreenSource): NonNullable<CommunicationsBrief["qualification"]> {
  const direction = source.hypothesis.direction;
  return { tier: "outreach_ready", label: "hypothesis", openChecks: source.hypothesis.openChecks as any, openQuestions: source.hypothesis.openQuestions,
    ownerDecision: { reference: SCREEN_OWNER_DECISION_REFERENCE, direction: { uri: direction.uri, generation: direction.generation, sha256: direction.sha256 } },
    sendsAuthorized: false };
}

/** The draft worker's check for a site-screen brief, rerun before and during every draft: the admission, direction and
 * row re-verify at `now`, then the brief's source, facts, qualification and contact proof bind to it. It grants no
 * send authority: verifyPublishedResearch and every send path refuse the brief. */
export function verifyScreenHypothesisForDraft(snapshot: any, brief: CommunicationsBrief, approval: unknown, contactProof: unknown, now = Date.now()) {
  if (!brief?.qualification) fail("research_hypothesis_brief_required");
  const handoff = verifyCommunicationsHandoff(approval, brief), origin = brief.researchOrigin;
  if (!origin.screenAdmissionId || origin.admissionId || origin.contactEvidenceKind !== "screen_recipient_resolution" || !origin.sourceDigest
    || !origin.contactEvidenceDigest) fail("research_hypothesis_origin_invalid");
  if (snapshot?.admission_id !== origin.screenAdmissionId) fail("research_publication_context_missing");
  const { source } = screenPublicationSource(snapshot, origin.candidateKey, now);
  if (communicationsDigest(source) !== origin.sourceDigest || origin.date !== source.date || origin.packetDigest !== source.packetDigest
    || origin.rawArtifactDigest !== source.rawArtifactDigest) fail("research_adapter_source_changed");
  if (handoff.sheetsReceipt !== source.sheetsReceipt || handoff.notionReceipt !== source.notionReceipt) fail("research_publication_receipt_changed");
  if (!same(brief.qualification, screenQualification(source)) || brief.contact.learningQuestion !== source.hypothesis.openQuestions[0]) {
    fail("research_hypothesis_qualification_changed");
  }
  const contact = verifyScreenContactResolution(contactProof, source, brief.prospectId);
  if (contact.evidenceDigest !== origin.contactEvidenceDigest || contact.email !== brief.contact.email.toLowerCase()
    || contact.sourceUrl !== brief.contact.sourceUrl || contact.sourceCheckedAt !== brief.contact.sourceCheckedAt || brief.contact.scope !== contact.scope
    || brief.consent.status !== contact.consent || !same(brief.contact.recipient ?? null, contact.recipient)
    || !same(brief.contact.resolvedMissingContactGaps ?? [], contact.resolvedGaps)) fail("research_contact_evidence_changed");
  if (!same(brief.facts, screenFacts(source)) || brief.facilityName !== source.candidate.organization || brief.boundedJob !== source.candidate.task) {
    fail("brief_fact_not_in_published_research");
  }
  return { runKey: source.runKey, packetDigest: source.packetDigest, sheetsReceipt: source.sheetsReceipt, notionReceipt: source.notionReceipt,
    briefDigest: communicationsDigest(brief) };
}
