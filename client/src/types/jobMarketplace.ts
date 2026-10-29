/** Blueprint-owned commercial workflow. It never supplies scientific evaluation verdicts. */
export type PurchaseReadiness = "exploring" | "planning" | "ready_for_proposals" | "unsure";
export interface JobBuyingRequirements {
  jobFrequency: string | null;
  purchaseReadiness: PurchaseReadiness;
  requiredOutput: string | null;
  installationBudget: string | null;
  ongoingBudget: string | null;
  currentProcessCost: string | null;
  targetStartDate: string | null;
}
export interface JobOptionsReview {
  disposition: "options_identified" | "more_information" | "no_suitable_option";
  summary: string;
  nextAction: string;
  reviewedAtIso: string;
  scopeRevision: string;
}
export type MarketplaceJobStage = "job_submitted" | "brief_agreed" | "options_assessed";
export interface JobMarketplaceWorkflow {
  schemaVersion: "job_marketplace.v1";
  jobId?: string;
  revision: string;
  requirements: JobBuyingRequirements;
  briefAgreed: boolean;
  optionsAssessed: boolean;
  reviewRequired: boolean;
  stage: MarketplaceJobStage;
  nextAction: string;
  actionOwner: "site" | "blueprint" | "none";
  review: JobOptionsReview | null;
  evidence?: JobEvidenceSummary[];
  managedEvidence?: JobManagedEvidenceSummary[];
  managedEvidenceUnavailable?: boolean;
  evidenceContext?: { briefDigest: string; question: string | null; testbedDigest: string | null } | null;
}

/** Factual Pipeline projection. Commercial recommendations remain operator-authored. */
export interface JobEvidenceSummary {
  requestId: string;
  publicationDigest: string | null;
  briefDigest: string;
  current: boolean;
  state: string;
  question: string;
  summary: string;
  nextAction: string;
  limitations: string[];
  runId: string | null;
  decisionDigest: string | null;
  planDigest: string | null;
  testbedDigest: string | null;
  approvedTaskDigest: string | null;
  serviceMessage?: string;
  claims: Array<{ claimId: string; verdict: string; rationale: string }>;
}

export interface JobManagedEvidenceSummary {
  runId: string;
  state: string;
  current: boolean;
  resultDigest: string | null;
  summary: string;
  nextAction: string;
  limitations: string[];
  href: string;
  screening?: { budget?: { limitUsd: string; committedUpperBoundUsd: string; spentUpperBoundUsd: string; reservedUsd: string };
    candidates: Array<{ candidateId: string; name: string; state: string; planned: number;
    scored: number; succeeded: number; failed: number; void: number; blockers: string[] }> };
}
