/**
 * The site readiness report: an expert's first read of a site's job, in the
 * site's own numbers. It answers what a site does not know to ask: how close
 * it is to a pilot and what to do next, what the job takes today, what the
 * site needs before a robot arrives, what decides success, how safety works,
 * and where robots already do this kind of job.
 *
 * The server computes it (`server/utils/siteReadiness.ts`). The tracker, next
 * steps, how the job runs and what it takes today are the owner's from the
 * start; the robot readiness report reaches the owner once Blueprint shares
 * it, with robot fit. Everything is fixed copy filled with the site's own
 * data: no team, count, price or "match", and every answer is a first read,
 * not a promise. Design: docs/superpowers/specs/2026-10-20-site-readiness-report-design.md.
 */
import type { MarketSource } from "./deploymentMarket";
import type { SiteRobotFit } from "./robotFit";

/* ------------------------------------------------------- how the job runs */

/** The same answers as the intake's `humanProximity` question, so robot fit reads either. */
export const PEOPLE_NEARBY = ["isolated", "nearby", "shared"] as const;
export type PeopleNearby = (typeof PEOPLE_NEARBY)[number];

export const PEOPLE_NEARBY_LABELS: Record<PeopleNearby, string> = {
  isolated: "No — the area is clear while it runs",
  nearby: "People pass nearby but do not work in it",
  shared: "People work in the same space",
};

export interface SiteOperations {
  /** How many times a day the job is done. */
  timesPerDay: number | null;
  /** On how many days a week. */
  daysPerWeek: number | null;
  peopleNearby: PeopleNearby | null;
  updatedAtIso: string | null;
}

export const MAX_TIMES_PER_DAY = 100_000;

/* ------------------------------------------------------ what it takes today */

export interface Workload {
  /** Short, for a folded section's title: "about 14 person-hours a week". */
  headline: string;
  hoursPerDay: number;
  /** Null until the site says on how many days a week. */
  hoursPerWeek: number | null;
  /** "This job takes about 2.8 person-hours a day, about 14 a week." */
  sentence: string;
  /** What the numbers rest on, in the site's words. */
  basis: string;
}

export interface SpeedCheck {
  state: "target_faster_than_today" | "target_within_today" | "needs_target" | "needs_measurement";
  sentence: string;
}

/* ------------------------------------------------------- steps to a pilot */

export type StepState = "done" | "partial" | "todo" | "in_progress" | "pending";

export interface TrackerStep {
  id: string;
  label: string;
  state: StepState;
  /** "2 of 6", or a short note. */
  detail: string | null;
  owner: "site" | "blueprint";
}

export interface Tracker {
  steps: TrackerStep[];
  /** What Blueprint is doing now, only from a real recorded state. */
  meanwhile: string | null;
}

export const STEP_STATE_LABELS: Record<StepState, string> = {
  done: "Done",
  partial: "Started",
  todo: "To do",
  in_progress: "In progress",
  pending: "Not yet",
};

/** Where on the job page a next step is answered. */
export type NextThingTarget = "brief" | "measurements" | "operations" | "photos";

/** Element ids on the job page that each target opens. */
export const NEXT_THING_ANCHORS: Record<NextThingTarget, string> = {
  brief: "job-brief",
  measurements: "site-measurements",
  operations: "how-the-job-runs",
  photos: "job-item-photos",
};

export interface NextThing {
  id: string;
  action: string;
  why: string;
  target: NextThingTarget;
}

/* ------------------------------------------------- robot readiness report */

export type ReadinessState = "ready" | "check" | "confirm" | "unknown";

export const READINESS_STATE_LABELS: Record<ReadinessState, string> = {
  ready: "Looks ready",
  check: "Check this",
  confirm: "Confirm with the robot team",
  unknown: "Not known yet",
};

export interface ReadinessItem {
  id: "floor_space" | "standing_spot" | "power_network" | "safe_zone" | "object_arrival";
  title: string;
  state: ReadinessState;
  /** In the site's own data. */
  detail: string;
  /** Why it matters, for someone who has never set up a robot. */
  why: string;
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

export interface DeploymentExample {
  id: string;
  name: string;
  status: "documented" | "emerging";
  evidence: string;
  sources: readonly MarketSource[];
}

export const DEPLOYMENT_STATUS_LABELS: Record<DeploymentExample["status"], string> = {
  documented: "In operation",
  emerging: "Emerging",
};

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
  nextThings: NextThing[];
  operations: SiteOperations;
  workload: Workload | null;
  speed: SpeedCheck | null;
  /** The robot readiness report, while Blueprint shares it. */
  report: SiteReadinessReport | null;
}

export const READINESS_BRIEF_FOOTER =
  "Prepared by Blueprint from what you told us, measured and filmed. It is a first read, not a promise that any robot "
  + "can do the job. If Blueprint recommends a robot team, it will be one whose evaluation of your job passed.";

/** Sent after the site saves how the job runs, so the report reads again. */
export const SITE_OPERATIONS_SAVED_EVENT = "blueprint:site-operations-saved";
