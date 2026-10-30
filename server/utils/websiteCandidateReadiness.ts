/** Read-only catalog preparation. This cannot supply a screening result or launch authority. */
import { z } from "zod";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import { strictBoundedProofJson } from "./strictBoundedProofJson";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";
import { loadCurrentWebsitePreparationProof, websitePreparationSelectorSchema,
  type WebsitePreparationReceipt, type WebsitePreparationSelector } from "./websitePreparationStatus";
import type { JobCandidateReadiness, JobManagedEvidenceSummary } from "../../client/src/types/jobMarketplace";
import { candidatePreparationNotes } from "./websiteCandidateReadinessNotes";

export const CANDIDATE_READINESS_MAX_BYTES = 256 * 1024;
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const candidate = z.object({
  candidate_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/),
  display_name: z.string().min(1).max(160).refine(value => !/[\x00-\x1f]/.test(value)
    && !value.includes("://") && !value.includes("@") && !/[\\=]/.test(value) && !/(?:^|\s)\/[A-Za-z0-9_.-]/.test(value)
    && !/\b(bearer|api[_ -]?key|password|secret|token)\b/i.test(value)),
  configuration_digest: digest, policy_kind: z.enum(["checkpoint", "hosted", "scripted"]),
  compatibility: z.literal("not_evaluated"),
  known_reasons: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,127}$/)).max(32),
}).strict();
export const candidateReadinessSchema = z.object({
  ...websitePreparationSelectorSchema.shape,
  schema_version: z.literal("website_candidate_readiness.v1"),
  claim_ceiling: z.literal("candidate_preparation_only"), compatibility: z.literal("not_evaluated"),
  preparation_revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  preparation_status_digest: digest, catalog_digest: digest, registry_digest: digest.nullable(),
  profile_digest: digest, profile_source: z.enum(["not_configured", "capture_profile", "derived_profile", "operator_defaults"]),
  candidate_count: z.number().int().min(1).max(256), candidates: z.array(candidate).min(1).max(256), readiness_digest: digest,
}).strict();
type Proof = { selector: WebsitePreparationSelector; status: WebsitePreparationReceipt };
export interface CandidateReadinessDeps {
  proof(requestId: string, captureId: string): Promise<Proof>;
  read(selector: WebsitePreparationSelector, signal: AbortSignal): Promise<unknown>;
}
const unavailable = () => new Error("candidate_readiness_unavailable");
export async function readCandidateReadinessCompanion(selector: WebsitePreparationSelector, signal: AbortSignal): Promise<unknown> {
  const body = JSON.stringify(selector);
  const signed = signedWebsitePipelineRequest("/api/live-pipeline/website-candidate-readiness", body);
  if (!signed) throw unavailable();
  const response = await fetch(signed.url, { method: "POST", redirect: "error", signal, body,
    headers: {"content-type": "application/json", ...signed.headers} });
  if (!response.body || Number(response.headers.get("content-length")) > CANDIDATE_READINESS_MAX_BYTES) throw unavailable();
  const reader = response.body.getReader(); let length = 0; const chunks: Buffer[] = [];
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break;
      length += chunk.value.length; if (length > CANDIDATE_READINESS_MAX_BYTES) throw unavailable();
      chunks.push(Buffer.from(chunk.value)); }
    const raw = strictBoundedProofJson(Buffer.concat(chunks), CANDIDATE_READINESS_MAX_BYTES);
    if (!response.ok) {
      if (response.status === 503 && (raw as {detail?: unknown})?.detail === "website_candidate_readiness_bound_exceeded")
        throw new Error("candidate_readiness_bound_exceeded");
      throw unavailable();
    }
    return raw;
  } finally { await reader.cancel().catch(() => undefined); }
}
const defaults: CandidateReadinessDeps = {proof: loadCurrentWebsitePreparationProof, read: readCandidateReadinessCompanion};
function parse(raw: unknown, proof: Proof) {
  const value = candidateReadinessSchema.parse(raw);
  const selected = Object.fromEntries(Object.keys(proof.selector).map(key => [key, value[key as keyof typeof value]]));
  websitePreparationSelectorSchema.parse(selected);
  if (crossRuntimeDigest(selected) !== crossRuntimeDigest(proof.selector)
    || value.preparation_revision !== proof.status.revision || value.preparation_status_digest !== proof.status.status_digest
    || value.candidate_count !== value.candidates.length
    || new Set(value.candidates.map(row => row.candidate_id)).size !== value.candidate_count
    || crossRuntimeArtifactDigest(value, "readiness_digest") !== value.readiness_digest
    || Buffer.byteLength(JSON.stringify(value)) > CANDIDATE_READINESS_MAX_BYTES) throw unavailable();
  return value;
}
/** Fail-soft and never persisted. Rechecks current source after the catalog read. */
export async function loadJobCandidateReadiness(requestId: string, captureId: string,
  deps = defaults): Promise<JobCandidateReadiness> {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {timer = setTimeout(() => {controller.abort(); reject(unavailable());}, 8_000);});
  try {
    return await Promise.race([timeout, (async (): Promise<JobCandidateReadiness> => {
      const before = await deps.proof(requestId, captureId);
      if (before.status.state === "authority_ended" || controller.signal.aborted) throw unavailable();
      const value = parse(await deps.read(before.selector, controller.signal), before);
      const after = await deps.proof(requestId, captureId);
      if (controller.signal.aborted || crossRuntimeDigest(before) !== crossRuntimeDigest(after)) throw unavailable();
      return {state: "available", revision: value.readiness_digest, catalogCandidateCount: value.candidate_count,
        candidates: value.candidates.map(row => ({candidateId: row.candidate_id, configurationDigest: row.configuration_digest, name: row.display_name,
          compatibility: "not_evaluated", kind: row.policy_kind === "scripted" ? "scripted_baseline" : "learned_policy",
          notes: candidatePreparationNotes(row.known_reasons)}))};
    })()]);
  } catch (error) { return {state: "unavailable", message: error instanceof Error && error.message === "candidate_readiness_bound_exceeded"
    ? "The complete candidate list exceeds the current display limit. Blueprint needs to expand it before showing preparation details."
    : "Candidate preparation details are temporarily unavailable. Refresh to try again."}; }
  finally {clearTimeout(timer!); controller.abort();}
}
/** Only current publication for the exact configuration supersedes preparation.
 * A tested older configuration remains valid history, never proof for its replacement. */
export function omitPublishedCandidates(preview: JobCandidateReadiness, evidence: JobManagedEvidenceSummary[]): JobCandidateReadiness {
  if (preview.state !== "available") return preview;
  const published = evidence.filter(row => row.current).flatMap(row => row.screening?.candidates ?? []);
  return {...preview, candidates: preview.candidates.flatMap(row => {
    const matches = published.filter(candidate => candidate.candidateId === row.candidateId);
    if (matches.some(candidate => candidate.configurationDigest === row.configurationDigest)) return [];
    if (!matches.length) return [row];
    const note = matches.every(candidate => candidate.configurationDigest)
      ? "Existing results used a different configuration. This configuration has not been evaluated."
      : "Existing results do not identify this configuration. This configuration has not been evaluated.";
    return [{...row, notes: [note, ...row.notes]}];
  })};
}
