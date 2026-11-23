// @vitest-environment node
/**
 * From the start route's stored record to the place a company is shown (`companyPlaceOf`): a picked place's city and
 * state, a typed place's state alone, and never the typed text, a street or coordinates.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { PRIVACY_VERSION, TERMS_VERSION } from "../../client/src/lib/legalAcceptance";
import { RECORDING_RIGHTS_STATEMENT_V4_VERSION } from "../../client/src/lib/recordingRightsStatement";
import { DESCRIPTION_AUTHORITY_WITH_VIDEO_V4_VERSION } from "../../client/src/lib/siteSubmissionAuthority";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null, authAdmin: null }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn() }));
vi.mock("../utils/slack", () => ({ notifySlackInboundRequest: vi.fn() }));
vi.mock("../utils/rate-limit-redis", () => ({ getRateLimitRedisClient: () => null }));

const devLogPath = path.join(os.tmpdir(), "blueprint-dev-inbound-requests.jsonl");
const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  process.env.NODE_ENV = "development";
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
});
afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.unstubAllEnvs();
});

/** The body the start form sends for a job with a video (`SiteCaptureStart.tsx`), with or without a picked place. */
function startBody(requestId: string, siteLocation: string, siteLocationMetadata?: Record<string, unknown>) {
  return {
    requestId, retryToken: crypto.randomUUID(), firstName: "", lastName: "", email: `${requestId}@example.com`,
    roleTitle: "Site operator", buyerType: "site_operator", accountSignup: false, acceptedTerms: true,
    termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, requestedLanes: [],
    siteName: siteLocation, siteLocation, ...(siteLocationMetadata ? { siteLocationMetadata } : {}),
    taskStatement: "Move sealed cartons from a conveyor onto a pallet.", taskDescription: "Move sealed cartons from a conveyor onto a pallet.",
    siteTaskGates: {}, siteTaskSpec: {}, captureMode: "self_capture", captureRegion: "us", hasExistingFootage: true,
    descriptionOnly: false,
    descriptionAuthority: { granted: true, statementVersion: DESCRIPTION_AUTHORITY_WITH_VIDEO_V4_VERSION },
    consentAttestation: { granted: true, statementVersion: RECORDING_RIGHTS_STATEMENT_V4_VERSION },
    context: { sourcePageUrl: "http://localhost/contact/site-operator" },
  };
}

/** Starts a job through the real start route, then stores its place the way production does (encrypted). */
async function storedJob(body: ReturnType<typeof startBody>) {
  vi.resetModules();
  const { default: router } = await import("../routes/inbound-request");
  const app = express();
  app.use(express.json());
  app.use("/", router);
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) });
    expect(response.status, await response.clone().text()).toBe(201);
  } finally { await new Promise(resolve => server.close(resolve)); }
  const row = fs.readFileSync(devLogPath, "utf8").trim().split("\n").map(line => JSON.parse(line)).find(entry => entry.requestId === body.requestId);
  expect(row).toBeDefined();
  const { encryptLocationMetadata } = await import("../utils/field-encryption");
  return { row, stored: { ...row, request: { ...row.request,
    siteLocationMetadata: await encryptLocationMetadata(row.request.siteLocationMetadata) } } };
}

async function placeShown(record: Record<string, any>) {
  const { companyPlaceOf } = await import("../utils/companyJobPage");
  return companyPlaceOf(record, { [String(record.request.consent_attestation.statement_version)]: "city" });
}

describe("the place a company is shown, from the start route's stored record", () => {
  it("a picked place reads its city, state and country", async () => {
    const requestId = `place-picked-${crypto.randomUUID()}`;
    const { row, stored } = await storedJob(startBody(requestId, "Austin, TX, USA",
      { source: "google_places", city: "Austin", state: "Texas", country: "US" }));
    expect(row.request.siteLocationMetadata).toMatchObject({ source: "google_places", city: "Austin", state: "Texas", country: "US",
      placeId: null, formattedAddress: null, lat: null, lng: null, postalCode: null });
    expect(await placeShown(stored)).toBe("Austin, Texas, United States");
  });

  it("a typed place reads its state alone, never the typed text", async () => {
    const requestId = `place-typed-${crypto.randomUUID()}`;
    const { row, stored } = await storedJob(startBody(requestId, "Austin, Texas"));
    expect(row.request.siteLocationMetadata).toMatchObject({ source: "typed_state", state: "Texas" });
    expect(row.request.siteLocationMetadata.city ?? null).toBeNull();
    expect(await placeShown(stored)).toBe("Texas, United States");
  });

  it("a typed site name and street give a company nothing of them", async () => {
    const requestId = `place-street-${crypto.randomUUID()}`;
    const typed = "Acme Foods, 12 Main Street, Austin, TX";
    const { stored } = await storedJob(startBody(requestId, typed));
    const shown = await placeShown(stored);
    expect(shown).toBe("Texas, United States");
    for (const hidden of ["Acme", "Main", "12", "Austin"]) expect(shown).not.toContain(hidden);
    const { row: streetOnly } = await storedJob(startBody(`place-street-only-${crypto.randomUUID()}`, "123 Main St"));
    expect(streetOnly.request.siteLocationMetadata).toBeNull();
  });

  it("a picked place's extra parts sent by a hand-made request still reach a company only as city and state", async () => {
    const requestId = `place-extra-${crypto.randomUUID()}`;
    const { stored } = await storedJob(startBody(requestId, "Austin, TX, USA", { source: "google_places", city: "Austin",
      state: "Texas", country: "US", formattedAddress: "12 Main Street, Austin, TX 78701", postalCode: "78701", lat: 30.2672, lng: -97.7431 }));
    const shown = await placeShown(stored);
    expect(shown).toBe("Austin, Texas, United States");
    for (const hidden of ["Main", "78701", "30.2", "97.7"]) expect(shown).not.toContain(hidden);
  });
});
