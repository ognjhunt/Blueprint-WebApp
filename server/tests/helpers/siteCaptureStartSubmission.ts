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
import { TASK_CONFIRMATION_VERSION } from "../../../client/src/lib/taskConfirmationStatement";

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
  /**
   * The start form with its one-line consent switched off (`START_FORM_SHORT_CONSENT`): the long statements, recording
   * 2026-11-02.v2 and description 2026-10-06.v1, which do not share the job. By default the body is what the form sends
   * today: the one line, recording and description authority `2026-11-12.v4`, which shares the job (2026-11-12).
   */
  longForm?: boolean;
  /** A job that is not shared: since 2026-11-12 that is a job under the long statements (`longForm`). */
  keepPrivate?: boolean;
  task?: string;
  email?: string;
  /** The optional success field on the form. */
  successDefinition?: string;
  /**
   * The one box the form requires (owner decision 2026-11-07). Only a body
   * from before that decision, or a direct API caller, leaves it out.
   */
  withoutTaskConfirmation?: boolean;
}) {
  const task = params.task ?? SITE_CAPTURE_START_FORM.task;
  const longForm = params.longForm === true || params.keepPrivate === true;
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
    ...(params.withoutTaskConfirmation ? {} : {
      taskConfirmation: { granted: true, statementVersion: TASK_CONFIRMATION_VERSION },
    }),
    ...(params.successDefinition ? { successCriteria: { successDefinition: params.successDefinition } } : {}),
    siteTaskGates: {},
    siteTaskSpec: {},
    captureMode: "self_capture",
    captureRegion: "us",
    hasExistingFootage: true,
    descriptionOnly: false,
    descriptionAuthority: { granted: true, statementVersion: longForm ? "2026-10-06.v1" : "2026-11-12.v4" },
    consentAttestation: { granted: true, statementVersion: longForm ? "2026-11-02.v2" : "2026-11-12.v4" },
    context: { sourcePageUrl: params.sourcePageUrl },
  };
}
