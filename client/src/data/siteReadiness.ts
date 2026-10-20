/**
 * The site readiness report: an expert's first read of a site's job.
 *
 * The site sends its video and nothing else (founder direction, 2026-10-20).
 * Blueprint infers the rest: from the video (sizes, weights, distances, pace,
 * people nearby), from anything the site already told us, and from its own
 * screening rules. The server computes the report (`server/utils/siteReadiness.ts`);
 * it reaches the owner once Blueprint shares it, folded on the job page and as
 * a printable brief with its own read-only link. Fixed copy filled with the
 * job's own data: no team, count, price or "match", no question to the site,
 * and every answer a first read, not a promise.
 * Design: docs/superpowers/specs/2026-10-20-site-readiness-report-design.md.
 */
import type { MarketSource } from "./deploymentMarket";
import type { SiteRobotFit } from "./robotFit";

/* ------------------------------------------------------- steps to a pilot */

/** "unknown" when a state could not be read just now; it never stands for "not done". */
export type StepState = "done" | "in_progress" | "pending" | "unknown";

export interface TrackerStep {
  id: string;
  label: string;
  state: StepState;
  owner: "site" | "blueprint";
}

export interface Tracker {
  steps: TrackerStep[];
  /** What Blueprint is doing now, only from a real recorded state. */
  meanwhile: string | null;
}

export const STEP_STATE_LABELS: Record<StepState, string> = {
  done: "Done",
  in_progress: "In progress",
  pending: "Not yet",
  unknown: "Could not be checked just now",
};

/* ------------------------------------------------- robot readiness report */

/** Ready from what Blueprint already holds, or one to settle with the robot team before a pilot. */
export type ReadinessState = "ready" | "confirm";

export const READINESS_STATE_LABELS: Record<ReadinessState, string> = {
  ready: "Looks ready",
  confirm: "Confirm with the robot team",
};

export interface ReadinessItem {
  id: "floor_space" | "standing_spot" | "power_network" | "safe_zone" | "object_arrival";
  title: string;
  state: ReadinessState;
  /** In the job's own data. */
  detail: string;
}

export interface SuccessFactor {
  id: string;
  title: string;
  detail: string;
  /** What the simulation tests for it, or why it is left to the pilot. */
  test: string;
  where: "simulation" | "pilot";
}

export const SUCCESS_FACTOR_WHERE_LABELS: Record<SuccessFactor["where"], string> = {
  simulation: "Tested in the simulation",
  pilot: "Checked in the pilot, not the simulation",
};

/** A third-party deployment on the public record: the environment and its sources, never a robot company. */
export interface DeploymentExample {
  id: string;
  name: string;
  sources: readonly MarketSource[];
}

export interface SiteReadinessReport {
  robotFit: SiteRobotFit;
  checklist: ReadinessItem[];
  successFactors: SuccessFactor[];
  safety: string[];
  examples: DeploymentExample[];
  /** Always shown with the examples. */
  examplesFootnote: string;
}

export interface SiteReadinessResponse {
  ok: true;
  /** The job in one line, for the printable brief. */
  summary: string | null;
  tracker: Tracker;
  /** The robot readiness report, while Blueprint shares it. */
  report: SiteReadinessReport | null;
  /**
   * The printable brief's read-only link, on the owner's read only. The owner's
   * job link never goes on paper: it can book the pilot and withdraw consent.
   */
  briefPath: string | null;
}

export const READINESS_BRIEF_FOOTER =
  "Prepared by Blueprint from your video and what you told us. It is a first read, not a promise that any robot can do "
  + "the job. If Blueprint recommends a robot team, it will be one whose evaluation of your job passed.";
