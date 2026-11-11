import { Router, type Request, type Response } from "express";

/**
 * The Apple app-site association file, retired (owner, 2026-11-11).
 *
 * It used to name the BlueprintCapture app and its App Clip, so an iPhone
 * opening a capture link (`/capture-upload/*`) could hand it to the app. No
 * capture app is in use: the site films its own job in the browser. The file
 * carried only those two capture-app entries (applinks and appclips) and
 * nothing else, so there is nothing left to serve, whatever APPLE_TEAM_ID,
 * IOS_APP_BUNDLE_ID or IOS_APP_CLIP_BUNDLE_ID say. A 404 tells Apple there is
 * no association, so the capture link always opens the browser recorder.
 */
export const ASSOCIATION_PATHS = [
  "/.well-known/apple-app-site-association",
  "/apple-app-site-association",
];

export function createAppleAssociationRouter() {
  const router = Router();
  const retired = (_req: Request, res: Response) => {
    res.status(404).json({ error: "app_association_retired" });
  };
  router.get(ASSOCIATION_PATHS, retired);
  router.head(ASSOCIATION_PATHS, (_req: Request, res: Response) => {
    res.status(404).end();
  });
  return router;
}

export default createAppleAssociationRouter();
