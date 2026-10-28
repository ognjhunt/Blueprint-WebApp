/** Private fact-confirmation ancestry; never a new grant or reservation. */
import { z } from "zod";
import { crossRuntimeArtifactDigest, crossRuntimeDigest as digest } from "./crossRuntimeCanonical";
import { canonicalArtifactDigest } from "./taskCandidateContract";
import { currentFamilyTaskFacts, familyAuthoringStatusSchema, familyTaskContextBasis,
  familyTaskFactsEnabled, familyTaskOperationBinding, type FamilyTaskBriefState } from "./siteTaskFamilyFacts";

const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const text = z.string().min(1).max(200);
const contextRecord = z.record(z.string(), z.unknown());
const origin = z.object({ authority_digest: sha, task_context_digest: sha,
  non_fact_context_digest: sha, context: contextRecord }).strict();
const transitionSchema = z.object({
  schema_version: z.literal("website_family_task_fact_continuation.v1"),
  request_id: text, scene_id: text, capture_id: text,
  parent_task_context_digest: sha, task_context_digest: sha,
  parent_context: contextRecord.nullable(),
  non_fact_context_digest: sha, source_fingerprint: sha, source_video_digest: sha,
  operation_binding_digest: sha, facts_digest: sha.nullable(),
  fact_confirmation_digest: sha.nullable(), parent_transition_digest: sha.nullable(),
  origin: origin.nullable(), transition_digest: sha,
}).strict();
export type FamilyTaskFactContinuation = z.infer<typeof transitionSchema>;
type Context = Record<string, any>;

/** A fact confirmation may change its timestamp, never other task/source truth. */
export function familyTaskNonFactContextDigest(context: Context) {
  const { confirmed_at: _time, ...basis } = familyTaskContextBasis(context) as Context;
  return digest(basis);
}
function validContext(context: Context): boolean {
  try {
    if (context.schema_version !== "website_site_task_context.v1"
      || Buffer.byteLength(JSON.stringify(context)) > 65536) return false;
    const expected = context.canonicalization === "rfc8785" ? crossRuntimeArtifactDigest(context, "context_digest")
      : context.canonicalization === undefined ? canonicalArtifactDigest(context, "context_digest") : null;
    return expected !== null && context.context_digest === expected;
  } catch { return false; }
}
function retainedContext(context: Context): Context | null {
  try {
    const copy = JSON.parse(JSON.stringify(context));
    return validContext(copy) && copy.context_digest === context.context_digest ? copy : null;
  } catch { return null; }
}
function sourceMatches(brief: FamilyTaskBriefState, context: Context) {
  const source = brief.familyTaskAuthoring;
  return source && familyAuthoringStatusSchema.safeParse(source.status).success
    && source.status.request_id === context.request_id && source.status.scene_id === context.scene_id
    && source.status.capture_id === context.capture_id
    && source.status.task_description_digest === digest({ description: context.description })
    && source.status.task_success_criteria_digest === digest({ success_criteria: context.success_criteria ?? null });
}
function currentTransition(brief: FamilyTaskBriefState, context: Context): FamilyTaskFactContinuation | null {
  if (!familyTaskFactsEnabled()) return null;
  try {
    const parsed = transitionSchema.safeParse(brief.familyTaskFactContinuation);
    if (!parsed.success || !validContext(context) || !sourceMatches(brief, context)) return null;
    const value = parsed.data, source = brief.familyTaskAuthoring!;
    const facts = currentFamilyTaskFacts(brief, familyTaskContextBasis(context));
    if (brief.familyTaskFacts && !facts
      || value.transition_digest !== crossRuntimeArtifactDigest(value, "transition_digest")
      || value.request_id !== context.request_id || value.scene_id !== context.scene_id
      || value.capture_id !== context.capture_id || value.task_context_digest !== context.context_digest
      || value.parent_context !== null && (!validContext(value.parent_context)
        || value.parent_context.context_digest !== value.parent_task_context_digest
        || familyTaskNonFactContextDigest(value.parent_context) !== value.non_fact_context_digest)
      || value.non_fact_context_digest !== familyTaskNonFactContextDigest(context)
      || value.source_fingerprint !== source.sourceFingerprint
      || value.source_video_digest !== source.status.source_video_digest
      || value.operation_binding_digest !== familyTaskOperationBinding(source.status)
      || value.facts_digest !== (facts?.facts_digest ?? null)
      || value.fact_confirmation_digest !== (brief.familyTaskFacts?.confirmation_digest ?? null)) return null;
    return value;
  } catch { return null; }
}
function plainOwnMap(value: unknown, required: readonly string[]): value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const fields = Object.getOwnPropertyDescriptors(value);
  // Hashing and continuation both consume JSON fields. Hidden values and
  // accessors must not become allowance data outside that same payload.
  return required.every(key => Object.hasOwn(fields, key))
    && Reflect.ownKeys(fields).every(key => typeof key === "string"
      && fields[key].enumerable === true && Object.hasOwn(fields[key], "value"));
}
function rootMatches(root: Record<string, any> | undefined, context: Context): root is Record<string, any> {
  try {
    if (!plainOwnMap(root, ["authority_digest", "schema_version", "sponsor", "purpose", "request_id",
      "scene_id", "capture_id", "task_context_digest", "expires_at_epoch", "consent"])
      || !plainOwnMap(root.consent, ["rights_reference", "task_confirmed", "private_processing_authorized",
        "provider_training_authorized", "spend_authorized"])) return false;
    const { authority_digest, ...payload } = root;
    return sha.safeParse(authority_digest).success && authority_digest === digest(payload)
      && root.schema_version === "website_scene_sponsorship.v1" && root.sponsor === "blueprint"
      && root.purpose === "scene_preparation" && root.request_id === context.request_id
      && root.scene_id === context.scene_id && root.capture_id === context.capture_id
      && sha.safeParse(root.task_context_digest).success
      && Number.isFinite(root.expires_at_epoch) && root.expires_at_epoch > 0
      && root.consent?.rights_reference === digest(context.capture_rights)
      && root.consent?.task_confirmed === context.confirmed
      && root.consent?.private_processing_authorized === true
      && root.consent?.provider_training_authorized === false && root.consent?.spend_authorized === true
      && context.capture_rights?.derived_scene_generation_allowed === true;
  } catch { return false; }
}
/** Recognizes only a server-retained current fact version under this exact root. */
export function familyTaskFactContinuationMatches(brief: FamilyTaskBriefState, context: Context,
  root: Record<string, any> | undefined): boolean {
  const value = currentTransition(brief, context);
  return Boolean(value?.origin && rootMatches(root, context)
    && value.parent_context !== null
    && value.origin.authority_digest === root.authority_digest
    && value.origin.task_context_digest === root.task_context_digest
    && validContext(value.origin.context)
    && value.origin.context.context_digest === value.origin.task_context_digest
    && value.origin.non_fact_context_digest === familyTaskNonFactContextDigest(value.origin.context)
    && value.origin.non_fact_context_digest === value.non_fact_context_digest);
}

/** Called only by the existing owner transaction after its current parent check.
 * An unproved/broader transition is retained with origin:null, never funded.
 * The public answer schema has no ancestry fields. */
export function retainFamilyTaskFactContinuation(input: {
  previousBrief: FamilyTaskBriefState; brief: FamilyTaskBriefState;
  previousContext: Context; context: Context; root?: Record<string, any>;
  parentContextProven: boolean;
}): FamilyTaskFactContinuation {
  const { previousBrief, brief, previousContext, context, root } = input;
  const source = brief.familyTaskAuthoring;
  if (!familyTaskFactsEnabled() || !sourceMatches(brief, context) || !sourceMatches(previousBrief, previousContext)
    || previousBrief.familyTaskAuthoring?.status.task_context_digest !== previousContext.context_digest
    || previousBrief.familyTaskAuthoring?.sourceFingerprint !== source?.sourceFingerprint
    || familyTaskOperationBinding(previousBrief.familyTaskAuthoring!.status) !== familyTaskOperationBinding(source!.status))
    throw new Error("family_task_facts_source_changed");
  const facts = currentFamilyTaskFacts(brief, familyTaskContextBasis(context));
  if (brief.familyTaskFacts && !facts) throw new Error("family_task_facts_source_changed");
  const prior = currentTransition(previousBrief, previousContext);
  const basis = familyTaskNonFactContextDigest(context);
  if (prior && context.context_digest === previousContext.context_digest
    && prior.fact_confirmation_digest === (brief.familyTaskFacts?.confirmation_digest ?? null)
    && prior.non_fact_context_digest === basis) return prior;
  const inherited = familyTaskFactContinuationMatches(previousBrief, previousContext, root)
    ? prior!.origin : null;
  const parent = retainedContext(previousContext);
  const directParent = root?.task_context_digest === previousContext.context_digest;
  const canContinue = input.parentContextProven && rootMatches(root, previousContext) && rootMatches(root, context)
    && parent !== null && validContext(context)
    && basis === familyTaskNonFactContextDigest(previousContext) && Boolean(directParent || inherited);
  const value = {
    schema_version: "website_family_task_fact_continuation.v1" as const,
    request_id: context.request_id, scene_id: context.scene_id, capture_id: context.capture_id,
    parent_task_context_digest: previousContext.context_digest, task_context_digest: context.context_digest,
    parent_context: parent,
    non_fact_context_digest: basis, source_fingerprint: source!.sourceFingerprint,
    source_video_digest: source!.status.source_video_digest,
    operation_binding_digest: familyTaskOperationBinding(source!.status), facts_digest: facts?.facts_digest ?? null,
    fact_confirmation_digest: brief.familyTaskFacts?.confirmation_digest ?? null,
    parent_transition_digest: prior?.transition_digest ?? null,
    origin: canContinue ? inherited ?? { authority_digest: root!.authority_digest,
      task_context_digest: root!.task_context_digest, non_fact_context_digest: basis, context: parent! } : null,
  };
  const retained = transitionSchema.safeParse({ ...value, transition_digest: digest(value) });
  if (!retained.success) throw new Error("family_task_facts_source_changed");
  return retained.data;
}
