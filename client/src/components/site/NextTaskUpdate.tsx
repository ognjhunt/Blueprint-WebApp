/**
 * How the site hears from us: by email, each time something happens.
 *
 * This used to promise a "next status update by" time, backed by a timed
 * check-in email. That check-in is retired -- every real event on the task
 * now sends its own email -- so there is no deadline to show. The prop stays
 * so callers need not change; any stale value is ignored.
 */
export function NextTaskUpdate(_props: { nextUpdateIso?: string | null }) {
  return (
    <p className="ms-field-hint" style={{ margin: "8px 0 0" }}>
      We email you each time something happens on this task. You do not need to check back.
    </p>
  );
}
