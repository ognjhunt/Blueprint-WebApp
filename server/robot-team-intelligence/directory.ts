import { createHash } from "node:crypto";
import { z } from "zod";
import { robotGateFields, robotSpecFields } from "../../client/src/data/robotTeamQualification";
import { assertPublicHttpsUrl, fetchPublicText, toReadableText, PublicFetchError } from "../utils/publicFetchGuard";
import { readQueryPages } from "../research-learning/query-pages";
import { ROBOT_TEAMS_COLLECTION } from "../types/robot-team-registry";

export const ROOT = "robotTeamIntelligence/default";
export const CATEGORIES = ["hardware", "software", "full_stack", "world_model", "robot_policy", "manipulation_component"] as const;
const EVENTS = ["announcement", "funding", "stealth", "product_release", "research", "deployment_claim", "partnership", "hiring", "other"] as const;
const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/);
const text = z.string().trim().min(1);
const instant = z.string().datetime({ offset: true });
const tags = z.object({ embodiment: z.array(text).optional(), task: z.array(text).optional(), geography: z.array(text).optional() }).strict();
const filters = z.object({ categories: z.array(z.enum(CATEGORIES)).optional(), embodiment: text.optional(), task: text.optional(),
  geography: text.optional(), event_type: z.enum(EVENTS).optional(), changed_since: instant.optional() }).strict();
const schemas = {
  search_robot_teams: z.object({ query: z.string().default(""), filters: filters.optional(), cursor: text.optional(),
    page_size: z.number().int().min(1).max(100).default(25) }).strict(),
  fetch_robot_team: z.object({ team_id: id }).strict(),
  mirror_robot_team_to_notion: z.object({ team_id: id }).strict(),
  save_robot_team_update: z.object({ update: z.object({ team_id: id.optional(),
    organization: z.object({ name: text, website: text, aliases: z.array(text).optional() }).strict().optional(),
    categories: z.array(z.enum(CATEGORIES)).optional(), tags: tags.optional(), event_type: z.enum(EVENTS).optional(),
    occurred_at: z.union([instant, z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/), z.null()]).optional(),
    summary: text.optional(), unknowns: z.array(text).optional(), claims: z.array(z.unknown()).default([]),
  }).strict() }).strict(),
  record_robot_team_check: z.object({ team_id: id, checked_at: instant, summary: text }).strict(),
  read_robot_team_history: z.object({ team_id: id, cursor: text.optional(), page_size: z.number().int().min(1).max(100).default(25) }).strict(),
};
const capabilityOptions = Object.fromEntries([...robotSpecFields, ...robotGateFields]
  .filter(f => f.id !== "budgetBand").map(f => [f.id, f.options.map(o => o.value)]));
const capabilityLabels = Object.fromEntries([...robotSpecFields, ...robotGateFields]
  .filter(f => f.id !== "budgetBand").map(f => [f.id, Object.fromEntries(f.options.map(o => [o.value, o.label]))]));
const capabilityFields = new Set([...Object.keys(capabilityOptions), "reachM", "pathWidthM", "deploymentRegions"]);
const observationFields = new Set(["announcement", "funding", "product", "research", "deployment_claim", "partnership", "hiring", "commercial_availability"]);
const claimSchema = z.object({ field: text, value: z.union([text, z.number().finite()]), grade: z.enum(["published", "inferred"]),
  source_url: text, quote: text, publication_date: z.union([z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/), z.null()]).optional(),
  rationale: text.optional(), supersedes: id.optional() }).strict();
type Issue = { path: string; code: string; message: string };
type RecordData = Record<string, any>;
const canonical = (v: any): string => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v && typeof v === "object"
  ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}` : JSON.stringify(v);
export const directoryDigest = (v: any) => createHash("sha256").update(canonical(v)).digest("hex");
const rawHash = (v: Buffer | string) => createHash("sha256").update(v).digest("hex");
const norm = (s: string) => s.toLowerCase().replace(/\b(?:wheeled humanoids?|mobile manipulators?)\b/g, "mobile_manipulator")
  .replace(/\b(?:cnc(?: machine)?(?: tending)?|machine tending)\b/g, "machine_tending").replace(/[^\p{L}\p{N}_]+/gu, " ").trim();
const domain = (s: string) => assertPublicHttpsUrl(s).hostname.toLowerCase().replace(/^www\./, "");
const fail = (code: string, issues: Issue[] = []) => ({ ok: false, error: { code, issues } });
const parseIssues = (e: z.ZodError): Issue[] => e.issues.map(i => ({ path: "/" + i.path.join("/"), code: i.code, message: i.message }));

/** Public-source projection only: account/contact/key/finance fields never leave this boundary. */
export function publicRobotTeam(teamId: string, row: RecordData) {
  const capability: RecordData = {}, provenance: RecordData = {};
  for (const key of capabilityFields) {
    const value = row.capability?.[key];
    if (["string", "number", "boolean"].includes(typeof value) || Array.isArray(value) && value.every(v => typeof v === "string")) capability[key] = value;
    const p = row.fieldProvenance?.[key];
    if (p) provenance[key] = { grade: typeof p.grade === "string" ? p.grade : null,
      source: typeof p.source === "string" ? p.source : null, observedAt: typeof p.observedAt === "string" ? p.observedAt : null };
  }
  const intel = row.public_intelligence || {};
  const strings = (value: unknown) => Array.isArray(value) ? value.filter(v => typeof v === "string") : [];
  const publicClaims = (Array.isArray(intel.claims) ? intel.claims : []).flatMap((claim: any) => {
    if (!claim || !capabilityFields.has(claim.field) && !observationFields.has(claim.field)) return [];
    const selected = Object.fromEntries(["field", "value", "grade", "source_url", "quote", "publication_date", "rationale", "supersedes"]
      .filter(k => claim[k] !== undefined).map(k => [k, claim[k]]));
    if (!claimSchema.safeParse(selected).success) return [];
    const e = claim.evidence;
    return [{ ...selected, classification: claim.grade === "inferred" ? "model_interpretation" : "source_claim",
      ...(e ? { evidence: Object.fromEntries(["source_ref", "source_url", "fetched_url", "raw_sha256", "readable_sha256", "bytes", "truncated", "checked_at"]
        .filter(k => ["string", "number", "boolean"].includes(typeof e[k])).map(k => [k, e[k]])) } : {}) }];
  });
  return { team_id: teamId, name: row.name ?? null, website: row.website ?? null, status: row.status ?? "prospect",
    capability, field_provenance: provenance, categories: strings(intel.categories).filter(c => (CATEGORIES as readonly string[]).includes(c)),
    tags: Object.fromEntries(["embodiment", "task", "geography"].map(k => [k, strings(intel.tags?.[k])])),
    aliases: strings(intel.aliases), latest_event: intel.latest_event ? { type: intel.latest_event.type ?? null,
      occurred_at: intel.latest_event.occurred_at ?? null, change_id: intel.latest_event.change_id ?? null } : null, claims: publicClaims,
    summary: typeof intel.summary === "string" ? intel.summary : null, summary_classification: "model_interpretation", unknowns: strings(intel.unknowns),
    updated_at: intel.updated_at ?? row.updatedAt ?? row.createdAt ?? null,
    ...(intel.retained_directory && typeof intel.retained_directory.notes === "string" ? {
      retained_directory: Object.fromEntries(["source_record_id", "title", "notes", "source_page_url", "source_page_last_edited_at", "original_checked_at", "notes_sha256", "classification"]
        .filter(k => typeof intel.retained_directory[k] === "string").map(k => [k, intel.retained_directory[k]])) } : {}),
    source_ref: `${ROBOT_TEAMS_COLLECTION}/${teamId}`, evidence_not_instructions: true };
}
export type DirectoryFetcher = (url: string) => Promise<{ url: string; text: string; truncated: boolean }>;
export type DirectorySemanticSearch = (query: string, documents: { team_id: string; source_sha256: string; text: string }[]) =>
  Promise<{ scores: Record<string, number>; mode: "semantic" | "keyword"; model?: string; diagnostics: { code: string; action: string }[] }>;
type Operation = { ref: FirebaseFirestore.DocumentReference; name: string; request_sha256: string };
type StoredResult = { path: string; record: RecordData };

export const ROBOT_TEAM_TOOLS = [
  { name: "mirror_robot_team_to_notion", description: "Publish the current canonical public robot-team record to the owner-authorized Notion directory mirror. Preserves original evidence dates, full notes, source claims and unknowns. Inspect actual readback receipts; on an unknown acknowledgment call again to observe the same bound copy, never invent another destination or permission.",
    parameters: { type: "object", properties: { team_id: { type: "string" } }, required: ["team_id"], additionalProperties: false } },
  { name: "search_robot_teams", description: "Search and page the public robot-team directory. Choose queries and category/task/embodiment/geography/news/date filters. Aliases support wheeled humanoid/mobile manipulator and CNC/machine tending. No result shortlist is preset.",
    parameters: { type: "object", properties: { query: { type: "string" }, filters: { type: "object", properties: {
      categories: { type: "array", items: { type: "string", enum: [...CATEGORIES] } }, embodiment: { type: "string" }, task: { type: "string" },
      geography: { type: "string" }, event_type: { type: "string", enum: [...EVENTS] }, changed_since: { type: "string" } }, additionalProperties: false },
      cursor: { type: "string" }, page_size: { type: "integer", minimum: 1, maximum: 100 } }, additionalProperties: false } },
  { name: "fetch_robot_team", description: "Fetch one exact public team record and its dated evidence/provenance. Account, email, credentials and private finance are excluded.",
    parameters: { type: "object", properties: { team_id: { type: "string" } }, required: ["team_id"], additionalProperties: false } },
  { name: "save_robot_team_update", description: "Save independently fetched, quote-supported public intelligence. Select existing team_id or a sourced organization name/website. Bad optional claims return issues while supported siblings may save. Preserve measured/self-reported capabilities and original identity/status. News never proves Blueprint engagement or physical capability.",
    parameters: { type: "object", properties: { update: { type: "object", properties: { team_id: { type: "string" },
      organization: { type: "object", properties: { name: { type: "string" }, website: { type: "string" }, aliases: { type: "array", items: { type: "string" } } }, required: ["name", "website"], additionalProperties: false },
      categories: { type: "array", items: { type: "string", enum: [...CATEGORIES] } }, tags: { type: "object", properties: {
        embodiment: { type: "array", items: { type: "string" } }, task: { type: "array", items: { type: "string" } }, geography: { type: "array", items: { type: "string" } } }, additionalProperties: false },
      event_type: { type: "string", enum: [...EVENTS] }, occurred_at: { type: ["string", "null"] }, summary: { type: "string" }, unknowns: { type: "array", items: { type: "string" } },
      claims: { type: "array", items: { type: "object", properties: { field: { type: "string" }, value: { type: ["string", "number"] }, grade: { type: "string", enum: ["published", "inferred"] },
        source_url: { type: "string" }, quote: { type: "string" }, publication_date: { type: ["string", "null"] }, rationale: { type: "string" }, supersedes: { type: "string" } },
        required: ["field", "value", "grade", "source_url", "quote"], additionalProperties: false } } }, additionalProperties: false } }, required: ["update"], additionalProperties: false } },
  { name: "record_robot_team_check", description: "Record a dated check and the agent's interpretation, including no-change/coverage gaps. It does not refresh any source evidence date or prove an unsupported claim.",
    parameters: { type: "object", properties: { team_id: { type: "string" }, checked_at: { type: "string" }, summary: { type: "string" } }, required: ["team_id", "checked_at", "summary"], additionalProperties: false } },
  { name: "read_robot_team_history", description: "Page exact retained changes/checks, original dates, source hashes and correction references for one team.",
    parameters: { type: "object", properties: { team_id: { type: "string" }, cursor: { type: "string" }, page_size: { type: "integer", minimum: 1, maximum: 100 } }, required: ["team_id"], additionalProperties: false } },
].map(tool => ({ type: "function" as const, ...tool }));

export class RobotTeamDirectory {
  semanticSearch?: DirectorySemanticSearch;
  private mirror?: (teamId: string) => Promise<any>;
  private mutationGuard: (tx?: FirebaseFirestore.Transaction) => Promise<void>;
  constructor(private database: FirebaseFirestore.Firestore, private fetcher: DirectoryFetcher = fetchPublicText,
    private clock: () => string = () => new Date().toISOString(), options: { semanticSearch?: DirectorySemanticSearch; mutationGuard?: (tx?: FirebaseFirestore.Transaction) => Promise<void>;
      mirror?: (teamId: string) => Promise<any> } = {}) {
    this.semanticSearch = options.semanticSearch;
    this.mirror = options.mirror;
    this.mutationGuard = options.mutationGuard ?? (async () => {});
  }
  private ref(collection: string, key: string) { return this.database.collection(collection).doc(key); }
  private async rows() { return readQueryPages(this.database.collection(ROBOT_TEAMS_COLLECTION)); }
  private async source(url: string) {
    assertPublicHttpsUrl(url);
    const page = await this.fetcher(url);
    assertPublicHttpsUrl(page.url);
    const readable = toReadableText(page.text), bytes = Buffer.from(page.text);
    const source = { source_ref: `${ROOT}/sources/${rawHash(bytes)}`, source_url: url, fetched_url: page.url,
      raw_sha256: rawHash(bytes), readable_sha256: rawHash(readable), bytes: bytes.length,
      truncated: page.truncated, checked_at: instant.parse(this.clock()) };
    // Content-addressed chunks preserve complete fetched bytes without enlarging
    // directory/history documents beyond Firestore's document limit.
    const chunkSize = 192 * 1024, parts = Math.max(1, Math.ceil(bytes.length / chunkSize));
    await this.database.runTransaction(async tx => {
      const ref = this.ref(`${ROOT}/sources`, source.raw_sha256), old = await tx.get(ref);
      if (old.exists) {
        if (old.data()?.raw_sha256 !== source.raw_sha256 || old.data()?.bytes !== bytes.length) throw Error("robot_team_source_conflict");
        return;
      }
      await this.mutationGuard(tx);
      tx.set(ref, { raw_sha256: source.raw_sha256, bytes: bytes.length, parts, encoding: "base64" });
      for (let i = 0; i < parts; i++) tx.set(this.ref(`${ROOT}/sources/${source.raw_sha256}/chunks`, String(i)),
        { bytes: bytes.subarray(i * chunkSize, (i + 1) * chunkSize).toString("base64") });
    });
    const meta = (await this.ref(`${ROOT}/sources`, source.raw_sha256).get()).data();
    if (!meta || meta.parts !== parts || meta.bytes !== bytes.length || meta.raw_sha256 !== source.raw_sha256) throw Error("robot_team_source_conflict");
    const chunks = await Promise.all(Array.from({ length: parts }, (_, i) => this.ref(`${ROOT}/sources/${source.raw_sha256}/chunks`, String(i)).get()));
    const retained = Buffer.concat(chunks.map(c => {
      if (!c.exists || typeof c.data()?.bytes !== "string") throw Error("robot_team_source_conflict");
      return Buffer.from(c.data()!.bytes, "base64");
    }));
    if (retained.length !== bytes.length || rawHash(retained) !== source.raw_sha256) throw Error("robot_team_source_conflict");
    return { source, readable };
  }
  private cursor(cursor: string | undefined, binding: string) {
    if (!cursor) return 0;
    try { const p = JSON.parse(Buffer.from(cursor, "base64url").toString());
      if (p.binding === binding && Number.isInteger(p.offset) && p.offset >= 0) return p.offset;
    } catch { /* actionable cursor error */ }
    throw Error("robot_team_cursor_stale_or_invalid");
  }
  private page<T>(rows: T[], cursor: string | undefined, size: number, identity: unknown) {
    const binding = directoryDigest({ identity, rows }), offset = this.cursor(cursor, binding), end = offset + size;
    return { rows: rows.slice(offset, end), next_cursor: end < rows.length ? Buffer.from(JSON.stringify({ binding, offset: end })).toString("base64url") : null };
  }
  private resultRef(path: string, name: string) {
    const prefix = `${ROOT}/${name === "save_robot_team_update" ? "changes" : "checks"}/`;
    if (typeof path !== "string" || !path.startsWith(prefix) || !/^[a-f0-9]{64}$/.test(path.slice(prefix.length))) throw Error("robot_team_operation_binding_changed");
    return this.ref(prefix.slice(0, -1), path.slice(prefix.length));
  }
  private async mapped(operation: Operation, tx?: FirebaseFirestore.Transaction): Promise<StoredResult | null> {
    const mapping = tx ? await tx.get(operation.ref) : await operation.ref.get();
    if (!mapping.exists) return null;
    const value = mapping.data()!;
    if (value.name !== operation.name || value.request_sha256 !== operation.request_sha256) throw Error("robot_team_operation_binding_changed");
    const ref = this.resultRef(value.result_ref, operation.name), result = tx ? await tx.get(ref) : await ref.get();
    if (!result.exists || directoryDigest(result.data()) !== value.result_sha256) throw Error("robot_team_operation_receipt_unavailable");
    return { path: value.result_ref, record: result.data()! };
  }
  private bindOperation(tx: FirebaseFirestore.Transaction, operation: Operation | undefined, result: StoredResult) {
    if (operation) tx.set(operation.ref, { name: operation.name, request_sha256: operation.request_sha256,
      result_ref: result.path, result_sha256: directoryDigest(result.record) });
  }
  private receipt(name: string, result: StoredResult) {
    const record = result.record;
    return name === "save_robot_team_update" ? { ok: true, team_id: record.team_id, change_id: record.change_id, record_ref: result.path,
      source_sha256: directoryDigest(record), readback_verified: true, record: record.record, issues: record.issues, protected_fields: record.protected_fields }
      : { ok: true, check_id: record.check_id, record_ref: result.path, source_sha256: directoryDigest(record), record };
  }
  async call(name: string, args: unknown, context: { operationKey?: string } = {}): Promise<any> {
    const schema = schemas[name as keyof typeof schemas];
    if (!schema) return fail("robot_team_tool_not_declared");
    if (typeof args === "string") {
      try { args = JSON.parse(args); }
      catch { return fail("robot_team_arguments_invalid", [{ path: "/", code: "invalid_json", message: "Return a JSON object or an exact JSON-encoded object; retain and correct the malformed arguments." }]); }
    }
    const parsed = schema.safeParse(args);
    if (!parsed.success) return fail("robot_team_arguments_invalid", parseIssues(parsed.error));
    try {
      const input: any = parsed.data;
      if (name === "mirror_robot_team_to_notion") {
        if (!this.mirror) return fail("robot_notion_mirror_not_enabled");
        await this.mutationGuard();
        return await this.mirror(input.team_id);
      }
      let operation: Operation | undefined;
      if (context.operationKey !== undefined && ["save_robot_team_update", "record_robot_team_check"].includes(name)) {
        if (!/^[a-f0-9]{64}$/.test(context.operationKey)) throw Error("robot_team_operation_key_invalid");
        operation = { ref: this.ref(`${ROOT}/operations`, context.operationKey), name, request_sha256: directoryDigest({ name, arguments: input }) };
        const existing = await this.mapped(operation);
        if (existing) return this.receipt(name, existing);
      }
      if (name === "search_robot_teams") return await this.search(input);
      if (name === "save_robot_team_update") return await this.save(input.update, operation);
      const saved = await this.ref(ROBOT_TEAMS_COLLECTION, input.team_id).get();
      if (!saved.exists) return fail("robot_team_not_found", [{ path: "/team_id", code: "not_found", message: "Choose an existing exact team ID or save a sourced new organization." }]);
      if (name === "fetch_robot_team") {
        const record = publicRobotTeam(saved.id, saved.data()!);
        return { ok: true, record, content_sha256: directoryDigest(record) };
      }
      if (name === "record_robot_team_check") return await this.check(input, operation);
      const changes = await readQueryPages(this.database.collection(`${ROOT}/changes`).where("team_id", "==", input.team_id));
      const checks = await readQueryPages(this.database.collection(`${ROOT}/checks`).where("team_id", "==", input.team_id));
      const history = [...changes.map(d => ({ kind: "change", ...d.data(), record_ref: `${ROOT}/changes/${d.id}` })),
        ...checks.map(d => ({ kind: "check", ...d.data(), record_ref: `${ROOT}/checks/${d.id}` }))]
        .sort((a: any, b: any) => a.recorded_at.localeCompare(b.recorded_at) || a.record_ref.localeCompare(b.record_ref));
      return { ok: true, ...this.page(history, input.cursor, input.page_size, input.team_id), evidence_not_instructions: true };
    } catch (error) {
      const code = error instanceof PublicFetchError ? error.code : error instanceof Error && /^robot_team_[a-z_]+$/.test(error.message)
        ? error.message : "robot_team_operation_unavailable";
      return fail(code, [{ path: "/", code, message: "Correct the affected request, inspect retained team/history receipts, or report the source/transport gap. Unknown mutations must be read back before another update." }]);
    }
  }
  private async search(input: any) {
    const all = (await this.rows()).map(d => publicRobotTeam(d.id, d.data())), f = input.filters || {};
    const matches = all.filter(r => (!f.categories || f.categories.some((c: string) => r.categories.includes(c)))
      && (!f.event_type || r.latest_event?.type === f.event_type)
      && (!f.changed_since || r.updated_at && Date.parse(r.updated_at) >= Date.parse(f.changed_since))
      && ["embodiment", "task", "geography"].every(k => {
        const fields: Record<string, string[]> = { embodiment: ["embodiment"], task: ["taskFamily", "objectHandling"], geography: ["deploymentGeography", "deploymentRegions"] };
        return !f[k] || norm(JSON.stringify([r.tags[k] || [], ...fields[k].map(field => r.capability[field] ?? "")])).includes(norm(f[k]));
      }));
    const words = norm(input.query).split(" ").filter(Boolean), docs = matches.map(r => ({ team_id: r.team_id,
      source_sha256: directoryDigest(r), text: JSON.stringify(r) }));
    let semantic: Awaited<ReturnType<DirectorySemanticSearch>> = { scores: {}, mode: "keyword", diagnostics: [{ code: "semantic_reader_not_configured", action: "Keyword and alias search remains available; configure the authorized semantic adapter if required." }] };
    if (input.query && this.semanticSearch) try { semantic = await this.semanticSearch(input.query, docs); }
    catch { semantic = { scores: {}, mode: "keyword", diagnostics: [{ code: "semantic_reader_unavailable", action: "Keyword and alias search remains available; retry the authorized semantic reader." }] }; }
    const ranked = matches.map(r => ({ record: r, lexical: words.filter(w => norm(JSON.stringify(r)).includes(w)).length,
      semantic: Number.isFinite(semantic.scores?.[r.team_id]) ? semantic.scores![r.team_id] : 0 }))
      .filter(r => !words.length || r.lexical > 0 || r.semantic > 0)
      .sort((a, b) => b.semantic - a.semantic || b.lexical - a.lexical || a.record.team_id.localeCompare(b.record.team_id));
    const page = this.page(ranked.map(r => ({ ...r.record, lexical_score: r.lexical, semantic_score: r.semantic })), input.cursor, input.page_size,
      { query: input.query, filters: f });
    return { ok: true, ...page, coverage: { directory_records: all.length, matching_records: ranked.length, complete: true },
      relevance: { scope: "complete_filtered_directory", mode: semantic.mode },
      semantic: { mode: semantic.mode, ...(semantic.model ? { model: semantic.model } : {}), diagnostics: semantic.diagnostics } };
  }
  private async check(input: any, operation?: Operation) {
    const now = instant.parse(this.clock());
    if (Date.parse(input.checked_at) > Date.parse(now)) return fail("robot_team_check_future", [{ path: "/checked_at", code: "future", message: "Retain the actual check time; do not invent a future observation." }]);
    const key = directoryDigest(input), ref = this.ref(`${ROOT}/checks`, key);
    const record = { ...input, check_id: key, classification: "model_interpretation", recorded_at: now, evidence_not_instructions: true };
    const expected = await this.database.runTransaction(async tx => {
      const prior = operation ? await this.mapped(operation, tx) : null;
      if (prior) return prior;
      const team = await tx.get(this.ref(ROBOT_TEAMS_COLLECTION, input.team_id)), old = await tx.get(ref);
      if (!team.exists) throw Error("robot_team_not_found");
      const result = { path: `${ROOT}/checks/${key}`, record: old.exists ? old.data()! : record };
      if (!old.exists || operation) {
        await this.mutationGuard(tx);
        if (!old.exists) tx.set(ref, record);
        this.bindOperation(tx, operation, result);
      }
      return result;
    });
    const readback = (await this.resultRef(expected.path, "record_robot_team_check").get()).data()!;
    if (!readback || directoryDigest(readback) !== directoryDigest(expected.record)) throw Error("robot_team_change_readback_mismatch");
    return this.receipt("record_robot_team_check", { path: expected.path, record: readback });
  }
  private async save(update: any, operation?: Operation) {
    if (!update.team_id && !update.organization) return fail("robot_team_identity_required", [{ path: "/update", code: "identity_required", message: "Provide exact team_id or sourced organization name and canonical website." }]);
    const now = instant.parse(this.clock()), issues: Issue[] = [], accepted: any[] = [], sources = new Map<string, Awaited<ReturnType<RobotTeamDirectory["source"]>>>();
    for (let index = 0; index < update.claims.length; index++) {
      const parsed = claimSchema.safeParse(update.claims[index]);
      if (!parsed.success) { issues.push(...parseIssues(parsed.error).map(i => ({ ...i, path: `/update/claims/${index}${i.path}` }))); continue; }
      const claim = parsed.data;
      if (!capabilityFields.has(claim.field) && !observationFields.has(claim.field)) {
        issues.push({ path: `/update/claims/${index}/field`, code: "field_not_public", message: "Use a public capability field or announcement/funding/product/research/deployment_claim/partnership/hiring/commercial_availability; private fields are excluded." }); continue;
      }
      if (capabilityOptions[claim.field] && !capabilityOptions[claim.field].includes(claim.value as string)) {
        issues.push({ path: `/update/claims/${index}/value`, code: "capability_value_invalid", message: `Existing capability values: ${capabilityOptions[claim.field].join(", ")}. Preserve the full claim as a product/research observation if it does not fit.` }); continue;
      }
      if (["reachM", "pathWidthM"].includes(claim.field) && (typeof claim.value !== "number" || claim.value <= 0)) {
        issues.push({ path: `/update/claims/${index}/value`, code: "capability_value_invalid", message: "Use a positive stated measurement in metres, or retain an uncertain observation without assigning the capability." }); continue;
      }
      try {
        let source = sources.get(claim.source_url);
        if (!source) { source = await this.source(claim.source_url); sources.set(claim.source_url, source); }
        const quotation = toReadableText(claim.quote);
        if (!quotation || !source.readable.includes(quotation)) throw Error("robot_team_quote_not_found");
        if (claim.grade === "inferred" && !claim.rationale) {
          issues.push({ path: `/update/claims/${index}/rationale`, code: "inference_rationale_required", message: "Retain your interpretation and why the quotation supports it; it is not a directly published fact." }); continue;
        }
        const literals = [String(claim.value), capabilityLabels[claim.field]?.[String(claim.value)]]
          .filter(Boolean).map(value => norm(value.replace(/_/g, " ")));
        if (claim.grade === "published" && !literals.some(value => (` ${norm(quotation)} `).includes(` ${value} `))) {
          issues.push({ path: `/update/claims/${index}/value`, code: "published_value_not_quoted", message: "Use the actual quoted value. If this is your interpretation, use inferred with a rationale; an unrelated quotation does not publish this value." }); continue;
        }
        if (["reachM", "pathWidthM"].includes(claim.field) && claim.grade === "published" && !/\b(?:metres?|meters?|m)\b/i.test(quotation)) {
          issues.push({ path: `/update/claims/${index}/value`, code: "measurement_unit_unverified", message: "These fields are metres. Retain the original units in a product observation or explain an inferred conversion." }); continue;
        }
        accepted.push({ ...claim, publication_date: claim.publication_date ?? null, evidence: source.source });
      } catch (error) {
        issues.push({ path: `/update/claims/${index}`, code: error instanceof PublicFetchError ? error.code : "source_or_quote_unverified",
          message: "Fetch an accessible public source and supply the exact supporting quotation; this claim has not been applied." });
      }
    }
    if (!accepted.length) return fail("robot_team_no_supported_claims", issues);
    const all = await this.rows();
    let teamId = update.team_id, organization = update.organization, identityDomain: string | null = null;
    if (organization) {
      identityDomain = domain(organization.website);
      const matches = all.filter(d => { try { return d.data().website && domain(d.data().website) === identityDomain; } catch { return false; } });
      if (matches.length > 1 && !matches.some(d => d.id === teamId)) return fail("robot_team_domain_ambiguous", [{ path: "/update/organization/website", code: "ambiguous", message: "Existing aliases share this domain; select the original exact team_id." }]);
      if (matches.length && teamId && !matches.some(d => d.id === teamId)) return fail("robot_team_identity_conflict");
      if (matches.length && !teamId) teamId = matches[0].id;
      if (!teamId) {
        const identity = await this.source(organization.website);
        if (!norm(identity.readable).includes(norm(organization.name))) return fail("robot_team_identity_unverified", [{ path: "/update/organization/name", code: "identity_unverified", message: "The fetched canonical website must identify this organization." }]);
        sources.set(organization.website, identity);
        teamId = "team_" + rawHash(identityDomain).slice(0, 32);
      }
    }
    const selectedTeam = all.find(d => d.id === teamId)?.data();
    if (!selectedTeam && !organization) return fail("robot_team_not_found");
    const identityNames = [selectedTeam?.name, organization?.name, ...(selectedTeam?.public_intelligence?.aliases || [])]
      .filter(name => typeof name === "string" && norm(name));
    const identityWebsite = selectedTeam?.website || organization?.website;
    let selectedDomain: string | null = null;
    try { if (identityWebsite) selectedDomain = domain(identityWebsite); } catch { /* Existing missing/nonpublic websites are unknown, not a reason to discard a name-bound public source. */ }
    const related = accepted.filter(claim => {
      const source = sources.get(claim.source_url)!;
      const matches = selectedDomain && domain(claim.source_url) === selectedDomain || identityNames.some(name => norm(source.readable).includes(norm(name)))
        || selectedDomain && source.readable.toLowerCase().includes(selectedDomain);
      if (!matches) issues.push({ path: "/update/claims", code: "source_team_unbound", message: "This external source must identify the selected organization. Keep unrelated teams' evidence in their own updates." });
      return matches;
    });
    accepted.splice(0, accepted.length, ...related);
    if (!accepted.length) return fail("robot_team_no_supported_claims", issues);
    for (const claim of [...accepted]) if (claim.supersedes) {
      const prior = await this.ref(`${ROOT}/changes`, claim.supersedes).get();
      if (!prior.exists || prior.data()?.team_id !== teamId) {
        issues.push({ path: "/update/claims/supersedes", code: "correction_unbound", message: "Choose a retained change ID for this exact team." });
        accepted.splice(accepted.indexOf(claim), 1);
      }
    }
    if (!accepted.length) return fail("robot_team_no_supported_claims", issues);
    const intent = { ...update, team_id: teamId, claims: accepted.map(({ evidence: _evidence, ...c }) => c) };
    const key = directoryDigest(intent), ref = this.ref(`${ROOT}/changes`, key), teamRef = this.ref(ROBOT_TEAMS_COLLECTION, teamId);
    const expected = await this.database.runTransaction(async tx => {
      const prior = operation ? await this.mapped(operation, tx) : null;
      if (prior) return prior;
      const old = await tx.get(ref), saved = await tx.get(teamRef);
      if (old.exists) {
        const result = { path: `${ROOT}/changes/${key}`, record: old.data()! };
        if (operation) { await this.mutationGuard(tx); this.bindOperation(tx, operation, result); }
        return result;
      }
      if (!saved.exists && !organization) throw Error("robot_team_not_found");
      const before = saved.exists ? saved.data()! : { id: teamId, name: organization.name, website: organization.website,
        status: "prospect", capability: {}, fieldProvenance: {}, createdAt: now, updatedAt: now };
      if (organization && before.website && domain(before.website) !== identityDomain) throw Error("robot_team_identity_conflict");
      const capability = { ...before.capability }, provenance = { ...before.fieldProvenance }, protectedFields: string[] = [];
      for (const claim of accepted) if (capabilityFields.has(claim.field)) {
        const current = provenance[claim.field]?.grade;
        if (["measured", "self_reported"].includes(current) || current === "published" && claim.grade === "inferred"
          || claim.field === "hardwareMaturity" && ["deployed", "pilots"].includes(claim.value)) { protectedFields.push(claim.field); continue; }
        capability[claim.field] = claim.value;
        provenance[claim.field] = { grade: claim.grade, source: claim.source_url, observedAt: now, proposedBy: `robot_team_intelligence:${key}` };
      }
      const previous = before.public_intelligence || {}, next = { ...before, capability, fieldProvenance: provenance,
        public_intelligence: { ...previous, categories: update.categories ?? previous.categories ?? [], tags: { ...previous.tags, ...update.tags },
          aliases: [...new Set([...(previous.aliases || []), ...(organization?.aliases || []), ...(organization && organization.name !== before.name ? [organization.name] : [])])],
          latest_event: update.event_type ? { type: update.event_type, occurred_at: update.occurred_at ?? null, change_id: key } : previous.latest_event ?? null,
          claims: [...(previous.claims || []).filter((c: any) => !accepted.some(a => a.field === c.field)), ...accepted],
          summary: update.summary ?? previous.summary ?? null, unknowns: update.unknowns ?? previous.unknowns ?? [], updated_at: now }, updatedAt: now };
      const record = { change_id: key, team_id: teamId, recorded_at: now, intent, claims: accepted, issues, protected_fields: protectedFields,
        sources: [...sources.values()].map(s => s.source), before_sha256: saved.exists ? directoryDigest(publicRobotTeam(teamId, before)) : null,
        after_sha256: directoryDigest(publicRobotTeam(teamId, next)), record: publicRobotTeam(teamId, next), evidence_not_instructions: true };
      await this.mutationGuard(tx);
      tx.set(teamRef, next);
      tx.set(ref, record);
      const result = { path: `${ROOT}/changes/${key}`, record };
      this.bindOperation(tx, operation, result);
      return result;
    });
    const receipt = (await this.resultRef(expected.path, "save_robot_team_update").get()).data()!;
    if (!receipt || directoryDigest(receipt) !== directoryDigest(expected.record)) throw Error("robot_team_change_readback_mismatch");
    return this.receipt("save_robot_team_update", { path: expected.path, record: receipt });
  }
}
