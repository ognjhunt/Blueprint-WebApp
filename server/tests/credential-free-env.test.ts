// @vitest-environment node
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  ADC_CONTEXT_ENV_KEYS,
  credentialFreeSubprocessEnv,
} from "./helpers/credentialFreeEnv";

const mutatedKeys: string[] = [];

afterEach(() => {
  for (const key of mutatedKeys.splice(0)) {
    delete process.env[key];
  }
});

describe("credential-free subprocess environment", () => {
  it("strips every ADC trigger key even when the parent shell sets them", () => {
    for (const key of ADC_CONTEXT_ENV_KEYS) {
      if (process.env[key] === undefined) {
        process.env[key] = `hostile-${key}`;
        mutatedKeys.push(key);
      }
    }

    const env = credentialFreeSubprocessEnv({ SOME_TEST_TOKEN: "ok" });
    for (const key of ADC_CONTEXT_ENV_KEYS) {
      expect(env[key], `${key} must be removed, not blanked`).toBeUndefined();
    }
    expect(env.SOME_TEST_TOKEN).toBe("ok");
  });

  it("covers every env key firebaseAdmin consults for credentials or ADC context", async () => {
    // Guard against a new trigger key being added to firebaseAdmin.ts without
    // updating ADC_CONTEXT_ENV_KEYS (which would silently reopen the leak the
    // 2026-07-16 audit found: GOOGLE_CLOUD_PROJECT/K_SERVICE surviving a
    // partial env scrub and triggering an ADC lookup in "credential-free"
    // subprocess tests).
    const source = await fs.readFile(
      path.join(process.cwd(), "client/src/lib/firebaseAdmin.ts"),
      "utf8",
    );
    const consulted = new Set(
      [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]),
    );
    consulted.delete("FIREBASE_STORAGE_BUCKET"); // config value, not a credential/ADC trigger

    for (const key of consulted) {
      expect(
        (ADC_CONTEXT_ENV_KEYS as readonly string[]).includes(key),
        `firebaseAdmin.ts consults ${key}; add it to ADC_CONTEXT_ENV_KEYS`,
      ).toBe(true);
    }
  });
});
