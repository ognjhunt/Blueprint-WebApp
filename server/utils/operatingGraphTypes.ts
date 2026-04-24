export type OperatingGraphStage =
  | "city_selected"
  | "supply_seeded"
  | "supply_contactable"
  | "capture_in_progress"
  | "capture_uploaded"
  | "pipeline_packaging"
  | "package_ready"
  | "hosted_review_ready"
  | "hosted_review_started"
  | "buyer_follow_up_in_progress"
  | "buyer_outcome_recorded"
  | "next_action_open";

export type BlockingConditionStatus =
  | "blocked"
  | "awaiting_external_confirmation"
  | "awaiting_human_decision"
  | "completed";

export type OperatingGraphExecutionStatus =
  | "ready_to_execute"
  | "awaiting_external_confirmation"
  | "awaiting_human_decision"
  | "blocked"
  | "completed";

export type OperatingGraphEntityType =
  | "city_program"
  | "supply_target"
  | "capture_run"
  | "package_run"
  | "hosted_review_run"
  | "buyer_outcome";

export type OperatingGraphRepo =
  | "Blueprint-WebApp"
  | "BlueprintCapture"
  | "BlueprintPipeline";

export interface OperatingGraphOriginRef {
  repo: OperatingGraphRepo;
  project?: string | null;
  issueId?: string | null;
  sourceCollection?: string | null;
  sourceDocId?: string | null;
  route?: string | null;
  artifactPath?: string | null;
  runId?: string | null;
}

export interface BlockingCondition {
  id: string;
  status: BlockingConditionStatus;
  summary: string;
  owner: string | null;
  evidenceStatus?: "first_party" | "external" | "missing" | null;
  sourceRef?: string | null;
}

export interface ExternalConfirmation {
  id: string;
  summary: string;
  owner: string | null;
  sourceRef?: string | null;
}

export interface NextAction {
  id: string;
  summary: string;
  owner: string | null;
  status?: OperatingGraphExecutionStatus;
  sourceRef?: string | null;
}

export interface OperatingGraphCanonicalForeignKeys {
  cityProgramId?: string | null;
  supplyTargetId?: string | null;
  cityLaunchProspectId?: string | null;
  captureId?: string | null;
  captureRunId?: string | null;
  siteSubmissionId?: string | null;
  sceneId?: string | null;
  buyerRequestId?: string | null;
  captureJobId?: string | null;
  packageId?: string | null;
  packageRunId?: string | null;
  hostedReviewRunId?: string | null;
  buyerOutcomeId?: string | null;
  buyerAccountId?: string | null;
}

export interface OperatingGraphEvent {
  id: string;
  event_key: string;
  entity_type: OperatingGraphEntityType;
  entity_id: string;
  city: string;
  city_slug: string;
  stage: OperatingGraphStage;
  summary: string;
  source_repo: OperatingGraphRepo;
  source_kind: string;
  origin: OperatingGraphOriginRef;
  blocking_conditions: BlockingCondition[];
  external_confirmations: ExternalConfirmation[];
  next_actions: NextAction[];
  metadata?: Record<string, unknown>;
  recorded_at_iso: string;
  recorded_at: string;
}

export interface OperatingGraphState {
  stateKey: string;
  entityType: OperatingGraphEntityType;
  entityId: string;
  city: string;
  citySlug: string;
  currentStage: OperatingGraphStage;
  stagesSeen: OperatingGraphStage[];
  blockingConditions: BlockingCondition[];
  externalConfirmations: ExternalConfirmation[];
  nextActions: NextAction[];
  latestSummary: string;
  latestSourceRepo: OperatingGraphRepo;
  latestEventId: string;
  latestEventAtIso: string;
  canonicalForeignKeys: OperatingGraphCanonicalForeignKeys;
}

export interface CityProgramProjection extends OperatingGraphState {
  entityType: "city_program";
  cityProgramId: string;
}

export interface CaptureRunProjection extends OperatingGraphState {
  entityType: "capture_run";
  captureRunId: string;
  captureId: string | null;
  siteSubmissionId: string | null;
  sceneId: string | null;
  buyerRequestId: string | null;
  captureJobId: string | null;
}

export interface SupplyTargetProjection extends OperatingGraphState {
  entityType: "supply_target";
  supplyTargetId: string;
  cityLaunchProspectId: string | null;
}

export interface PackageRunProjection extends OperatingGraphState {
  entityType: "package_run";
  packageRunId: string;
  packageId: string | null;
  captureId: string | null;
  siteSubmissionId: string | null;
  sceneId: string | null;
  buyerRequestId: string | null;
  captureJobId: string | null;
}

export interface HostedReviewRunProjection extends OperatingGraphState {
  entityType: "hosted_review_run";
  hostedReviewRunId: string;
  packageId: string | null;
  captureId: string | null;
  siteSubmissionId: string | null;
  buyerRequestId: string | null;
  buyerAccountId: string | null;
}

export interface BuyerOutcomeProjection extends OperatingGraphState {
  entityType: "buyer_outcome";
  buyerOutcomeId: string;
  hostedReviewRunId: string | null;
  packageId: string | null;
  captureId: string | null;
  buyerAccountId: string | null;
}
