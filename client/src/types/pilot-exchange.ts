export type PilotLocationType =
  | "Warehouse"
  | "Retail"
  | "Grocery"
  | "Hospitality"
  | "Industrial"
  | "Healthcare";

export type RobotEmbodiment =
  | "Humanoid"
  | "Franka Arm"
  | "Mobile Manipulator"
  | "AMR + Arm";

export type DeploymentTimeline =
  | "30 days"
  | "60 days"
  | "90 days"
  | "120+ days";

export type PrivacyMode = "Anonymized" | "Named";
export type IntegrationCheckStatus = "Passed" | "Partial" | "Failed";
export type SafetySatStatus = "Ready" | "In Progress" | "Blocked";

export interface ReadinessGate {
  id: string;
  title:
    | "Site Intake"
    | "Digital Twin Capture"
    | "SimReady Authoring"
    | "Real-to-Sim Activation"
    | "Standardized Eval Harness"
    | "Safety + SAT Prep"
    | "Controlled Pilot Ramp";
  description: string;
  whyItMatters: string;
}

export interface ReadinessFunnelPoint {
  id: string;
  stage: string;
  teams: number;
}

export interface ConfidenceBandPoint {
  id: string;
  task: string;
  low: number;
  median: number;
  high: number;
}

export interface FailureAttributionSlice {
  id: string;
  label: "Geometry" | "Calibration" | "Integration" | "Policy Logic" | "Ops Process";
  percent: number;
  note: string;
}

export interface ActivationSignal {
  id: string;
  label: string;
  description: string;
}

export interface ActivationArtifact {
  id: string;
  label: string;
  description: string;
}

export interface WorkflowValidationCheck {
  id: string;
  label: string;
  checks: string[];
}

export interface PilotExchangeFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface LocationBrief {
  id: string;
  operatorAlias: string;
  locationType: PilotLocationType;
  region: string;
  footprintSqFt: number;
  robotEmbodiment: RobotEmbodiment;
  timeline: DeploymentTimeline;
  privacyMode: PrivacyMode;
  qualifyingSuccessRateThreshold: number; // Minimum % success required to start conversations.
  objective: string;
  evaluationGoal: string;
  primaryTasks: string[];
  integrationSurface: string[];
  safetyConstraints: string[];
  excludedTasks?: string;
  openSlots: number;
}

export interface PolicySubmission {
  id: string;
  teamAlias: string;
  locationType: PilotLocationType;
  robotEmbodiment: RobotEmbodiment;
  timeline: DeploymentTimeline;
  privacyMode: PrivacyMode;
  benchmarkRuns: number;
  summary: string;
  readiness: "Ready" | "Conditional" | "Needs Work";
  successRate: number;
}

export interface ScoreSummary {
  id: string;
  rank: number;
  entrant: string;
  locationType: PilotLocationType;
  robotEmbodiment: RobotEmbodiment;
  successRate: number;
  transferConfidence: number;
  readiness: "Ready" | "Conditional" | "Needs Work";
  detailsAccess: "Gated";
}

export interface EvalLeaderboardEntry {
  id: string;
  briefId: string;
  rank: number;
  entrant: string; // Anonymous by default (e.g., "Anon Team 014")
  successRate: number;
  interventionRatePer100: number;
  integrationCheckStatus: IntegrationCheckStatus;
  safetySatStatus: SafetySatStatus;
  benchmarkRuns: number;
  readiness: "Ready" | "Conditional" | "Needs Work";
  detailsAccess: "Gated";
}

export interface CaptureNetworkStat {
  id: string;
  label: string;
  value: string;
  note: string;
}
