import { Router, type Request, type Response } from "express";

import { logger } from "../logger";

interface AppleAssociationPayload {
  applinks: {
    apps: string[];
    details: Array<{ appID: string; paths: string[] }>;
  };
  appclips: {
    apps: string[];
  };
}

export interface AppleAssociationConfig {
  /** The file to serve, or null when the server cannot serve one. */
  payload: AppleAssociationPayload | null;
  /** Placeholder values are configured: answer 204, never a guessed identifier. */
  usesPlaceholders: boolean;
  placeholderFields: string[];
  missingFields: string[];
  invocationPaths: string[];
}

type AssociationEnv = Record<string, string | undefined>;

// `/capture-upload/*` is the capture link the site-operator QR opens. The same
// URL invokes the App Clip (through its App Store Connect experience) and, when
// the full app is installed, opens it as a universal link. The browser recorder
// at that URL stays the fallback for everyone else.
export const DEFAULT_INVOCATION_PATHS = ["/go", "/go/*", "/capture-upload/*"];

const isPlaceholderValue = (value: string | undefined) => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toUpperCase();
  return (
    normalized === "PLACEHOLDER" ||
    normalized === "REPLACE_ME" ||
    normalized === "CHANGE_ME" ||
    normalized === "YOUR_TEAM_ID" ||
    normalized === "YOUR_APP_BUNDLE_ID" ||
    normalized === "YOUR_APP_CLIP_BUNDLE_ID" ||
    normalized === "APPLE_TEAM_ID" ||
    normalized === "IOS_APP_BUNDLE_ID" ||
    normalized === "IOS_APP_CLIP_BUNDLE_ID" ||
    normalized === "APP_BUNDLE_ID" ||
    normalized === "APP_CLIP_BUNDLE_ID" ||
    /^YOUR[_-]/.test(normalized) ||
    /^REPLACE[_-]/.test(normalized) ||
    /^CHANGE[_-]/.test(normalized)
  );
};

export function appleAssociationConfig(env: AssociationEnv): AppleAssociationConfig {
  const appleTeamId = env.APPLE_TEAM_ID?.trim();
  const iosAppBundleId =
    env.IOS_APP_BUNDLE_ID?.trim() || env.APP_BUNDLE_ID?.trim();
  const iosAppClipBundleId =
    env.IOS_APP_CLIP_BUNDLE_ID?.trim() || env.APP_CLIP_BUNDLE_ID?.trim();

  const additionalPaths = (env.APP_CLIP_ADDITIONAL_PATHS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (entry.startsWith("/") ? entry : `/${entry}`));
  const invocationPaths = Array.from(
    new Set([...DEFAULT_INVOCATION_PATHS, ...additionalPaths]),
  );

  const placeholderFields: string[] = [];
  const missingFields: string[] = [];
  const fields: Array<[string, string | undefined]> = [
    ["APPLE_TEAM_ID", appleTeamId],
    ["IOS_APP_BUNDLE_ID", iosAppBundleId],
    ["IOS_APP_CLIP_BUNDLE_ID", iosAppClipBundleId],
  ];
  for (const [name, value] of fields) {
    if (!value) {
      missingFields.push(name);
    } else if (isPlaceholderValue(value)) {
      placeholderFields.push(name);
    }
  }

  const usesPlaceholders = placeholderFields.length > 0;
  let payload: AppleAssociationPayload | null = null;
  if (!usesPlaceholders && missingFields.length === 0) {
    payload = {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${appleTeamId}.${iosAppBundleId}`,
            paths: invocationPaths,
          },
        ],
      },
      appclips: {
        apps: [`${appleTeamId}.${iosAppClipBundleId}`],
      },
    };
  }

  return { payload, usesPlaceholders, placeholderFields, missingFields, invocationPaths };
}

const ASSOCIATION_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
};

export const ASSOCIATION_PATHS = [
  "/.well-known/apple-app-site-association",
  "/apple-app-site-association",
];

function logAssociationConfig(config: AppleAssociationConfig) {
  if (config.payload) {
    logger.info(
      {
        fullAppIdentifier: config.payload.applinks.details[0]?.appID,
        fullClipIdentifier: config.payload.appclips.apps[0],
        invocationPaths: config.invocationPaths,
      },
      "App Clip association configured",
    );
  }
  if (config.usesPlaceholders) {
    logger.warn(
      { placeholderFields: config.placeholderFields },
      "App Clip association placeholders detected; returning disabled response",
    );
  }
  if (config.missingFields.length > 0) {
    logger.warn(
      {
        configurationError: `Missing ${config.missingFields.join(
          ", ",
        )} environment variable(s) for App Clip association.`,
        invocationPaths: config.invocationPaths,
      },
      "App Clip association is not fully configured",
    );
  }
}

/**
 * Serves the Apple app-site association file. Apple fetches it from both hosts,
 * so it must answer 200 JSON directly, with no redirect.
 */
export function createAppleAssociationRouter(env: AssociationEnv = process.env) {
  const router = Router();
  const config = appleAssociationConfig(env);
  logAssociationConfig(config);

  router.get(ASSOCIATION_PATHS, (_req: Request, res: Response) => {
    if (config.usesPlaceholders) {
      res.status(204).end();
      return;
    }
    if (!config.payload) {
      res
        .status(503)
        .json({ error: "App Clip association not configured on server" });
      return;
    }
    res.status(200).set(ASSOCIATION_HEADERS).json(config.payload);
  });

  router.head(ASSOCIATION_PATHS, (_req: Request, res: Response) => {
    if (config.usesPlaceholders) {
      res.status(204).end();
      return;
    }
    if (!config.payload) {
      res.status(503).end();
      return;
    }
    res.status(200).set(ASSOCIATION_HEADERS).end();
  });

  return router;
}

export default createAppleAssociationRouter();
