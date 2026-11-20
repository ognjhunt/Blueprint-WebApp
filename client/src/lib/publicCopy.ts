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

export const HOME_TITLE = "Post a job for robots.";
export const HOME_SUB_LINE = "Share a video of one repetitive job with approved robot deployment companies.";

/**
 * The answers the company form offers (`CompanyJob.tsx`), said the same way on every public page: three always, and the
 * two tested ones only once the job's simulation can be downloaded. Built from the form's own labels so it cannot drift.
 * No page says a company tests anything: Blueprint runs no company's robot software.
 */
export const COMPANY_ANSWERS = `${ANSWER.interested}, ${ANSWER.declined} or ${ANSWER.needs_something}; once the simulation can be `
  + `downloaded, also ${ANSWER.tested_can_do} or ${ANSWER.tested_cannot_yet}`;
/** The answers beside which a site may ask for an introduction (`INTRODUCIBLE_RESPONSE_STATES`). */
export const INTRODUCIBLE_ANSWERS = `${ANSWER.interested} or ${ANSWER.tested_can_do}`;

export const START_JOB = "Start a job";
export const FIRST_LOOK_WHEN_READY = "We add a first look at which robots could fit when we have enough detail.";
export const FREE_FOR_SITES = "Free for sites.";
export const FOR_DEPLOYMENT_COMPANIES = "For deployment companies";
export const PARTNERS_TITLE = "Find jobs for the robots you deploy.";

export const HOW_STEPS = [
  { key: "video", title: "Film the job", line: "Use your phone to show one full round of a job that repeats." },
  { key: "packet", title: "Companies review it", line: "We share your video and job description with approved companies, with a first look and a simulation when ready." },
  { key: "companies", title: "Choose who to meet", line: "Responses appear on your job page. If a company is interested, you can ask for an introduction." },
] as const;

/** What used to be the "Jobs we support" page, in one line. */
export const JOBS_THAT_FIT = "Jobs that involve picking something up and putting it down are a good fit. You can post other jobs, too.";

export const HOME_SEO_TITLE = `Blueprint | ${HOME_TITLE}`;
export const HOME_SEO_DESCRIPTION = `${HOME_SUB_LINE} See responses and choose who to meet. ${FREE_FOR_SITES}`;

/**
 * The home page's moving example card: what a site sees on its job page once companies answer. Everything on it is
 * invented and marked "Example"; the answer labels and aliases come from `companyResponses.ts`, as the site sees them.
 */
export const EXAMPLE_TAG = "Example job";
export const HOW_SEO_DESCRIPTION = HOME_SEO_DESCRIPTION;
export const QUESTIONS_SEO_DESCRIPTION = "What Blueprint costs a site, what happens after it sends a job, which jobs fit, what deployment companies see and how they respond, what stays private, and who we are.";
export const START_SEO_DESCRIPTION = "Upload a video of a repetitive job, or start now and film it on your phone. Free for sites.";
export const PARTNERS_SEO_DESCRIPTION = "Apply to review real robotics jobs with site videos and details. When a site asks to meet, Blueprint introduces you.";
export const ROBOT_TEAM_SEO_DESCRIPTION = "Approved robot deployment companies can browse site jobs, watch videos and respond.";
