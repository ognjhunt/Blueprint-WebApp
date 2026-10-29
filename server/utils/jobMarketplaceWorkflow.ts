import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  DeliveryProposal, DeliveryProposalInput, JobBuyingRequirements, JobMarketplaceWorkflow,
  JobOptionsReview, JobPilotAgreement, JobProposalSelection, JobReportedOutcome,
} from "../../client/src/types/jobMarketplace";

const optionalText = (max = 2000) => z.string().trim().max(max).nullable();
const requiredText = (max = 2000) => z.string().trim().min(1).max(max);
const money = z.number().finite().nonnegative().max(100_000_000).nullable();
const timestamp = z.string().datetime({ offset: true });
export const proposalIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/);
export const revisionSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const requirementsSchema = z.object({
  jobFrequency: optionalText(500).optional(),
  purchaseReadiness: z.enum(["exploring", "planning", "ready_for_proposals", "unsure"]).optional(),
  requiredOutput: optionalText().optional(),
  installationBudget: optionalText(500).optional(),
  ongoingBudget: optionalText(500).optional(),
  currentProcessCost: optionalText(500).optional(),
  targetStartDate: optionalText(500).optional(),
}).strict();
export const deliveryProposalSchema = z.object({
  providerName: requiredText(160), scope: requiredText(), equipment: requiredText(), software: requiredText(),
  deliveryCommitment: requiredText(), installationCostUsd: money, monthlyCostUsd: money, currency: z.literal("USD"),
  exclusions: requiredText(), sitePreparation: requiredText(), humanAssistance: requiredText(),
  timing: requiredText(), support: requiredText(),
  evidence: z.array(z.object({ level: z.enum(["prior_deployment", "simulation", "physical_trial", "unverified"]),
    summary: requiredText(1000), reference: z.union([z.object({ kind: z.literal("decision_evidence").optional(), requestId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/), publicationDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/) }).strict(), z.object({ kind: z.literal("managed_run"), runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/), resultDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/) }).strict()]).optional() }).strict()).min(1).max(8),
  acceptanceCriteria: requiredText(), recommendationReason: optionalText(),
}).strict();
const storedProposalSchema = deliveryProposalSchema.extend({ id: proposalIdSchema, revision: revisionSchema,
  briefRevision: revisionSchema, status: z.enum(["available", "withdrawn"]), createdAtIso: timestamp, updatedAtIso: timestamp });
export const optionsReviewSchema = z.object({
  disposition: z.enum(["options_identified", "more_information", "no_suitable_option"]),
  summary: requiredText(), nextAction: requiredText(),
}).strict();
export const selectProposalSchema = z.object({ proposalId: proposalIdSchema, expectedRevision: revisionSchema,
  authorized: z.literal(true) }).strict();
const pilotAgreementFieldsSchema = z.object({
  proposalId: proposalIdSchema, expectedRevision: revisionSchema, agreedAtIso: timestamp,
  plannedStartIso: timestamp.nullable(), siteAgreementReference: requiredText(1000), providerAgreementReference: requiredText(1000),
  outcomeRecordingAuthorized: z.boolean().default(false),
  outcomeRecordingPermissionReference: optionalText(1000).default(null),
}).strict();
export const pilotAgreementSchema = pilotAgreementFieldsSchema.superRefine((agreement, context) => {
  if (agreement.outcomeRecordingAuthorized && !agreement.outcomeRecordingPermissionReference) context.addIssue({
    code: z.ZodIssueCode.custom, path: ["outcomeRecordingPermissionReference"],
    message: "Reference both parties' permission to record the operational outcome.",
  });
});
export const outcomeSchema = z.object({
  proposalId: proposalIdSchema, expectedRevision: revisionSchema, authorized: z.literal(true),
  summary: requiredText(), metCriteria: z.boolean().nullable(),
  measuredUnitsPerHour: z.number().finite().nonnegative().max(1_000_000_000).nullable(),
  interventionsPerHour: z.number().finite().nonnegative().max(1_000_000).nullable(), notes: optionalText(),
}).strict();

export interface StoredJobMarketplace {
  schemaVersion: "job_marketplace.v1";
  requirements: JobBuyingRequirements;
  proposals: DeliveryProposal[];
  selection: JobProposalSelection | null;
  agreement: JobPilotAgreement | null;
  outcome: JobReportedOutcome | null;
  review: JobOptionsReview | null;
  updatedAtIso: string;
  updatedBy: string;
}

/** Stable opaque revision; no caller can replace a quote under a reviewed identity. */
export function workflowDigest(value: unknown): string {
  const canonical = (item: any): any => Array.isArray(item) ? item.map(canonical)
    : item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

/** Quote scope follows confirmed work, not who or when the same brief was confirmed. */
export function proposalScopeRevision(brief: unknown, requirements: JobBuyingRequirements): string {
  const value = brief && typeof brief === "object" ? brief as Record<string, any> : {};
  return workflowDigest({ brief: {
    summary: value.summary ?? null,
    captureMode: value.captureMode ?? null,
    operatorAnswers: value.operatorAnswers ?? {},
    operatorUnknown: [...(value.operatorUnknown ?? [])].sort(),
    operatorTaskDetails: value.operatorTaskDetails ?? null,
    successCriteria: value.successCriteria ?? null,
    pilotIntent: value.pilotIntent ?? null,
    unresolved: [...(value.unresolved ?? [])].sort(),
  }, requirements });
}

export function requirementsFrom(record: Record<string, any>): JobBuyingRequirements {
  const spec = record.request?.siteTaskSpec ?? {};
  const incoming = requirementsSchema.safeParse(record.job_marketplace?.requirements);
  const stated = incoming.success ? incoming.data : {};
  const text = (key: keyof JobBuyingRequirements) => {
    const value = Object.prototype.hasOwnProperty.call(stated, key) ? stated[key] : spec[key];
    return typeof value === "string" && value.trim() ? value.trim().slice(0, key === "requiredOutput" ? 2000 : 500) : null;
  };
  const readiness = stated.purchaseReadiness ?? spec.purchaseReadiness;
  return {
    jobFrequency: text("jobFrequency"), requiredOutput: text("requiredOutput"), installationBudget: text("installationBudget"),
    ongoingBudget: text("ongoingBudget"), currentProcessCost: text("currentProcessCost"), targetStartDate: text("targetStartDate"),
    purchaseReadiness: ["exploring", "planning", "ready_for_proposals", "unsure"].includes(readiness) ? readiness : "unsure",
  };
}

export function storedMarketplace(record: Record<string, any>): StoredJobMarketplace {
  const source = record.job_marketplace?.schemaVersion === "job_marketplace.v1" ? record.job_marketplace : {};
  const proposals = Array.isArray(source.proposals) ? source.proposals.flatMap((row: unknown) => {
    const parsed = storedProposalSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  }).slice(0, 20) : [];
  // Project only validated, exact quote bindings. A partially written record cannot advance a stage.
  const validSelection = z.object({ proposalId: proposalIdSchema, proposalRevision: revisionSchema, selectedAtIso: timestamp }).safeParse(source.selection);
  const selection = validSelection.success && proposals.some(p => p.status === "available" && p.id === validSelection.data.proposalId
    && p.revision === validSelection.data.proposalRevision) ? validSelection.data : null;
  const validAgreement = pilotAgreementFieldsSchema.omit({ expectedRevision: true }).extend({ proposalRevision: revisionSchema, recordedAtIso: timestamp }).safeParse(source.agreement);
  const agreement = validAgreement.success && selection?.proposalId === validAgreement.data.proposalId
    && selection.proposalRevision === validAgreement.data.proposalRevision ? validAgreement.data : null;
  const validOutcome = outcomeSchema.omit({ expectedRevision: true, authorized: true }).extend({ proposalRevision: revisionSchema,
    source: z.literal("customer_reported"), recordedAtIso: timestamp }).safeParse(source.outcome);
  const outcome = validOutcome.success && agreement?.proposalId === validOutcome.data.proposalId
    && agreement.proposalRevision === validOutcome.data.proposalRevision ? validOutcome.data : null;
  const validReview = optionsReviewSchema.extend({ reviewedAtIso: timestamp, scopeRevision: revisionSchema }).safeParse(source.review);
  return { schemaVersion: "job_marketplace.v1", requirements: requirementsFrom(record), proposals, selection, agreement, outcome,
    review: validReview.success ? validReview.data : null, updatedAtIso: source.updatedAtIso ?? "", updatedBy: source.updatedBy ?? "" };
}

/** A commercial projection; an assessment, selected quote or owner report never manufactures a simulator result. */
export function projectJobMarketplace(record: Record<string, any>, brief: Record<string, any> | null,
  captureReceived: boolean | null = false, evidenceReviewProposalIds: ReadonlySet<string> = new Set()): JobMarketplaceWorkflow {
  const value = storedMarketplace(record);
  // Keep recorded commitments visible if a historical capture is unavailable.
  // A written draft alone never advances a new video-backed assessment.
  const assessmentStarted = captureReceived === true || Boolean(value.agreement);
  const briefAgreed = assessmentStarted && Boolean(brief?.confirmedAtIso && Number.isFinite(Date.parse(brief.confirmedAtIso)));
  const currentBriefRevision = proposalScopeRevision(brief, value.requirements);
  const proposals = value.proposals.map(proposal => proposal.status === "available" && (proposal.briefRevision !== currentBriefRevision || evidenceReviewProposalIds.has(proposal.id))
    ? { ...proposal, status: "review_required" as const } : proposal);
  const review = value.review?.scopeRevision === currentBriefRevision ? value.review : null;
  const reviewRequired = proposals.some(proposal => proposal.status === "review_required") || Boolean(value.review && !review);
  const optionsAssessed = briefAgreed && Boolean(review || proposals.some(proposal => proposal.status === "available"));
  let stage: JobMarketplaceWorkflow["stage"] = "job_submitted";
  let nextAction = captureReceived === null
    ? "We could not read your recording status. Refresh the job to try again."
    : captureReceived ? "Review the brief drafted from your video and correct any missing details."
      : "Record or upload a video of the work so Blueprint can draft the brief and assess your job.";
  let actionOwner: JobMarketplaceWorkflow["actionOwner"] = "site";
  if (briefAgreed) { stage = "brief_agreed"; nextAction = "Build the site simulation from your video, then run and compare candidate robots, policies and policy APIs against your job."; actionOwner = "blueprint"; }
  if (briefAgreed && optionsAssessed) { stage = "options_assessed"; nextAction = review?.nextAction ?? "Blueprint is checking which deployment company can deliver the approach that works on your job."; actionOwner = "blueprint"; }
  if (briefAgreed && proposals.some(p => p.status === "available")) {
    stage = "proposals_ready"; nextAction = "Review the scope, cost, support and acceptance criteria, then choose a proposal."; actionOwner = "site";
  }
  if (briefAgreed && value.selection) { stage = "proposals_ready"; nextAction = "Agree the pilot's scope, price and terms with the delivery partner. Selection alone is not a contract."; actionOwner = "deployment_partner"; }
  if (briefAgreed && value.agreement) { stage = "pilot_agreed"; nextAction = "Run the agreed pilot and measure its outcome against the acceptance criteria."; actionOwner = "deployment_partner"; }
  if (briefAgreed && value.outcome) { stage = "results_recorded"; nextAction = "Review the reported outcome together and decide whether to expand, change the setup or stop."; actionOwner = "site"; }
  const selected = value.selection && proposals.find(proposal => proposal.id === value.selection!.proposalId);
  const blockingReview = selected ? selected.status === "review_required"
    : reviewRequired && !proposals.some(proposal => proposal.status === "available");
  if (briefAgreed && blockingReview) { stage = "brief_agreed"; nextAction = selected && evidenceReviewProposalIds.has(selected.id)
    ? "Evidence supporting this proposal no longer applies to the current task or configuration. Blueprint and the delivery partner must review the affected proposal before you proceed. Recorded agreements and reports retain their original scope."
    : "The job brief changed. Blueprint and the delivery partner must review the affected proposals before you proceed. Recorded agreements and reports refer to their original proposal scope."; actionOwner = "blueprint"; }
  return { schemaVersion: "job_marketplace.v1", revision: workflowDigest(value), requirements: value.requirements,
    briefAgreed, optionsAssessed, reviewRequired, stage, nextAction, actionOwner, review,
    proposals: briefAgreed ? proposals : [], selection: briefAgreed ? value.selection : null,
    agreement: briefAgreed ? value.agreement : null, outcome: briefAgreed ? value.outcome : null };
}

export class JobMarketplaceError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}

export function selectedProposal(value: StoredJobMarketplace, proposalId: string, expectedRevision: string): DeliveryProposal {
  const proposal = value.proposals.find(p => p.id === proposalId && p.status === "available");
  if (!proposal) throw new JobMarketplaceError("proposal_unavailable", "This proposal is no longer available. Refresh the job.");
  if (proposal.revision !== expectedRevision) throw new JobMarketplaceError("proposal_changed", "The proposal changed. Review the current scope and price before confirming.");
  return proposal;
}

export function makeProposal(input: DeliveryProposalInput, id: string, now: string, briefRevision: string, existing?: DeliveryProposal): DeliveryProposal {
  const content = { ...input, id, briefRevision, status: "available" as const, createdAtIso: existing?.createdAtIso ?? now, updatedAtIso: now };
  return { ...content, revision: workflowDigest(content) };
}
