import type { Express } from "express";
import createCheckoutSessionHandler from "../client/src/pages/api/create-checkout-session/route";
import googlePlacesHandler from "../client/src/pages/api/googlePlaces";
import generateImageHandler from "../client/src/pages/api/generate-image";
import submitToSheetsHandler from "../client/src/pages/api/submit-to-sheets";
import processWaitlistHandler from "./routes/process-waitlist";
// import processMappingConfirmationHandler from "./routes/mapping-confirmation"; // Commented out - handler is not exported
import demoDayConfirmationHandler from "./routes/demo-day-confirmation";
import uploadToB2Handler from "../client/src/pages/api/upload-to-b2";

export function registerRoutes(app: Express) {
  // API routes for Express
  app.post("/api/create-checkout-session", createCheckoutSessionHandler);
  app.get("/api/googlePlaces", googlePlacesHandler);
  app.all("/api/generate-image", generateImageHandler);
  app.post("/api/submit-to-sheets", submitToSheetsHandler);
  app.post("/api/process-waitlist", processWaitlistHandler);
  // app.post("/api/mapping-confirmation", processMappingConfirmationHandler); // Commented out - handler is not exported
  app.post("/api/demo-day-confirmation", demoDayConfirmationHandler);
  app.post("/api/upload-to-b2", uploadToB2Handler);
}
