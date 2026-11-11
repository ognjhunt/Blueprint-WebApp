/**
 * The public pages' words, in one place, bare bones (owner direction 2026-11-11: "a 10 year old should be able to
 * understand what everything is"; mocks approved with the owner's changes in step 2's wording). The home page, How it
 * works, Questions, index.html, llms.txt, the agent page list (`server/routes/site-content.ts`) and the structured
 * data all read or repeat these, so one edit here keeps them in step.
 *
 * Step 2 is the owner's framing (2026-11-11): Blueprint tests the top AI options (a robot plus the camera-driven AI
 * software that controls it) on the site's own job in a simulation of its site, about ten tries each with things
 * varied between tries, and shows which did best. Pre-programmed motion is never an option. The fine print keeps what the check covers and
 * what it is not.
 */

export const HOME_LABEL = "Free during the beta";
export const HOME_TITLE = "Which robot could do your job?";

export const STEP_SEND = "Send a video of one job that repeats";
export const STEP_TEST = "We test the top AI robots on your job";
export const STEP_TEST_LINE = "in a simulation of your site, and show you which did best.";
export const STEP_COMPANY = "Find a company to set it up";

export const START_JOB = "Start a job";
export const HOME_START_HELPER = "A video, where the job is, and an email.";
export const FOR_ROBOT_COMPANIES = "For robot companies";

/** The limits of the check, in one line, on every public page that describes it (rule 10). */
export const PUBLIC_LIMITS = "We check pick-up-and-put-down jobs. Not a test at your site, or a safety check.";

export const HOW_STEPS = [
  { key: "send", title: "Send a video", line: "One job that repeats, filmed on any phone." },
  { key: "test", title: STEP_TEST, line: "In a simulation of your site, built from your video. Each gets about ten tries, with things moved between tries. You see which did best and how sure we are." },
  { key: "company", title: STEP_COMPANY, line: "Shared with companies we've approved, without your name, only if you press the button." },
] as const;

/** What used to be the "Jobs we support" page, in one line. */
export const JOBS_THAT_FIT = "Best for one job that repeats, with known objects, where something is picked up and put down. Other jobs we keep and hold until we can test them.";

export const HOME_SEO_TITLE = "Blueprint | Which robot could do your job?";
export const HOME_SEO_DESCRIPTION = "Send a video of one job that repeats. Blueprint tests the top AI robots on it in a simulation of your site and shows you which did best. Free during the beta.";
export const HOW_SEO_DESCRIPTION = "Send a video of one job that repeats. Blueprint tests the top AI robots on it in a simulation of your site, built from your video, about ten tries each, and shows you which did best. Free during the beta.";
export const QUESTIONS_SEO_DESCRIPTION = "What Blueprint's free beta costs, how fast we reply, which jobs fit, what the simulation tests and what it is not, how your video stays private, and who we are.";
export const START_SEO_DESCRIPTION = "Start a job with a video of the work, where the job is, and an email. Blueprint tests the top AI robots on it in a simulation of your site and shows you which did best. Free during the beta.";
export const PARTNERS_SEO_DESCRIPTION = "Companies that set robots up can apply to see the jobs sites choose to share, without the site's name, with Blueprint's answer when the site shares it. Free during the beta.";
export const ROBOT_TEAM_SEO_DESCRIPTION = "Apply to see the robot jobs sites choose to share with approved companies. Blueprint approves each company by hand. Free during the beta.";
