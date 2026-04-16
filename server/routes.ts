import type { Express } from "express";
import createCheckoutSessionHandler from "./routes/api/create-checkout-session";
import googlePlacesHandler from "./routes/api/google-places";
import generateImageHandler from "./routes/api/generate-image";
import submitToSheetsHandler from "./routes/api/submit-to-sheets";
import processWaitlistHandler from "./routes/process-waitlist";
import uploadToB2Handler from "./routes/api/upload-to-b2";
import postSignupWorkflowsHandler from "./routes/post-signup-workflows";
import helpRouter from "./routes/help";
import geminiRouter from "./routes/gemini";
import aiStudioRouter from "./routes/ai-studio";
import qrLinkRouter from "./routes/qr-link";
import appleAssociationRouter from "./routes/apple-app-site-association";
import stripeAccountRouter from "./routes/stripe";
import creatorRouter from "./routes/creator";
import contactHandler from "./routes/contact";
import waitlistHandler from "./routes/waitlist";
import applyHandler from "./routes/apply";
import healthRouter from "./routes/health";
import errorsRouter from "./routes/errors";
import siteContentRouter from "./routes/site-content";
import inboundRequestRouter from "./routes/inbound-request";
import adminLeadsRouter from "./routes/admin-leads";
import adminFieldOpsRouter from "./routes/admin-field-ops";
import adminAgentRouter from "./routes/admin-agent";
import adminCreativeRouter from "./routes/admin-creative";
import adminGrowthRouter, {
  sendgridWebhookHandler,
} from "./routes/admin-growth";
import adminSiteWorldsRouter from "./routes/admin-site-worlds";
import analyticsIngestRouter from "./routes/analytics-ingest";
import experimentsRouter from "./routes/experiments";
import requestsRouter from "./routes/requests";
import marketplaceRouter from "./routes/marketplace";
import internalPipelineRouter from "./routes/internal-pipeline";
import internalGapIntakeRouter from "./routes/internal-gap-intake";
import internalHumanBlockersRouter from "./routes/internal-human-blockers";
import internalHumanRepliesRouter from "./routes/internal-human-replies";
import siteWorldsRouter from "./routes/site-worlds";
import siteWorldSessionsRouter, { publicSiteWorldSessionsRouter } from "./routes/site-world-sessions";
import { paperclipOpsFirestoreRelayHandler } from "./routes/paperclip-relay";
import slackEventsRouter from "./routes/slack-events";
import voiceRouter, {
  telephonyInboundHandler,
  telephonyStatusHandler,
  voiceWebhookHandler,
} from "./routes/voice";
import verifyFirebaseToken from "./middleware/verifyFirebaseToken";
import { csrfCookieHandler, csrfProtection } from "./middleware/csrf";
import marketplaceEntitlementsRouter from "./routes/marketplace-entitlements";
import cityLaunchRouter from "./routes/city-launch";

export function registerRoutes(app: Express) {
  app.use(appleAssociationRouter);

  // Health check routes (no /api prefix for standard probe paths)
  app.use(healthRouter);

  // Public content summary for external tooling.
  app.use("/api/site-content", siteContentRouter);
  app.use("/api/experiments", experimentsRouter);
  app.use("/api/internal/pipeline", internalPipelineRouter);
  app.use("/api/internal/gap-intake", internalGapIntakeRouter);
  app.use("/api/internal/human-blockers", internalHumanBlockersRouter);
  app.use("/api/internal/human-replies", internalHumanRepliesRouter);
  app.post("/api/paperclip/ops-firestore-relay", paperclipOpsFirestoreRelayHandler);
  app.use("/api/slack", slackEventsRouter);
  app.use("/api/site-worlds", siteWorldsRouter);
  app.use("/api/site-worlds/sessions", publicSiteWorldSessionsRouter);

  // API routes for Express
  app.get("/api/csrf", csrfCookieHandler);
  // Public semantic search for the marketplace (CSRF-protected, no auth required).
  app.use(
    "/api/marketplace/entitlements",
    verifyFirebaseToken,
    marketplaceEntitlementsRouter,
  );
  app.use("/api/marketplace", csrfProtection, marketplaceRouter);
  app.use("/api/errors", csrfProtection, errorsRouter);
  app.use("/api/analytics", csrfProtection, analyticsIngestRouter);
  app.post(
    "/api/create-checkout-session",
    csrfProtection,
    verifyFirebaseToken,
    createCheckoutSessionHandler,
  );
  app.get("/api/googlePlaces", verifyFirebaseToken, googlePlacesHandler);
  app.all(
    "/api/generate-image",
    csrfProtection,
    verifyFirebaseToken,
    generateImageHandler,
  );
  app.post(
    "/api/submit-to-sheets",
    csrfProtection,
    verifyFirebaseToken,
    submitToSheetsHandler,
  );
  app.post("/api/process-waitlist", csrfProtection, processWaitlistHandler);
  // Public endpoints (no Firebase auth required).
  app.post("/api/contact", csrfProtection, contactHandler);
  app.post("/api/waitlist", csrfProtection, waitlistHandler);
  app.post("/api/apply", csrfProtection, applyHandler);
  app.use("/api/help", csrfProtection, helpRouter);
  app.post("/api/voice/webhook", voiceWebhookHandler);
  app.post("/api/voice/telephony/inbound", telephonyInboundHandler);
  app.post("/api/voice/telephony/status", telephonyStatusHandler);
  app.post("/api/growth/webhooks/sendgrid", sendgridWebhookHandler);
  app.use("/api/voice", csrfProtection, voiceRouter);
  // Inbound request (lead pipeline) - public submission endpoint
  app.use("/api/inbound-request", csrfProtection, inboundRequestRouter);
  app.use("/api/requests", csrfProtection, requestsRouter);
  // Admin leads management - requires Firebase auth
  app.use(
    "/api/admin/leads",
    csrfProtection,
    verifyFirebaseToken,
    adminLeadsRouter,
  );
  app.use(
    "/api/admin/field-ops",
    csrfProtection,
    verifyFirebaseToken,
    adminFieldOpsRouter,
  );
  app.use(
    "/api/admin/agent",
    csrfProtection,
    verifyFirebaseToken,
    adminAgentRouter,
  );
  app.use(
    "/api/admin/creative",
    csrfProtection,
    verifyFirebaseToken,
    adminCreativeRouter,
  );
  app.use(
    "/api/admin/growth",
    csrfProtection,
    verifyFirebaseToken,
    adminGrowthRouter,
  );
  app.use(
    "/api/admin/site-worlds",
    csrfProtection,
    verifyFirebaseToken,
    adminSiteWorldsRouter,
  );
  app.use("/api/site-worlds/sessions", csrfProtection, verifyFirebaseToken, siteWorldSessionsRouter);
  app.post(
    "/api/upload-to-b2",
    csrfProtection,
    verifyFirebaseToken,
    uploadToB2Handler,
  );
  app.post(
    "/api/post-signup-workflows",
    csrfProtection,
    verifyFirebaseToken,
    postSignupWorkflowsHandler,
  );
  app.use("/api/gemini", csrfProtection, verifyFirebaseToken, geminiRouter);
  app.use("/api/ai-studio", csrfProtection, verifyFirebaseToken, aiStudioRouter);
  app.use("/api/qr", csrfProtection, verifyFirebaseToken, qrLinkRouter);
  app.use("/v1/creator", verifyFirebaseToken, creatorRouter);
  app.use("/v1/stripe", csrfProtection, verifyFirebaseToken, stripeAccountRouter);
  app.use("/api/city-launch", csrfProtection, verifyFirebaseToken, cityLaunchRouter);
}
