/**
 * What the admin job page shows, and nothing more (`GET /api/admin/jobs`, `GET /api/admin/jobs/:id`).
 *
 * The page works out no status of its own. Where a job stands is the job's outlook, the one decision the site's own
 * job page shows (`server/utils/jobOutlook.ts`); everything else is a record, said as the record says it
 * (`server/utils/jobConsoleData.ts`).
 */
import type { JobPhase } from "../lib/jobOutlook";

/** An internal test job (one the console closes as `internal_test_job`): its label, never a site. */
export interface AdminJobInternalTest {
  label: string | null;
}

/** One row of the list: the job, one phrase for where it stands, when it was received. */
export interface AdminJobRow {
  requestId: string;
  /** The site's own sentence for the job (its brief's summary), exactly as written; null when it has none yet. */
  sentence: string | null;
  internalTest: AdminJobInternalTest | null;
  /** The outlook's phase, or null when it could not be read. */
  phase: JobPhase | null;
  /** One short phrase for that phase (`ADMIN_PHASE_WORDS`), or that it could not be read. */
  standing: string;
  receivedAtIso: string | null;
}

export interface AdminJobListResponse {
  jobs: AdminJobRow[];
  nextCursor: string | null;
}

/** Something that stops the job, only for privacy, rights or money, and whose step it is. */
export interface AdminJobStop {
  key: string;
  text: string;
  /** Whose step it is: the site's, Blueprint's, or nobody's (nothing is left to do). */
  whose: "site" | "blueprint" | "none";
  atIso: string | null;
}

/** A thing that happened, from a record that holds its time. */
export interface AdminJobEvent {
  key: string;
  text: string;
  atIso: string;
}

export interface AdminJobDetail {
  requestId: string;
  job: {
    sentence: string | null;
    /** The sentence was read from the video by Blueprint, and the site has not confirmed it. */
    drafted: boolean;
    /** The site's name and place, for the admin only; null for a job with no site (an internal test job). */
    site: { name: string | null; place: string | null } | null;
    internalTest: AdminJobInternalTest | null;
  };
  standing: {
    phase: JobPhase | null;
    phrase: string;
    /** The outlook's own sentence, as the site's page says it; null when the outlook has none. */
    siteSees: string | null;
    /** The job's sharing, in `sharingInWords`' words; null for an internal test job, which is never shared. */
    companies: string | null;
    /** The Pipeline's last report for the job, in plain words; null when it has reported nothing readable. */
    pipeline: string | null;
  };
  /** "Download the simulation package": the console's own route, only while a package is stored. */
  simulationPackageUrl: string | null;
  /** What the stored package record says it holds. */
  simulationPackage: { files: string[]; sizeBytes: number; builtAtIso: string | null } | null;
  /** The admin route that opens the job's scene preview in the viewer, when one is stored; else null. */
  scenePreviewViewUrl: string | null;
  /** What the job's ledgers count so far, in US dollars; null when the job has no ledger entry. */
  cost: { spentOrHeldUsd: number; unreadable: string[] } | null;
  stops: AdminJobStop[];
  events: AdminJobEvent[];
}

/** The outlook's phase in a short phrase, for staff. One wording per phase; no reading of its own. */
export const ADMIN_PHASE_WORDS: Readonly<Record<JobPhase, string>> = {
  reading: "Reading the video",
  building: "Building the simulation",
  testing: "Simulation ready",
  result: "Simulation ready",
  waiting_on_site: "Waiting on the site to say what the job is",
  no_test: "Ended",
  ended_by_site: "Stopped by the site",
};

export const STANDING_UNREAD = "Could not read where it stands right now";
/** The package record says the simulation package is built: said first, whatever the outlook reads (owner review, 2026-11-17). */
export const STANDING_PACKAGE_BUILT = "Simulation package built";
/** The outlook reads "reading" while no video has arrived: that is waiting for it, not reading it. */
export const STANDING_NO_VIDEO = "Waiting for the video";
/** An ending after which a test can still come (`OUTLOOK_HOLDS`): a hold, never "Ended". */
export const STANDING_ON_HOLD = "On hold";
