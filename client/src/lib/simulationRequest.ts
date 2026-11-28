/**
 * The simulation on request (owner, 2026-11-28): the simulation of the site is built only when an approved deployment
 * company asks for it on that job. A video is still required to post a job, and the sound-free clip reaches companies as
 * before. One request builds it for every company. Only a job created after this change waits for a request
 * (`server/utils/simulationRequest.ts`); every earlier job builds as it always did, and its pages keep their words.
 *
 * The words both pages show for it, said the same wherever they appear.
 */

/** On the job record, written once at creation: this job's simulation is built only when a company asks for it. A leaf
 * constant, so the task context projection (`server/utils/websiteTaskContext.ts`) reads it without importing more. */
export const SIMULATION_ON_REQUEST_FIELD = "simulation_on_request";

/** The company's job page, where no simulation exists and none was asked for. */
export const SIMULATION_ON_REQUEST_COMPANY = "A simulation of the site is built when a company asks for one.";
/** The company's button. */
export const ASK_FOR_SIMULATION_LABEL = "Ask for a simulation";
/** The site's job page, while no company has asked. */
export const SIMULATION_ON_REQUEST_SITE = "A simulation of your site is built if a company asks for one.";
/**
 * The site's job page, when no company asked while the job's time to build one lasted: no simulation can be built for
 * it now (`server/utils/simulationRequest.ts`, `simulationRequestState`). The company's page says the existing
 * "There is no simulation for this job." for the same state.
 */
export const SIMULATION_NOT_BUILT_SITE = "No simulation of your site will be built for this job.";
/** The company library card's label while a job's simulation waits for a company to ask. */
export const SIMULATION_ON_REQUEST_STAGE_LABEL = "Simulation on request";

/** The day a request was made, as the company's page says it. Empty when the time does not read. */
export function simulationAskedOn(iso: string | null | undefined): string {
  const date = new Date(String(iso ?? ""));
  return iso && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "";
}

/** The company's page after the first request: when it was made, and what is happening. */
export function simulationAskedLine(iso: string | null | undefined): string {
  const day = simulationAskedOn(iso);
  return day ? `Asked ${day}. The simulation is being built from the site's video.`
    : "The simulation is being built from the site's video.";
}

/** The answers of `POST /api/site-worlds/jobs/:taskId/simulation-request`, one plain sentence each. */
export const SIMULATION_ASKED = "Thank you. The simulation is being built from the site's video.";
export const SIMULATION_ALREADY_ASKED = "A simulation of this job was already asked for. It is being built from the site's video.";
export const SIMULATION_CANNOT_BE_ASKED = "A simulation can no longer be built for this job.";
export const SIMULATION_NOT_ON_REQUEST = "This job's simulation is built without being asked for.";
export const SIMULATION_ASK_NOT_SHARED = "This job is no longer shared, so a simulation can't be asked for.";
export const SIMULATION_ASK_FAILED = "Your request could not be saved just now. Try again.";

/**
 * Where the company's page stands on a job's simulation request, from the server (`CompanyJobPage.simulationRequest`):
 * `can_ask` offers the button; `asked` says when; there is no state for a job whose simulation cannot be asked for (it
 * reads as the existing "no simulation" line) or for one that builds without a request.
 */
export type CompanySimulationRequest = { state: "can_ask" } | { state: "asked"; askedAtIso: string };
