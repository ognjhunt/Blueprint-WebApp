/**
 * Where a site's job stands, as a shipment tracker shows a load (owner, 2026-11-23, after Uber Freight's shipment
 * timeline): six steps in order, each done, current or still to come, with one line of what is true now.
 *
 * Posted → companies looking → responses → introduced → visit → pilot. The first four come from what Blueprint
 * records (the sharing state, the companies that opened the job, their answers, the introductions); a visit and a pilot
 * happen outside Blueprint, so only the site's own mark under an introduced company says one did. Nothing is guessed:
 * a step with nothing on record is still to come.
 */
import type { JobSharing } from "./siteAnswer";
import { INTRODUCIBLE_RESPONSE_STATES, type SiteCompanyActivity } from "./companyResponses";

export type TrackerStepKey = "posted" | "looking" | "responses" | "introduced" | "visit" | "pilot";
export type TrackerStepState = "done" | "current" | "upcoming";
export interface TrackerStep { key: TrackerStepKey; label: string; state: TrackerStepState; detail: string | null; atIso?: string }

export const TRACKER_LABELS: Readonly<Record<TrackerStepKey, string>> = {
  posted: "Posted", looking: "Companies looking", responses: "Responses", introduced: "Introduced", visit: "Site visit",
  pilot: "Pilot agreed",
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const earliest = (dates: Array<string | undefined>) => dates.filter((value): value is string => Boolean(value)).sort()[0];

/** The six steps for a job, from its sharing state and its company activity. */
export function jobTrackerSteps(sharing: JobSharing, activity: SiteCompanyActivity | undefined): TrackerStep[] {
  const answered = (activity?.entries ?? []).filter(entry => entry.kind === "answered");
  const interested = answered.filter(entry => INTRODUCIBLE_RESPONSE_STATES.includes(entry.state));
  const introduced = answered.filter(entry => entry.company || entry.introducedAtIso);
  const visited = introduced.filter(entry => entry.progress?.visitAtIso);
  const piloted = introduced.filter(entry => entry.progress?.pilotAtIso);
  const views = activity?.views ?? 0;
  const posted = sharing.state === "visible";
  const sentCount = activity?.sent?.count ?? 0;

  const done: Record<TrackerStepKey, boolean> = {
    posted, looking: views > 0 || answered.length > 0, responses: answered.length > 0, introduced: introduced.length > 0,
    visit: visited.length > 0, pilot: piloted.length > 0,
  };
  // A done step says how many companies only where the section's own counts do not (introductions, visits, pilots);
  // the current step says what happens next. Steps still to come say nothing.
  const doneDetail: Partial<Record<TrackerStepKey, string>> = {
    introduced: plural(introduced.length, "company", "companies"), visit: plural(visited.length, "company", "companies"),
    pilot: plural(piloted.length, "company", "companies"),
  };
  const next: Record<TrackerStepKey, string> = {
    posted: "Getting your job ready to post",
    looking: sentCount ? `Sent to ${plural(sentCount, "approved company", "approved companies")}; waiting for one to open it`
      : "Waiting for companies to open it",
    responses: "Waiting for a company to answer",
    introduced: interested.length ? "Press Introduce us below to meet a company" : "Waiting for a company to say Interested",
    visit: "Mark it below when a company visits",
    pilot: "Mark it below when you agree a pilot",
  };
  const atIso: Partial<Record<TrackerStepKey, string>> = {
    posted: posted ? sharing.sharedAtIso ?? undefined : undefined,
    responses: activity?.firstAnswerAtIso,
    introduced: earliest(introduced.map(entry => entry.introducedAtIso)),
    visit: earliest(visited.map(entry => entry.progress?.visitAtIso)),
    pilot: earliest(piloted.map(entry => entry.progress?.pilotAtIso)),
  };
  const keys = Object.keys(TRACKER_LABELS) as TrackerStepKey[];
  // The current step is the first one not done after the last done step: a later mark (a pilot) does the steps before it.
  const lastDone = keys.reduce((last, key, index) => done[key] ? index : last, -1);
  return keys.map((key, index) => {
    const state: TrackerStepState = index <= lastDone ? "done" : index === lastDone + 1 ? "current" : "upcoming";
    const detail = state === "current" ? next[key] : state === "done" && done[key] ? doneDetail[key] ?? null : null;
    return { key, label: TRACKER_LABELS[key], state, detail, ...(atIso[key] && state === "done" ? { atIso: atIso[key] } : {}) };
  });
}

/** The mark buttons under an introduced company: what each says before and after the site presses it. */
export const PROGRESS_MARK: Readonly<Record<"visit" | "pilot", { press: string; done: (date: string) => string }>> = {
  visit: { press: "We had a site visit", done: date => `Site visit on ${date}` },
  pilot: { press: "We agreed a pilot", done: date => `Pilot agreed on ${date}` },
};
export const PROGRESS_UNDO = "Undo";
export const PROGRESS_FAILED = "That could not be saved. Please try again.";
