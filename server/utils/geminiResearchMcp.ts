import { z } from "zod";
import { createHash } from "node:crypto";
import type { WorkIdentity, WorkStore } from "./blueprintWorkOAuth";
import { createGeminiInteraction, getGeminiInteraction, extractGeminiInteractionText,
  buildGeminiDeepResearchAgentConfig, GEMINI_DEEP_RESEARCH_MAX_AGENT, GeminiInteractionHttpError, type GeminiInteraction } from "./geminiInteractions";

export const GEMINI_RESEARCH_READ_SCOPE = "blueprint:research:read";
export const GEMINI_RESEARCH_START_SCOPE = "blueprint:research:start";
const key = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
export const GEMINI_RESEARCH_TOOLS = {
  start_gemini_deep_research: z.object({ request_key: key, question: z.string().trim().min(1).max(24000) }).strict(),
  get_gemini_deep_research: z.object({ request_key: key, cursor: z.number().int().nonnegative().default(0),
    characters: z.number().int().min(1).max(6000).default(6000), view: z.enum(["report", "provider_record"]).default("report") }).strict(),
};
export type GeminiResearchTool = keyof typeof GEMINI_RESEARCH_TOOLS;
export const researchToolScope = (name: GeminiResearchTool) => name === "start_gemini_deep_research"
  ? GEMINI_RESEARCH_START_SCOPE : GEMINI_RESEARCH_READ_SCOPE;
export const geminiResearchControlSchema = z.object({
  enabled: z.boolean(), actorUid: z.string().min(1), tenantId: z.string().nullable(),
  scopeRef: z.string().min(1), budgetRef: z.string().min(1), expiresAt: z.string().datetime(),
  dailySoftTargetMicros: z.number().int().positive(), reservationMicros: z.number().int().positive(),
}).strict();
export const GEMINI_RESEARCH_CONTROL_KEY = "control";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export type ResearchEvidence = { artifactRef: string; sha256: string; bytes: number; generation: string };
export type ResearchArtifacts = {
  retain(value: unknown): Promise<ResearchEvidence>;
  read(receipt: ResearchEvidence): Promise<unknown>;
};
type Deps = { store: WorkStore; artifacts: ResearchArtifacts;
  create?: typeof createGeminiInteraction; get?: typeof getGeminiInteraction; clock?: () => Date };
const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const identityMatches = (row: any, identity: WorkIdentity) => row.actorUid === identity.uid && row.tenantId === identity.tenantId;
function assertAdmission(value: unknown, identity: WorkIdentity, now: Date) {
  const parsed = geminiResearchControlSchema.safeParse(value);
  if (!parsed.success) throw new Error("research_control_missing_or_invalid: owner must retain explicit actor, scope, budget and expiry");
  const control = parsed.data;
  if (!control.enabled || !identityMatches(control, identity) || Date.parse(control.expiresAt) <= now.getTime())
    throw new Error("research_admission_disabled_or_expired: reads of already-bound requests remain available");
  return control;
}
function unknownResult(row: any) {
  return { request_key: row.requestKey, status: row.providerHttpStatus ? "create_http_error" : "create_ack_unknown", provider_id: null,
    provider_http_status: row.providerHttpStatus ?? null, provider_error_code: row.providerErrorCode ?? null,
    private_diagnostic: row.diagnostic ?? null, cost_micros: null, reserved_micros: row.reservationMicros,
    action: row.diagnostic
      ? "Read the retained original diagnostic using provider_record on this request key and repair the affected configuration. This original claim remains observe-only; do not submit another POST."
      : "Observe this request key only. Do not create another task; no provider ID was acknowledged." };
}
/** Agent-facing MCP adapter. Internally this uses Google's existing Interactions
 * API transport; Google does not supply an official Deep Research MCP server. */
export async function executeGeminiResearchTool(name: GeminiResearchTool, args: unknown,
  identity: WorkIdentity, scopes: string[], deps: Deps) {
  if (!scopes.includes(researchToolScope(name))) throw new Error("research_scope_required: reconnect with the explicit research permission");
  const parsed = GEMINI_RESEARCH_TOOLS[name].safeParse(args);
  if (!parsed.success) return { isError: true, fields: parsed.error.issues.map(i => ({ field: i.path.join("."), repair: i.message })) };
  const input = parsed.data;
  const requestKey = `request-${hash(`${identity.tenantId ?? ""}:${identity.uid}:${input.request_key}`)}`;
  const clock = deps.clock || (() => new Date());
  const existing = await deps.store.get(requestKey);
  if (existing && !identityMatches(existing, identity)) throw new Error("research_request_identity_mismatch");
  if (name === "start_gemini_deep_research") {
    const question = (input as z.infer<typeof GEMINI_RESEARCH_TOOLS.start_gemini_deep_research>).question;
    const questionHash = hash(question);
    const claim = await deps.store.transaction(async tx => {
      const prior = await tx.get(requestKey);
      if (prior) {
        if (!identityMatches(prior, identity) || prior.questionSha256 !== questionHash)
          throw new Error("research_request_key_question_changed: reuse the original question or observe the original key");
        return { row: prior, create: false };
      }
      const now = clock(), control = assertAdmission(await tx.get(GEMINI_RESEARCH_CONTROL_KEY), identity, now);
      const budgetKey = `budget-${hash(`${control.budgetRef}:${day(now)}`)}`;
      const budget = await tx.get(budgetKey);
      const held = budget?.reservedMicros ?? 0;
      if (!Number.isSafeInteger(held) || held < 0 || held + control.reservationMicros > control.dailySoftTargetMicros)
        throw new Error("research_daily_reservation_exhausted: known and unknown task exposure remains reserved");
      const row = { schema: "blueprint.gemini-research-request.v1", requestKey: input.request_key,
        actorUid: identity.uid, tenantId: identity.tenantId, question, questionSha256: questionHash,
        providerAgent: GEMINI_DEEP_RESEARCH_MAX_AGENT, status: "create_claimed", providerId: null,
        scopeRef: control.scopeRef, budgetRef: control.budgetRef, controlSha256: hash(JSON.stringify(control)), authorityExpiresAt: control.expiresAt,
        claimedAt: now.toISOString(), reservationMicros: control.reservationMicros, costMicros: null,
        usage: null, usageComplete: false, evidence: null };
      tx.set(budgetKey, { schema: "blueprint.gemini-research-budget.v1", budgetRef: control.budgetRef,
        scheduledDay: day(now), reservedMicros: held + control.reservationMicros, actualTotalMicros: null });
      tx.set(requestKey, row);
      return { row, create: true };
    });
    if (!claim.create) return claim.row.providerId ? observe(claim.row, requestKey, 0, 6000, deps, clock, "report") : unknownResult(claim.row);
    // Claim is permanent before any possible provider submission. A fresh
    // control read narrows the race window; it never releases the reservation.
    const freshControl = assertAdmission(await deps.store.get(GEMINI_RESEARCH_CONTROL_KEY), identity, clock());
    if (hash(JSON.stringify(freshControl)) !== claim.row.controlSha256) throw new Error("research_authority_changed_before_submission");
    let response: GeminiInteraction;
    try {
      response = await (deps.create || createGeminiInteraction)({ input: question, agent: GEMINI_DEEP_RESEARCH_MAX_AGENT,
        background: true, store: true, timeoutMs: 45000, agentConfig: buildGeminiDeepResearchAgentConfig({ visualization: "off" }) });
    } catch (error) {
      if (error instanceof GeminiInteractionHttpError) {
        const providerCode = (error.payload as any)?.error?.status;
        const safeCode = typeof providerCode === "string" && /^[A-Z0-9_]{1,64}$/.test(providerCode) ? providerCode : null;
        const diagnostic = { schema: "blueprint.gemini-research-http-diagnostic.v1", requestKey: claim.row.requestKey,
          questionSha256: claim.row.questionSha256, actorUid: claim.row.actorUid, tenantId: claim.row.tenantId,
          claimedAt: claim.row.claimedAt, observedAt: clock().toISOString(), providerAgent: claim.row.providerAgent,
          operation: "create", httpStatus: error.status, requestId: error.requestId, payload: error.payload };
        const receipt = await deps.artifacts.retain(diagnostic);
        const retained = await deps.store.transaction(async tx => {
          const current = await tx.get(requestKey);
          if (!current || current.providerId || current.questionSha256 !== claim.row.questionSha256)
            throw new Error("research_canonical_binding_changed");
          const row = { ...current, status: "create_http_error", providerHttpStatus: error.status,
            providerErrorCode: safeCode, diagnostic: receipt };
          tx.set(requestKey, row);
          return row;
        });
        return unknownResult(retained);
      }
      return unknownResult(claim.row); // Never retry a POST after an uncertain acknowledgement.
    }
    if (typeof response.id !== "string" || !response.id) return unknownResult(claim.row);
    // Retain accepted identity before object-storage work, so an archive failure
    // can be recovered by GET without creating another paid task.
    const bound = { ...claim.row, providerId: response.id, status: "accepted" };
    await deps.store.set(requestKey, bound);
    return retainAndProject(bound, requestKey, response, 0, 6000, deps, clock, "report");
  }
  if (!existing) throw new Error("research_request_not_found: use a previously claimed request key");
  const read = input as z.infer<typeof GEMINI_RESEARCH_TOOLS.get_gemini_deep_research>;
  if (!existing.providerId) {
    if (read.view === "provider_record" && existing.diagnostic) {
      const diagnostic = JSON.stringify(await deps.artifacts.read(existing.diagnostic));
      return { ...unknownResult(existing), view: read.view, report: diagnostic.slice(read.cursor, read.cursor + read.characters),
        report_characters: diagnostic.length, next_cursor: read.cursor + read.characters < diagnostic.length ? read.cursor + read.characters : null };
    }
    return unknownResult(existing);
  }
  return observe(existing, requestKey, read.cursor, read.characters, deps, clock, read.view);
}
async function observe(row: any, key: string, cursor: number, characters: number, deps: Deps, clock: () => Date, view: "report" | "provider_record") {
  const terminal = ["completed", "failed", "cancelled"].includes(row.status);
  const response = terminal && row.evidence
    ? await deps.artifacts.read(row.evidence) as GeminiInteraction
    : await (deps.get || getGeminiInteraction)(row.providerId, 45000);
  if (response.id !== row.providerId) throw new Error("research_provider_identity_changed");
  return retainAndProject(row, key, response, cursor, characters, deps, clock, view);
}
async function retainAndProject(row: any, key: string, response: GeminiInteraction, cursor: number,
  characters: number, deps: Deps, clock: () => Date, view: "report" | "provider_record") {
  let evidence = await deps.artifacts.retain(response); // Full raw report/citations/usage, no projection loss.
  const bound = { ...row, status: response.status, evidence, observedAt: clock().toISOString(),
    usage: response.usage ?? response.usage_metadata ?? null, usageComplete: false, costMicros: null };
  const settled = await deps.store.transaction(async tx => {
    const current = await tx.get(key);
    if (!current || current.providerId !== response.id || current.questionSha256 !== row.questionSha256)
      throw new Error("research_canonical_binding_changed");
    // Concurrent stale observers cannot replace or present a newer verified
    // terminal receipt as running. Retain stale observations as private evidence.
    if (["completed", "failed", "cancelled"].includes(current.status) && current.evidence) return current;
    tx.set(key, bound);
    return bound;
  });
  if (settled.evidence.sha256 !== evidence.sha256) {
    evidence = settled.evidence;
    response = await deps.artifacts.read(evidence) as GeminiInteraction;
  }
  const report = view === "report" ? extractGeminiInteractionText(response) : JSON.stringify(response);
  const usage = response.usage ?? response.usage_metadata ?? null;
  return { request_key: row.requestKey, provider_id: response.id, agent: row.providerAgent, status: response.status,
    view, report: report.slice(cursor, cursor + characters), report_characters: report.length,
    next_cursor: cursor + characters < report.length ? cursor + characters : null,
    full_raw_evidence: evidence, usage_retained: usage !== null, usage_complete: false, cost_micros: null,
    reserved_micros: row.reservationMicros, citations_provenance: "Full citations and provider grounding retained in the private raw evidence; inspect source URLs, not provider agreement alone." };
}
