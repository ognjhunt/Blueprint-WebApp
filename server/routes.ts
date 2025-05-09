import type { Express } from "express";
import createCheckoutSessionHandler from "../client/src/pages/api/create-checkout-session/route";
import googlePlacesHandler from "../client/src/pages/api/googlePlaces";
import generateImageHandler from "../client/src/pages/api/generate-image";
import submitToSheetsHandler from "../client/src/pages/api/submit-to-sheets";

export function registerRoutes(app: Express) {
  // API routes for Express
  app.post('/api/create-checkout-session', createCheckoutSessionHandler);
  app.get('/api/googlePlaces', googlePlacesHandler);
  app.all('/api/generate-image', generateImageHandler);
  app.post('/api/submit-to-sheets', submitToSheetsHandler);
}
