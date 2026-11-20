import type { TaskOutcome } from "@/types/taskOutcome";

/**
 * Where the job stands, in plain words. The outcome's evidence digests and its reference are kept for the admin job
 * console only, never shown to the site. A scope line is said only when it has words (an estimate's caveat).
 */
export function TaskOutcomeNotice({ outcome, showTitle = true }: { outcome?: TaskOutcome | null; showTitle?: boolean }) {
  if (!outcome) return null;
  return <section aria-label="Where your job stands" className="ws-task-outcome">
    {showTitle && <h3>{outcome.title}</h3>}
    <p>{outcome.reason}</p>
    {outcome.scope.trim() && <p>{outcome.scope}</p>}
    {outcome.actionOwner === "site" ? <p><strong>Next:</strong> {outcome.nextStep}</p> : <p>{outcome.nextStep}</p>}
  </section>;
}
