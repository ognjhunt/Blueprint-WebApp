import type {
  InboundRequest,
  PilotDataUsePermissions,
  PilotOpportunityVisibility,
} from "../types/inbound-request";

export type PilotOpportunityAccessLevel = "anonymized" | "shortlisted_confidential";

export type PilotOpportunityProjection = {
  opportunity_id: string;
  access_level: PilotOpportunityAccessLevel;
  visibility: PilotOpportunityVisibility;
  site_name: string | null;
  site_location: string | null;
  site_type: string | null;
  workflow: string;
  anonymized_summary: string | null;
  benchmark_profile: string;
  object_profile: string | null;
  operational_profile: string | null;
  integration_environment: string | null;
  rollout_readiness: string | null;
  data_use_permissions: PilotDataUsePermissions;
  underlying_site_files: "hosted_not_downloadable";
  controlled_evaluation: "request_required";
  compute_responsibility: string;
  qualification_outcome: "evaluation_candidate";
  qualification_state: "qualified_ready";
  opportunity_state: "handoff_ready";
  deployment_readiness: "not_established";
  claim_ceiling: string;
};

const CLAIM_CEILING =
  "Qualified for robot-team evaluation only. Simulation evidence, when present, does not establish deployment readiness; robot-specific interfaces and authoritative physical evidence are still required.";

function normalizedEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function hasCompletePilotDossier(record: InboundRequest): boolean {
  const opportunity = record.request.pilotOpportunity;
  if (!opportunity?.requested) return false;

  const requiredValues = [
    opportunity.objectProfile,
    opportunity.operationalProfile,
    opportunity.integrationEnvironment,
    opportunity.rolloutReadiness,
    opportunity.benchmarkProfile,
  ];
  if (requiredValues.some((value) => !String(value || "").trim())) return false;
  if (opportunity.visibility === "anonymized" && !String(opportunity.anonymizedSummary || "").trim()) {
    return false;
  }
  if (
    opportunity.visibility === "approved_robot_teams" &&
    !(opportunity.approvedRobotTeamEmails || []).some((email) => normalizedEmail(email))
  ) {
    return false;
  }
  return true;
}

export function pilotOpportunityPassedGates(record: InboundRequest): boolean {
  const rightsCleared =
    record.ops?.rights_status === "verified" ||
    record.evaluation_readiness?.rights_review_status === "cleared";
  const captureApproved = ["approved", "paid"].includes(
    String(record.ops?.capture_status || ""),
  );

  return Boolean(
    record.request.buyerType === "site_operator" &&
      hasCompletePilotDossier(record) &&
      record.request.pilotOpportunity?.visibility !== "private" &&
      record.structured_intake?.site_operator_claim_outcome ===
        "site_claim_access_boundary_ready" &&
      record.structured_intake?.access_boundary_outcome === "access_boundary_defined" &&
      record.structured_intake?.pilot_opportunity_outcome === "evaluation_candidate" &&
      (record.structured_intake?.missing_pilot_opportunity_fields || []).length === 0 &&
      record.qualification_state === "qualified_ready" &&
      record.opportunity_state === "handoff_ready" &&
      rightsCleared &&
      captureApproved,
  );
}

export function projectPilotOpportunityForRobotTeam(
  record: InboundRequest,
  robotTeamEmail: string,
): PilotOpportunityProjection | null {
  if (!pilotOpportunityPassedGates(record)) return null;

  const opportunity = record.request.pilotOpportunity!;
  if (opportunity.visibility === "approved_robot_teams") {
    const allowedEmails = new Set(
      (opportunity.approvedRobotTeamEmails || []).map(normalizedEmail).filter(Boolean),
    );
    if (!allowedEmails.has(normalizedEmail(robotTeamEmail))) return null;

    return {
      opportunity_id: record.requestId,
      access_level: "shortlisted_confidential",
      visibility: opportunity.visibility,
      site_name: record.request.siteName,
      site_location: record.request.siteLocation,
      site_type: record.request.targetSiteType || null,
      workflow: record.request.taskStatement,
      anonymized_summary: opportunity.anonymizedSummary || null,
      benchmark_profile: opportunity.benchmarkProfile || "Benchmark held in dossier",
      object_profile: opportunity.objectProfile || null,
      operational_profile: opportunity.operationalProfile || null,
      integration_environment: opportunity.integrationEnvironment || null,
      rollout_readiness: opportunity.rolloutReadiness || null,
      data_use_permissions: opportunity.dataUsePermissions,
      underlying_site_files: "hosted_not_downloadable",
      controlled_evaluation: "request_required",
      compute_responsibility:
        "The site funds the common model and baseline; the robot team funds incremental evaluation compute. Training compute is scoped separately by reusable value.",
      qualification_outcome: "evaluation_candidate",
      qualification_state: "qualified_ready",
      opportunity_state: "handoff_ready",
      deployment_readiness: "not_established",
      claim_ceiling: CLAIM_CEILING,
    };
  }

  if (opportunity.visibility !== "anonymized") return null;

  return {
    opportunity_id: record.requestId,
    access_level: "anonymized",
    visibility: opportunity.visibility,
    site_name: null,
    site_location: null,
    site_type: record.request.targetSiteType || null,
    workflow: opportunity.anonymizedSummary || "Anonymized workflow",
    anonymized_summary: opportunity.anonymizedSummary || null,
    benchmark_profile: opportunity.benchmarkProfile || "Benchmark held in dossier",
    object_profile: null,
    operational_profile: null,
    integration_environment: null,
    rollout_readiness: null,
    data_use_permissions: opportunity.dataUsePermissions,
    underlying_site_files: "hosted_not_downloadable",
    controlled_evaluation: "request_required",
    compute_responsibility:
      "The site funds the common model and baseline; the robot team funds incremental evaluation compute. Training compute is scoped separately by reusable value.",
    qualification_outcome: "evaluation_candidate",
    qualification_state: "qualified_ready",
    opportunity_state: "handoff_ready",
    deployment_readiness: "not_established",
    claim_ceiling: CLAIM_CEILING,
  };
}
