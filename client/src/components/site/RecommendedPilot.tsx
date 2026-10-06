import { useEffect, useRef, useState } from "react";
import { formatPrice, pilotBookingAuthorization, pilotFeeUsd } from "@/lib/evaluationPricing";

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
};

/**
 * Blueprint's one recommended pilot, and the site's one decision: book it.
 * Renders nothing until Blueprint has made a recommendation.
 */
export function RecommendedPilot({ token }: { token: string }) {
  return <RecommendedPilotForToken key={token} token={token} />;
}

function RecommendedPilotForToken({ token }: { token: string }) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [booked, setBooked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [state, setState] = useState<"idle" | "booking" | "error">("idle");
  const [message, setMessage] = useState("");
  const bookingInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/task-listings/owner/${encodeURIComponent(token)}`).then(async r => {
      if (!r.ok) return;
      const { recommendation: saved, booking } = await r.json();
      if (!active) return;
      setRecommendation(saved ?? null);
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
        setMessage(body?.error ?? "We could not confirm the booking. Reopen your job page to check its status before trying again, or email hello@tryblueprint.io.");
        setState("error");
        return;
      }
      setBooked(true);
      setState("idle");
    } catch {
      setMessage("We could not confirm the booking. Reopen your job page to check its status before trying again, or email hello@tryblueprint.io.");
      setState("error");
    } finally {
      bookingInFlight.current = false;
    }
  }

  if (!recommendation) return null;
  return (
    <section className="ms-task-interest" aria-labelledby="recommended-pilot-title">
      <h2 id="recommended-pilot-title">Your recommended pilot</h2>
      <dl>
        <dt>Robot team</dt><dd>{recommendation.teamName}</dd>
        <dt>What the pilot tests</dt><dd>{recommendation.purpose}</dd>
        <dt>What you provide</dt><dd>{recommendation.siteProvides}</dd>
        <dt>What the robot team provides</dt><dd>{recommendation.teamProvides}</dd>
        <dt>Pilot cost</dt><dd>{recommendation.pilotCost}, paid to the robot team</dd>
        <dt>When</dt><dd>{recommendation.window}</dd>
        {recommendation.uncertainties ? <><dt>Still uncertain</dt><dd>{recommendation.uncertainties}</dd></> : null}
        {recommendation.alternative ? <><dt>Alternative</dt><dd>{recommendation.alternative}</dd></> : null}
      </dl>
      {booked ? (
        <p role="status">Booked. We coordinate the team, dates and site visit from here.</p>
      ) : (
        <form className="ms-form" onSubmit={book}>
          <label className="ms-check-row">
            <input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} required />
            {pilotBookingAuthorization}
          </label>
          <button className="ms-button" disabled={state === "booking"}>
            {state === "booking" ? "Booking…" : `Book this pilot · ${formatPrice(pilotFeeUsd)} Blueprint fee`}
          </button>
          <p className="ms-field-hint">Not right? Reply to our email and tell us why. Nothing is booked until you click.</p>
          {state === "error" && <p role="alert">{message}</p>}
        </form>
      )}
    </section>
  );
}
