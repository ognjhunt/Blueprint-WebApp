import { useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import { BareButton } from "@/components/bare/Bare";
import { INTRODUCTION_REQUEST_STATEMENT_VERSION, introduceSentence, isIntroductionStatementVersion } from "@/lib/siteIntroductions";
import {
  PILOT_CONFIRMED_PENDING, PILOT_OFFERS_HEADING, PILOT_OFFERS_LEAD, PILOT_OFFERS_NONE, PILOT_OFFERS_NOT_CHECKED,
  PILOT_QUESTION_LINE, PILOT_REFUSED_LINE, PILOT_REQUEST_FAILED, PILOT_REQUEST_REFUSAL_SENTENCES, REQUEST_PILOT_LABEL,
  isPilotRequestRefusal, pilotConfirmedLine, pilotDeclinedLine, pilotRequestedLine, pilotTermsLines, pilotUnknownLine,
  type SitePilotOffer, type SitePilotOffers,
} from "@/lib/pilotOffers";
import { PilotSheet } from "@/components/site/PilotSheet";

/** Where one request stands, in one line. */
function requestLine(offer: SitePilotOffer): string | null {
  const request = offer.request;
  if (!request) return null;
  switch (request.state) {
    case "requested": return pilotRequestedLine(request.requestedAtIso);
    case "question": return PILOT_QUESTION_LINE;
    case "declined": return pilotDeclinedLine(request.reason);
    case "confirmed": return request.introducedAtIso ? pilotConfirmedLine(request.introducedAtIso) : PILOT_CONFIRMED_PENDING;
    case "refused": return PILOT_REFUSED_LINE;
  }
}

/**
 * "Pilot offers that fit your job" (owner, 2026-11-28), above Applicants on the site's job page, once the job is listed
 * for companies. Each offer shows the company's name and website and the offer's terms, the facts the match could not
 * check, and one button. The sentence under the button is the introduction sentence true for this job, word for word
 * (`introduceSentence`): if the company confirms, that is what is given. The press records its version.
 */
export function PilotOffers({ token, pilot, onChanged }: { token: string; pilot: SitePilotOffers; onChanged?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requested, setRequested] = useState<Record<string, string>>({});
  const [statementOverride, setStatementOverride] = useState<string | null>(null);
  const shown = isIntroductionStatementVersion(pilot.introductionStatementVersion) ? pilot.introductionStatementVersion
    : INTRODUCTION_REQUEST_STATEMENT_VERSION;
  const statementVersion = statementOverride ?? shown;
  async function request(offerRef: string) {
    if (busy) return;
    setBusy(offerRef); setErrors(current => ({ ...current, [offerRef]: "" }));
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/pilot-requests`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }), referrerPolicy: "no-referrer",
        // The version of the sentence shown under the button: pressing it is the agreement that sentence records.
        body: JSON.stringify({ offerRef, statementVersion }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        setErrors(current => ({ ...current, [offerRef]: isPilotRequestRefusal(result?.reason)
          ? PILOT_REQUEST_REFUSAL_SENTENCES[result.reason as keyof typeof PILOT_REQUEST_REFUSAL_SENTENCES] : PILOT_REQUEST_FAILED }));
        if (result?.reason === "statement_not_current" && isIntroductionStatementVersion(result?.statementVersion))
          setStatementOverride(result.statementVersion);
        if (response.status === 409) onChanged?.();
        return;
      }
      setRequested(current => ({ ...current, [offerRef]: String(result.requestedAtIso ?? new Date().toISOString()) }));
      onChanged?.();
    } catch { setErrors(current => ({ ...current, [offerRef]: PILOT_REQUEST_FAILED })); }
    finally { setBusy(null); }
  }
  return <section className="site-answer-section site-pilot-offers" aria-labelledby="site-job-pilot-offers">
    <h2 id="site-job-pilot-offers">{PILOT_OFFERS_HEADING}</h2>
    {pilot.offers.length === 0 ? <p className="bare-helper">{PILOT_OFFERS_NONE}</p> : <>
      <p className="bare-helper">{PILOT_OFFERS_LEAD}</p>
      <ul className="site-job-company-entries" aria-label="Pilot offers">
        {pilot.offers.map(offer => {
          const line = requestLine(offer) ?? (requested[offer.offerRef] ? pilotRequestedLine(requested[offer.offerRef]) : null);
          const unknown = offer.unknown.map(fact => pilotUnknownLine(fact, offer.offer, offer.weightPartly === true))
            .filter((text): text is string => Boolean(text));
          return <li key={offer.offerRef}>
            <div className="site-company-response-title"><h3>{offer.company.name}</h3></div>
            {offer.company.website && <p className="site-company-website">
              <a className="ms-text-link" href={offer.company.website} target="_blank" rel="noreferrer noopener">{offer.company.website}</a></p>}
            <ul className="site-pilot-terms" aria-label={`${offer.company.name}'s pilot terms`}>
              {pilotTermsLines(offer.offer.terms).map(text => <li key={text}>{text}</li>)}
            </ul>
            {unknown.map(text => <p key={text} className="bare-helper">{text}</p>)}
            {line ? <p className="bare-helper" role="status">{line}</p>
              : <BareButton onClick={() => void request(offer.offerRef)} disabled={busy !== null}
                helper={introduceSentence(offer.company.name, statementVersion)}>
                {busy === offer.offerRef ? "Asking…" : REQUEST_PILOT_LABEL}</BareButton>}
            {offer.request?.sheet && <PilotSheet sheet={offer.request.sheet} />}
            {errors[offer.offerRef] && <p role="alert">{errors[offer.offerRef]}</p>}
          </li>;
        })}
      </ul>
      <p className="bare-helper">{PILOT_OFFERS_NOT_CHECKED}</p>
    </>}
  </section>;
}

export default PilotOffers;
