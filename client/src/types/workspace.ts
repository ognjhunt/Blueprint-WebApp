import type { RobotDescription } from "./robotDescription";
import type { SitePilotIntent, SiteVisitAnswer } from "@/data/sitePilotIntent";
export type WorkspaceRole = "site_operator" | "robot_team";
export type TaskTargets = {
  successRate: number | null;
  cycleTimeSeconds: number | null;
};
export type TaskTerms = TaskTargets & {
  pilotBudgetUsd: number | null;
  deploymentBudgetUsd: number | null;
  targetDate: string | null;
  successDefinition: string;
};
export type RobotSetup = {
  robotDescription?: RobotDescription;
  executionBindingId?: string;
  id: string;
  name: string;
  embodiment: string;
  policyName: string;
  version: string;
  delivery: "checkpoint" | "container" | "endpoint";
  reference: string;
  notes: string;
  updatedAt: string;
};
export type WorkspaceResult = {
  id: string;
  teamAlias: string;
  status: string;
  successRate: number | null;
  cycleTimeSeconds: number | null;
  sampleCount: number | null;
  evidenceLabel: string;
  targetsMet: boolean | null;
  selected: boolean;
  runId?: string | null;
};
export type CaptureVisit = {
  id: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  capturerName: string | null;
  changeStatus: string | null;
  canMessage: boolean;
};
export type WorkspaceTask = {
  id: string;
  title: string;
  siteName: string;
  location: string;
  siteType: string;
  status: string;
  nextStep: string | null;
  terms: TaskTerms;
  pilotIntent?: SitePilotIntent | null;
  visibility: "private" | "anonymized" | "approved_robot_teams";
  published: boolean;
  archived: boolean;
  /** The owner hid the task from robot teams (the listing control). */
  paused?: boolean;
  /** Filmed by the site itself, or by a Blueprint visit. */
  captureMode?: "self_capture" | "site_visit" | null;
  /** The task card in the robot-team library, as the owner approved it. */
  listing?: { approved: boolean; live: boolean } | null;
  /** The reconstructed scene can be opened from the task page. */
  sceneReady?: boolean;
  potentialMatches: number | null;
  capture: CaptureVisit | null;
  results: WorkspaceResult[];
  pilot: {
    state: string;
    selectedResultId: string | null;
    notes: string | null;
    siteVisitAnswer?: SiteVisitAnswer | null;
  };
  /**
   * Where the task stands on the assessment ladder, when it is a site task.
   *
   * Optional because this type is shared with the robot-team role, and because
   * a task with no brief drafted has no readiness yet. Projected from the same
   * `projectTaskStatus` the account-free page uses, so the two surfaces cannot
   * disagree about one task.
   */
  readiness?: {
    decision: string;
    headline: string;
    operatorAction: string | null;
    missingViews: string[];
    nextUpdateIso: string | null;
  } | null;
  createdAt: string | null;
};
export type WorkspaceEvaluation = WorkspaceResult & {
  taskId: string | null;
  title: string;
  siteType: string;
  location: string | null;
  setupName: string | null;
  terms: TaskTargets;
  outcome: string | null;
  archived: boolean;
  createdAt: string | null;
};
export type WorkspaceSnapshot = {
  role: WorkspaceRole;
  profile: { name: string; organization: string; email: string };
  tasks: WorkspaceTask[];
  evaluations: WorkspaceEvaluation[];
  setups: RobotSetup[];
};

export type WorkspaceAccountSetup = {
  workspaceType: WorkspaceRole | null;
  profile: { name: string; organization: string; email: string };
  termsRequired: boolean;
  access: { operations: boolean; capture: boolean };
};
