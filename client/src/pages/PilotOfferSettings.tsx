import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import { CHARGE_MODELS, CHARGE_MODEL_LABELS, COMPANY_START_LABELS, COMPANY_START_WINDOWS, ESTIMATE_LABEL,
  type ChargeModel, type CompanyStartWindow } from "@/lib/companyResponses";
import { typedEstimate } from "@/pages/CompanyJob";
import {
  PILOT_HOURS_LIMITS, PILOT_HOURS_LIMIT_LABELS, PILOT_OFFER_FORM_HEADING, PILOT_OFFER_FORM_LEAD, PILOT_OFFER_JOB_TYPES,
  PILOT_OFFER_JOB_TYPE_LABELS, PILOT_OFFER_NONE_YET, PILOT_OFFER_PAUSED, PILOT_OFFER_PUBLISHED, PILOT_SIZE_LIMITS,
  PILOT_SIZE_LIMIT_LABELS, PILOT_WEEKS_MAX, PILOT_WEEKS_MIN, SITE_PROVIDES, SITE_PROVIDES_LABELS, US_STATE_CODES, US_STATE_NAMES,
  type OfferJobType, type PilotHoursLimit, type PilotOfferView, type PilotSizeLimit, type SiteProvides,
} from "@/lib/pilotOffers";

/** The form's own words. */
export const PILOT_FORM_SAVED = "Saved.";
export const PILOT_FORM_FAILED = "Your pilot offer could not be saved just now. Try again.";
export const PILOT_FORM_LOAD_FAILED = "Your pilot offer could not be loaded. Reload the page to try again.";
export const PILOT_FORM_PAYS_INVALID = "Enter what the site pays in US dollars, such as 1,200, with the lower amount first, or choose Nothing.";
export const PILOT_FORM_KINDS_REQUIRED = "Choose at least one kind of job you take.";
export const PILOT_FORM_STATES_REQUIRED = "Choose at least one state, or every US state.";

type Draft = {
  kinds: OfferJobType[]; maxKg: string; maxSide: PilotSizeLimit | ""; minHours: PilotHoursLimit | "";
  allStates: boolean; states: string[]; weeks: string; pays: "nothing" | "once" | "monthly"; low: string; high: string;
  siteProvides: SiteProvides[]; earliestStart: CompanyStartWindow; afterPilot: ChargeModel;
};
const EMPTY: Draft = { kinds: [], maxKg: "", maxSide: "", minHours: "", allStates: true, states: [], weeks: "4", pays: "nothing",
  low: "", high: "", siteProvides: [], earliestStart: "within_month", afterPilot: "undecided" };
function draftOf(offer: PilotOfferView | null): Draft {
  if (!offer) return EMPTY;
  const pays = offer.terms.sitePays;
  return { kinds: offer.kinds, maxKg: offer.limits.maxKg === null ? "" : String(offer.limits.maxKg), maxSide: offer.limits.maxSide ?? "",
    minHours: offer.limits.minHours ?? "", allStates: offer.limits.states === "all_us",
    states: offer.limits.states === "all_us" ? [] : offer.limits.states, weeks: String(offer.terms.weeks), pays: pays.kind,
    low: pays.kind === "nothing" ? "" : String(pays.low), high: pays.kind === "nothing" ? "" : String(pays.high),
    siteProvides: offer.terms.siteProvides, earliestStart: offer.terms.earliestStart, afterPilot: offer.terms.afterPilot };
}
const toggled = <T,>(list: T[], item: T) => list.includes(item) ? list.filter(entry => entry !== item) : [...list, item];

/**
 * "Your pilot offer" (owner, 2026-11-28), from the company's Settings: one standing offer, published, edited or paused.
 * Closed choices and numbers only. The statement under the buttons is recorded with the offer.
 */
export default function PilotOfferSettings() {
  const { currentUser } = useAuth();
  const [state, setState] = useState<"loading" | "ready" | "error" | "refused">("loading");
  const [refusal, setRefusal] = useState("");
  const [offer, setOffer] = useState<PilotOfferView | null>(null);
  const [statement, setStatement] = useState<{ version: string; text: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    (async () => {
      const response = await fetch("/api/site-worlds/pilot-offer", { headers: await withFirebaseAuthHeaders(currentUser) });
      const body = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok) { setRefusal(typeof body?.error === "string" ? body.error : PILOT_FORM_LOAD_FAILED); setState("refused"); return; }
      setOffer(body?.offer ?? null); setDraft(draftOf(body?.offer ?? null)); setStatement(body?.statement ?? null); setState("ready");
    })().catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [currentUser?.uid]);

  async function save(published: boolean) {
    if (!currentUser || !statement || saving) return;
    if (!draft.kinds.length) { setMessage(PILOT_FORM_KINDS_REQUIRED); return; }
    if (!draft.allStates && !draft.states.length) { setMessage(PILOT_FORM_STATES_REQUIRED); return; }
    const range = draft.pays === "nothing" ? null : typedEstimate(draft.pays === "once" ? "purchase" : "subscription", draft.low, draft.high);
    if (draft.pays !== "nothing" && (range === null || range === "invalid")) { setMessage(PILOT_FORM_PAYS_INVALID); return; }
    const sitePays = draft.pays === "nothing" || !range || range === "invalid" ? { kind: "nothing" as const }
      : { kind: draft.pays, low: range.lowUsd, high: range.highUsd };
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/site-worlds/pilot-offer", { method: "PUT", credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ published, kinds: draft.kinds,
          limits: { maxKg: draft.maxKg.trim() ? Number(draft.maxKg) : null, maxSide: draft.maxSide || null,
            minHours: draft.minHours || null, states: draft.allStates ? "all_us" : draft.states },
          terms: { weeks: Number(draft.weeks), sitePays, siteProvides: draft.siteProvides, earliestStart: draft.earliestStart,
            afterPilot: draft.afterPilot },
          statementVersion: statement.version }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.ok !== true) { setMessage(typeof body?.error === "string" ? body.error : PILOT_FORM_FAILED); return; }
      setOffer(body.offer); setDraft(draftOf(body.offer)); setMessage(PILOT_FORM_SAVED);
    } catch { setMessage(PILOT_FORM_FAILED); }
    finally { setSaving(false); }
  }
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void save(true); };
  const set = (change: Partial<Draft>) => { setDraft(current => ({ ...current, ...change })); setMessage(""); };

  return <AppShell active="settings" breadcrumb={PILOT_OFFER_FORM_HEADING}>
    <h1>{PILOT_OFFER_FORM_HEADING}</h1>
    <p className="ws-note"><Link className="ws-link" href="/settings">← Settings</Link></p>
    {state === "loading" && <p role="status">Loading…</p>}
    {state === "error" && <p role="alert">{PILOT_FORM_LOAD_FAILED}</p>}
    {state === "refused" && <p role="alert">{refusal}</p>}
    {state === "ready" && <>
      <p>{PILOT_OFFER_FORM_LEAD}</p>
      <p role="status">{!offer ? PILOT_OFFER_NONE_YET : offer.published ? PILOT_OFFER_PUBLISHED : PILOT_OFFER_PAUSED}</p>
      <form className="ws-form ws-section ws-pilot-offer" onSubmit={submit} aria-label={PILOT_OFFER_FORM_HEADING}>
        <fieldset className="ws-option-columns"><legend>Jobs you take</legend>
          {PILOT_OFFER_JOB_TYPES.map(kind => <label key={kind}><input type="checkbox" checked={draft.kinds.includes(kind)}
            onChange={() => set({ kinds: toggled(draft.kinds, kind) })} /> {PILOT_OFFER_JOB_TYPE_LABELS[kind]}</label>)}
        </fieldset>
        <label>Heaviest item you handle, in kg (leave empty for no limit)
          <input inputMode="decimal" value={draft.maxKg} onChange={event => set({ maxKg: event.target.value })} /></label>
        <label>Largest item you handle<select value={draft.maxSide} onChange={event => set({ maxSide: event.target.value as PilotSizeLimit | "" })}>
          <option value="">No limit</option>
          {PILOT_SIZE_LIMITS.map(code => <option key={code} value={code}>Items {PILOT_SIZE_LIMIT_LABELS[code]}</option>)}
        </select></label>
        <label>Shortest working day you take<select value={draft.minHours} onChange={event => set({ minHours: event.target.value as PilotHoursLimit | "" })}>
          <option value="">Any</option>
          {PILOT_HOURS_LIMITS.map(code => <option key={code} value={code}>Jobs that run {PILOT_HOURS_LIMIT_LABELS[code]}</option>)}
        </select></label>
        <fieldset><legend>Where you work</legend>
          <label><input type="checkbox" checked={draft.allStates} onChange={() => set({ allStates: !draft.allStates })} /> Every US state</label>
          {!draft.allStates && <div className="ws-checkbox-grid">{US_STATE_CODES.map(code => <label key={code}>
            <input type="checkbox" checked={draft.states.includes(code)} onChange={() => set({ states: toggled(draft.states, code) })} /> {US_STATE_NAMES[code]}
          </label>)}</div>}
        </fieldset>
        <label>Pilot length, in weeks<input type="number" min={PILOT_WEEKS_MIN} max={PILOT_WEEKS_MAX} step={1} required value={draft.weeks}
          onChange={event => set({ weeks: event.target.value })} /></label>
        <fieldset><legend>What the site pays for the pilot</legend>
          {(["nothing", "once", "monthly"] as const).map(kind => <label key={kind}><input type="radio" name="pays" checked={draft.pays === kind}
            onChange={() => set({ pays: kind })} /> {kind === "nothing" ? "Nothing" : kind === "once" ? "A one-time amount" : "An amount each month"}</label>)}
          {draft.pays !== "nothing" && <div role="group" aria-label="Amount in US dollars">
            <label>From, in US dollars<input inputMode="decimal" value={draft.low} onChange={event => set({ low: event.target.value })} /></label>
            <label>To, in US dollars<input inputMode="decimal" value={draft.high} onChange={event => set({ high: event.target.value })} /></label>
            <p className="ws-note">{ESTIMATE_LABEL}</p>
          </div>}
        </fieldset>
        <fieldset className="ws-option-columns"><legend>What the site provides</legend>
          {SITE_PROVIDES.map(item => <label key={item}><input type="checkbox" checked={draft.siteProvides.includes(item)}
            onChange={() => set({ siteProvides: toggled(draft.siteProvides, item) })} /> {SITE_PROVIDES_LABELS[item]}</label>)}
        </fieldset>
        <label>Earliest start<select value={draft.earliestStart} onChange={event => set({ earliestStart: event.target.value as CompanyStartWindow })}>
          {COMPANY_START_WINDOWS.map(window => <option key={window} value={window}>{COMPANY_START_LABELS[window]}</option>)}
        </select></label>
        <label>How you charge after a pilot that works<select value={draft.afterPilot} onChange={event => set({ afterPilot: event.target.value as ChargeModel })}>
          {CHARGE_MODELS.map(model => <option key={model} value={model}>{CHARGE_MODEL_LABELS[model]}</option>)}
        </select></label>
        <div className="ws-form-actions">
          <button className="ws-primary" disabled={saving} aria-describedby="pilot-offer-statement">
            {saving ? "Saving…" : offer?.published ? "Save changes" : "Publish"}</button>
          {offer?.published && <button type="button" className="ws-link" disabled={saving} onClick={() => void save(false)}>Pause the offer</button>}
        </div>
        {statement && <p className="ws-note" id="pilot-offer-statement">{statement.text}</p>}
        {message && <p role="status">{message}</p>}
      </form>
    </>}
  </AppShell>;
}
