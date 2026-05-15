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
  missingStructuredFieldLabels: string[];
  ownerLane: string;
  recommendedPath: string;
  nextAction: string;
  routingSummary: string;
  calendarSummary: string;
  proofPathSummary: string;
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

const STRUCTURED_FIELD_LABELS: Record<string, string> = {
  access_rules: "Access rules",
  budget_or_procurement_range: "Budget or procurement range",
  facility_name: "Facility name",
  operator_intent: "Operator intent",
  privacy_security_boundary: "Privacy/security boundary",
  proof_path_preference: "Proof path preference",
  robot_or_stack: "Robot or stack",
  robot_team_role: "Robot-team role",
  site_location: "Site location",
  site_name: "Site name",
  target_site_type_or_site: "Target site class or site",
  task_or_workflow_question: "Task or workflow question",
};

function fieldLabels(fields: string[]): string[] {
  return unique(
    fields.map((field) => STRUCTURED_FIELD_LABELS[field] || field.replace(/_/g, " ")),
  );
}

function formatList(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function buildCalendarSummary(
  disposition: CalendarDisposition,
  missingFieldLabels: string[],
  reasons: string[],
): string {
  if (disposition === "required_before_next_step") {
    return "Calendar or human review is required before access, rights, privacy, or commercialization movement.";
  }

  if (disposition === "recommended") {
    return "A scoped call is recommended because the intake is specific enough to accelerate the next decision.";
  }

  if (disposition === "eligible_optional") {
    return "Calendar is secondary; intake review can proceed asynchronously, with a call only if it helps the scoped decision.";
  }

  if (missingFieldLabels.length > 0) {
    return `Calendar is not needed yet; ask for ${formatList(missingFieldLabels)} first.`;
  }

  if (reasons.length > 0) {
    return "Calendar is not needed yet; keep the first response tied to the recorded intake reasons.";
  }

  return "Calendar is not needed yet; structured intake review is the next step.";
}

function buildProofPathSummary(params: {
  buyerType: BuyerType;
  proofPathOutcome: ProofPathOutcome;
  proofReadyOutcome: ProofReadyOutcome;
  missingProofReadyFields: string[];
}): string {
  if (params.buyerType === "site_operator") {
    return "Site-operator intake is routed through access, privacy, and commercialization review, not robot-team proof readiness.";
  }

  if (params.proofPathOutcome === "exact_site") {
    return "Exact-site proof path is specific enough for buyer-solutions triage; package access, rights, provider execution, and hosted availability still require backing proof.";
  }

  if (params.proofPathOutcome === "adjacent_site") {
    return "Adjacent-site proof path is specific enough for buyer-solutions triage without demanding exact-site fields upfront.";
  }

  const missingLabels = fieldLabels(params.missingProofReadyFields);
  if (missingLabels.length > 0) {
    return `Proof path needs clarification; ask for ${formatList(missingLabels)} before treating this as proof-ready.`;
  }

  return "Proof path needs scoped follow-up before package, hosted review, or capture access can be confirmed.";
}

function buildRoutingSummary(params: {
  ownerLane: string;
  recommendedPath: string;
  nextAction: string;
}): string {
  return `${params.ownerLane} should handle ${params.recommendedPath.replace(/_/g, " ")}. ${params.nextAction}`;
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

  if (input.buyerType === "robot_team") {
    if (!hasText(input.roleTitle)) missingStructuredFields.push("robot_team_role");
    if (!hasText(input.taskStatement)) missingStructuredFields.push("task_or_workflow_question");
    if (!hasText(input.targetRobotTeam)) missingStructuredFields.push("robot_or_stack");
    if (input.proofPathPreference === "exact_site_required") {
      if (!hasText(input.siteName)) missingStructuredFields.push("site_name");
      if (!hasText(input.siteLocation)) missingStructuredFields.push("site_location");
    } else if (!hasText(input.targetSiteType) && !hasText(input.siteName)) {
      missingStructuredFields.push("target_site_type_or_site");
    }
    if (!input.proofPathPreference) missingStructuredFields.push("proof_path_preference");
  } else {
    if (!hasText(input.siteName)) missingStructuredFields.push("site_name");
    if (!hasText(input.siteLocation)) missingStructuredFields.push("site_location");
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

  const hasStructuredGaps = missingStructuredFields.length > 0;
  let calendarDisposition: CalendarDisposition = "not_needed_yet";
  if (input.buyerType === "site_operator" && operatorRightsOrPrivacy) {
    calendarDisposition = "required_before_next_step";
  } else if (
    !hasStructuredGaps &&
    (robotHighIntent || (input.buyerType === "robot_team" && isHighBudget(input.budgetBucket)))
  ) {
    calendarDisposition = "recommended";
  } else if (!hasStructuredGaps) {
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
      : proofReadyDecision.proofReadyOutcome === "proof_ready_intake" ||
          calendarDisposition === "recommended" ||
          calendarDisposition === "required_before_next_step"
        ? "buyer-solutions-agent"
        : "intake-agent";
  const recommendedPath =
    calendarDisposition === "required_before_next_step"
      ? "intake_then_required_scoping_call"
      : calendarDisposition === "recommended"
        ? "intake_then_recommended_scoping_call"
        : input.buyerType === "site_operator" &&
            siteOperatorClaimDecision.siteOperatorClaimOutcome ===
              "site_claim_needs_access_boundary"
          ? "operator_access_boundary_review"
          : proofReadyDecision.proofReadyOutcome === "proof_ready_intake"
            ? "proof_ready_buyer_solutions_handoff"
            : calendarDisposition === "eligible_optional"
              ? "intake_then_optional_scoping_call"
              : "structured_intake_review";
  const missingStructuredFieldLabels = fieldLabels(missingStructuredFields);
  const nextAction =
    calendarDisposition === "required_before_next_step"
      ? "review structured intake, preserve the operator rights/privacy boundary, then schedule scoping before any access or commercialization commitment"
      : input.buyerType === "site_operator" &&
          siteOperatorClaimDecision.siteOperatorClaimOutcome ===
            "site_claim_needs_access_boundary"
        ? "review the site claim and ask for the missing privacy/security boundary before any call, listing, access, or commercialization commitment"
        : input.buyerType === "site_operator" &&
            siteOperatorClaimDecision.siteOperatorClaimOutcome ===
              "site_claim_needs_detail"
          ? `ask for ${formatList(missingStructuredFieldLabels.length > 0 ? missingStructuredFieldLabels : fieldLabels(siteOperatorClaimDecision.missingSiteClaimFields))} before suggesting a call`
          : calendarDisposition === "recommended"
            ? "review structured intake and offer a scoping call because the request is specific enough to accelerate"
            : proofReadyDecision.proofReadyOutcome === "proof_ready_intake"
              ? "handoff to buyer-solutions for proof-path triage; keep package access, hosted availability, rights clearance, and provider execution unclaimed until backed by proof"
              : missingStructuredFieldLabels.length > 0
                ? `ask for ${formatList(missingStructuredFieldLabels)} before suggesting a call`
                : "review structured intake asynchronously and offer a call only if it accelerates a scoped buyer decision";
  const calendarSummary = buildCalendarSummary(
    calendarDisposition,
    missingStructuredFieldLabels,
    calendarReasons,
  );
  const proofPathSummary = buildProofPathSummary({
    buyerType: input.buyerType,
    ...proofReadyDecision,
  });
  const routingSummary = buildRoutingSummary({
    ownerLane,
    recommendedPath,
    nextAction,
  });

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
    missingStructuredFieldLabels,
    ownerLane,
    recommendedPath,
    nextAction,
    routingSummary,
    calendarSummary,
    proofPathSummary,
    requiresHumanReview: calendarDisposition === "required_before_next_step",
    filterTags: unique(filterTags),
    ...proofReadyDecision,
    ...siteOperatorClaimDecision,
  };
}
