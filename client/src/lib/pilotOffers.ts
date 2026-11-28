/**
 * Pilot offers (owner, 2026-11-28). An approved deployment company publishes one standing pilot offer: the kinds of job
 * it takes, a few limits in the site's own answer codes, and its pilot's terms. When a site's job fits the offer on paper
 * (`pilotOfferFit.ts`), the site's job page shows the company's name, its website and these terms, the same that an
 * applicant row shows. The site can ask for the pilot with one press; the company confirms on the job's page, which is
 * an ordinary Apply under the company's response line, and the introduction is then made the way Accept makes it.
 *
 * Closed choices and numbers only, so nothing here needs screening for names. Every key avoids the words the payload
 * price guard reads (`scripts/qa/price-statements.ts`): `sitePays`, `low`, `high`, `afterPilot`. A company's figure is
 * its own, shown as "not a quote"; Blueprint states no price of its own anywhere.
 */
import {
  CHARGE_MODEL_LABELS, CHARGE_MODELS, COMPANY_START_LABELS, COMPANY_START_WINDOWS, estimateInWords, isApplicationEstimate,
  type ChargeModel, type CompanyStartWindow,
} from "./companyResponses";
import { JOB_FACT_CHOICES } from "./jobFacts";

/**
 * The statement a company agrees to when it publishes its offer: a recorded statement, pinned word for word in
 * `client/tests/recordedStatements.guard.test.ts`. Drafted for the owner's review (2026-11-28). Changing a word means a
 * new version.
 */
export const PILOT_OFFER_STATEMENT_VERSION = "pilot-offer-2026-11-28.1";
export const PILOT_OFFER_STATEMENT = "When a site's job fits this offer on paper, we show the site your company's name, your "
  + "website and these terms. If the site asks for your pilot and you confirm, we give the site your contact details, and "
  + "give you theirs. These terms are your own, given before a site visit. They are not a quote, and Blueprint does not "
  + "check or guarantee them.";
/** Every version an offer may be published under. */
export const PILOT_OFFER_STATEMENT_VERSIONS: readonly string[] = [PILOT_OFFER_STATEMENT_VERSION];

/** The kinds of job an offer takes: the video reading's kinds, with unloading and cleaning named on their own. */
export const PILOT_OFFER_JOB_TYPES = ["pick_and_place", "palletizing", "machine_tending", "transport", "unloading", "cleaning",
  "other"] as const;
export type OfferJobType = (typeof PILOT_OFFER_JOB_TYPES)[number];
export const PILOT_OFFER_JOB_TYPE_LABELS: Readonly<Record<OfferJobType, string>> = {
  pick_and_place: "Pick and place", palletizing: "Palletizing", machine_tending: "Machine tending",
  transport: "Moving things between places", unloading: "Unloading", cleaning: "Cleaning", other: "Other hands-on jobs",
};

/** What a site may be asked to provide for a pilot. */
export const SITE_PROVIDES = ["floor_space", "power", "wifi", "a_person", "storage", "sample_items", "loading_access"] as const;
export type SiteProvides = (typeof SITE_PROVIDES)[number];
export const SITE_PROVIDES_LABELS: Readonly<Record<SiteProvides, string>> = {
  floor_space: "Floor space", power: "Power", wifi: "Wi-Fi", a_person: "A person to help", storage: "Storage space",
  sample_items: "Sample items", loading_access: "Access for loading and unloading",
};

/** The largest item an offer takes, as the site's own size answer codes (no figure Blueprint made up). */
export const PILOT_SIZE_LIMITS = ["under_30cm", "30_60cm", "over_60cm"] as const;
export type PilotSizeLimit = (typeof PILOT_SIZE_LIMITS)[number];
export const PILOT_SIZE_LIMIT_LABELS: Readonly<Record<PilotSizeLimit, string>> = {
  under_30cm: "under 30 cm (1 ft) on the longest side", "30_60cm": "up to 60 cm (2 ft) on the longest side",
  over_60cm: "of any size, over 60 cm (2 ft) too",
};

/** The shortest working day an offer takes, as the site's own hours answer codes. */
export const PILOT_HOURS_LIMITS = ["one_shift", "two_shifts", "around_the_clock"] as const;
export type PilotHoursLimit = (typeof PILOT_HOURS_LIMITS)[number];
export const PILOT_HOURS_LIMIT_LABELS: Readonly<Record<PilotHoursLimit, string>> = {
  one_shift: "at least one shift a day", two_shifts: "at least two shifts a day", around_the_clock: "around the clock",
};

/** US states and DC, by their two-letter code (the same list as `server/utils/typedPlaceState.ts`). */
export const US_STATE_NAMES: Readonly<Record<string, string>> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
export const US_STATE_CODES = Object.keys(US_STATE_NAMES);
/** A state's name ("Texas") or code ("TX") as its code; null for anything else. */
export function usStateCodeOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed) && US_STATE_NAMES[trimmed.toUpperCase()]) return trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  return US_STATE_CODES.find(code => US_STATE_NAMES[code].toLowerCase() === lower) ?? null;
}

export const PILOT_WEEKS_MIN = 1;
export const PILOT_WEEKS_MAX = 26;
/** The heaviest-item limit's bounds, in kg, as the quick questions take a typed weight. */
export const PILOT_MAX_KG_MIN = 0.1;
export const PILOT_MAX_KG_MAX = 100_000;

/** What the site pays for the pilot: nothing, or the company's own range, once or a month. */
export type PilotSitePays = { kind: "nothing" } | { kind: "once" | "monthly"; low: number; high: number };
export interface PilotOfferLimits {
  /** The heaviest item the company handles, in kg; null: no limit stated. */
  maxKg: number | null;
  maxSide: PilotSizeLimit | null;
  minHours: PilotHoursLimit | null;
  states: string[] | "all_us";
}
export interface PilotOfferTerms {
  weeks: number;
  sitePays: PilotSitePays;
  siteProvides: SiteProvides[];
  earliestStart: CompanyStartWindow;
  afterPilot: ChargeModel;
}
/** What the company publishes, and what a site's request keeps as it was then (`offerSnapshot`). */
export interface PilotOfferBody { kinds: OfferJobType[]; limits: PilotOfferLimits; terms: PilotOfferTerms }
/** The company's own offer, as its form reads it back. */
export interface PilotOfferView extends PilotOfferBody {
  published: boolean;
  revision: string;
  statementVersion: string;
  updatedAtIso: string;
}

/** The estimate rule's way of charging for each way the site pays: once is a total, monthly is a month. */
const PAYS_AS: Readonly<Record<"once" | "monthly", Exclude<ChargeModel, "undecided">>> = { once: "purchase", monthly: "subscription" };

/** Whether a stored or sent `sitePays` is well formed: nothing, or a range the application estimate rule takes. */
export function isPilotSitePays(value: unknown): value is PilotSitePays {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  if (raw.kind === "nothing") return true;
  if (raw.kind !== "once" && raw.kind !== "monthly") return false;
  return isApplicationEstimate({ lowUsd: raw.low, highUsd: raw.high }, PAYS_AS[raw.kind]);
}

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);
const uniqueOf = <T extends string>(list: readonly T[], value: unknown): T[] | null =>
  Array.isArray(value) && value.every(item => isOneOf(list, item)) && new Set(value).size === value.length ? value as T[] : null;

/** Only a well-formed offer body; anything else is null and never shown. */
export function sanitizePilotOfferBody(value: unknown): PilotOfferBody | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, any>;
  const kinds = uniqueOf(PILOT_OFFER_JOB_TYPES, raw.kinds);
  const limits = raw.limits, terms = raw.terms;
  if (!kinds?.length || !limits || typeof limits !== "object" || !terms || typeof terms !== "object") return null;
  const maxKg = limits.maxKg === null ? null : typeof limits.maxKg === "number" && Number.isFinite(limits.maxKg)
    && limits.maxKg >= PILOT_MAX_KG_MIN && limits.maxKg <= PILOT_MAX_KG_MAX ? limits.maxKg : undefined;
  const maxSide = limits.maxSide === null ? null : isOneOf(PILOT_SIZE_LIMITS, limits.maxSide) ? limits.maxSide : undefined;
  const minHours = limits.minHours === null ? null : isOneOf(PILOT_HOURS_LIMITS, limits.minHours) ? limits.minHours : undefined;
  const states = limits.states === "all_us" ? "all_us" : uniqueOf(US_STATE_CODES, limits.states);
  const siteProvides = uniqueOf(SITE_PROVIDES, terms.siteProvides);
  if (maxKg === undefined || maxSide === undefined || minHours === undefined || !states || (states !== "all_us" && !states.length)
    || !Number.isInteger(terms.weeks) || terms.weeks < PILOT_WEEKS_MIN || terms.weeks > PILOT_WEEKS_MAX
    || !isPilotSitePays(terms.sitePays) || !siteProvides || !isOneOf(COMPANY_START_WINDOWS, terms.earliestStart)
    || !isOneOf(CHARGE_MODELS, terms.afterPilot)) return null;
  const sitePays: PilotSitePays = terms.sitePays.kind === "nothing" ? { kind: "nothing" }
    : { kind: terms.sitePays.kind, low: terms.sitePays.low, high: terms.sitePays.high };
  return { kinds, limits: { maxKg, maxSide, minHours, states },
    terms: { weeks: terms.weeks, sitePays, siteProvides, earliestStart: terms.earliestStart, afterPilot: terms.afterPilot } };
}

/* ------------------------------------------------------------------ the site's page */

export const PILOT_OFFERS_HEADING = "Pilot offers that fit your job";
export const PILOT_OFFERS_LEAD = "These companies offer a pilot for jobs like yours. The match is on paper: what you told us "
  + "against what each company says it takes. A company confirms after you ask.";
export const PILOT_OFFERS_NONE = "No pilot offer fits your job on paper yet. Approved companies can still see your job and answer.";
export const PILOT_OFFERS_NOT_CHECKED = "Each pilot offer is the company's own, given before a site visit. It is not a quote, "
  + "and Blueprint does not check it.";
export const REQUEST_PILOT_LABEL = "Request this pilot";
export const COMPANY_OWN_FIGURE = "(the company's own figure, not a quote)";

export const pilotWeeksLine = (weeks: number) => `Pilot: ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
/** "Cost to you: free", or the company's own range: "… in total" or "… a month", said as its own figure. */
export function sitePaysLine(pays: PilotSitePays): string {
  if (pays.kind === "nothing") return "Cost to you: free";
  const range = estimateInWords(PAYS_AS[pays.kind], { lowUsd: pays.low, highUsd: pays.high });
  return range ? `Cost to you: ${range} ${COMPANY_OWN_FIGURE}` : "Cost to you: not stated";
}
const listInWords = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0] ?? "";
export const siteProvidesLine = (provides: readonly SiteProvides[]) =>
  `You provide: ${provides.length ? listInWords(provides.map(item => SITE_PROVIDES_LABELS[item])) : "nothing listed"}`;
export const earliestStartLine = (start: CompanyStartWindow) => `Earliest start: ${COMPANY_START_LABELS[start]}`;
export const afterPilotLine = (model: ChargeModel) => `After a pilot that works: ${CHARGE_MODEL_LABELS[model]}`;

/** The offer's terms as the lines both pages show, in this order. */
export function pilotTermsLines(terms: PilotOfferTerms): string[] {
  return [pilotWeeksLine(terms.weeks), sitePaysLine(terms.sitePays), siteProvidesLine(terms.siteProvides),
    earliestStartLine(terms.earliestStart), afterPilotLine(terms.afterPilot)];
}

/** A fact the fit could not check because the site has not said it (or the record does not hold it). */
export const PILOT_FIT_FACTS = ["job_type", "weight", "size", "hours", "region"] as const;
export type PilotFitFact = (typeof PILOT_FIT_FACTS)[number];

const kg = (value: number) => `${Number(value.toFixed(1))} kg`;
const statesInWords = (states: string[] | "all_us") => states === "all_us" ? "every US state"
  : states.length > 3 ? `${states.length} states` : listInWords(states.map(code => US_STATE_NAMES[code] ?? code));

/**
 * One plain line for each fact the fit left open, with what the company takes, so the site knows what would settle it.
 * `weightPartly`: the site's weight answer is a range only partly under the company's limit.
 */
export function pilotUnknownLine(fact: PilotFitFact, offer: PilotOfferBody, weightPartly = false): string | null {
  switch (fact) {
    case "job_type": return `We could not tell the kind of job yet. This company takes: ${listInWords(offer.kinds.map(kind =>
      PILOT_OFFER_JOB_TYPE_LABELS[kind].toLowerCase()))}.`;
    case "weight": return offer.limits.maxKg === null ? null : weightPartly
      ? `Your heaviest item may be over the ${kg(offer.limits.maxKg)} this company takes.`
      : `You have not said how heavy the item is. This company takes up to ${kg(offer.limits.maxKg)}.`;
    case "size": return offer.limits.maxSide === null ? null
      : `You have not said how big the item is. This company takes items ${PILOT_SIZE_LIMIT_LABELS[offer.limits.maxSide]}.`;
    case "hours": return offer.limits.minHours === null ? null
      : `You have not said how many hours a day the job runs. This company takes jobs that run ${PILOT_HOURS_LIMIT_LABELS[offer.limits.minHours]}.`;
    case "region": return `Your job's state is not on record. This company works in ${statesInWords(offer.limits.states)}.`;
  }
}

/** Where the site's request stands, as its page reads it. */
export const PILOT_REQUEST_STATES = ["requested", "question", "declined", "confirmed", "refused"] as const;
export type PilotRequestState = (typeof PILOT_REQUEST_STATES)[number];

/** The pilot sheet: what each side said, as of the request. No signature, no acceptance, no new statement. */
export interface PilotSheet {
  /** The site's sentence for the job. */
  sentence: string;
  /** The site's "what counts as done", or null: "Not stated". */
  done: string | null;
  terms: PilotOfferTerms;
  requestedAtIso: string;
}
export const PILOT_SHEET_HEADING = "Pilot sheet";
export const PILOT_SHEET_FOOTER = "A summary of what each side said. The site and the company agree the pilot between them.";
export const PILOT_SHEET_SENTENCE_LABEL = "The job";
export const PILOT_SHEET_DONE_LABEL = "What counts as done";
export const PILOT_SHEET_TERMS_LABEL = "The company's pilot terms, as of the request";
export const PILOT_SHEET_NOT_STATED = "Not stated";

export interface SitePilotRequest {
  state: PilotRequestState;
  requestedAtIso: string;
  /** With `declined`: the company's words, with its identity taken out, as the site reads them under Applicants. */
  reason?: string;
  /** The introduction is made (the company's email went). */
  introducedAtIso?: string;
  /** Only once the introduction is made. */
  sheet?: PilotSheet;
}
/** One offer on the site's page: the company's name and website, the offer's terms, and nothing else of the company. */
export interface SitePilotOffer {
  /** Opaque: a digest of the job and the company. Never the company's id. */
  offerRef: string;
  company: { name: string; website: string | null };
  offer: PilotOfferBody;
  /** Facts the fit could not check; shown, never a reason to leave the offer out. */
  unknown: PilotFitFact[];
  /** The site's weight answer is a range only partly under the company's limit. */
  weightPartly?: true;
  request?: SitePilotRequest;
}
export interface SitePilotOffers {
  offers: SitePilotOffer[];
  /** The sentence beside the button, as the introduction sentence true for this job (`siteIntroductions.ts`). */
  introductionStatementVersion: string;
}

const pilotDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
};
export const pilotRequestedLine = (atIso: string) => `Requested ${pilotDate(atIso)}. The company has not confirmed yet.`;
export const pilotDeclinedLine = (reason?: string) => reason?.trim()
  ? `The company said this job is not a fit: ${reason.trim().replace(/[.!?]+$/, "")}.` : "The company said this job is not a fit.";
export const PILOT_QUESTION_LINE = "The company asked a question before it confirms. You can reply under Applicants.";
export const PILOT_CONFIRMED_PENDING = "The company confirmed. We are emailing you both each other's contact details.";
export const pilotConfirmedLine = (atIso: string) => `The company confirmed on ${pilotDate(atIso)}. Its contact details are under Applicants.`;
export const PILOT_REFUSED_LINE = "The company confirmed, but the introduction could not be made. Its application is under Applicants.";

/** The site's request refusals, each in one plain sentence. */
export const PILOT_REQUEST_REFUSALS = ["not_listed", "withdrawn", "offer_unavailable", "already_introduced",
  "statement_not_current"] as const;
export type PilotRequestRefusal = (typeof PILOT_REQUEST_REFUSALS)[number];
export const PILOT_REQUEST_REFUSAL_SENTENCES: Readonly<Record<PilotRequestRefusal, string>> = {
  not_listed: "Your job is not in front of deployment companies right now, so you cannot request a pilot.",
  withdrawn: "You withdrew this job, so you cannot request a pilot.",
  offer_unavailable: "This pilot offer is not open to your job any more. Reload the page to see the offers that fit.",
  already_introduced: "You have already accepted this company.",
  statement_not_current: "The wording on this page has changed. Reload the page, read it, then press Request this pilot again.",
};
export const PILOT_REQUEST_FAILED = "We could not send your request just now. Try again shortly.";
export const isPilotRequestRefusal = (value: unknown): value is PilotRequestRefusal => isOneOf(PILOT_REQUEST_REFUSALS, value);

/** A cheap shape check for the site's page: anything else is dropped, never shown. */
export function sanitizeSitePilotOffers(value: unknown): SitePilotOffers | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as Record<string, unknown>).offers)) return null;
  const raw = value as { offers: unknown[]; introductionStatementVersion?: unknown };
  const offers: SitePilotOffer[] = [];
  for (const item of raw.offers) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, any>;
    const offer = sanitizePilotOfferBody(row.offer);
    if (!offer || typeof row.offerRef !== "string" || !/^p-[a-f0-9]{32}$/.test(row.offerRef)
      || typeof row.company?.name !== "string" || !row.company.name.trim()) continue;
    const unknown = Array.isArray(row.unknown) ? row.unknown.filter((fact: unknown) => isOneOf(PILOT_FIT_FACTS, fact)) : [];
    const request = row.request && isOneOf(PILOT_REQUEST_STATES, row.request.state) && typeof row.request.requestedAtIso === "string"
      ? { state: row.request.state as PilotRequestState, requestedAtIso: row.request.requestedAtIso,
        ...(typeof row.request.reason === "string" ? { reason: row.request.reason } : {}),
        ...(typeof row.request.introducedAtIso === "string" ? { introducedAtIso: row.request.introducedAtIso } : {}),
        ...(sanitizePilotSheet(row.request.sheet) ? { sheet: sanitizePilotSheet(row.request.sheet)! } : {}) } : undefined;
    offers.push({ offerRef: row.offerRef, company: { name: row.company.name.trim(),
      website: typeof row.company.website === "string" ? row.company.website : null }, offer, unknown,
      ...(row.weightPartly === true ? { weightPartly: true as const } : {}), ...(request ? { request } : {}) });
  }
  return { offers, introductionStatementVersion: typeof raw.introductionStatementVersion === "string"
    ? raw.introductionStatementVersion : "" };
}

export function sanitizePilotSheet(value: unknown): PilotSheet | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, any>;
  const offer = sanitizePilotOfferBody({ kinds: ["other"], limits: { maxKg: null, maxSide: null, minHours: null, states: "all_us" },
    terms: raw.terms });
  if (typeof raw.sentence !== "string" || !offer || typeof raw.requestedAtIso !== "string") return null;
  return { sentence: raw.sentence, done: typeof raw.done === "string" && raw.done.trim() ? raw.done : null, terms: offer.terms,
    requestedAtIso: raw.requestedAtIso };
}

/* ------------------------------------------------------------------ the company's side */

export const PILOT_OFFER_FORM_HEADING = "Your pilot offer";
export const PILOT_OFFER_FORM_LEAD = "Publish one pilot offer. When a site's job fits it on paper, the site sees your company's "
  + "name, your website and these terms, and can ask for your pilot. You confirm on the job's page.";
export const PILOT_OFFER_PUBLISHED = "Your pilot offer is published.";
export const PILOT_OFFER_PAUSED = "Your pilot offer is paused. No site sees it.";
export const PILOT_OFFER_NONE_YET = "You have no pilot offer yet.";
/** The one sentence on the Find jobs page (owner, 2026-11-28). */
export const PILOT_OFFER_FIND_JOBS_LINE = "Once approved, you can also publish a pilot offer. Sites whose jobs fit it on paper "
  + "see it and can ask for your pilot.";
export const PILOT_OFFER_SETTINGS_LINK = "Your pilot offer";

/** On the company's job page, while the site's request waits. */
export const PILOT_REQUEST_BANNER = "The site asked for your pilot offer.";
export const pilotRequestAskedLine = (atIso: string) => `Asked on ${pilotDate(atIso)}, under your terms as they were then:`;
export const PILOT_CONFIRM_LABEL = "Confirm";
export const PILOT_CONFIRM_OTHER_ANSWERS = "Or answer below: Need more details or Not a fit.";
export const PILOT_COMPANY_CONFIRMED_PENDING = "You confirmed. We are emailing you and the site each other's contact details.";
export const pilotCompanyConfirmedLine = (atIso: string) => `You confirmed on ${pilotDate(atIso)}. We emailed you and the site each other's contact details.`;
export const PILOT_COMPANY_QUESTION = "You asked the site a question. You can still confirm once it replies.";
export const PILOT_COMPANY_DECLINED = "You said this job is not a fit. You can still confirm if that changes.";
/** The introduction could not be made after the company confirmed: its application stands, and the site can accept it. */
export const PILOT_COMPANY_REFUSAL_SENTENCES: Readonly<Record<string, string>> = {
  statement_not_current: "The site's details changed after it asked, so it has to accept you again.",
  not_listed: "The job is not in front of deployment companies right now.",
  already_introduced: "The site already accepted you.",
  company_not_approved: "Your company cannot be introduced right now.",
  answer_changed: "Your application changed while it was being saved.",
  not_interested: "Your application was not on record.",
  consent_missing: "Your application was not on record.",
};
export const pilotCompanyRefusedLine = (reason: string | undefined) =>
  `Your application is saved, but the introduction was not made. ${PILOT_COMPANY_REFUSAL_SENTENCES[reason ?? ""]
    ?? "It could not go ahead."} The site can still accept your application.`;
export const PILOT_CONFIRM_FAILED = "We could not save your confirmation just now. Try again shortly.";

/** The company's job page: the site's request, as the company reads it. Nothing of the site. */
export interface CompanyPilotRequest {
  state: PilotRequestState;
  requestedAtIso: string;
  terms: PilotOfferTerms;
  /** With `refused`: why the introduction was not made (`requestIntroduction`'s reason). */
  refusal?: string;
  introducedAtIso?: string;
  decidedAtIso?: string;
}

/** The email to the company: no figure, no site detail, the job's one-use link. */
export const PILOT_REQUEST_EMAIL_SUBJECT = "A site asked for your pilot";
export const PILOT_REQUEST_EMAIL_BODY = "A site asked for the pilot you offer on Blueprint. Open the job to confirm, ask a "
  + "question or say it is not a fit. The terms are on the job's page.";
export const PILOT_REQUEST_EMAIL_LINE = "You get this email because you published a pilot offer. You can pause your offer in Settings.";

/** Which of the site's size answers fit under a size limit, and which hours answers meet an hours limit (by order). */
export const SIZE_ORDER: readonly string[] = JOB_FACT_CHOICES.size.map(choice => choice.code).filter(code => code !== "unsure");
export const HOURS_ORDER: readonly string[] = JOB_FACT_CHOICES.hours.map(choice => choice.code).filter(code => code !== "unsure");
