import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/evaluationPricing";
import { TaskClarification } from "./TaskClarification";

type JobDecision = { recommendation: string; why: string; decisiveUncertainty: string; nextAction: string; question?: { text: string; reason: string } | null };

type Recommendation = {
  id: string;
  teamName: string;
  purpose: string;
  siteProvides: string;
  teamProvides: string;
  pilotCost: string;
  window: string;
  uncertainties?: string;
  alternative?: string;
  successCondition?: string; exclusions?: string; costBasis?: string;
  sitePreparation?: string; humanWork?: string; capabilityBasis?: string;
  providerCommitment?: string; reviewRequired?: boolean;
  evidence?: EvaluationEvidence | null;
};

/** The site's view of the evaluation the recommendation stands on (server: projectEvidenceForSite). */
type EvaluationEvidence = {
  episodesRun: number; episodesSucceeded: number; successRate: number;
  passMarkSuccessRate: number; passMarkSource: "job_terms" | "site_task_brief" | "blueprint_default";
  cycleTimeTargetSeconds: number | null; medianCycleSeconds: number | null; cycleTimeMet: boolean | null;
  evaluatedAtIso: string; evidenceScope: "development_only" | "simulation"; boundary: string; resultUrl: string | null;
};

const BETA_FREE = "Blueprint charges nothing during the beta; the pilot's cost is agreed with the robot team.";
const percent = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

function EvidenceLine({ teamName, evidence }: { teamName: string; evidence: EvaluationEvidence }) {
  const mark = evidence.passMarkSource === "blueprint_default"
    ? `Blueprint's pass mark of ${percent(evidence.passMarkSuccessRate)}`
    : `your pass mark of ${percent(evidence.passMarkSuccessRate)}`;
  return <>
    <p>{teamName} evaluated your job: {evidence.episodesSucceeded} of {evidence.episodesRun} simulated episodes succeeded ({percent(evidence.successRate)}), meeting {mark}.</p>
    <p className="ms-field-hint">Simulation estimate — the physical pilot measures the real result. It does not certify physical performance or safety.</p>
    {evidence.resultUrl && <p><a className="ms-text-link" href={evidence.resultUrl}>See the evaluation results</a></p>}
  </>;
}

/**
 * One concrete pilot proposal, followed by truthful coordination status.
 * Renders nothing until Blueprint has made a recommendation.
 */
export function RecommendedPilot({ token }: { token: string }) {
  return <RecommendedPilotForToken key={token} token={token} />;
}

function RecommendedPilotForToken({ token }: { token: string }) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [decision, setDecision] = useState<JobDecision | null>(null);
  const [booked, setBooked] = useState(false);
  const [coordination, setCoordination] = useState<{ state: string; nextAction: string; startsAt?: string; sitePreparation?: string; feeUsd?: number; commercialBasis?: string } | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [state, setState] = useState<"idle" | "booking" | "error">("idle");
  const [message, setMessage] = useState("");
  const bookingInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/task-listings/owner/${encodeURIComponent(token)}`).then(async r => {
      if (!r.ok) return;
      const { recommendation: saved, booking, coordination: progress, decision: reviewedDecision } = await r.json();
      if (!active) return;
      setRecommendation(saved ?? null);
      setDecision(reviewedDecision ?? null);
      setCoordination(progress ?? null);
      setBooked(Boolean(saved && booking?.recommendationId === saved.id));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [token]);

  async function book(event: React.FormEvent) {
    event.preventDefault();
    if (!recommendation || !authorized || bookingInFlight.current || booked) return;
    bookingInFlight.current = true;
    setState("booking");
    try {
      const r = await fetch(`/api/task-listings/owner/${encodeURIComponent(token)}/book`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: recommendation.id, authorized: true }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || body?.ok !== true) {
        setMessage(body?.error ?? "We could not confirm acceptance. Reopen your job page to check its status before trying again, or email hello@tryblueprint.io.");
        setState("error");
        return;
      }
      setBooked(true);
      setCoordination(body.coordination ?? { state: "awaiting_coordination", nextAction: "Blueprint must confirm provider and site agreement, the date and preparation responsibilities. No date is reserved yet." });
      setState("idle");
    } catch {
      setMessage("We could not confirm acceptance. Reopen your job page to check its status before trying again, or email hello@tryblueprint.io.");
      setState("error");
    } finally {
      bookingInFlight.current = false;
    }
  }

  if (!recommendation && !decision) return null;
  const decisionSummary = decision ? <section className="ms-task-interest" aria-labelledby="job-decision-title">
    <h2 id="job-decision-title">Our recommendation</h2>
    <p>{decision.recommendation}</p>
    <dl><dt>Why</dt><dd>{decision.why}</dd>
      {decision.decisiveUncertainty && <><dt>What still changes the decision</dt><dd>{decision.decisiveUncertainty}</dd></>}
      <dt>Blueprint's next action</dt><dd>{decision.nextAction}</dd></dl>
    {decision.question && <TaskClarification token={token} />}
  </section> : null;
  if (!recommendation) return decisionSummary;
  return (
    <>{decisionSummary}<section className="ms-task-interest" aria-labelledby="recommended-pilot-title">
      <h2 id="recommended-pilot-title">Your recommended pilot</h2>
      <dl>
        <dt>Robot team</dt><dd>{recommendation.teamName}</dd>
        <dt>What the pilot tests</dt><dd>{recommendation.purpose}</dd>
        <dt>Measurable success condition</dt><dd>{recommendation.successCondition || "Not yet recorded — agree the pass condition before a physical commitment."}</dd>
        <dt>Scope exclusions</dt><dd>{recommendation.exclusions || "Not yet agreed."}</dd>
        <dt>Evaluation evidence</dt><dd>{recommendation.evidence
          ? <EvidenceLine teamName={recommendation.teamName} evidence={recommendation.evidence} />
          : recommendation.capabilityBasis || "No demonstrated capability evidence is recorded here; this is a proposed fit to test."}</dd>
        <dt>Provider commitment</dt><dd>{coordination?.state === "scheduled" ? "Provider and site agreement recorded for the confirmed date and scope." : recommendation.providerCommitment || "Proposed team; availability and commitment are not yet confirmed."}</dd>
        <dt>What you provide</dt><dd>{recommendation.siteProvides}</dd>
        <dt>What the robot team provides</dt><dd>{recommendation.teamProvides}</dd>
        <dt>Pilot cost</dt><dd>{recommendation.pilotCost}, paid to the robot team</dd>
        <dt>Cost basis</dt><dd>{recommendation.costBasis || "Provisional — confirm the provider quote and applicable agreement."}</dd>
        <dt>Proposed timing</dt><dd>{recommendation.window} {coordination?.state === "scheduled" ? "(original proposal window; confirmed date below)" : "(not a reserved date)"}</dd>
        <dt>Site preparation</dt><dd>{recommendation.sitePreparation || "Responsibilities still need agreement."}</dd>
        <dt>Human work still needed</dt><dd>{recommendation.humanWork || "Provider/site coordination, safety review and installation authority remain to be confirmed."}</dd>
        {recommendation.uncertainties ? <><dt>Still uncertain</dt><dd>{recommendation.uncertainties}</dd></> : null}
        {recommendation.alternative ? <><dt>Alternative</dt><dd>{recommendation.alternative}</dd></> : null}
      </dl>
      {recommendation.reviewRequired && <p role="alert">The job changed. Blueprint must review this proposal against the new brief before any new commitment.</p>}
      {booked ? (
        <div role="status"><p>{coordination?.state === "scheduled" ? `Scheduled: ${new Date(coordination.startsAt!).toLocaleString()}.` : "Proposal accepted · awaiting coordination."}</p>
          <p>{coordination?.nextAction || "Blueprint must confirm provider and site agreement, date and preparation responsibilities. No date is reserved yet."}</p>
          {coordination?.sitePreparation && <p>{coordination.sitePreparation}</p>}
          <p>{coordination?.feeUsd === 0 ? BETA_FREE : typeof coordination?.feeUsd === "number" ? `Previously agreed Blueprint fee: ${formatPrice(coordination.feeUsd)}, due when the pilot is booked. Your accepted terms remain on file.` : "Your previously accepted commercial terms remain on file; this page has no verified price to display."}</p>
        </div>
      ) : (
        <form className="ms-form" onSubmit={book}>
          <label className="ms-check-row">
            <input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} required />
            I am authorized to accept this proposal for my site. {BETA_FREE}
          </label>
          <button className="ms-button" disabled={state === "booking" || recommendation.reviewRequired}>
            {state === "booking" ? "Recording acceptance…" : "Accept proposal · coordinate dates"}
          </button>
          <p className="ms-field-hint">Acceptance records your decision on this proposal. A physical pilot still needs provider and site agreement, a confirmed date and agreed preparation responsibilities. New cost, scope or disclosure needs its applicable approval.</p>
          {state === "error" && <p role="alert">{message}</p>}
        </form>
      )}
    </section></>
  );
}
