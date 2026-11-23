/**
 * The job page no longer says "Blueprint will update this job as the work progresses." (ledger AL31): the job's own
 * headline already says where things stand. Nothing renders this any more; the file stays because the public-claims
 * guard reads it by name.
 */
export function NextTaskUpdate(_props: { nextUpdateIso?: string | null }) {
  return null;
}
