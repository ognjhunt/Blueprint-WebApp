/** Current progress is available on the job page; the existing prop stays compatible. */
export function NextTaskUpdate(_props: { nextUpdateIso?: string | null }) {
  return (
    <p className="ms-field-hint" style={{ margin: "8px 0 0" }}>
      Updates appear on this job page. Return here to check progress.
    </p>
  );
}
