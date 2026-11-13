// @vitest-environment node
/**
 * Embeddings are their own kind: OpenAI only, through the data-class gate,
 * the host pin and the "no funds" handling. When OpenAI answers that it has
 * no funds, embedTexts returns "not available" and the site search ranks by
 * plain text; any other error is thrown as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const embeddingsCreate = vi.hoisted(() => vi.fn());
const listPublicSiteWorldsMock = vi.hoisted(() => vi.fn());

vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  class FakeOpenAI { embeddings = { create: embeddingsCreate }; }
  Object.assign(FakeOpenAI, { APIError: actual.default.APIError });
  return { ...actual, default: FakeOpenAI };
});
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
  dbAdmin: null,
  storageAdmin: null,
}));
vi.mock("../utils/site-worlds", () => ({ listPublicSiteWorlds: listPublicSiteWorldsMock }));
/** The data-class gate, closed for the one test that checks embeddings follow it. */
const gate = vi.hoisted(() => ({ closed: false }));
vi.mock("../agents/provider-privacy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../agents/provider-privacy")>();
  return { ...actual, privacyDecisionForClasses: ((...args: Parameters<typeof actual.privacyDecisionForClasses>) => {
    const decision = actual.privacyDecisionForClasses(...args);
    return gate.closed ? { ...decision, permitted: false, blocked_by: ["public_material"] } : decision;
  }) as typeof actual.privacyDecisionForClasses };
});

import OpenAI from "openai";
import type { SiteWorldCard } from "../../client/src/data/siteWorlds";

function testSite(overrides: Partial<SiteWorldCard>): SiteWorldCard {
  return {
    id: "fixture-retail",
    siteCode: "FIXTURE-RETAIL",
    siteName: "Test Fixture Grocery Backroom",
    siteAddress: "100 Fixture Lane, Chicago, IL 00000",
    sceneId: "fixture-scene",
    captureId: "fixture-capture",
    siteSubmissionId: "fixture-submission",
    pipelinePrefix: "gs://test-fixtures/site-worlds/fixture-retail",
    category: "Retail",
    industry: "Grocery test fixture",
    taskLane: "Shelf replenishment fixture workflow",
    tone: "test",
    accent: "test",
    thumbnailKind: "grocery",
    summary: "Synthetic unit-test fixture with totes and shelves.",
    bestFor: "Automated search tests only.",
    startStates: ["Fixture start"],
    runtime: "test-runtime",
    defaultRuntimeBackend: "test-runtime",
    availableRuntimeBackends: ["test-runtime"],
    sampleRobot: "Fixture robot",
    sampleRobotProfile: { id: "fixture-robot", displayName: "Fixture robot" } as SiteWorldCard["sampleRobotProfile"],
    sampleTask: "Move the fixture tote to the shelf",
    samplePolicy: "fixture-policy",
    scenarioVariants: ["Fixture lighting"],
    exportArtifacts: ["fixture manifest"],
    runtimeManifest: { launchable: false } as SiteWorldCard["runtimeManifest"],
    taskCatalog: [{ id: "fixture-task", taskId: "fixture-task", taskText: "Move tote", taskCategory: "manipulation" }] as SiteWorldCard["taskCatalog"],
    scenarioCatalog: [{ id: "fixture-scenario", name: "Fixture lighting", source: "test_fixture" }] as SiteWorldCard["scenarioCatalog"],
    startStateCatalog: [{ id: "fixture-start", name: "Fixture start", source: "test_fixture" }] as SiteWorldCard["startStateCatalog"],
    robotProfiles: [{ id: "fixture-robot", displayName: "Fixture robot" }] as SiteWorldCard["robotProfiles"],
    exportModes: ["test"],
    packages: [
      { name: "Site Package", summary: "Fixture package", priceLabel: "Request review", payerLabel: "Test", actionLabel: "Test", actionHref: "/contact", deliverables: [] },
      { name: "Policy Evaluation Set", summary: "Fixture evaluation set", priceLabel: "Request review", payerLabel: "Test", actionLabel: "Test", actionHref: "/contact", deliverables: [] },
    ],
    dataSource: "pipeline",
    ...overrides,
  };
}

const siteWorldCards: SiteWorldCard[] = [
  testSite({}),
  testSite({
    id: "fixture-logistics",
    siteCode: "FIXTURE-LOGISTICS",
    siteName: "Test Fixture Warehouse",
    siteAddress: "200 Fixture Road, Example City, TX 00000",
    category: "Logistics",
    industry: "Warehouse test fixture",
    taskLane: "Tote transfer fixture workflow",
    thumbnailKind: "parcel",
    summary: "Synthetic logistics unit-test fixture with totes and pallets.",
    sampleTask: "Transfer the fixture tote",
  }),
];

const apiError = (status: number, body: Record<string, unknown>) => (OpenAI as unknown as {
  APIError: typeof import("openai").default.APIError }).APIError.generate(status, { error: { message: "wording that can change", ...body } },
  undefined, new Headers());
const noFunds = () => apiError(429, { type: "insufficient_quota", code: "insufficient_quota" });

beforeEach(async () => {
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
  vi.stubEnv("OPENAI_BASE_URL", "");
  embeddingsCreate.mockReset();
  gate.closed = false;
  listPublicSiteWorldsMock.mockResolvedValue(siteWorldCards);
  vi.resetModules();
  (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("embeddings as their own kind", () => {
  it("returns 'not available' on a funds error, and the search ranks by plain text", async () => {
    embeddingsCreate.mockRejectedValue(noFunds());
    const { searchPublicSiteWorlds } = await import("../retrieval/siteWorldSearch");
    const response = await searchPublicSiteWorlds({ query: "Test Fixture Grocery", limit: 5 });
    expect(embeddingsCreate).toHaveBeenCalledTimes(1);
    expect(response.meta.usedEmbeddings).toBe(false);
    expect(response.warnings.join(" ")).toContain("embeddings_unavailable");
    expect(response.results[0].siteWorld.id).toBe("fixture-retail");
    // The lanes learn it: the provider is cooling down for them.
    const funds = await import("../agents/provider-funds");
    expect(funds.isProviderCoolingDown("openai_responses")).toBe(true);
  });

  it("asks again during the cool-down, since nothing else can serve embeddings, and succeeds at once after a top-up", async () => {
    embeddingsCreate.mockRejectedValue(noFunds());
    const { embedTexts } = await import("../retrieval/embeddings");
    expect(await embedTexts(["a"])).toEqual([[]]);
    expect(await embedTexts(["a"])).toEqual([[]]);
    expect(embeddingsCreate).toHaveBeenCalledTimes(2);
    embeddingsCreate.mockReset();
    embeddingsCreate.mockResolvedValue({ data: [{ embedding: [0.25] }] });
    expect(await embedTexts(["a"])).toEqual([[0.25]]);
    expect(embeddingsCreate).toHaveBeenCalledTimes(1);
  });

  it("sends a request once, with no SDK retries, only while the provider is cooling down", async () => {
    embeddingsCreate.mockRejectedValue(noFunds());
    const { embedTexts } = await import("../retrieval/embeddings");
    expect(await embedTexts(["a"])).toEqual([[]]);
    // Before any cool-down: the client's own retry setting (no per-request option).
    expect(embeddingsCreate.mock.calls[0]).toHaveLength(1);
    expect(await embedTexts(["a"])).toEqual([[]]);
    expect(embeddingsCreate.mock.calls[1][1]).toEqual({ maxRetries: 0 });
    (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
    embeddingsCreate.mockResolvedValue({ data: [{ embedding: [0.5] }] });
    expect(await embedTexts(["a"])).toEqual([[0.5]]);
    expect(embeddingsCreate.mock.calls[2]).toHaveLength(1);
  });

  it.each([
    ["rate_limit_exceeded", { type: "requests", code: "rate_limit_exceeded" }],
    ["slow_down", { type: "requests", code: "slow_down" }],
  ])("throws a 429 %s as before and starts no cool-down: only the trigger table's 429 rows are no funds", async (_name, body) => {
    embeddingsCreate.mockRejectedValue(apiError(429, body));
    const { embedTexts } = await import("../retrieval/embeddings");
    await expect(embedTexts(["a"])).rejects.toThrow();
    expect((await import("../agents/provider-funds")).isProviderCoolingDown("openai_responses")).toBe(false);
  });

  it.each([
    ["insufficient_quota", { type: "insufficient_quota", code: "insufficient_quota" }],
    ["project_spend_limit_exceeded", { type: "x", code: "project_spend_limit_exceeded" }],
  ])("treats a 429 %s as no funds", async (_name, body) => {
    embeddingsCreate.mockRejectedValue(apiError(429, body));
    const { embedTexts } = await import("../retrieval/embeddings");
    expect(await embedTexts(["a"])).toEqual([[]]);
    expect((await import("../agents/provider-funds")).isProviderCoolingDown("openai_responses")).toBe(true);
  });

  it("sends nothing when the data-class gate does not permit the send", async () => {
    gate.closed = true;
    embeddingsCreate.mockResolvedValue({ data: [{ embedding: [0.5] }] });
    const { embedTexts } = await import("../retrieval/embeddings");
    expect(await embedTexts(["a"])).toEqual([[]]);
    expect(embeddingsCreate).not.toHaveBeenCalled();
  });

  it("throws any other error as before", async () => {
    embeddingsCreate.mockRejectedValue(new Error("socket hang up"));
    const { embedTexts } = await import("../retrieval/embeddings");
    await expect(embedTexts(["a"])).rejects.toThrow("socket hang up");
  });

  it("sends through the gate's own row for embeddings, OpenAI only", async () => {
    embeddingsCreate.mockResolvedValue({ data: [{ embedding: [0.5] }] });
    const { embedTexts } = await import("../retrieval/embeddings");
    expect(await embedTexts(["a"])).toEqual([[0.5]]);
    const { NON_LANE_SENDS, privacyDecisionForClasses } = await import("../agents/provider-privacy");
    const send = NON_LANE_SENDS.retrieval_embeddings;
    expect(send.provider).toBe("openai_responses");
    expect(privacyDecisionForClasses("anthropic_agent_sdk", send.classes).permitted).toBe(false);
    expect(privacyDecisionForClasses(send.provider, send.classes).permitted).toBe(true);
  });
});
