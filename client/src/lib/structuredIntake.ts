import type {
  BudgetBucket,
  BuyerType,
  ProofPathPreference,
  RequestedLane,
} from "@/types/inbound-request";

export type CalendarDisposition =
  | "not_needed_yet"
  | "eligible_optional"
  | "recommended"
  | "required_before_next_step";

export type StructuredIntakeMode = "structured_intake_first" | "calendar_accelerated";
export type ProofPathOutcome =
  | "exact_site"
  | "adjacent_site"
  | "scoped_follow_up"
  | "operator_handoff";
export type ProofReadyOutcome =
  | "proof_ready_intake"
  | "needs_clarification"
  | "operator_handoff";
export type SiteOperatorClaimOutcome =
  | "not_site_operator"
  | "site_claim_needs_detail"
  | "site_claim_needs_access_boundary"
  | "site_claim_access_boundary_ready";
export type AccessBoundaryOutcome =
  | "not_applicable"
  | "needs_access_rules"
  | "needs_privacy_security_boundary"
  | "access_boundary_defined";

export interface StructuredIntakeDecision {
  intakeMode: StructuredIntakeMode;
  primaryCta: string;
  secondaryCta: string;
  calendarDisposition: CalendarDisposition;
  calendarReasons: string[];
  missingStructuredFields: string[];
  ownerLane: string;
  recommendedPath: string;
  nextAction: string;
  requiresHumanReview: boolean;
  filterTags: string[];
  proofReadyOutcome: ProofReadyOutcome;
  proofPathOutcome: ProofPathOutcome;
  proofReadinessScore: number;
  proofReadyCriteria: string[];
  missingProofReadyFields: string[];
  siteOperatorClaimOutcome: SiteOperatorClaimOutcome;
  accessBoundaryOutcome: AccessBoundaryOutcome;
  siteClaimReadinessScore: number;
  siteClaimCriteria: string[];
  missingSiteClaimFields: string[];
}

export interface StructuredIntakeInput {
  buyerType: BuyerType;
  requestedLanes?: RequestedLane[];
  budgetBucket?: BudgetBucket | "";
  siteName?: string | null;
  siteLocation?: string | null;
  taskStatement?: string | null;
  targetSiteType?: string | null;
  proofPathPreference?: ProofPathPreference | null;
  targetRobotTeam?: string | null;
  roleTitle?: string | null;
  workflowContext?: string | null;
  humanGateTopics?: string | null;
  operatingConstraints?: string | null;
  privacySecurityConstraints?: string | null;
  knownBlockers?: string | null;
  captureRights?: string | null;
  derivedScenePermission?: string | null;
  datasetLicensingPermission?: string | null;
  payoutEligibility?: string | null;
  details?: string | null;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(String(value || "").trim());
}

function isHighBudget(value: BudgetBucket | "" | null | undefined): boolean {
  return value === "$300K-$1M" || value === ">$1M";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function buildProofReadyDecision(
  input: StructuredIntakeInput,
  requestedLanes: RequestedLane[],
): {
  proofReadyOutcome: ProofReadyOutcome;
  proofPathOutcome: ProofPathOutcome;
  proofReadinessScore: number;
  proofReadyCriteria: string[];
  missingProofReadyFields: string[];
} {
  if (input.buyerType !== "robot_team") {
    return {
      proofReadyOutcome: "operator_handoff",
      proofPathOutcome: "operator_handoff",
      proofReadinessScore: 0,
      proofReadyCriteria: [],
      missingProofReadyFields: [],
    };
  }

  const criteria: Array<{ key: string; met: boolean }> = [
    { key: "robot_team_role", met: hasText(input.roleTitle) },
    { key: "task_or_workflow_question", met: hasText(input.taskStatement) },
    { key: "robot_or_stack", met: hasText(input.targetRobotTeam) },
    {
      key: "target_site_type_or_site",
      met: hasText(input.targetSiteType) || hasText(input.siteName),
    },
    {
      key: "proof_path_preference",
      met: Boolean(input.proofPathPreference && input.proofPathPreference !== "need_guidance"),
    },
    { key: "requested_lane", met: requestedLanes.length > 0 },
    { key: "budget_or_procurement_range", met: Boolean(input.budgetBucket) },
  ];

  if (input.proofPathPreference === "exact_site_required") {
    criteria.push(
      { key: "site_name", met: hasText(input.siteName) },
      { key: "site_location", met: hasText(input.siteLocation) },
    );
  }

  const proofReadyCriteria = criteria
    .filter((criterion) => criterion.met)
    .map((criterion) => criterion.key);
  const missingProofReadyFields = criteria
    .filter((criterion) => !criterion.met)
    .map((criterion) => criterion.key);
  const proofReadinessScore = Math.round((proofReadyCriteria.length / criteria.length) * 100);

  const proofPathOutcome: ProofPathOutcome =
    missingProofReadyFields.length > 0
      ? "scoped_follow_up"
      : input.proofPathPreference === "exact_site_required"
        ? "exact_site"
        : input.proofPathPreference === "adjacent_site_acceptable"
          ? "adjacent_site"
          : "scoped_follow_up";

  return {
    proofReadyOutcome:
      proofPathOutcome === "exact_site" || proofPathOutcome === "adjacent_site"
        ? "proof_ready_intake"
        : "needs_clarification",
    proofPathOutcome,
    proofReadinessScore,
    proofReadyCriteria: unique(proofReadyCriteria),
    missingProofReadyFields: unique(missingProofReadyFields),
  };
}

function buildSiteOperatorClaimDecision(input: StructuredIntakeInput): {
  siteOperatorClaimOutcome: SiteOperatorClaimOutcome;
  accessBoundaryOutcome: AccessBoundaryOutcome;
  siteClaimReadinessScore: number;
  siteClaimCriteria: string[];
  missingSiteClaimFields: string[];
} {
  if (input.buyerType !== "site_operator") {
    return {
      siteOperatorClaimOutcome: "not_site_operator",
      accessBoundaryOutcome: "not_applicable",
      siteClaimReadinessScore: 0,
      siteClaimCriteria: [],
      missingSiteClaimFields: [],
    };
  }

  const hasPrivacyBoundary =
    hasText(input.privacySecurityConstraints)
    || hasText(input.captureRights)
    || hasText(input.derivedScenePermission)
    || hasText(input.datasetLicensingPermission);
  const criteria: Array<{ key: string; met: boolean }> = [
    { key: "facility_name", met: hasText(input.siteName) },
    { key: "site_location", met: hasText(input.siteLocation) },
    {
      key: "operator_intent",
      met:
        hasText(input.taskStatement)
        || hasText(input.workflowContext)
        || hasText(input.details),
    },
    { key: "access_rules", met: hasText(input.operatingConstraints) },
    { key: "privacy_security_boundary", met: hasPrivacyBoundary },
  ];

  const siteClaimCriteria = criteria
    .filter((criterion) => criterion.met)
    .map((criterion) => criterion.key);
  const missingSiteClaimFields = criteria
    .filter((criterion) => !criterion.met)
    .map((criterion) => criterion.key);
  const siteClaimReadinessScore = Math.round((siteClaimCriteria.length / criteria.length) * 100);
  const accessBoundaryOutcome: AccessBoundaryOutcome = !hasText(input.operatingConstraints)
    ? "needs_access_rules"
    : hasPrivacyBoundary
      ? "access_boundary_defined"
      : "needs_privacy_security_boundary";
  const missingCoreClaimDetail = ["facility_name", "site_location", "operator_intent"].some(
    (key) => missingSiteClaimFields.includes(key),
  );
  const siteOperatorClaimOutcome: SiteOperatorClaimOutcome = missingCoreClaimDetail
    ? "site_claim_needs_detail"
    : accessBoundaryOutcome === "access_boundary_defined"
      ? "site_claim_access_boundary_ready"
      : "site_claim_needs_access_boundary";

  return {
    siteOperatorClaimOutcome,
    accessBoundaryOutcome,
    siteClaimReadinessScore,
    siteClaimCriteria: unique(siteClaimCriteria),
    missingSiteClaimFields: unique(missingSiteClaimFields),
  };
}

export function evaluateStructuredIntake(input: StructuredIntakeInput): StructuredIntakeDecision {
  const requestedLanes = input.requestedLanes || [];
  const missingStructuredFields: string[] = [];
  const calendarReasons: string[] = [];
  const filterTags = ["structured_intake_first", input.buyerType];
  const proofReadyDecision = buildProofReadyDecision(input, requestedLanes);
  const siteOperatorClaimDecision = buildSiteOperatorClaimDecision(input);

  if (!hasText(input.siteName)) missingStructuredFields.push("site_name");
  if (!hasText(input.siteLocation)) missingStructuredFields.push("site_location");

  if (input.buyerType === "robot_team") {
    if (!hasText(input.roleTitle)) missingStructuredFields.push("robot_team_role");
    if (!hasText(input.taskStatement)) missingStructuredFields.push("task_or_workflow_question");
    if (!hasText(input.targetRobotTeam)) missingStructuredFields.push("robot_or_stack");
    if (!hasText(input.targetSiteType) && !hasText(input.siteName)) {
      missingStructuredFields.push("target_site_type_or_site");
    }
    if (!input.proofPathPreference) missingStructuredFields.push("proof_path_preference");
  } else {
    if (!hasText(input.operatingConstraints)) missingStructuredFields.push("access_rules");
  }

  const exactSiteRequested =
    input.proofPathPreference === "exact_site_required"
    || requestedLanes.includes("deeper_evaluation");
  const robotHighIntent =
    input.buyerType === "robot_team"
    && exactSiteRequested
    && hasText(input.taskStatement)
    && (hasText(input.targetRobotTeam) || hasText(input.targetSiteType))
    && (hasText(input.siteName) || hasText(input.siteLocation));

  if (robotHighIntent) {
    calendarReasons.push("robot_team_has_specific_site_workflow_and_stack");
  }
  if (input.buyerType === "robot_team" && isHighBudget(input.budgetBucket)) {
    calendarReasons.push("buyer_budget_supports_managed_scoping");
  }
  if (input.buyerType === "robot_team" && hasText(input.humanGateTopics)) {
    calendarReasons.push("buyer_named_human_gated_topics");
  }

  const operatorRightsOrPrivacy =
    hasText(input.privacySecurityConstraints)
    || hasText(input.captureRights)
    || hasText(input.derivedScenePermission)
    || hasText(input.datasetLicensingPermission)
    || hasText(input.payoutEligibility);
  const operatorPrivateAccess =
    input.buyerType === "site_operator" && hasText(input.operatingConstraints);

  if (operatorPrivateAccess) {
    calendarReasons.push("operator_named_access_rules");
  }
  if (input.buyerType === "site_operator" && operatorRightsOrPrivacy) {
    calendarReasons.push("operator_named_rights_privacy_or_commercialization_boundary");
  }

  let calendarDisposition: CalendarDisposition = "not_needed_yet";
  if (input.buyerType === "site_operator" && operatorRightsOrPrivacy) {
    calendarDisposition = "required_before_next_step";
  } else if (robotHighIntent || (input.buyerType === "robot_team" && isHighBudget(input.budgetBucket))) {
    calendarDisposition = "recommended";
  } else if (missingStructuredFields.length <= 1) {
    calendarDisposition = "eligible_optional";
  }

  const primaryCta =
    input.buyerType === "site_operator"
      ? "Submit or claim a site"
      : requestedLanes.includes("deeper_evaluation")
        ? "Scope hosted evaluation"
        : "Request buyer access";
  const secondaryCta =
    calendarDisposition === "not_needed_yet"
      ? "Talk to Blueprint after intake"
      : "Book a scoping call";
  const ownerLane =
    input.buyerType === "site_operator"
      ? "site-operator-partnership-agent"
      : calendarDisposition === "recommended" || calendarDisposition === "required_before_next_step"
        ? "buyer-solutions-agent"
        : "intake-agent";
  const recommendedPath =
    calendarDisposition === "required_before_next_step"
      ? "intake_then_required_scoping_call"
      : calendarDisposition === "recommended"
        ? "intake_then_recommended_scoping_call"
        : calendarDisposition === "eligible_optional"
          ? "intake_then_optional_scoping_call"
          : "structured_intake_review";
  const nextAction =
    calendarDisposition === "required_before_next_step"
      ? "review structured intake, preserve the operator rights/privacy boundary, then schedule scoping before any access or commercialization commitment"
      : calendarDisposition === "recommended"
        ? "review structured intake and offer a scoping call because the request is specific enough to accelerate"
        : "review structured intake first and ask only for missing details before suggesting a call";

  filterTags.push(
    recommendedPath,
    `calendar_${calendarDisposition}`,
    proofReadyDecision.proofReadyOutcome,
    `proof_path_${proofReadyDecision.proofPathOutcome}`,
    siteOperatorClaimDecision.siteOperatorClaimOutcome,
    siteOperatorClaimDecision.accessBoundaryOutcome,
    ...requestedLanes,
    ...calendarReasons,
  );

  return {
    intakeMode:
      calendarDisposition === "recommended" || calendarDisposition === "required_before_next_step"
        ? "calendar_accelerated"
        : "structured_intake_first",
    primaryCta,
    secondaryCta,
    calendarDisposition,
    calendarReasons: unique(calendarReasons),
    missingStructuredFields: unique(missingStructuredFields),
    ownerLane,
    recommendedPath,
    nextAction,
    requiresHumanReview: calendarDisposition === "required_before_next_step",
    filterTags: unique(filterTags),
    ...proofReadyDecision,
    ...siteOperatorClaimDecision,
  };
}
