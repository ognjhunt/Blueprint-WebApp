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

const router = Router();

const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID?.trim();
const IOS_APP_BUNDLE_ID =
  process.env.IOS_APP_BUNDLE_ID?.trim() || process.env.APP_BUNDLE_ID?.trim();
const IOS_APP_CLIP_BUNDLE_ID =
  process.env.IOS_APP_CLIP_BUNDLE_ID?.trim() ||
  process.env.APP_CLIP_BUNDLE_ID?.trim();

const DEFAULT_INVOCATION_PATHS = ["/go", "/go/*"];
const additionalPaths = (process.env.APP_CLIP_ADDITIONAL_PATHS || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => (entry.startsWith("/") ? entry : `/${entry}`));

const invocationPaths = Array.from(
  new Set([...DEFAULT_INVOCATION_PATHS, ...additionalPaths]),
);

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

let associationPayload: AppleAssociationPayload | null = null;
let configurationError: string | null = null;
let usesPlaceholders = false;
const placeholderFields: string[] = [];
const missingFields: string[] = [];

if (!APPLE_TEAM_ID) {
  missingFields.push("APPLE_TEAM_ID");
} else if (isPlaceholderValue(APPLE_TEAM_ID)) {
  placeholderFields.push("APPLE_TEAM_ID");
}

if (!IOS_APP_BUNDLE_ID) {
  missingFields.push("IOS_APP_BUNDLE_ID");
} else if (isPlaceholderValue(IOS_APP_BUNDLE_ID)) {
  placeholderFields.push("IOS_APP_BUNDLE_ID");
}

if (!IOS_APP_CLIP_BUNDLE_ID) {
  missingFields.push("IOS_APP_CLIP_BUNDLE_ID");
} else if (isPlaceholderValue(IOS_APP_CLIP_BUNDLE_ID)) {
  placeholderFields.push("IOS_APP_CLIP_BUNDLE_ID");
}

usesPlaceholders = placeholderFields.length > 0;

if (!usesPlaceholders && missingFields.length === 0) {
  const fullAppIdentifier = `${APPLE_TEAM_ID}.${IOS_APP_BUNDLE_ID}`;
  const fullClipIdentifier = `${APPLE_TEAM_ID}.${IOS_APP_CLIP_BUNDLE_ID}`;

  associationPayload = {
    applinks: {
      apps: [],
      details: [
        {
          appID: fullAppIdentifier,
          paths: invocationPaths,
        },
      ],
    },
    appclips: {
      apps: [fullClipIdentifier],
    },
  };

  logger.info(
    {
      fullAppIdentifier,
      fullClipIdentifier,
      invocationPaths,
    },
    "App Clip association configured",
  );
}

if (usesPlaceholders) {
  logger.warn(
    {
      placeholderFields,
    },
    "App Clip association placeholders detected; returning disabled response",
  );
}

if (missingFields.length > 0) {
  configurationError = `Missing ${missingFields.join(
    ", ",
  )} environment variable(s) for App Clip association.`;
}

if (configurationError) {
  logger.warn(
    {
      configurationError,
      invocationPaths,
    },
    "App Clip association is not fully configured",
  );
}

function respondAssociation(_req: Request, res: Response) {
  if (usesPlaceholders) {
    res.status(204).end();
    return;
  }

  if (!associationPayload) {
    res
      .status(503)
      .json({ error: "App Clip association not configured on server" });
    return;
  }

  res
    .status(200)
    .set({
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    })
    .json(associationPayload);
}

const associationPaths = [
  "/.well-known/apple-app-site-association",
  "/apple-app-site-association",
];

router.get(associationPaths, respondAssociation);

router.head(associationPaths, (_req: Request, res: Response) => {
  if (usesPlaceholders) {
    res.status(204).end();
    return;
  }

  if (!associationPayload) {
    res.status(503).end();
    return;
  }

  res
    .status(200)
    .set({
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    })
    .end();
});

export default router;
