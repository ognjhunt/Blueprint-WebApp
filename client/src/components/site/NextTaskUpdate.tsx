export function NextTaskUpdate({ nextUpdateIso }: { nextUpdateIso?: string | null }) {
  if (!nextUpdateIso || !Number.isFinite(Date.parse(nextUpdateIso))) return <p className="ms-field-hint">The next update time has not been scheduled. <a href="mailto:ops@tryblueprint.io">Contact Blueprint</a>.</p>;
  const overdue = Date.parse(nextUpdateIso) < Date.now();
  return <p className="ms-field-hint" style={{ margin: "8px 0 0" }}>
    {overdue ? "Update overdue — it was due " : "Next status update by "}
    <time dateTime={nextUpdateIso}>{new Date(nextUpdateIso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>.
    {overdue ? <> <a href="mailto:ops@tryblueprint.io">Contact Blueprint</a>.</> : " This is an update time, not a result deadline."}
  </p>;
}
