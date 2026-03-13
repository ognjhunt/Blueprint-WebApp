// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  MissingEnvironmentVariableError,
  getConfiguredEnvValue,
  requireConfiguredEnvValue,
  validateEnv,
} from "../config/env";

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.PORT;
  delete process.env.STRIPE_PUBLIC_BASE_URL;
});

describe("server env helpers", () => {
  it("skips empty and placeholder values when resolving config", () => {
    process.env.GEMINI_API_KEY = "PLACEHOLDER";
    process.env.GOOGLE_API_KEY = "live-google-key";

    expect(
      getConfiguredEnvValue("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    ).toBe("live-google-key");
  });

  it("throws a typed error when required config is missing", () => {
    expect(() =>
      requireConfiguredEnvValue(
        ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "AI Studio Gemini integration",
      ),
    ).toThrow(MissingEnvironmentVariableError);
  });

  it("validates core env values with defaults", () => {
    const env = validateEnv();

    expect(env.NODE_ENV).toBeDefined();
    expect(env.PORT).toBeGreaterThan(0);
  });

  it("throws a readable validation error for invalid env values", () => {
    process.env.STRIPE_PUBLIC_BASE_URL = "not-a-url";

    expect(() => validateEnv()).toThrowError(/STRIPE_PUBLIC_BASE_URL/i);
  });
});
