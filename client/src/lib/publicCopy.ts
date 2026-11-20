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
 * The answers the company form offers (`CompanyJob.tsx`), said the same way on every public page, built from the form's
 * own labels so they cannot drift: the three everyday answers in one sentence, and the two tested ones in a short second
 * sentence of the page's own ("Once the simulation can be downloaded, … can also answer …"), because a company can give
 * them only once the job's simulation can be downloaded (launch copy, 2026-11-20). No page says Blueprint tests anything:
 * Blueprint runs no company's robot software.
 */
export const EVERYDAY_ANSWERS = `${ANSWER.interested}, ${ANSWER.declined} or ${ANSWER.needs_something}`;
export const TESTED_ANSWERS = `${ANSWER.tested_can_do} or ${ANSWER.tested_cannot_yet}`;
/** The same answers as one clause, for the approval email until it builds its own sentence from `COMPANY_RESPONSE_LABELS`. */
export const COMPANY_ANSWERS = `${EVERYDAY_ANSWERS}; once the simulation can be downloaded, also ${TESTED_ANSWERS}`;
/** The answers beside which a site may ask for an introduction (`INTRODUCIBLE_RESPONSE_STATES`). */
export const INTRODUCIBLE_ANSWERS = `${ANSWER.interested} or ${ANSWER.tested_can_do}`;

export const START_JOB = "Start a job";
export const FIRST_LOOK_WHEN_READY = "We add a first look at which robots could fit when we have enough detail.";
export const FREE_FOR_SITES = "Free for sites.";
export const FOR_DEPLOYMENT_COMPANIES = "For deployment companies";
/** The header link and page for deployment companies (owner, 2026-11-20): one page, a sample job, the application. */
export const FIND_JOBS = "Find jobs";
export const FIND_JOBS_PATH = "/jobs";
export const PARTNERS_TITLE = "Find jobs for the robots you deploy.";
/** The Find jobs page's tab and search title: its heading, so the short nav label is explained where it lands. */
export const PARTNERS_PAGE_NAME = "Find jobs for the robots you deploy";

/**
 * The Find jobs page's sample job (`SampleJob.tsx`). Stock footage (Mixkit, free license), never a site's job, and said
 * so where it starts. Its facts are only what the video shows; what a live job adds names features that exist.
 */
export const SAMPLE_JOB = {
  tag: "Sample job",
  notLive: "Stock footage, not a live job. No site posted it.",
  title: "Load parcels onto a hand truck",
  sentence: "Pick up each parcel and stack it on the hand truck.",
  done: "Every parcel is on the hand truck, stacked so none falls.",
  facts: ["Cardboard parcels in two sizes", "Stacked on a two-wheel hand truck, the larger parcel at the bottom", "Outdoors, on a paved path"],
  credit: "Video: Mixkit, free license. Sound removed, as on every job.",
  liveAlso: [
    "The site's answers to a few questions about the job, such as the heaviest item and the peak rate.",
    "A first look on paper at which kinds of robot most likely fit, from published specifications.",
    "A simulation of the site with the job's object in it, to download and open in your own tools.",
  ],
  introduction: "You see no site name, address or contact details until the site asks to meet you. Then we email you both each other's details.",
  cta: "Apply to see jobs",
} as const;

export const HOW_STEPS = [
  { key: "video", title: "Film the job", line: "Use your phone to show one full round of a job that repeats." },
  { key: "packet", title: "Companies review it", line: "We share your video and job description with approved companies, with a first look and a simulation when ready." },
  { key: "companies", title: "Choose who to meet", line: "Responses appear on your job page. If a company is interested, you can ask for an introduction." },
] as const;

/** The Questions page's "Jobs" row: Blueprint takes every job (owner, 2026-11-17), so the line says what kind of job to post. */
export const JOBS_THAT_FIT = "Any job someone does over and over, like moving boxes, loading a cart or sorting items.";

export const HOME_SEO_TITLE = `Blueprint | ${HOME_TITLE}`;
export const HOME_SEO_DESCRIPTION = `${HOME_SUB_LINE} See responses and choose who to meet. ${FREE_FOR_SITES}`;

/**
 * The home page's moving example card: what a site sees on its job page once companies answer. Everything on it is
 * invented and marked "Example"; the answer labels and aliases come from `companyResponses.ts`, as the site sees them.
 */
export const EXAMPLE_TAG = "Example job";
export const HOW_SEO_DESCRIPTION = `Film one job that repeats. We share it with approved deployment companies. You see their responses and choose who to meet. ${FREE_FOR_SITES}`;
export const QUESTIONS_SEO_DESCRIPTION = "What Blueprint costs a site, what deployment companies see, how they respond, what stays private, and who we are.";
export const START_SEO_DESCRIPTION = "Upload a video of a repetitive job, or start now and film it on your phone. Free for sites.";
export const PARTNERS_SEO_DESCRIPTION = "For robot deployment companies: apply to see real jobs that sites want robots to do, each with a video. When a site asks to meet, Blueprint introduces you.";
export const ROBOT_TEAM_SEO_DESCRIPTION = "Approved robot deployment companies can see jobs, watch videos and respond.";
