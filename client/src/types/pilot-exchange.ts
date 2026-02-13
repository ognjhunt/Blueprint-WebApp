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
