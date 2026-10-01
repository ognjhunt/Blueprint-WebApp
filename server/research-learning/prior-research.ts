import { z } from "zod";
import { createHash } from "node:crypto";
import { digest, hash, id, instant } from "./contract";

export const SOURCE_SNAPSHOT_VERSION = "blueprint.research-learning-source-snapshot.v1";
export const SOURCE_ROOT = "blueprintDailyResearch/sites-first";
export const CRM_SHEET_ID = "1n95Ih0Swc-q-kZyUaDHoZh6SVzxvf_zt-CRR7i39bWY";
const forbidden = (value: string) => /[\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[A-Za-z]{2,}/i.test(value)
  || /(?:bearer\s+\S+|(?:api[ _-]?key|access[ _-]?(?:token|key(?:[ _-]?id)?)|refresh[ _-]?token|client[ _-]?secret|private[ _-]?key|password|passwd|pwd|authorization|token|credentials?|secret(?:[ _-]?access)?[ _-]?key|secret|signature|sig)\s*["']?\s*[:=]|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i.test(value);
export const safeText = (max = 2000) => z.string().min(1).max(max).refine(value => !forbidden(value)
  && (value.match(/https?:\/\/[^\s<>"]+/gi) ?? []).every(url => publicUrl.safeParse(url.replace(/[.,;!?)\]]+$/, "")).success), "learning_private_text");
export const publicUrl = z.string().max(2000).url().refine(value => {
  try {
    const url = new URL(value); let decoded = value;
    for (let attempt = 0; attempt < 4; attempt++) {
      const next = decodeURIComponent(decoded);
      if (forbidden(next)) return false;
      if (next === decoded) break;
      decoded = next;
    }
    const decodedUrl = new URL(decoded);
    return [url, decodedUrl].every(parsed => parsed.protocol === "https:" && !parsed.username && !parsed.password)
      && decodeURIComponent(decoded) === decoded
      && ![...decodedUrl.searchParams.keys()].some(key => /^(?:email|emailaddress|token|accesstoken|refreshtoken|apikey|key|secret|clientsecret|privatekey|authorization|password|passwd|pwd|credentials?|signature|sig)$/i.test(key.replace(/[^a-z0-9]/gi, "")));
  } catch { return false; }
}, "learning_private_url");
function dateMillis(value: string): number {
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const day = us ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}` : value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN;
  const timestamp = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== day) return NaN;
  if (us || value === day) return timestamp;
  return z.string().datetime({ offset: true }).safeParse(value).success ? Date.parse(value) : NaN;
}
export const originalDate = z.string().max(80).refine(value => Number.isFinite(dateMillis(value)), "learning_source_date_invalid");
const unique = z.array(id).max(100).refine(items => new Set(items).size === items.length);
export const sourceGrantSchema = z.object({ principalId: id, crmIds: unique, capabilityIds: unique,
  sections: z.array(z.enum(["crm", "capabilities", "site_learning"])).min(1).max(3).refine(items => new Set(items).size === items.length), expiresAt: instant }).strict();
export type SourceGrant = z.infer<typeof sourceGrantSchema>;
export const sourceRequestSchema = z.object({ crmIds: unique, capabilityIds: unique,
  sections: sourceGrantSchema.shape.sections, asOf: instant }).strict().refine(value => value.crmIds.length + value.capabilityIds.length > 0);
export type SourceRequest = z.infer<typeof sourceRequestSchema>;
export function authorizeSources(grantInput: SourceGrant, requestInput: SourceRequest, now: string) {
  const grant = sourceGrantSchema.parse(grantInput), request = sourceRequestSchema.parse(requestInput);
  const at = instant.parse(now);
  if (grant.expiresAt <= at || request.asOf > at || request.crmIds.some(value => !grant.crmIds.includes(value))
    || request.capabilityIds.some(value => !grant.capabilityIds.includes(value)) || request.sections.some(value => !grant.sections.includes(value))) throw new Error("learning_source_scope_denied");
  return { grant, request };
}
const sourceSchema = z.object({ recordRef: safeText(500), sourceHash: hash, capturedAt: z.string().datetime({ offset: true }) }).strict();
const rowSchema = z.object({ crmId: id, organization: safeText(200), prospectType: safeText(120), siteLabel: safeText(500),
  taskHypothesis: safeText(1200).nullable(), geography: safeText(300).nullable(), sourceCheckedDate: originalDate.nullable(),
  verification: safeText(120).nullable(), evidenceMaturity: safeText(120).nullable(), inventoryStage: safeText(120).nullable(),
  publicEvidenceUrls: z.array(publicUrl).max(20), rowHash: hash,
  canonical: z.object({ prospectId: id.nullable(), siteId: id.nullable(), taskId: id.nullable(), caseId: id.nullable() }).strict(),
}).strict();
const companySchema = z.object({ companyId: id, name: safeText(200), roles: z.array(safeText(120)).max(20), sourcePageIds: unique }).strict();
const factSchema = z.object({ factId: id, field: safeText(120), statement: safeText(), status: z.enum(["reviewed", "conflicted", "unsupported", "unknown"]),
  evidenceLevel: z.enum(["vendor_claim", "demonstrated_capability", "named_deployment", "current_availability", "unknown"]),
  confidence: z.enum(["low", "medium", "high", "unknown"]), freshnessDays: z.number().int().min(1).max(90),
  taskTags: z.array(safeText(120)).max(20), geographyTags: z.array(safeText(120)).max(20), sourcePageIds: unique,
  sources: z.array(z.object({ url: publicUrl, sourceCheckedAt: originalDate, revalidatedAt: originalDate.nullable(), publicationDate: originalDate.nullable(),
    classification: safeText(120), publisher: safeText(300).nullable() }).strict()).max(20),
  limits: z.array(safeText(120)).max(20), conflicts: z.array(safeText(120)).max(20),
}).strict();
const capabilitySchema = z.object({ capabilityId: id, companyId: id, recordType: safeText(120),
  product: z.object({ name: safeText(200), version: safeText(120).nullable() }).strict(), taskTags: z.array(safeText(120)).max(20),
  geographyTags: z.array(safeText(120)).max(20), facts: z.array(factSchema).max(20) }).strict();
const pageSchema = z.object({ pageId: id, url: publicUrl, revision: z.object({ kind: z.enum(["native_revision_id", "page_last_edited_at"]), value: safeText(200) }).strict() }).strict();
export const sourceSnapshotSchema = z.object({ version: z.literal(SOURCE_SNAPSHOT_VERSION), snapshotId: hash, contentHash: hash, asOf: instant,
  scope: z.object({ principalId: id, crmIds: unique, capabilityIds: unique, sections: sourceGrantSchema.shape.sections }).strict(),
  source: z.object({ crm: sourceSchema, knowledge: sourceSchema, knowledgeContentHash: hash, reconciliationHash: hash }).strict(),
  crmRows: z.array(rowSchema).max(100), companies: z.array(companySchema).max(100), capabilities: z.array(capabilitySchema).max(100), sourcePages: z.array(pageSchema).max(30),
  researchRuns: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), state: safeText(120), recordRef: safeText(500) }).strict()).max(100),
  unknowns: z.array(safeText(200)).max(20), parentSnapshotId: hash.nullable(),
}).strict();
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export const CRM_HEADERS = ["Prospect ID", "Organization", "Prospect type", "Site / team", "Contact name", "Contact details", "Verification", "Contact source URL", "Robot-team fit", "Task evidence URL", "Stage", "Owner", "Next action", "Next action date", "Task / job", "Robot capability evidence URL", "Evidence maturity", "Geography", "Evidence checked date"];
export type SourceInputs = { crm: any; crmSourceHash: string; knowledge: any; knowledgeSourceHash: string; independentHeaders: string[];
  independentRows: { crmId: string; rowHash: string }[]; canonical: { crmId: string; prospectId: string; siteId: string | null; taskId: string | null; caseId: string | null }[];
  researchRuns: SourceSnapshot["researchRuns"]; };
export const cellRowHash = (row: unknown[]) => createHash("sha256").update(JSON.stringify(row)).digest("hex");
/** Existing Pipeline content_hash is Python sorted compact JSON with ensure_ascii. */
export function knowledgeContentHash(value: Record<string, unknown>): string {
  const canonical = (item: any): any => Array.isArray(item) ? item.map(canonical) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
  const { content_hash: _hash, ...content } = value;
  return createHash("sha256").update(JSON.stringify(canonical(content)).replace(/[\u007f-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`)).digest("hex");
}
const nullable = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
const seal = (content: Omit<SourceSnapshot, "snapshotId" | "contentHash">): SourceSnapshot => {
  const { snapshotId: _id, contentHash: _hash, ...normalized } = sourceSnapshotSchema.parse({ ...content, snapshotId: "0".repeat(64), contentHash: "0".repeat(64) });
  const contentHash = digest(normalized);
  return { ...normalized, snapshotId: contentHash, contentHash };
};
// A successful private reconciliation is required in this process before any
// append. Serialized reports and caller-created/self-hashed snapshots are reads.
const reconciledReports = new WeakMap<object, string>();

/** Private raw-row reconciliation is separate from the whitelist shared with agents. */
export function reconcilePriorResearch(input: SourceInputs, grant: SourceGrant, request: SourceRequest, now: string) {
  const authorized = authorizeSources(grant, request, now), errors: string[] = [];
  if (input.crm?.sheet_id !== CRM_SHEET_ID || input.crm.complete !== true || !Array.isArray(input.crm.values)
    || digest(input.crm.values[4]?.slice(0, 19)) !== digest(CRM_HEADERS)
    || digest(input.independentHeaders.slice(0, 19)) !== digest(CRM_HEADERS)) throw new Error("learning_crm_source_invalid");
  if (input.knowledge?.schema_version !== "blueprint.knowledge-snapshot.v1" || knowledgeContentHash(input.knowledge) !== input.knowledge.content_hash) throw new Error("learning_knowledge_source_invalid");
  const rows: unknown[][] = input.crm.values.slice(5).filter((row: unknown[]) => row.some(cell => cell !== "" && cell !== null));
  const rawIds = rows.map(row => id.parse(row[0])), independentIds = input.independentRows.map(row => id.parse(row.crmId));
  if (new Set(rawIds).size !== rawIds.length || new Set(independentIds).size !== independentIds.length) errors.push("duplicate_crm_id");
  if (digest([...rawIds].sort()) !== digest([...independentIds].sort())) errors.push("crm_id_manifest_mismatch");
  if (rows.some(row => input.independentRows.find(item => item.crmId === row[0])?.rowHash !== cellRowHash(row))) errors.push("crm_row_readback_mismatch");
  if (authorized.request.crmIds.some(value => !rawIds.includes(value))) errors.push("requested_crm_missing");
  if (input.canonical.some(value => !rawIds.includes(value.crmId)) || new Set(input.canonical.map(value => value.crmId)).size !== input.canonical.length) errors.push("canonical_join_ambiguous");
  if (Date.parse(input.crm.captured_at) > Date.parse(authorized.request.asOf) || Date.parse(input.knowledge.exported_at) > Date.parse(authorized.request.asOf)) errors.push("source_after_cutoff");
  const selected = rows.filter(row => authorized.request.sections.includes("crm") && authorized.request.crmIds.includes(String(row[0])));
  const crmRows = selected.map(row => {
    const join = input.canonical.find(value => value.crmId === row[0]);
    return rowSchema.parse({ crmId: row[0], organization: row[1], prospectType: row[2], siteLabel: row[3], taskHypothesis: nullable(row[14]),
      geography: nullable(row[17]), sourceCheckedDate: nullable(row[18]), verification: nullable(row[6]), evidenceMaturity: nullable(row[16]), inventoryStage: nullable(row[10]),
      publicEvidenceUrls: [...new Set([row[7], row[9], row[15]].flatMap(value => typeof value === "string" ? value.split(/\r?\n/).map(url => url.trim()).filter(Boolean) : []))],
      rowHash: cellRowHash(row), canonical: { prospectId: join?.prospectId ?? null, siteId: join?.siteId ?? null, taskId: join?.taskId ?? null, caseId: join?.caseId ?? null } });
  });
  const capabilities = (input.knowledge.records ?? []).filter((record: any) => authorized.request.sections.includes("capabilities") && authorized.request.capabilityIds.includes(record.record_id))
    .map((record: any) => capabilitySchema.parse({ capabilityId: record.record_id, companyId: record.company_id, recordType: record.record_type,
      product: record.product, taskTags: record.task_tags, geographyTags: record.geography_tags,
      facts: record.facts.map((fact: any) => ({ factId: fact.fact_id, field: fact.field, statement: fact.statement, status: fact.status,
        evidenceLevel: fact.evidence_level, confidence: fact.confidence, freshnessDays: fact.freshness_days, taskTags: fact.task_tags, geographyTags: fact.geography_tags,
        sourcePageIds: fact.source_page_ids, limits: fact.limits, conflicts: fact.conflicts,
        sources: fact.sources.map((source: any) => ({ url: source.url, sourceCheckedAt: source.source_checked_at, revalidatedAt: source.revalidated_at ?? null,
          publicationDate: source.publication_date ?? null, classification: source.classification, publisher: source.publisher ?? null })) })) }));
  if (new Set(capabilities.map((record: any) => record.capabilityId)).size !== capabilities.length) errors.push("duplicate_capability_id");
  if (capabilities.some((record: any) => new Set(record.facts.map((fact: any) => fact.factId)).size !== record.facts.length)) errors.push("duplicate_capability_fact_id");
  if (authorized.request.sections.includes("capabilities") && authorized.request.capabilityIds.some(value => !capabilities.some((record: any) => record.capabilityId === value))) errors.push("requested_capability_missing");
  const companyIds = new Set(capabilities.map((record: any) => record.companyId));
  const companies = (input.knowledge.companies ?? []).filter((company: any) => companyIds.has(company.company_id)).map((company: any) => companySchema.parse({
    companyId: company.company_id, name: company.name, roles: company.roles, sourcePageIds: company.source_page_ids }));
  if (new Set(companies.map(company => company.companyId)).size !== companies.length) errors.push("duplicate_company_id");
  if ([...companyIds].some(companyId => !companies.some(company => company.companyId === companyId))) errors.push("capability_company_join_missing");
  const pageIds = new Set([...companies.flatMap((company: any) => company.sourcePageIds), ...capabilities.flatMap((record: any) => record.facts.flatMap((fact: any) => fact.sourcePageIds))]);
  const sourcePages = (input.knowledge.source_pages ?? []).filter((page: any) => pageIds.has(page.page_id)).map((page: any) => pageSchema.parse({ pageId: page.page_id, url: page.url, revision: page.revision }));
  if (new Set(sourcePages.map(page => page.pageId)).size !== sourcePages.length) errors.push("duplicate_knowledge_page_id");
  if ([...pageIds].some(pageId => !sourcePages.some(page => page.pageId === pageId))) errors.push("knowledge_page_join_missing");
  const snapshot = seal({ version: SOURCE_SNAPSHOT_VERSION, asOf: authorized.request.asOf,
    scope: { principalId: authorized.grant.principalId, crmIds: [...authorized.request.crmIds].sort(), capabilityIds: [...authorized.request.capabilityIds].sort(), sections: [...authorized.request.sections].sort() },
    source: { crm: { recordRef: `${SOURCE_ROOT}/files/crm.json`, sourceHash: input.crmSourceHash, capturedAt: input.crm.captured_at },
      knowledge: { recordRef: `${SOURCE_ROOT}/files/knowledge.json`, sourceHash: input.knowledgeSourceHash, capturedAt: input.knowledge.exported_at },
      knowledgeContentHash: input.knowledge.content_hash, reconciliationHash: digest(input.independentRows) },
    crmRows, companies, capabilities, sourcePages, researchRuns: input.researchRuns,
    unknowns: ["source_checks_are_not_refreshed", ...(crmRows.some(row => row.canonical.prospectId === null) ? ["crm_only_canonical_joins_missing"] : []),
      ...(crmRows.some(row => row.verification === "Needs recheck") ? ["legacy_contact_needs_recheck"] : []), ...(input.researchRuns.some(row => row.state === "failed") ? ["failed_run_is_not_completed_research"] : [])], parentSnapshotId: null });
  const report = { version: "blueprint.research-learning-source-reconciliation.v1", errors, readyForStagedAppend: errors.length === 0, readyForCutover: false,
    counts: { crmRows: crmRows.length, companies: companies.length, capabilityRecords: capabilities.length, capabilityFacts: capabilities.reduce((count: number, record: any) => count + record.facts.length, 0),
      joinedCanonicalProspects: crmRows.filter(row => row.canonical.prospectId !== null).length, unjoinedCrmRows: crmRows.filter(row => row.canonical.prospectId === null).length, proposedSourceSnapshots: errors.length ? 0 : 1, normalizedOutcomeEvents: 0 }, snapshot };
  if (!errors.length) reconciledReports.set(report, verifySourceSnapshot(snapshot).snapshotId);
  return report;
}
export function validatedReconciliationSnapshot(report: ReturnType<typeof reconcilePriorResearch>): SourceSnapshot {
  const expected = reconciledReports.get(report), snapshot = verifySourceSnapshot(report.snapshot);
  if (!expected || expected !== snapshot.snapshotId || report.errors.length || !report.readyForStagedAppend) throw new Error("learning_source_reconciliation_required");
  return snapshot;
}

export function verifySourceSnapshot(value: unknown): SourceSnapshot {
  const parsed = sourceSnapshotSchema.parse(value), { snapshotId, contentHash, ...content } = parsed;
  if (snapshotId !== contentHash || digest(content) !== contentHash) throw new Error("learning_source_snapshot_hash_mismatch");
  const uniqueKeys = (items: string[]) => new Set(items).size === items.length;
  if (!uniqueKeys(parsed.crmRows.map(row => row.crmId)) || !uniqueKeys(parsed.capabilities.map(row => row.capabilityId))
    || !uniqueKeys(parsed.companies.map(row => row.companyId)) || !uniqueKeys(parsed.sourcePages.map(row => row.pageId))
    || (parsed.scope.sections.includes("crm") && parsed.scope.crmIds.some(crmId => !parsed.crmRows.some(row => row.crmId === crmId)))
    || (parsed.scope.sections.includes("capabilities") && parsed.scope.capabilityIds.some(capabilityId => !parsed.capabilities.some(row => row.capabilityId === capabilityId)))
    || parsed.crmRows.some(row => !parsed.scope.sections.includes("crm") || !parsed.scope.crmIds.includes(row.crmId))
    || parsed.capabilities.some(row => !parsed.scope.sections.includes("capabilities") || !parsed.scope.capabilityIds.includes(row.capabilityId)
      || !uniqueKeys(row.facts.map(fact => fact.factId)) || !parsed.companies.some(company => company.companyId === row.companyId))
    || parsed.companies.some(company => !parsed.capabilities.some(record => record.companyId === company.companyId))
    || [...parsed.companies.flatMap(row => row.sourcePageIds), ...parsed.capabilities.flatMap(row => row.facts.flatMap(fact => fact.sourcePageIds))]
      .some(pageId => !parsed.sourcePages.some(page => page.pageId === pageId))
    || parsed.sourcePages.some(page => !parsed.companies.some(company => company.sourcePageIds.includes(page.pageId))
      && !parsed.capabilities.some(record => record.facts.some(fact => fact.sourcePageIds.includes(page.pageId))))) throw new Error("learning_source_snapshot_join_invalid");
  if (Date.parse(parsed.source.crm.capturedAt) > Date.parse(parsed.asOf) || Date.parse(parsed.source.knowledge.capturedAt) > Date.parse(parsed.asOf)
    || parsed.crmRows.some(row => row.sourceCheckedDate && dateMillis(row.sourceCheckedDate) > Date.parse(parsed.source.crm.capturedAt))
    || parsed.capabilities.some(row => row.facts.some(fact => fact.sources.some(source => [source.sourceCheckedAt, source.revalidatedAt, source.publicationDate]
      .some(date => date && dateMillis(date) > Date.parse(parsed.source.knowledge.capturedAt)))))) throw new Error("learning_source_snapshot_date_invalid");
  return parsed;
}

/** A host-issued grant is required for every agent; no mailbox or CRM writes. */
export function scopeSourceSnapshot(value: unknown, grant: SourceGrant, request: SourceRequest, now: string): SourceSnapshot {
  const { grant: allowed, request: selected } = authorizeSources(grant, request, now), source = verifySourceSnapshot(value);
  if (source.asOf > selected.asOf || selected.crmIds.some(value => !source.scope.crmIds.includes(value))
    || selected.capabilityIds.some(value => !source.scope.capabilityIds.includes(value)) || selected.sections.some(value => !source.scope.sections.includes(value))) throw new Error("learning_source_snapshot_scope_missing");
  const crmRows = selected.sections.includes("crm") ? source.crmRows.filter(row => selected.crmIds.includes(row.crmId)) : [];
  const capabilities = selected.sections.includes("capabilities") ? source.capabilities.filter(row => selected.capabilityIds.includes(row.capabilityId)) : [];
  const companies = source.companies.filter(row => capabilities.some(record => record.companyId === row.companyId));
  const pageIds = new Set([...companies.flatMap(row => row.sourcePageIds), ...capabilities.flatMap(row => row.facts.flatMap(fact => fact.sourcePageIds))]);
  const { snapshotId: _id, contentHash: _hash, ...content } = source;
  return seal({ ...content, scope: { principalId: allowed.principalId, crmIds: [...selected.crmIds].sort(), capabilityIds: [...selected.capabilityIds].sort(), sections: [...selected.sections].sort() },
    crmRows, capabilities, companies, sourcePages: source.sourcePages.filter(row => pageIds.has(row.pageId)), parentSnapshotId: source.parentSnapshotId ?? source.snapshotId,
    unknowns: ["source_checks_are_not_refreshed", ...(crmRows.some(row => row.canonical.prospectId === null) ? ["crm_only_canonical_joins_missing"] : []),
      ...(crmRows.some(row => row.verification === "Needs recheck") ? ["legacy_contact_needs_recheck"] : []), ...(source.researchRuns.some(row => row.state === "failed") ? ["failed_run_is_not_completed_research"] : [])],
  });
}
