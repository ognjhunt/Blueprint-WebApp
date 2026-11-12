/**
 * The public pages' words, in one place, bare bones (owner direction 2026-11-11: "a 10 year old should be able to
 * understand what everything is"). The home page, How it works, Questions, index.html, llms.txt, the agent page list
 * (`server/routes/site-content.ts`) and the structured data all read or repeat these, so one edit here keeps them in
 * step.
 *
 * The frame is the owner's (2026-11-12): a site films a job once; Blueprint turns it into a job packet (the site's
 * sentence for the job, a first look on paper at which robots could fit, a simulation of the site, what counts as
 * done). Sharing is the service (owner, 2026-11-12): a job sent under the current statement is shared, with its video
 * without sound and its simulation, with the deployment companies Blueprint approves; a site's name, address and
 * contact details go to a company only through an introduction the site asks for. No price is stated anywhere: "Free
 * for sites" and "Nothing is charged today" are the only money sentences.
 */

export const HOME_LABEL = "Free for sites";
/** The outcome a site wants (owner, 2026-11-12 ~19:15Z: "the goal is ... having repetitive work/jobs done by robots"). */
export const HOME_TITLE = "Get repetitive work done by robots.";
/** The line under the title. The home page does not lead with privacy (owner, same message); the rule is said where the site agrees. */
export const HOME_SUB_LINE = "Film the job once. Robot deployment companies can test it on a simulation of your site and tell you if they can do it.";

export const STEP_SEND = "Send a video of one job that repeats.";
export const STEP_SIMULATE = "We send the job to robot deployment companies we approve and build a simulation of your site for them to test.";
export const STEP_ANSWER = "Their answers come back to you: interested, can do, not a fit, or would need something. You pick up to three to meet.";

export const START_JOB = "Start a job";
export const HOME_START_HELPER = "A video, where the job is, and an email.";
/** The home page's link to the page for deployment companies. */
export const FOR_DEPLOYMENT_COMPANIES_LINK = "Deploy robots? See how jobs reach you";
/** The page's own name, in the navigation and its label. */
export const FOR_DEPLOYMENT_COMPANIES = "For deployment companies";

export const HOW_STEPS = [
  { key: "video", title: "Your video", line: "One job that repeats, filmed on any phone." },
  { key: "packet", title: "Your job packet", line: "Your sentence for the job, a first look on paper, a simulation of your site, and what counts as done." },
  { key: "companies", title: "Deployment companies", line: "We share your job, with its video, with deployment companies we approve. We approve each company by hand. They answer, and you choose which to meet." },
  { key: "trial", title: "Early trial", line: "Sometimes we also try openly available robot software in the simulation. It is a trial, not a prediction of any company's robot." },
] as const;

/** What used to be the "Jobs we support" page, in one line. */
export const JOBS_THAT_FIT = "Best for one job that repeats, with known objects, where something is picked up and put down. Other jobs still go to companies; their simulation waits until we can build one.";

export const HOME_SEO_TITLE = "Blueprint | Get repetitive work done by robots.";
export const HOME_SEO_DESCRIPTION = "Film one job that repeats; we send it to robot deployment companies we approve and build a simulation of your site, so they can test it and tell you if they can do it. Free for sites.";

/**
 * The home page's moving example card: what a site sees on its job page once companies answer. Everything on it is
 * invented and marked "Example"; the answer labels and aliases come from `companyResponses.ts`, as the site sees them.
 */
export const EXAMPLE_TAG = "Example";
export const EXAMPLE_CARD_NAME = "Example of a job page once deployment companies answer";
export const exampleSentTo = (count: number) => `Sent to ${count} deployment ${count === 1 ? "company" : "companies"}`;
export const EXAMPLE_FOOT = "Everything in this example is made up.";
export const HOW_SEO_DESCRIPTION = "One video of a job that repeats becomes a job packet: your sentence for the job, a first look on paper, a simulation of your site, and what counts as done. Approved deployment companies see it and answer. Free for sites.";
export const QUESTIONS_SEO_DESCRIPTION = "What Blueprint costs a site, how fast we reply, which jobs fit, what deployment companies see and how they respond, what stays private, and who we are.";
export const START_SEO_DESCRIPTION = "Start a job with a video of the work, where the job is, and an email. Blueprint turns it into a job packet: a first look at which robots could fit and a simulation of your site. Free for sites.";
export const PARTNERS_SEO_DESCRIPTION = "Robot deployment companies can apply to receive real jobs from real sites, each with the site's video, a first look at which robots could fit and the simulation of the site. Nothing is charged today.";
export const ROBOT_TEAM_SEO_DESCRIPTION = "Approved deployment companies see the jobs sites send, with their videos, and answer. Blueprint approves each company by hand. Nothing is charged today.";
