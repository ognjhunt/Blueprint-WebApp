// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import router from "../routes/location-autocomplete";
import { privateWorkLogPath } from "../utils/blueprintWorkLogPrivacy";

const nativeFetch = globalThis.fetch;
const providerFetch = vi.fn();
const token = "8f5e0812-ab4a-40d3-a2c4-8850f2a197e4";
let server: Server;
let origin: string;
const keys = ["GOOGLE_PLACES_API_KEY", "GEMINI_API_KEY", "GOOGLE_GENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_STUDIO_API_KEY"];

beforeAll(async () => {
  const app = express();
  app.use("/api/location-autocomplete", router);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => {
  for (const key of keys) vi.stubEnv(key, "");
  vi.stubEnv("GEMINI_API_KEY", "private-server-fixture-key");
  providerFetch.mockReset();
  vi.stubGlobal("fetch", providerFetch);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function get(path = "", params: Record<string, string> = { input: "1005 Crete Street", sessionToken: token }) {
  return nativeFetch(`${origin}/api/location-autocomplete${path}?${new URLSearchParams(params)}`);
}
function provider(payload: unknown, status = 200) {
  providerFetch.mockResolvedValue(new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } }));
}

describe("server-side Places autocomplete", () => {
  it("uses the existing Gemini key only in a provider header and returns bounded display fields", async () => {
    provider({ suggestions: [
      { queryPrediction: { text: { text: "ignored" } } },
      ...Array.from({ length: 7 }, () => ({ placePrediction: { placeId: "ChIJfixture", text: { text: "1005 Crete Street, Durham, NC, USA" },
        structuredFormat: { mainText: { text: "1005 Crete Street" }, secondaryText: { text: "Durham, NC, USA" } }, privateProviderField: "omit" } })),
    ] });
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const payload = await response.json();
    expect(payload.suggestions).toHaveLength(5);
    expect(payload.suggestions[0]).toEqual({ placeId: "ChIJfixture", label: "1005 Crete Street, Durham, NC, USA", mainText: "1005 Crete Street", secondaryText: "Durham, NC, USA" });
    expect(JSON.stringify(payload)).not.toContain("private");
    expect(providerFetch).toHaveBeenCalledWith("https://places.googleapis.com/v1/places:autocomplete", expect.objectContaining({
      method: "POST", headers: expect.objectContaining({ "X-Goog-Api-Key": "private-server-fixture-key",
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.distanceMeters" }),
      body: JSON.stringify({ input: "1005 Crete Street", sessionToken: token, languageCode: "en", regionCode: "us",
        locationBias: { rectangle: { low: { latitude: 24, longitude: -125 }, high: { latitude: 49, longitude: -66 } } } }),
      signal: expect.any(AbortSignal),
    }));
  });

  it("biases toward an optional rounded position without restricting international matches", async () => {
    provider({ suggestions: [{ placePrediction: { placeId: "canadian-place", text: { text: "1005 Crete Street, Toronto, Canada" }, distanceMeters: 32000 } }] });
    const response = await get("", { input: "1005 Crete Street", sessionToken: token, lat: "35.9940321", lng: "-78.8986192" });
    expect(response.status).toBe(200);
    expect((await response.json()).suggestions[0]).toMatchObject({ placeId: "canadian-place", distanceMeters: 32000 });
    const body = JSON.parse(providerFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ origin: { latitude: 35.994, longitude: -78.899 },
      locationBias: { circle: { center: { latitude: 35.994, longitude: -78.899 }, radius: 50000 } } });
    expect(body).not.toHaveProperty("includedRegionCodes");
    expect(body).not.toHaveProperty("locationRestriction");
  });

  it.each([
    { lat: "35.99" }, { lng: "-78.89" }, { lat: "", lng: "" },
    { lat: "91", lng: "0" }, { lat: "0", lng: "-181" },
    { lat: "NaN", lng: "0" }, { lat: "0", lng: "Infinity" },
  ])("rejects invalid position parameters before calling Places (%j)", async (position) => {
    const response = await get("", { input: "Crete", sessionToken: token, ...position } as Record<string, string>);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "invalid_location" });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("terminates the same billing session with structured country details only", async () => {
    provider({ addressComponents: [{ types: ["country", "political"], shortText: "de" }], otherDetails: "omit" });
    const response = await get("/country", { placeId: "ChIJfixture", sessionToken: token });
    expect(await response.json()).toEqual({ countryCode: "DE" });
    const [url, init] = providerFetch.mock.calls[0];
    expect(new URL(url).searchParams.get("sessionToken")).toBe(token);
    expect(init.headers["X-Goog-FieldMask"]).toBe("addressComponents");
  });

  it("does not infer US when structured country is absent", async () => {
    provider({ addressComponents: [] });
    expect(await (await get("/country", { placeId: "ChIJfixture", sessionToken: token })).json()).toEqual({ countryCode: null });
  });

  it("supports a dedicated Places credential before the Gemini fallback", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "dedicated-server-fixture-key");
    provider({ suggestions: [] });
    await get();
    expect(providerFetch.mock.calls[0][1].headers["X-Goog-Api-Key"]).toBe("dedicated-server-fixture-key");
  });

  it("does not reuse a browser key when no server credential is available", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "expired-browser-fixture-key");
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "not_configured" });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["", { input: "x", sessionToken: token }],
    ["", { input: "a".repeat(301), sessionToken: token }],
    ["", { input: "Durham", sessionToken: "invalid" }],
    ["/country", { placeId: "../other-endpoint", sessionToken: token }],
    ["/country", { placeId: "ChIJfixture", sessionToken: "invalid" }],
  ])("rejects invalid lookup inputs without calling the provider (%s %j)", async (path, query) => {
    const response = await get(path, query as Record<string, string>);
    expect(response.status).toBe(400);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["API_KEY_EXPIRED", "key_expired"], ["SERVICE_DISABLED", "api_not_enabled"],
    ["BILLING_DISABLED", "billing_disabled"], ["API_KEY_SERVICE_BLOCKED", "request_denied"],
  ])("sanitizes provider errors (%s)", async (reason, code) => {
    provider({ error: { message: "private-server-fixture-key or private address", details: [{ reason }] } }, 403);
    const response = await get();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code });
  });

  it("handles a provider timeout without relaying exception contents", async () => {
    providerFetch.mockRejectedValue(new Error("private-server-fixture-key"));
    expect(await (await get()).json()).toEqual({ code: "provider_unavailable" });
  });

  it("removes address and session parameters from app logs", () => {
    expect(privateWorkLogPath(`/api/location-autocomplete?input=private-address&sessionToken=${token}`)).toBe("/api/location-autocomplete");
    expect(privateWorkLogPath(`/api/location-autocomplete?lat=35.994&lng=-78.899&input=private-address&sessionToken=${token}`)).toBe("/api/location-autocomplete");
    expect(privateWorkLogPath(`/api/location-autocomplete/country?placeId=private-place&sessionToken=${token}`)).toBe("/api/location-autocomplete/country");
  });

  it("limits repeated public lookups before they incur provider calls", async () => {
    provider({ suggestions: [] });
    let response: Response;
    for (let index = 0; index < 81; index++) {
      response = await get();
      if (response.status === 429) break;
    }
    expect(response!.status).toBe(429);
    expect(response!.headers.get("cache-control")).toBe("no-store");
    expect(providerFetch.mock.calls.length).toBeLessThan(81);
  });
});
