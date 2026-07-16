// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  LOCAL_SMOKE_DISABLED_AUTOMATION_FLAGS,
  LOCAL_SMOKE_FORBIDDEN_ENV_KEYS,
  buildLocalSmokeEnv,
} from "./launch-smoke-env.mjs";

const smokeArgs = {
  port: 5055,
  baseUrl: "http://127.0.0.1:5055",
  fieldEncryptionKey: "dGVzdC1rZXktZm9yLXNtb2tlLWVudi10ZXN0IQ==",
};

describe("local launch smoke environment", () => {
  it("never inherits credentials or live configuration from the parent shell", () => {
    const hostile = { PATH: "/usr/bin", HOME: "/home/dev" };
    for (const key of LOCAL_SMOKE_FORBIDDEN_ENV_KEYS) {
      hostile[key] = `live-value-${key}`;
    }
    // Simulate a dev shell with extra live config beyond the known-bad list.
    hostile.SOME_FUTURE_PROVIDER_SECRET = "super-secret";
    hostile.DATABASE_URL = "postgres://prod";

    const env = buildLocalSmokeEnv(hostile, smokeArgs);

    for (const key of LOCAL_SMOKE_FORBIDDEN_ENV_KEYS) {
      expect(env[key], `${key} must not leak into the smoke child`).toBeUndefined();
    }
    // Allowlist semantics: unknown keys never pass through.
    expect(env.SOME_FUTURE_PROVIDER_SECRET).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.PATH).toBe("/usr/bin");
  });

  it("pins every automation lane off and disables the ops scheduler", () => {
    const env = buildLocalSmokeEnv(
      { BLUEPRINT_ALL_AUTOMATION_ENABLED: "1", BLUEPRINT_SLA_WATCHDOG_ENABLED: "1" },
      smokeArgs,
    );
    for (const [key, value] of Object.entries(LOCAL_SMOKE_DISABLED_AUTOMATION_FLAGS)) {
      expect(env[key], `${key} must be pinned in the smoke child`).toBe(value);
    }
    expect(env.BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER).toBe("1");
  });

  it("injects safe non-zero beta limits and the local smoke readiness profile", () => {
    const env = buildLocalSmokeEnv(
      { BLUEPRINT_BETA_INVITE_CAP: "0", BLUEPRINT_BETA_COHORT_DAILY_LIMIT: "0" },
      smokeArgs,
    );
    expect(Number(env.BLUEPRINT_BETA_INVITE_CAP)).toBeGreaterThan(0);
    expect(Number(env.BLUEPRINT_BETA_COHORT_DAILY_LIMIT)).toBeGreaterThan(0);
    expect(env.BLUEPRINT_LOCAL_LAUNCH_SMOKE).toBe("1");
    expect(env.BLUEPRINT_BETA_KILL_SWITCH).toBe("0");
    expect(env.NODE_ENV).toBe("production");
    expect(env.BASE_URL).toBe("http://127.0.0.1:5055");
    expect(env.FIELD_ENCRYPTION_MASTER_KEY).toBe(smokeArgs.fieldEncryptionKey);
  });
});
