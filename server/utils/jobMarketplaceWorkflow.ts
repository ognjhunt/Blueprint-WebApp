import { createHash } from "node:crypto";
import { z } from "zod";
import type { JobBuyingRequirements, JobMarketplaceWorkflow, JobOptionsReview } from "../../client/src/types/jobMarketplace";

const optionalText = (max = 2000) => z.string().trim().max(max).nullable();
const requiredText = (max = 2000) => z.string().trim().min(1).max(max);
const timestamp = z.string().datetime({ offset: true });
const revisionSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const requirementsSchema = z.object({
  jobFrequency: optionalText(500).optional(),
  purchaseReadiness: z.enum(["exploring", "planning", "ready_for_proposals", "unsure"]).optional(),
  requiredOutput: optionalText().optional(),
  installationBudget: optionalText(500).optional(),
  ongoingBudget: optionalText(500).optional(),
  currentProcessCost: optionalText(500).optional(),
  targetStartDate: optionalText(500).optional(),
}).strict();
export const optionsReviewSchema = z.object({
  disposition: z.enum(["options_identified", "more_information", "no_suitable_option"]),
  summary: requiredText(), nextAction: requiredText(),
}).strict();
/**
 * The site's planning details and Blueprint's options review. Proposal,
 * selection, agreement and outcome fields from the retired delivery-proposal
 * flow may still be stored on older records; they are left untouched and not
 * projected.
 */
export interface StoredJobMarketplace {
  schemaVersion: "job_marketplace.v1";
  requirements: JobBuyingRequirements;
  review: JobOptionsReview | null;
  updatedAtIso: string;
  updatedBy: string;
}

/** Stable opaque revision of the stored planning state. */
export function workflowDigest(value: unknown): string {
  const canonical = (item: any): any => Array.isArray(item) ? item.map(canonical)
    : item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

/** Review scope follows confirmed work, not who or when the same brief was confirmed. */
export function reviewScopeRevision(brief: unknown, requirements: JobBuyingRequirements): string {
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
  const validReview = optionsReviewSchema.extend({ reviewedAtIso: timestamp, scopeRevision: revisionSchema }).safeParse(source.review);
  return { schemaVersion: "job_marketplace.v1", requirements: requirementsFrom(record),
    review: validReview.success ? validReview.data : null, updatedAtIso: source.updatedAtIso ?? "", updatedBy: source.updatedBy ?? "" };
}

/** A planning projection; an options review never manufactures a simulator result. */
export function projectJobMarketplace(record: Record<string, any>, brief: Record<string, any> | null,
  captureReceived: boolean | null = false): JobMarketplaceWorkflow {
  const value = storedMarketplace(record);
  // A written draft alone never advances a new video-backed assessment.
  const briefAgreed = captureReceived === true && Boolean(brief?.confirmedAtIso && Number.isFinite(Date.parse(brief.confirmedAtIso)));
  const review = value.review?.scopeRevision === reviewScopeRevision(brief, value.requirements) ? value.review : null;
  const reviewRequired = Boolean(value.review && !review);
  const optionsAssessed = briefAgreed && Boolean(review);
  let stage: JobMarketplaceWorkflow["stage"] = "job_submitted";
  let nextAction = captureReceived === null
    ? "We could not read your recording status. Refresh the job to try again."
    : captureReceived ? "Review the brief drafted from your video and correct any missing details."
      : "Record or upload a video of the work so Blueprint can draft the brief and assess your job.";
  let actionOwner: JobMarketplaceWorkflow["actionOwner"] = "site";
  if (briefAgreed) { stage = "brief_agreed"; nextAction = "Build the site simulation from your video, then run and compare candidate robots, policies and policy APIs against your job."; actionOwner = "blueprint"; }
  if (briefAgreed && optionsAssessed) { stage = "options_assessed"; nextAction = review?.nextAction ?? "Blueprint is checking which deployment company can deliver the approach that works on your job."; actionOwner = "blueprint"; }
  return { schemaVersion: "job_marketplace.v1", revision: workflowDigest(value), requirements: value.requirements,
    briefAgreed, optionsAssessed, reviewRequired, stage, nextAction, actionOwner, review };
}

export class JobMarketplaceError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
