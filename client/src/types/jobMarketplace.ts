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
export type DeliveryEvidenceLevel = "prior_deployment" | "simulation" | "physical_trial" | "unverified";
export interface DeliveryProposalInput {
  providerName: string;
  scope: string;
  equipment: string;
  software: string;
  deliveryCommitment: string;
  installationCostUsd: number | null;
  monthlyCostUsd: number | null;
  currency: "USD";
  exclusions: string;
  sitePreparation: string;
  humanAssistance: string;
  timing: string;
  support: string;
  evidence: Array<{ level: DeliveryEvidenceLevel; summary: string; reference?: { kind?: "decision_evidence"; requestId: string; publicationDigest: string } | { kind: "managed_run"; runId: string; resultDigest: string } }>;
  acceptanceCriteria: string;
  recommendationReason: string | null;
}
export interface DeliveryProposal extends DeliveryProposalInput {
  id: string;
  revision: string;
  /** Digest of the confirmed brief and buying requirements for this quote. */
  briefRevision: string;
  status: "available" | "withdrawn" | "review_required";
  createdAtIso: string;
  updatedAtIso: string;
}
export interface JobProposalSelection {
  proposalId: string;
  proposalRevision: string;
  selectedAtIso: string;
}
export interface JobPilotAgreement {
  proposalId: string;
  proposalRevision: string;
  agreedAtIso: string;
  plannedStartIso: string | null;
  siteAgreementReference: string;
  providerAgreementReference: string;
  /** Separate permission from both parties to record the operational outcome here. */
  outcomeRecordingAuthorized: boolean;
  outcomeRecordingPermissionReference: string | null;
  recordedAtIso: string;
}
export interface JobReportedOutcome {
  proposalId: string;
  proposalRevision: string;
  summary: string;
  metCriteria: boolean | null;
  measuredUnitsPerHour: number | null;
  interventionsPerHour: number | null;
  notes: string | null;
  recordedAtIso: string;
  source: "customer_reported";
}
export interface JobOptionsReview {
  disposition: "options_identified" | "more_information" | "no_suitable_option";
  summary: string;
  nextAction: string;
  reviewedAtIso: string;
  scopeRevision: string;
}
export type MarketplaceJobStage = "job_submitted" | "brief_agreed" | "options_assessed" | "proposals_ready" | "pilot_agreed" | "results_recorded";
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
  actionOwner: "site" | "blueprint" | "deployment_partner" | "none";
  review: JobOptionsReview | null;
  evidence?: JobEvidenceSummary[];
  managedEvidence?: JobManagedEvidenceSummary[];
  managedEvidenceUnavailable?: boolean;
  evidenceContext?: { briefDigest: string; question: string | null; testbedDigest: string | null } | null;
  proposals: DeliveryProposal[];
  selection: JobProposalSelection | null;
  agreement: JobPilotAgreement | null;
  outcome: JobReportedOutcome | null;
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
  finalist?: { candidateId: string; planDigest: string | null; episodes: 200; approvalPending: boolean;
    approvalCapUsd: number; minimumCapUsd: number; approvalTtlMs: number };
  screening?: { budget?: { limitUsd: string; committedUpperBoundUsd: string; spentUpperBoundUsd: string; reservedUsd: string };
    candidates: Array<{ candidateId: string; name: string; state: string; planned: number;
    scored: number; succeeded: number; failed: number; void: number; blockers: string[] }> };
}
