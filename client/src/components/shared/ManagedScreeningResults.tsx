import { PolicyScreeningCandidates } from "@/components/shared/PolicyScreeningCandidates";
import type { JobManagedEvidenceSummary } from "@/types/jobMarketplace";

/** The screenings of a job that are current, unless a corrected object selection superseded them. */
export function currentScreenings(evidence: JobManagedEvidenceSummary[] | undefined, superseded = false) {
  return superseded ? [] : (evidence ?? []).filter(item => item.current && item.screening);
}

/**
 * Blueprint's current screening results for a job, said the same way on its
 * job page and in the signed-in workspace.
 */
export function ManagedScreeningResults({ evidence, superseded = false, className }: {
  evidence: JobManagedEvidenceSummary[] | undefined;
  superseded?: boolean;
  className?: string;
}) {
  return <>{currentScreenings(evidence, superseded).map(item => <section
    key={item.runId} className={className} aria-label="Simulation results for your job">
    {/* Only an estimate is called one: scripted reference baselines alone are not (F-03). */}
    <h3>{item.outcome === "estimate" ? "Your simulation estimate" : "Simulation evaluation"}</h3>
    <p>{item.summary}</p>
    <PolicyScreeningCandidates screening={item.screening!} />
    {item.limitations.map((limit, index) => <p className="ms-field-hint" key={index}>{limit}</p>)}
  </section>)}</>;
}
