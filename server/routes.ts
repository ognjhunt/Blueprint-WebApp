import type { Express } from "express";
import createCheckoutSessionHandler from "../client/src/pages/api/create-checkout-session/route";
import googlePlacesHandler from "../client/src/pages/api/googlePlaces";
import generateImageHandler from "../client/src/pages/api/generate-image";
import submitToSheetsHandler from "../client/src/pages/api/submit-to-sheets";
import processWaitlistHandler from "./routes/process-waitlist";
// import processMappingConfirmationHandler from "./routes/mapping-confirmation"; // Commented out - handler is not exported
import demoDayConfirmationHandler from "./routes/demo-day-confirmation";
import uploadToB2Handler from "../client/src/pages/api/upload-to-b2";
import postSignupWorkflowsHandler from "./routes/post-signup-workflows";
import webhooksRouter from "./routes/webhooks";
import aiStudioRouter from "./routes/ai-studio";
import qrLinkRouter from "./routes/qr-link";
import appleAssociationRouter from "./routes/apple-app-site-association";
import stripeAccountRouter from "./routes/stripe";
import contactHandler from "./routes/contact";
import waitlistHandler from "./routes/waitlist";
import applyHandler from "./routes/apply";
import healthRouter from "./routes/health";
import errorsRouter from "./routes/errors";
import verifyFirebaseToken from "./middleware/verifyFirebaseToken";

export function registerRoutes(app: Express) {
  app.use(appleAssociationRouter);

  // Health check routes (no /api prefix for standard probe paths)
  app.use(healthRouter);

  // API routes for Express
  app.use("/api/webhooks", webhooksRouter);
  app.use("/api/errors", errorsRouter);
  app.post(
    "/api/create-checkout-session",
    verifyFirebaseToken,
    createCheckoutSessionHandler,
  );
  app.get("/api/googlePlaces", verifyFirebaseToken, googlePlacesHandler);
  app.all("/api/generate-image", verifyFirebaseToken, generateImageHandler);
  app.post(
    "/api/submit-to-sheets",
    verifyFirebaseToken,
    submitToSheetsHandler,
  );
  app.post("/api/process-waitlist", processWaitlistHandler);
  // Public endpoints (no Firebase auth required).
  app.post("/api/contact", contactHandler);
  app.post("/api/waitlist", waitlistHandler);
  app.post("/api/apply", applyHandler);
  // app.post("/api/mapping-confirmation", processMappingConfirmationHandler); // Commented out - handler is not exported
  app.post("/api/demo-day-confirmation", demoDayConfirmationHandler);
  app.post("/api/upload-to-b2", verifyFirebaseToken, uploadToB2Handler);
  app.post(
    "/api/post-signup-workflows",
    verifyFirebaseToken,
    postSignupWorkflowsHandler,
  );
  app.use("/api/ai-studio", verifyFirebaseToken, aiStudioRouter);
  app.use("/api/qr", verifyFirebaseToken, qrLinkRouter);
  app.use("/v1/stripe", stripeAccountRouter);
}
