import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/evaluationPricing";
import { TaskClarification } from "./TaskClarification";
import { PilotBookingDetails } from "./PilotBookingDetails";
import type { PilotBookingView } from "@/types/workspace";

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
  /** The task the simulation scored, in plain words; null when not recorded. */
  scoredTask?: string | null;
};

/** The site's view of the evaluation the recommendation stands on (server: projectEvidenceForSite). */
type EvaluationEvidence = {
  episodesRun: number; episodesSucceeded: number; successRate: number;
  passMarkSuccessRate: number; passMarkSource: "job_terms" | "site_task_brief" | "blueprint_default";
  cycleTimeTargetSeconds: number | null; medianCycleSeconds: number | null; cycleTimeMet: boolean | null;
  evaluatedAtIso: string; evidenceScope: "development_only" | "simulation"; boundary: string; resultUrl: string | null;
  episodeAccounting?: { planned: number; reported: number; scored: number; succeeded: number; failed: number; void: number };
  uncertainty?: { method: "wilson_two_sided_95"; lower: number; upper: number; boundary: string };
};

const BETA_FREE = "Blueprint charges nothing during the beta. Agree the pilot price and terms with the delivery team before work starts.";
const DIRECT_AGREEMENT = "You and the delivery team must agree the scope, price, dates and support directly. No date or delivery contract is confirmed by this selection.";
const percent = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

function EvidenceLine({ teamName, evidence }: { teamName: string; evidence: EvaluationEvidence }) {
  const mark = evidence.passMarkSource === "blueprint_default"
    ? `Blueprint's pass mark of ${percent(evidence.passMarkSuccessRate)}`
    : `your pass mark of ${percent(evidence.passMarkSuccessRate)}`;
  return <>
    <p>{teamName} evaluated your job: {evidence.episodesSucceeded} of {evidence.episodesRun} simulated episodes succeeded ({percent(evidence.successRate)}), meeting {mark}.</p>
    {evidence.episodeAccounting && <p className="ms-field-hint">{evidence.episodeAccounting.planned} prescribed episodes: {evidence.episodeAccounting.scored} scored ({evidence.episodeAccounting.succeeded} successes, {evidence.episodeAccounting.failed} failures), {evidence.episodeAccounting.void} void and excluded from the success-rate denominator.</p>}
    {evidence.uncertainty && <p className="ms-field-hint">95% Wilson interval: {percent(evidence.uncertainty.lower)}–{percent(evidence.uncertainty.upper)}. The pass mark uses the observed success rate. {evidence.uncertainty.boundary}</p>}
    {evidence.cycleTimeTargetSeconds !== null && <>
      <p>Simulated median cycle: {evidence.medianCycleSeconds}s; target: at most {evidence.cycleTimeTargetSeconds}s.</p>
      <p className="ms-field-hint">Includes settling in the simulator; excludes policy-service latency. The physical pilot measures actual throughput.</p>
    </>}
    <p className="ms-field-hint">Simulation estimate — the physical pilot measures the real result. It does not certify physical performance or safety.</p>
    {evidence.resultUrl && <p><a className="ms-text-link" href={evidence.resultUrl}>See the evaluation results</a></p>}
  </>;
}

/**
 * One concrete pilot proposal, followed by truthful coordination status.
 * Renders nothing until Blueprint has made a recommendation.
 */
export function RecommendedPilot({ token, bookedOnly = false }: { token: string; bookedOnly?: boolean }) {
  return <RecommendedPilotForToken key={token} token={token} bookedOnly={bookedOnly} />;
}

function RecommendedPilotForToken({ token, bookedOnly }: { token: string; bookedOnly: boolean }) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [decision, setDecision] = useState<JobDecision | null>(null);
  const [booked, setBooked] = useState(false);
  const [pilotBooking, setPilotBooking] = useState<PilotBookingView | null>(null);
  const [coordination, setCoordination] = useState<{ state: string; nextAction: string; startsAt?: string; sitePreparation?: string; feeUsd?: number; commercialBasis?: string } | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [state, setState] = useState<"idle" | "booking" | "error">("idle");
  const [message, setMessage] = useState("");
  const bookingInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/task-listings/owner/${encodeURIComponent(token)}`).then(async r => {
      if (!r.ok) return;
      const { recommendation: saved, booking, coordination: progress, decision: reviewedDecision, pilotBooking: bookedView } = await r.json();
      if (!active) return;
      setRecommendation(saved ?? null);
      setDecision(reviewedDecision ?? null);
      setCoordination(progress ?? null);
      setBooked(Boolean(saved && booking?.recommendationId === saved.id));
      setPilotBooking(bookedView ?? null);
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
      setCoordination(body.coordination ?? { state: "awaiting_coordination", nextAction: DIRECT_AGREEMENT });
      setPilotBooking(body.pilotBooking ?? null);
      setState("idle");
    } catch {
      setMessage("We could not confirm acceptance. Reopen your job page to check its status before trying again, or email hello@tryblueprint.io.");
      setState("error");
    } finally {
      bookingInFlight.current = false;
    }
  }

  if (bookedOnly && !booked) return null;
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
      <h2 id="recommended-pilot-title">Evaluation-backed pilot proposal</h2>
      <dl>
        <dt>Delivery team</dt><dd>{recommendation.teamName}</dd>
        <dt>What the pilot tests</dt><dd>{recommendation.purpose}</dd>
        <dt>What the simulation tested</dt><dd>
          <p>{recommendation.scoredTask ? `${recommendation.scoredTask}.` : "Not recorded. Ask Blueprint what the simulation tested before you choose this proposal."}</p>
          <p className="ms-field-hint">This is the task the simulation scored. It can be narrower than your job; compare the two before you choose this proposal.</p>
        </dd>
        <dt>Measurable success condition</dt><dd>{recommendation.successCondition || "Not yet recorded — agree the pass condition before a physical commitment."}</dd>
        <dt>Scope exclusions</dt><dd>{recommendation.exclusions || "Not yet agreed."}</dd>
        <dt>Evaluation evidence</dt><dd>{recommendation.evidence
          ? <EvidenceLine teamName={recommendation.teamName} evidence={recommendation.evidence} />
          : recommendation.capabilityBasis || "No demonstrated capability evidence is recorded here; this is a proposed fit to test."}</dd>
        <dt>Provider commitment</dt><dd>{coordination?.state === "scheduled" ? "Provider and site agreement recorded for the confirmed date and scope." : recommendation.providerCommitment || "Proposed team; availability and commitment are not yet confirmed."}</dd>
        <dt>What you provide</dt><dd>{recommendation.siteProvides}</dd>
        <dt>Equipment and work the team provides</dt><dd>{recommendation.teamProvides}</dd>
        <dt>Pilot cost</dt><dd>{recommendation.pilotCost}, paid to the delivery team under your agreement</dd>
        <dt>Cost basis</dt><dd>{recommendation.costBasis || "Provisional — confirm the provider quote and applicable agreement."}</dd>
        <dt>Proposed timing</dt><dd>{recommendation.window} {coordination?.state === "scheduled" ? "(original proposal window; confirmed date below)" : "(not a reserved date)"}</dd>
        <dt>Site preparation</dt><dd>{recommendation.sitePreparation || "Responsibilities still need agreement."}</dd>
        <dt>Human work still needed</dt><dd>{recommendation.humanWork || "Provider/site coordination, safety review and installation authority remain to be confirmed."}</dd>
        {recommendation.uncertainties ? <><dt>Still uncertain</dt><dd>{recommendation.uncertainties}</dd></> : null}
        {recommendation.alternative ? <><dt>Alternative</dt><dd>{recommendation.alternative}</dd></> : null}
      </dl>
      {recommendation.reviewRequired && <p role="alert">The job changed. Blueprint must review this proposal against the new brief before any new commitment.</p>}
      {booked ? (
        <div role="status"><p>{coordination?.state === "scheduled" ? `Scheduled: ${new Date(coordination.startsAt!).toLocaleString()}.` : "Team selected · pilot terms still need agreement."}</p>
          <p>{coordination?.nextAction || DIRECT_AGREEMENT}</p>
          {pilotBooking && <PilotBookingDetails booking={pilotBooking} other="robot team" showAgreement={false} />}
          {coordination?.sitePreparation && <p>{coordination.sitePreparation}</p>}
          <p>{coordination?.feeUsd === 0 ? BETA_FREE : typeof coordination?.feeUsd === "number" ? `Previously agreed Blueprint fee: ${formatPrice(coordination.feeUsd)}, due when the pilot is booked. Your accepted terms remain on file.` : "No Blueprint price is recorded here. Your existing accepted terms remain on file."}</p>
        </div>
      ) : (
        <form className="ms-form" onSubmit={book}>
          <label className="ms-check-row">
            <input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} required />
            I am authorized to choose this team for pilot discussions. This selection does not sign a delivery contract. {BETA_FREE}
          </label>
          <button className="ms-button" disabled={state === "booking" || recommendation.reviewRequired}>
            {state === "booking" ? "Saving your choice…" : "Choose this pilot proposal"}
          </button>
          <p className="ms-field-hint">Choosing this proposal shares your name, company and email with the delivery team, and gives you its contact. Agree scope, price, dates, preparation and support with the team before signing or starting work. Blueprint takes no cut during the beta.</p>
          {state === "error" && <p role="alert">{message}</p>}
        </form>
      )}
    </section></>
  );
}
