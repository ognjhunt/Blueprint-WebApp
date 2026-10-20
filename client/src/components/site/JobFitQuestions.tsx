import { qualifyingConditions } from "@/data/qualifyingEnvironments";

/**
 * Blueprint's four screening questions, as a site reads them. They are our own
 * criteria, not a third-party standard, so the full version states each with
 * the failure mode that follows when it does not hold.
 */
export function JobFitQuestions({ withFailureModes = false }: { withFailureModes?: boolean }) {
  return (
    <ol className={`ms-fit-list${withFailureModes ? " ms-fit-list-full" : ""}`}>
      {qualifyingConditions.map((condition) => (
        <li key={condition.id}>
          <p className="ms-fit-name">{condition.name}</p>
          <p className="ms-fit-test">{condition.test}</p>
          {withFailureModes && <p className="ms-fit-failure"><span>If not:</span> {condition.failure}</p>}
        </li>
      ))}
    </ol>
  );
}
