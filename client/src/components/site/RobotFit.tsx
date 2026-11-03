export type RobotFitVerdict = "fits" | "fits_spec" | "doesnt_fit" | "unknown";

export type RobotFitView = {
  route: "full" | "geometry_only";
  status: "completed" | "not_run";
  reason: string | null;
  counts: { fits: number; fitsSpec: number; doesntFit: number; unknown: number } | null;
  models: Array<{ name: string; manufacturer: string; verdict: RobotFitVerdict; openChecks: string[] }>;
  modelsTruncated: boolean;
};

const VERDICTS: RobotFitVerdict[] = ["fits", "fits_spec", "doesnt_fit", "unknown"];

export function isRobotFit(value: unknown): value is RobotFitView {
  const fit = value as Partial<RobotFitView> | null;
  if (!fit || (fit.route !== "full" && fit.route !== "geometry_only")
    || (fit.status !== "completed" && fit.status !== "not_run") || typeof fit.modelsTruncated !== "boolean"
    || !Array.isArray(fit.models) || !fit.models.every(row => typeof row?.name === "string"
      && typeof row.manufacturer === "string" && VERDICTS.includes(row.verdict)
      && Array.isArray(row.openChecks) && row.openChecks.every(check => typeof check === "string"))) return false;
  if (fit.status === "not_run") return typeof fit.reason === "string";
  const counts = fit.counts;
  return Boolean(counts) && [counts!.fits, counts!.fitsSpec, counts!.doesntFit, counts!.unknown]
    .every(count => Number.isInteger(count) && count >= 0);
}

const GROUPS: Record<RobotFitVerdict, string> = {
  fits: "Fit, with an arm path checked in your scene",
  fits_spec: "Fit on paper",
  doesnt_fit: "Ruled out",
  unknown: "Need more information",
};

const CHECKS: Record<string, string> = {
  stance: "space to stand", reach: "reach", payload: "lifting capacity", cycle_time: "speed",
  access: "path from the entrance",
};

const NOT_RUN: Record<string, string> = {
  preparation_blocked: "Blueprint could not check robot fit yet: the scene is missing a measurement the check needs.",
  task_strategy_not_modelled: "The robot fit check covers picking up and placing one object so far. This task is a different kind.",
  subject_not_excised: "Blueprint could not separate the object from the rest of your scene, so robot fit was not checked.",
  task_family_not_modelled: "The robot fit check covers moving one object so far. This task is a different kind.",
};

function openText(checks: string[]): string {
  return checks.length ? `Open: ${checks.map(check => CHECKS[check] ?? check.replace(/_/g, " ")).join(", ")}` : "";
}

/** Which catalog robots fit the job by spec sheet. An estimate from published figures and the
 * scene sized from video: never a physical test or a promise that a robot can do the job. */
export function RobotFit({ fit }: { fit: RobotFitView }) {
  if (fit.status === "not_run") {
    return <section aria-label="Robot fit">
      <h2>Robot fit</h2>
      <p className="ms-field-hint">{NOT_RUN[fit.reason ?? ""] ?? "Blueprint could not check robot fit for this job."}</p>
    </section>;
  }
  const counts = fit.counts!;
  const total = counts.fits + counts.fitsSpec + counts.doesntFit + counts.unknown;
  const group = (verdict: RobotFitVerdict, open: boolean) => {
    const rows = fit.models.filter(row => row.verdict === verdict);
    if (!rows.length) return null;
    const list = <ul style={{ margin: "6px 0 12px", paddingLeft: "20px" }}>
      {rows.map(row => <li key={`${row.manufacturer}:${row.name}`}>
        {row.name} <span className="ms-field-hint">({row.manufacturer})</span>
        {row.openChecks.length > 0 && <span className="ms-field-hint"> · {openText(row.openChecks)}</span>}
      </li>)}
    </ul>;
    return open
      ? <div key={verdict}><h3 style={{ fontSize: "16px", margin: "12px 0 0" }}>{GROUPS[verdict]} ({rows.length})</h3>{list}</div>
      : <details key={verdict}><summary>{GROUPS[verdict]} ({rows.length})</summary>{list}</details>;
  };
  return <section aria-label="Robot fit">
    <h2>Robots that may fit this job</h2>
    <p className="ms-field-hint">An estimate from published robot specs and your scene, sized from your video. It is not a
      physical test: no robot has been tried on this job for this result.</p>
    <p>{counts.fits + counts.fitsSpec} of {total} robots checked fit on paper, {counts.doesntFit} {counts.doesntFit === 1
      ? "is" : "are"} ruled out and {counts.unknown} need more information.</p>
    {group("fits", true)}
    {group("fits_spec", true)}
    {group("doesnt_fit", false)}
    {group("unknown", false)}
    {fit.modelsTruncated && <p className="ms-field-hint">More robots were checked than are listed here.</p>}
  </section>;
}
