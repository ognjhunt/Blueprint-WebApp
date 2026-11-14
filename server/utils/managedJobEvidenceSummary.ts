import type { BetaPolicyScreeningPublication, ScreeningExecutionEvidence, ScreeningOutcome, ScreeningOutcomeCaveat }
  from "./betaPolicyScreeningContract";
import type { JobCandidateSelection, JobScreeningProgress } from "../../client/src/types/jobMarketplace";

export type ManagedJobEvidenceSummary = {
  runId: string; state: string; current: boolean; resultDigest: string | null;
  /** These results were prepared before the site picked another place for the object (`currentManagedScreeningScope`). */
  placeCorrectedSince?: true;
  /** A job evaluation's outcome (`screeningOutcome`); null while it still runs. */
  outcome?: ScreeningOutcome | null;
  /** What the outcome's sentence adds (`screeningOutcomeCaveat`); the summary already says it. */
  outcomeCaveat?: ScreeningOutcomeCaveat;
  /** `nextAction` is what the site may read; `opsNextAction` is staff only. */
  summary: string; nextAction: string; opsNextAction?: string; limitations: string[]; href: string;
  screening?: { budget?: { limitUsd?: string; committedUpperBoundUsd: string; spentUpperBoundUsd: string; reservedUsd: string };
    provenance?: Pick<BetaPolicyScreeningPublication, "schema_version" | "claim_ceiling" | "source" | "generated_at"
      | "publication_digest" | "catalog_digest" | "plan_digest">;
    candidates: Array<{ candidateId: string; name: string; state: string; planned: number;
    scored: number; succeeded: number; failed: number; void: number; blockers: string[]; configurationDigest?: string;
    robotNotes?: string[];
    successRange?: ScreeningSuccessRange; executionEvidence?: ScreeningExecutionEvidence;
    /** How far the row's graded episodes got (publication v4); absent when the publication has none. */
    progress?: JobScreeningProgress;
    practiceRuns?: ScreeningPracticeRun[] }>; selection?: JobCandidateSelection;
    /** What Blueprint's own checks recorded about the scene the run used, in plain sentences, never codes. */
    setupNotes?: string[] };
};

/** One practice run (episode) of a candidate, with the videos kept of it; `videoId` is the video's sha256 hex. */
export type ScreeningPracticeRun = { number: number; outcome: "success" | "failure" | "void";
  videos: Array<{ videoId: string; camera: string; phase: "run" | "setup_check"; durationSeconds: number | null }> };

export type ScreeningSuccessRange = { lowerPercent: number; upperPercent: number; confidencePercent: number };
