import type { CityLaunchExecutionResult } from "./cityLaunchExecutionHarness";

export type CityLaunchAutonomyCertification = {
  city: string;
  planningReady: boolean;
  activationReady: boolean;
  issueTreeReady: boolean;
  manualInterventionRequired: boolean;
  blockingExecutionStates: string[];
  doctrineGatesRemaining: string[];
  warnings: string[];
};

export function summarizeCityLaunchAutonomyCertification(
  result: CityLaunchExecutionResult,
): CityLaunchAutonomyCertification {
  const blockingExecutionStates: string[] = [];
  const doctrineGatesRemaining: string[] = [];
  const warnings: string[] = [];

  const executionStates = result.capabilitySnapshot?.execution;
  if (executionStates) {
    for (const [key, value] of Object.entries(executionStates)) {
      if (
        value.status === "blocked"
        || value.status === "pending_upstream_evidence"
        || value.status === "external_confirmation_required"
      ) {
        blockingExecutionStates.push(key);
      }

      if (value.status === "external_confirmation_required") {
        doctrineGatesRemaining.push(key);
      }

      if (value.status === "warning") {
        warnings.push(value.detail);
      }
    }
  }

  if (result.outboundReadiness) {
    warnings.push(...result.outboundReadiness.warnings);
  }

  if (executionStates?.analytics.status === "warning") {
    warnings.push("Firehose enrichment unavailable; using first-party city-launch ledgers only.");
  }

  const uniqueBlockingStates = [...new Set(blockingExecutionStates)];
  const uniqueDoctrineGates = [...new Set(doctrineGatesRemaining)];
  const uniqueWarnings = [...new Set(warnings)];

  const planningReady = result.planning.status === "completed";
  const activationReady =
    result.status === "founder_approved_activation_ready"
    && result.activationStatus === "activation_ready";
  const issueTreeReady = Boolean(
    result.paperclip?.rootIssueId && (result.paperclip?.dispatched.length || 0) > 0,
  );

  return {
    city: result.city,
    planningReady,
    activationReady,
    issueTreeReady,
    manualInterventionRequired: !(planningReady && activationReady && issueTreeReady),
    blockingExecutionStates: uniqueBlockingStates,
    doctrineGatesRemaining: uniqueDoctrineGates,
    warnings: uniqueWarnings,
  };
}
