import type { TaskOutcome } from "@/types/taskOutcome";

export function TaskOutcomeNotice({ outcome, showTitle = true }: { outcome?: TaskOutcome | null; showTitle?: boolean }) {
  if (!outcome) return null;
  return <section aria-label="Preparation outcome" className="ws-task-outcome">
    {showTitle && <h3>{outcome.title}</h3>}
    <p>{outcome.reason}</p>
    <p>{outcome.scope}</p>
    <p><strong>Next step — {outcome.actionOwner === "blueprint" ? "Blueprint" : "you"}:</strong> {outcome.nextStep}</p>
    {(outcome.evidence.length > 0 || outcome.reference) && <details><summary>Evidence references</summary>
      {outcome.reference && <p>Reference: {outcome.reference}</p>}
      <ul>{outcome.evidence.map(item => <li key={`${item.label}-${item.digest}`}>
        {item.label}: <code style={{ overflowWrap: "anywhere" }}>{item.digest}</code>
      </li>)}</ul>
    </details>}
  </section>;
}
