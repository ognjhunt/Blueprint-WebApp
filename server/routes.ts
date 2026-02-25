import type { Express } from "express";
import createCheckoutSessionHandler from "./routes/api/create-checkout-session";
import googlePlacesHandler from "./routes/api/google-places";
import generateImageHandler from "./routes/api/generate-image";
import submitToSheetsHandler from "./routes/api/submit-to-sheets";
import processWaitlistHandler from "./routes/process-waitlist";
import uploadToB2Handler from "./routes/api/upload-to-b2";
import postSignupWorkflowsHandler from "./routes/post-signup-workflows";
import geminiRouter from "./routes/gemini";
import aiStudioRouter from "./routes/ai-studio";
import qrLinkRouter from "./routes/qr-link";
import appleAssociationRouter from "./routes/apple-app-site-association";
import stripeAccountRouter from "./routes/stripe";
import contactHandler from "./routes/contact";
import waitlistHandler from "./routes/waitlist";
import applyHandler from "./routes/apply";
import healthRouter from "./routes/health";
import errorsRouter from "./routes/errors";
import siteContentRouter from "./routes/site-content";
import inboundRequestRouter from "./routes/inbound-request";
import adminLeadsRouter from "./routes/admin-leads";
import marketplaceRouter from "./routes/marketplace";
import verifyFirebaseToken from "./middleware/verifyFirebaseToken";
import { csrfCookieHandler, csrfProtection } from "./middleware/csrf";

export function registerRoutes(app: Express) {
  app.use(appleAssociationRouter);

  // Health check routes (no /api prefix for standard probe paths)
  app.use(healthRouter);

  // Public content summary for external tooling.
  app.use("/api/site-content", siteContentRouter);

  // API routes for Express
  app.get("/api/csrf", csrfCookieHandler);
  // Public semantic search for the marketplace (CSRF-protected, no auth required).
  app.use("/api/marketplace", csrfProtection, marketplaceRouter);
  app.use("/api/errors", csrfProtection, errorsRouter);
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
  // Inbound request (lead pipeline) - public submission endpoint
  app.use("/api/inbound-request", csrfProtection, inboundRequestRouter);
  // Admin leads management - requires Firebase auth
  app.use(
    "/api/admin/leads",
    csrfProtection,
    verifyFirebaseToken,
    adminLeadsRouter,
  );
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
  app.use("/v1/stripe", csrfProtection, stripeAccountRouter);
}
