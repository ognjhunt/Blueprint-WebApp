/**
 * The public pages' words, in one place, bare bones (owner direction 2026-11-11: "a 10 year old should be able to
 * understand what everything is"). The home page, How it works, Questions, index.html, llms.txt, the agent page list
 * (`server/routes/site-content.ts`) and the structured data all read or repeat these, so one edit here keeps them in
 * step.
 *
 * The frame is the owner's (2026-11-12): a site films a job once; Blueprint turns it into a job packet (the site's
 * sentence for the job, a first look on paper at which robots could fit, and a simulation of the site). Sharing is
 * the service (owner, 2026-11-12): a job sent under the current statement is shared, with its video
 * without sound and its simulation, with the deployment companies Blueprint approves; a site's name, address and
 * contact details go to a company only through an introduction the site asks for. No price is stated anywhere: "Free
 * for sites" and "Nothing is charged today" are the only money sentences.
 */

import { COMPANY_RESPONSE_LABELS as ANSWER } from "./companyResponses";

export const HOME_LABEL = "Free for sites";
/** The outcome a site wants (owner, 2026-11-12 ~19:15Z: "the goal is ... having repetitive work/jobs done by robots"). */
export const HOME_TITLE = "Get repetitive work done by robots.";
/** The line under the title. The home page does not lead with privacy (owner, same message); the rule is said where the site agrees. */
export const HOME_SUB_LINE = "Film the job once or describe it. We send it to robot deployment companies so they can tell you if they can do it.";

/**
 * The answers the company form offers (`CompanyJob.tsx`), said the same way on every public page: three always, and the
 * two tested ones only once the job's simulation can be downloaded. Built from the form's own labels so it cannot drift.
 * No page says a company tests anything: Blueprint runs no company's robot software.
 */
export const COMPANY_ANSWERS = `${ANSWER.interested}, ${ANSWER.declined} or ${ANSWER.needs_something}; once the simulation can be `
  + `downloaded, also ${ANSWER.tested_can_do} or ${ANSWER.tested_cannot_yet}`;
/** The answers beside which a site may ask for an introduction (`INTRODUCIBLE_RESPONSE_STATES`). */
export const INTRODUCIBLE_ANSWERS = `${ANSWER.interested} or ${ANSWER.tested_can_do}`;

export const STEP_SEND = "Film or describe one job that repeats.";
export const STEP_SIMULATE = "We send the job to robot deployment companies we approve. With video, we build a simulation of your site when we can.";
export const STEP_ANSWER = `Their answers come back to you: ${COMPANY_ANSWERS}. You pick who to meet.`;

export const START_JOB = "Start a job";
export const HOME_START_HELPER = "A video or description, where the job is, and an email.";
/** The home page's link to the page for deployment companies. */
export const FOR_DEPLOYMENT_COMPANIES_LINK = "Deploy robots? See how jobs reach you";
/** The page's own name, in the navigation and its label. */
export const FOR_DEPLOYMENT_COMPANIES = "For deployment companies";
export const FIRST_LOOK_WHEN_READY = "We add a first look at which robots could fit when we have enough detail.";

export const HOW_STEPS = [
  { key: "video", title: "Your job", line: "Film one recurring job or send a description." },
  { key: "packet", title: "Your job packet", line: `What the job is and what counts as done when known. ${FIRST_LOOK_WHEN_READY} If you send video, we add it without sound and build a simulation when we can.` },
  { key: "companies", title: "Deployment companies", line: "We share your job with deployment companies we approve by hand. When they answer, you choose which to meet." },
] as const;

/** What used to be the "Jobs we support" page, in one line. */
export const JOBS_THAT_FIT = "Best for one job that repeats, with known objects, where something is picked up and put down. Other jobs still go to companies; their simulation waits until we can build one.";

export const HOME_SEO_TITLE = "Blueprint | Get repetitive work done by robots.";
export const HOME_SEO_DESCRIPTION = "Film or describe one job that repeats. We send it to robot deployment companies we approve so they can tell you if they can do it. Free for sites.";

/**
 * The home page's moving example card: what a site sees on its job page once companies answer. Everything on it is
 * invented and marked "Example"; the answer labels and aliases come from `companyResponses.ts`, as the site sees them.
 */
export const EXAMPLE_TAG = "Example";
export const EXAMPLE_CARD_NAME = "Example of a job page once deployment companies answer";
export const exampleSentTo = (count: number) => `Sent to ${count} deployment ${count === 1 ? "company" : "companies"}`;
export const EXAMPLE_FOOT = "Everything in this example is made up.";
export const HOW_SEO_DESCRIPTION = `A video or description of a recurring job becomes a job packet. ${FIRST_LOOK_WHEN_READY} Free for sites.`;
export const QUESTIONS_SEO_DESCRIPTION = "What Blueprint costs a site, how fast we reply, which jobs fit, what deployment companies see and how they respond, what stays private, and who we are.";
export const START_SEO_DESCRIPTION = "Start a job with a video or description of the work, where the job is, and an email. Blueprint sends it to approved deployment companies. Free for sites.";
export const PARTNERS_SEO_DESCRIPTION = "Robot deployment companies can apply to receive job packets with the site's description and a first look when available. Nothing is charged today.";
export const ROBOT_TEAM_SEO_DESCRIPTION = "Approved deployment companies see the jobs sites send and answer. Blueprint approves each company by hand. Nothing is charged today.";
