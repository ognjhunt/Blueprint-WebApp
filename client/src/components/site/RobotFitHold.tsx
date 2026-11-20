export type RobotFitHoldVerdict = "fit" | "no_fit" | "unknown";
export type RobotFitHoldEmbodiment =
  "droid_franka_panda_robotiq_2f85_v1" | "unitree_g1_dex3_sonic_v1" | "registered_team_embodiment";

/** The early robot fit precheck (preparation status v6) of a job held because no robot we run fits it. */
export type RobotFitHoldView = {
  status: "no_fit";
  holdReason: string;
  /** Display only: an open lowercase code; one this page does not know is shown with a neutral label. */
  taskKind: string | null;
  counts: { fit: number; noFit: number; unknown: number; unavailable: number };
  embodiments: Array<{ embodiment: RobotFitHoldEmbodiment; verdict: RobotFitHoldVerdict; reasons: string[] }>;
  embodimentsTruncated: boolean;
  precheckDigest: string;
};

/** The robots the precheck may name; read to check a hold's shape, never shown (the page names no robot or reason). */
const EMBODIMENTS: Record<RobotFitHoldEmbodiment, true> = {
  droid_franka_panda_robotiq_2f85_v1: true,
  unitree_g1_dex3_sonic_v1: true,
  registered_team_embodiment: true,
};
const VERDICTS: RobotFitHoldVerdict[] = ["fit", "no_fit", "unknown"];

export function isRobotFitHold(value: unknown): value is RobotFitHoldView {
  const hold = value as Partial<RobotFitHoldView> | null;
  const counts = hold?.counts;
  return Boolean(hold) && hold!.status === "no_fit" && typeof hold!.holdReason === "string"
    && /^website_robot_fit_none:[a-z][a-z0-9_]{0,99}$/.test(hold!.holdReason)
    && (hold!.taskKind === null || typeof hold!.taskKind === "string" && /^[a-z_]{1,40}$/.test(hold!.taskKind))
    && Boolean(counts) && [counts!.fit, counts!.noFit, counts!.unknown, counts!.unavailable]
      .every(count => Number.isInteger(count) && count >= 0)
    && typeof hold!.embodimentsTruncated === "boolean" && typeof hold!.precheckDigest === "string"
    && Array.isArray(hold!.embodiments) && hold!.embodiments.every(row => Boolean(row) && row.embodiment in EMBODIMENTS
      && VERDICTS.includes(row.verdict) && Array.isArray(row.reasons) && row.reasons.every(code => typeof code === "string"));
}

const TASK_KINDS: Record<string, string> = {
  rigid_pick_place: "picking up one object and putting it down somewhere else",
  articulated_open_close: "opening one door, drawer or lid",
};
/** A kind this page has no words for gets a neutral label, never its code. */
export function taskKindLabel(kind: string): string {
  return Object.prototype.hasOwnProperty.call(TASK_KINDS, kind) ? TASK_KINDS[kind] : "the job you described";
}

/**
 * The robots Blueprint checked, and that none fits: an estimate from the job as rebuilt from its video, never a physical
 * test or a finding that no robot could do it. The per-robot list and the check's reason codes are engineering detail
 * (and name robot software Blueprint no longer runs, owner 2026-11-14), so the site is told only the outcome.
 */
export function RobotFitHold({ hold }: { hold: RobotFitHoldView }) {
  return <section aria-label="Robots we checked">
    <h2>Robots we checked</h2>
    <p>None of the robots we checked fits this job. This is an estimate from your video; it does not mean no robot could do the job.</p>
    {hold.taskKind && <p className="ms-field-hint">Job checked: {taskKindLabel(hold.taskKind)}.</p>}
  </section>;
}
