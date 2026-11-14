import companyMediaRouter from "./routes/company-media";
import jobFactsRouter from "./routes/job-facts";
import jobOutcomesRouter from "./routes/job-outcomes";
import robotTeamAccessRouter from "./routes/robot-team-access";
import accountInvitationsRouter from "./routes/account-invitations";
import accountDeletionRouter from "./routes/account-deletion";
import passwordResetRouter from "./routes/password-reset";
import adminRobotTeamAccessRouter from "./routes/admin-robot-team-access";
import type { Express } from "express";
import captureUploadsRouter from "./routes/capture-uploads";
import websiteAtlasPreviewDownloadsRouter from "./routes/website-atlas-preview-downloads";
import websiteAtlasPreviewViewsRouter from "./routes/website-atlas-preview-views";
import websiteDestinationPicturesRouter from "./routes/website-destination-pictures";
import screeningPracticeRunVideosRouter from "./routes/screening-practice-run-videos";
import operatorStatusRouter from "./routes/operator-status";
import workspaceRouter from "./routes/workspace";
import contactTaskMediaHandler from "./routes/contact-task-media";
import healthRouter from "./routes/health";
import errorsRouter from "./routes/errors";
import siteContentRouter from "./routes/site-content";
import locationAutocompleteRouter from "./routes/location-autocomplete";
import adminJobConsoleRouter from "./routes/admin-job-console";
import jobWorkflowRouter from "./routes/job-workflow";
import internalJobEvidenceRouter from "./routes/internal-job-evidence";
import emailPreferencesRouter from "./routes/email-preferences";
import inboundRequestRouter from "./routes/inbound-request";
import adminRobotTeamsRouter from "./routes/admin-robot-teams";
import { resendWebhookHandler } from "./routes/resend-webhook";
import analyticsIngestRouter from "./routes/analytics-ingest";
import experimentsRouter from "./routes/experiments";
import internalPipelineRouter from "./routes/internal-pipeline";
import internalCaptureTestbedsRouter from "./routes/internal-capture-testbeds";
import internalBetaPolicyScreeningRouter from "./routes/internal-beta-policy-screening";
import internalSceneExecutionWindowRouter from "./routes/internal-scene-execution-window";
import internalOwnerSuccessProposalRouter from "./routes/internal-owner-success-proposal";
import internalRobotAccessProposalRouter from "./routes/internal-robot-access-proposal";
import internalCaptureReconstructionRouter from "./routes/internal-capture-reconstruction";
import internalWebsitePreparationRouter from "./routes/internal-website-preparation";
import internalCaptureWorldsRouter from "./routes/internal-capture-worlds";
import selfCaptureUploadsRouter from "./routes/self-capture-uploads";
import siteTaskBriefRouter from "./routes/site-task-brief";
import siteClaimRouter from "./routes/site-claim";
import internalTaskEvaluationLaunchesRouter from "./routes/internal-task-evaluation-launches";
import siteWorldsRouter from "./routes/site-worlds";
import verifyFirebaseToken from "./middleware/verifyFirebaseToken";
import { requireAdminRole } from "./middleware/requireAdminRole";
import { csrfCookieHandler, csrfProtection } from "./middleware/csrf";
import { requireAppCheck } from "./middleware/appCheck";
import internalTaskEvaluationLaunchSubmissionsRouter from "./routes/internal-task-evaluation-launch-submissions";
import internalTaskEvaluationLaunchPreparationsRouter from "./routes/internal-task-evaluation-launch-preparations";
import { registerRetiredCapturerRoutes } from "./utils/retiredCapturerRoutes";

export function registerRoutes(app: Express) {
  // Capturer money and account routes are switched off (owner, 2026-11-11).
  registerRetiredCapturerRoutes(app);

  // Health check routes (no /api prefix for standard probe paths)
  app.use(healthRouter);

  // Public content summary for external tooling.
  app.use("/api/site-content", siteContentRouter);
  app.use("/api/location-autocomplete", locationAutocompleteRouter);
  // Founder job console: one row per site job with its loop stage. Read-only;
  // admin/ops role enforced inside the router.
  app.use("/api/admin/jobs", csrfProtection, verifyFirebaseToken, requireAdminRole, adminJobConsoleRouter);
  app.use("/api/job-workflow", csrfProtection, jobWorkflowRouter);
  app.use("/api/internal", internalJobEvidenceRouter);
  app.use("/api/account-deletion", csrfProtection, verifyFirebaseToken, accountDeletionRouter);
  app.use("/api/experiments", experimentsRouter);
  app.use("/api/internal/pipeline", internalPipelineRouter);
  app.use("/api/internal/pipeline", internalCaptureTestbedsRouter);
  app.use("/api/internal/pipeline", internalBetaPolicyScreeningRouter);
  app.use("/api/internal/pipeline", internalSceneExecutionWindowRouter);
  app.use("/api/internal/pipeline", internalOwnerSuccessProposalRouter);
  app.use("/api/internal/pipeline", internalRobotAccessProposalRouter);
  app.use("/api/internal/pipeline", internalCaptureReconstructionRouter);
  app.use("/api/internal/pipeline", internalWebsitePreparationRouter);
  app.use("/api/internal/pipeline", internalCaptureWorldsRouter);
  app.use("/api/self-capture/uploads", selfCaptureUploadsRouter);
  // Same signed link as the camera, because it is the same person doing two
  // things about one submission.
  app.use("/api/site-task-brief", siteTaskBriefRouter);
  // The claim link's own read: what the operator would be claiming. The
  // attach is /api/workspace/claim, behind Firebase auth.
  app.use("/api/site-claim", siteClaimRouter);
  app.use("/api/internal/pipeline", internalTaskEvaluationLaunchesRouter);
  // The job's video for an approved deployment company (package E, E3): a ticket bound to the viewer, re-checked per range.
  app.use("/api/company-media", companyMediaRouter);
  // The site's quick answers (CSRF inside the router) and the outcome questions' signed links (the token is the credential).
  app.use("/api/job-facts", jobFactsRouter);
  app.use("/api/job-outcomes", jobOutcomesRouter);
  // Robot-team early access: the public application, and the review queue.
  app.use("/api/robot-team-access", csrfProtection, robotTeamAccessRouter);
  app.use("/api/account-invitations", csrfProtection, accountInvitationsRouter);
  app.use("/api/password-reset", csrfProtection, passwordResetRouter);
  app.use(
    "/api/admin/robot-team-access",
    csrfProtection,
    verifyFirebaseToken,
    requireAdminRole,
    adminRobotTeamAccessRouter,
  );
  app.use("/api/site-worlds", siteWorldsRouter);
  app.use("/api/website-atlas-preview-downloads", websiteAtlasPreviewDownloadsRouter);
  app.use("/api/website-atlas-preview-views", websiteAtlasPreviewViewsRouter);
  app.use("/api/website-destination-pictures", websiteDestinationPicturesRouter);
  app.use("/api/screening-practice-run-videos", screeningPracticeRunVideosRouter);

  // API routes for Express
  app.get("/api/csrf", csrfCookieHandler);
  app.use("/api/errors", csrfProtection, errorsRouter);
  app.use("/api/analytics", csrfProtection, analyticsIngestRouter);
  // Public endpoints (no Firebase auth required).
  app.post("/api/contact", csrfProtection, contactTaskMediaHandler);
  app.post("/api/growth/webhooks/resend", resendWebhookHandler);
  app.use("/api/growth/email", emailPreferencesRouter);
  // Inbound request (lead pipeline) - public submission endpoint
  // App Check is staged by BLUEPRINT_APP_CHECK_MODE (off | monitor | enforce).
  app.use("/api/inbound-request", csrfProtection, requireAppCheck("inbound_intake"), inboundRequestRouter);
  // The robot-team registry and its review queue. Operator-only: accepting a
  // proposal is the one action that turns an inferred figure into a registry
  // value, and it records who did it.
  app.use(
    "/api/admin/robot-teams",
    csrfProtection,
    verifyFirebaseToken,
    requireAdminRole,
    adminRobotTeamsRouter,
  );
  app.use(
    "/api/internal/task-evaluation-launch-submissions",
    internalTaskEvaluationLaunchSubmissionsRouter,
  );
  app.use(
    "/api/internal/task-evaluation-launch-preparations",
    internalTaskEvaluationLaunchPreparationsRouter,
  );
  app.use(
    "/api/capture-uploads",
    csrfProtection,
    verifyFirebaseToken,
    captureUploadsRouter,
  );
  app.use("/api/workspace", csrfProtection, verifyFirebaseToken, workspaceRouter);
  app.use("/api/operator-status", csrfProtection, verifyFirebaseToken, operatorStatusRouter);
}
