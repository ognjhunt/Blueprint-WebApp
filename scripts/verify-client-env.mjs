#!/usr/bin/env node
/**
 * Fail a deployable client build when the Firebase client config is absent.
 *
 * Vite inlines `import.meta.env` at BUILD time. A build that runs without the
 * VITE_FIREBASE_* variables therefore ships an env object carrying only
 * BASE_URL/DEV/MODE/PROD/SSR, and `client/src/lib/firebase.ts` throws the
 * moment it loads — so `auth` never initializes and every sign-in path, Google
 * and email alike, is dead. That failure is invisible until a user reaches the
 * sign-in page, and setting the variables afterwards changes nothing without a
 * rebuild. This turns it into a build failure instead.
 *
 * Compile-only builds (CI verifying that the app builds, never served to
 * anyone) opt out with BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";

const projectRoot = path.resolve(fileURLToPath(import.meta.url), "../..");

/**
 * Vite resolves env files relative to `root`, and vite.config.ts sets root to
 * `client`. Reading through Vite's own loader is what makes this guard agree
 * with the build rather than approximate it: it sees the same .env files and
 * the same prefixed process.env variables the build will inline.
 */
export const CLIENT_ENV_DIR = path.resolve(projectRoot, "client");

/**
 * Every key `requireFirebaseEnv()` demands in client/src/lib/firebase.ts.
 * Kept in step by scripts/verify-client-env.test.ts.
 */
export const REQUIRED_CLIENT_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

export const OPT_OUT_VAR = "BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD";

/** Keys the build would inline as empty, in declaration order. */
export function missingClientEnvKeys(env) {
  return REQUIRED_CLIENT_ENV_KEYS.filter((key) => !String(env[key] ?? "").trim());
}

function report(missing) {
  return [
    "",
    "  Client build is missing required Firebase configuration.",
    "",
    ...missing.map((key) => `    - ${key}`),
    "",
    "  Vite inlines these at build time. Building without them produces a",
    "  bundle whose sign-in page throws on load, for every account and every",
    "  sign-in method. Setting them on the service is not enough on its own:",
    "  the service has to rebuild, not just restart.",
    "",
    "  Set them on the deploy target, then rebuild. This repo's own path:",
    "    RENDER_API_KEY=... RENDER_SERVICE_ID=... \\",
    "      npm run render:import-env -- render.required.env.example",
    "",
    `  For a compile-only build that will never be served, set ${OPT_OUT_VAR}=1.`,
    "",
  ].join("\n");
}

export function main() {
  const env = loadEnv("production", CLIENT_ENV_DIR, "VITE_");
  const missing = missingClientEnvKeys(env);

  if (!missing.length) {
    return 0;
  }

  if (String(process.env[OPT_OUT_VAR] ?? "").trim() === "1") {
    console.warn(
      `[verify-client-env] ${missing.length} Firebase client variable(s) missing; ` +
        `continuing because ${OPT_OUT_VAR}=1. This build cannot serve sign-in.`,
    );
    return 0;
  }

  console.error(report(missing));
  return 1;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  process.exit(main());
}
