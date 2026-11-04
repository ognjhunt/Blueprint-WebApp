export type RobotFitHoldVerdict = "fit" | "no_fit" | "unknown";
export type RobotFitHoldEmbodiment =
  "droid_franka_panda_robotiq_2f85_v1" | "unitree_g1_dex3_sonic_v1" | "registered_team_embodiment";

/** The early robot fit precheck (preparation status v6) of a job held because no robot we run fits it. */
export type RobotFitHoldView = {
  status: "no_fit";
  holdReason: string;
  taskKind: "rigid_pick_place" | "articulated_open_close" | null;
  counts: { fit: number; noFit: number; unknown: number; unavailable: number };
  embodiments: Array<{ embodiment: RobotFitHoldEmbodiment; verdict: RobotFitHoldVerdict; reasons: string[] }>;
  embodimentsTruncated: boolean;
  precheckDigest: string;
};

const EMBODIMENTS: Record<RobotFitHoldEmbodiment, string> = {
  droid_franka_panda_robotiq_2f85_v1: "Franka Panda arm with a Robotiq 2F-85 gripper",
  unitree_g1_dex3_sonic_v1: "Unitree G1 humanoid with Dex3 hands",
  registered_team_embodiment: "A robot registered by a robot team",
};
const VERDICTS: RobotFitHoldVerdict[] = ["fit", "no_fit", "unknown"];

export function isRobotFitHold(value: unknown): value is RobotFitHoldView {
  const hold = value as Partial<RobotFitHoldView> | null;
  const counts = hold?.counts;
  return Boolean(hold) && hold!.status === "no_fit" && typeof hold!.holdReason === "string"
    && /^website_robot_fit_none:[a-z][a-z0-9_]{0,99}$/.test(hold!.holdReason)
    && (hold!.taskKind === null || hold!.taskKind === "rigid_pick_place" || hold!.taskKind === "articulated_open_close")
    && Boolean(counts) && [counts!.fit, counts!.noFit, counts!.unknown, counts!.unavailable]
      .every(count => Number.isInteger(count) && count >= 0)
    && typeof hold!.embodimentsTruncated === "boolean" && typeof hold!.precheckDigest === "string"
    && Array.isArray(hold!.embodiments) && hold!.embodiments.every(row => Boolean(row) && row.embodiment in EMBODIMENTS
      && VERDICTS.includes(row.verdict) && Array.isArray(row.reasons) && row.reasons.every(code => typeof code === "string"));
}

const VERDICT_LABELS: Record<RobotFitHoldVerdict, string> = {
  fit: "Its body fits the room on this check",
  no_fit: "Ruled out",
  unknown: "Not decided before the scene is built",
};

/** Each precheck reason in plain words. An unknown code is shown as itself, never guessed at. */
const REASONS: Record<string, string> = {
  reach: "the task is farther than the arm reaches from any place it could be mounted level with the lower work surface",
  carry_not_checked_before_spend: "its carry path was not checked before paid work",
  no_clear_station_found: "no clear place to mount it was found in the scene",
  carry_blocked_from_stations_tried: "its carry path was blocked from the places tried",
  carry_undecided: "whether it can carry the object was not decided",
  collider_unavailable: "the room's collision shape was not available for this check",
  no_clear_stance_found: "no clear place for it to stand was found in the scene",
  nominal_arm_span_missed_body_motion_may_reach: "standing still, its arms do not span the task; it may still reach by walking, leaning or crouching",
  stance_reach_unassessed: "its reach from where it stands was not assessed",
  embodiment_free_base_reach_not_modeled: "it moves on its own base, and this check does not model that reach",
  declared_reach_misses_own_arm_may_reach: "its declared reach falls short, but its own arm model may still reach",
  declared_reach_misses_from_stations_found: "its declared reach falls short from the places found",
  task_geometry_not_modelled_before_authoring: "this check measures only pick-and-place tasks before the scene is built",
  task_inputs_missing: "a task measurement this check needs is missing",
};

const TASK_KINDS: Record<NonNullable<RobotFitHoldView["taskKind"]>, string> = {
  rigid_pick_place: "picking up one object and putting it down somewhere else",
  articulated_open_close: "opening one door, drawer or lid",
};

function reasonText(codes: string[]): string {
  return codes.map(code => REASONS[code] ?? code.replace(/_/g, " ")).join("; ");
}

/** Which robots Blueprint checked before any spend, and why none fits: the precheck's own evidence and no more.
 * An estimate from the scene rebuilt from video: never a physical test or a finding that no robot could do it. */
export function RobotFitHold({ hold }: { hold: RobotFitHoldView }) {
  const { fit, noFit, unknown, unavailable } = hold.counts;
  const total = fit + noFit + unknown + unavailable;
  const parts = [`${noFit} ruled out`, ...(unavailable ? [`${unavailable} not available for this job`] : []),
    ...(unknown ? [`${unknown} not decided`] : []), ...(fit ? [`${fit} fit`] : [])];
  return <section aria-label="Robots checked before any spend">
    <h2>Robots we checked</h2>
    <p className="ms-field-hint">Checked before any paid work, from your scene as rebuilt from your video. It is an
      estimate: no robot was tried on your job, and it does not show that no robot could ever do it.</p>
    {hold.taskKind && <p>Task checked: {TASK_KINDS[hold.taskKind]}.</p>}
    <p>{total} robot {total === 1 ? "setup" : "setups"} (a robot and the software that drives it): {parts.join(", ")}.</p>
    {hold.embodiments.length > 0 && <ul style={{ margin: "6px 0 12px", paddingLeft: "20px" }}>
      {hold.embodiments.map(row => <li key={row.embodiment}>
        {EMBODIMENTS[row.embodiment]}: {VERDICT_LABELS[row.verdict]}
        {row.reasons.length > 0 && <span className="ms-field-hint"> ({reasonText(row.reasons)})</span>}
      </li>)}
    </ul>}
    {hold.embodimentsTruncated && <p className="ms-field-hint">More robots were checked than are listed here.</p>}
  </section>;
}
