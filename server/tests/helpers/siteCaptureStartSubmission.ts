/**
 * The exact body `client/src/components/site/SiteCaptureStart.tsx` posts to
 * `/api/workspace/capture-start` when a new site starts a job by uploading the
 * footage it already has, under the account it creates from the email alone.
 *
 * `client/tests/components/SiteCaptureStart.test.tsx` checks the component's
 * real request against this function, and the server journey in
 * `server/tests/team-evaluation-request-journey.test.ts` starts from it. If the
 * form changes what it sends, the client test fails until this is updated,
 * and the server journey then runs against the new shape. Tests that build
 * records by hand are what hid the request-step blocker (audit P0-5).
 */
import { anonymizedOpportunityDraft } from "../../../client/src/types/taskBrowse";

/**
 * What the person types into the start form. The job is the one kind a robot
 * team's evaluation can run (`siteTaskScope.ts`): one rigid object, placed at
 * another spot on the surface it starts on.
 */
export const SITE_CAPTURE_START_FORM = {
  task: "Pick up each packed carton and place it at the end of the table",
  location: "Austin, TX",
  email: "owner@example.com",
} as const;

export function siteCaptureStartSubmission(params: {
  requestId: string;
  retryToken: string;
  sourcePageUrl: string;
  /** No card grant: a job kept private before the start form dropped that choice (2026-10-22). */
  keepPrivate?: boolean;
  task?: string;
  email?: string;
}) {
  const task = params.task ?? SITE_CAPTURE_START_FORM.task;
  return {
    requestId: params.requestId,
    retryToken: params.retryToken,
    firstName: "",
    lastName: "",
    email: params.email ?? SITE_CAPTURE_START_FORM.email,
    roleTitle: "Site operator",
    buyerType: "site_operator",
    accountSignup: false,
    acceptedTerms: true,
    requestedLanes: [],
    siteName: SITE_CAPTURE_START_FORM.location,
    siteLocation: SITE_CAPTURE_START_FORM.location,
    taskStatement: task,
    taskDescription: task,
    ...(params.keepPrivate ? {} : {
      publicTaskListing: {
        consent: true,
        statementVersion: "public-task-card-v1",
        details: anonymizedOpportunityDraft(task),
      },
    }),
    siteTaskGates: {},
    siteTaskSpec: {},
    captureMode: "self_capture",
    captureRegion: "us",
    hasExistingFootage: true,
    descriptionOnly: false,
    descriptionAuthority: { granted: true, statementVersion: "2026-10-06.v1" },
    consentAttestation: { granted: true, statementVersion: "2026-09-18.v1" },
    context: { sourcePageUrl: params.sourcePageUrl },
  };
}
