#!/usr/bin/env tsx
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BlueprintAgentApiClient, type FetchLike } from "./agent-api-client";

type SmokeStep = {
  name: string;
  ok: boolean;
  status?: number;
  detail?: string;
};

export type HeadlessSmokeResult = {
  mode: "mock" | "public-demo";
  ok: boolean;
  sessionId: string | null;
  orderId?: string;
  entitlementId?: string;
  truthLabels: string[];
  searchRequestCandidateIntakeOnly: boolean;
  steps: SmokeStep[];
};

type SmokeOptions = {
  mode?: "mock" | "public-demo";
  stdout?: (line: string) => void;
  fetchImpl?: FetchLike;
};

const publicDemoSiteWorldId = "siteworld-f5fd54898cfb";
const publicDemoSessionFallback = {
  siteWorldId: publicDemoSiteWorldId,
  robotProfileId: "mobile_manipulator_rgb_v1",
  taskId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
  scenarioId: "scenario_default",
  startStateId: "start_default_start_state",
};
const mockSessionId = "mock-session-1";
const mockOrderId = "dry-order-1";
const mockEntitlementId = "dry-entitlement-1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstRecordFromArray(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) ? asRecord(value[0]) : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function publicDemoIdFromManifest(agentAccess: Record<string, unknown>) {
  const publicDemo = asRecord(agentAccess.publicDemo);
  return firstString(
    agentAccess.publicDemoSiteWorldId,
    publicDemo?.siteWorldId,
    publicDemoSessionFallback.siteWorldId,
  );
}

function buildPublicDemoSessionDefaults(
  agentAccess: Record<string, unknown>,
  siteWorldPayload: unknown,
) {
  const siteWorld = asRecord(siteWorldPayload) || {};
  const sampleRobotProfile = asRecord(siteWorld.sampleRobotProfile);
  const robotProfile = firstRecordFromArray(siteWorld.robotProfiles);
  const task = firstRecordFromArray(siteWorld.taskCatalog);
  const scenario = firstRecordFromArray(siteWorld.scenarioCatalog);
  const startState = firstRecordFromArray(siteWorld.startStateCatalog);
  return {
    siteWorldId: firstString(siteWorld.id, publicDemoIdFromManifest(agentAccess)),
    robotProfileId: firstString(robotProfile?.id, sampleRobotProfile?.id, publicDemoSessionFallback.robotProfileId),
    taskId: firstString(task?.id, task?.taskId, publicDemoSessionFallback.taskId),
    scenarioId: firstString(scenario?.id, publicDemoSessionFallback.scenarioId),
    startStateId: firstString(startState?.id, publicDemoSessionFallback.startStateId),
  };
}

function hasAuthorizationHeader(init?: RequestInit) {
  const headers = init?.headers || {};
  if (headers instanceof Headers) {
    return headers.has("authorization");
  }
  if (Array.isArray(headers)) {
    return headers.some(([key]) => String(key).toLowerCase() === "authorization");
  }
  return Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
}

function createMockFetch(): FetchLike {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = String(init?.method || "GET").toUpperCase();
    const path = url.pathname;

    if (method === "GET" && path === "/api/site-content") {
      return json({
        summary: "Blueprint public agent discovery",
        machineReadableFiles: {
          llms: "/llms.txt",
          llmsFull: "/llms-full.txt",
          agentAccessOpenApi: "/agent-access.openapi.json",
          agentAccessApi: "/api/agent-access/openapi.json",
        },
      });
    }
    if (method === "GET" && path === "/api/agent-access") {
      return json({
        preferredTool: "blueprint.siteWorld.search",
        compatibilityTool: "blueprint.catalog.search",
        publicDemo: {
          canRunWithoutCredentials: true,
          siteWorldId: "siteworld-f5fd54898cfb",
        },
        dryRunCommerce: {
          mode: "dry_run",
          liveStripeTouched: false,
          endpoints: {
            quote: "/api/agent-access/commerce/quote",
            dryRunCheckout: "/api/agent-access/commerce/dry-run-checkout",
            entitlementReadiness: "/api/agent-access/commerce/entitlement-readiness",
          },
        },
        requestCandidate: {
          intakeOnly: true,
          grantsAccess: false,
          grantsEntitlement: false,
          grantsHostedSession: false,
        },
        truthLabels: [
          "capture_grounded",
          "provider_derived",
          "generated",
          "sample_demo",
          "public_demo_eligible",
          "request_gated",
          "protected_robot_team",
          "dry_run_order",
        ],
      });
    }
    if (method === "GET" && path === "/api/agent-access/openapi.json") {
      return json({
        openapi: "3.1.0",
        info: { title: "Blueprint Robot-Team Agent API" },
        "x-blueprint-truth-labels": [
          "capture_grounded",
          "provider_derived",
          "generated",
          "sample_demo",
          "public_demo_eligible",
          "request_gated",
          "protected_robot_team",
          "dry_run_order",
        ],
      });
    }
    if (method === "GET" && path === "/api/site-worlds") {
      return json({
        items: [{ id: publicDemoSiteWorldId, siteName: "Public demo site world" }],
        count: 1,
      });
    }
    if (method === "GET" && path === `/api/site-worlds/${publicDemoSiteWorldId}`) {
      return json({
        id: publicDemoSiteWorldId,
        siteName: "Public demo site world",
        robotProfiles: [{ id: publicDemoSessionFallback.robotProfileId }],
        sampleRobotProfile: { id: publicDemoSessionFallback.robotProfileId },
        taskCatalog: [{ id: publicDemoSessionFallback.taskId, taskId: publicDemoSessionFallback.taskId }],
        scenarioCatalog: [{ id: publicDemoSessionFallback.scenarioId }],
        startStateCatalog: [{ id: publicDemoSessionFallback.startStateId }],
      });
    }
    if (method === "GET" && path === "/api/site-worlds/search") {
      const q = String(url.searchParams.get("q") || "").toLowerCase();
      if (q.includes("whole foods")) {
        return json({
          query: "whole foods",
          results: [
            {
              siteWorld: { id: "sw-chi-01", siteName: "Harborview Grocery Distribution Annex", category: "Retail" },
              score: 0.92,
              reasons: ["Alias whole foods maps to Retail; closest grocery/retail match; no exact Whole Foods availability is implied"],
              matchedAliases: ["whole foods -> grocery retail"],
              matchedFields: ["category", "industry", "taskLane"],
            },
          ],
          parsed: { q: "whole foods", aliases: [{ alias: "whole foods", mapsTo: "whole foods -> grocery retail" }] },
          appliedFilters: {},
          matchSemantics: {
            exactMatch: false,
            noExactScannedPackage: true,
            message: "No scanned package for this exact place yet.",
            truthBoundary: "Search and requestCandidate are intake-only.",
          },
          requestCandidate: {
            buyerType: "robot_team",
            source: "site-worlds",
            requestPath: "new-capture",
            requestUrl: "/contact?source=site-worlds&buyerType=robot_team&path=new-capture",
            inboundRequestDraft: {
              buyerType: "robot_team",
              commercialRequestPath: "capture_access",
              requestedLanes: ["deeper_evaluation"],
              context: { buyerChannelSourceRaw: "site-worlds" },
            },
          },
          warnings: ["embeddings_unavailable: mock smoke uses deterministic lexical and alias ranking"],
          meta: { backend: "static-fallback", usedEmbeddings: false },
        });
      }
      if (q.includes("store")) {
        return json({
          query: "store",
          results: [
            {
              siteWorld: { id: "sw-chi-01", siteName: "Harborview Grocery Distribution Annex", category: "Retail" },
              score: 0.78,
              reasons: ["Alias store maps to Retail"],
              matchedAliases: ["store -> grocery retail"],
              matchedFields: ["category", "taskLane"],
            },
          ],
          parsed: { q: "store", aliases: [{ alias: "store", mapsTo: "store -> grocery retail" }] },
          appliedFilters: {},
          matchSemantics: {
            exactMatch: false,
            noExactScannedPackage: true,
            message: "No scanned package for this exact place yet.",
            truthBoundary: "Search and requestCandidate are intake-only.",
          },
          requestCandidate: {
            buyerType: "robot_team",
            source: "site-worlds",
            requestPath: "new-capture",
            requestUrl: "/contact?source=site-worlds&buyerType=robot_team&path=new-capture",
            inboundRequestDraft: {
              buyerType: "robot_team",
              commercialRequestPath: "capture_access",
              requestedLanes: ["deeper_evaluation"],
              context: { buyerChannelSourceRaw: "site-worlds" },
            },
          },
          warnings: ["embeddings_unavailable: mock smoke uses deterministic lexical and alias ranking"],
          meta: { backend: "static-fallback", usedEmbeddings: false },
        });
      }
      return json({ query: q, results: [], parsed: { q, aliases: [] }, appliedFilters: {}, warnings: [], meta: { backend: "static-fallback", usedEmbeddings: false } });
    }
    if (method === "GET" && path === "/api/site-worlds/sessions/launch-readiness") {
      return json({
        entitled: true,
        status: "runtime_live_ready",
        launchable: true,
        blockers: [],
        runtime_only: { launchable: true, blockers: [] },
      });
    }
    if (method === "GET" && path === "/api/agent-access/commerce/quote") {
      return json({
        quote: {
          mode: "dry_run",
          product: "hosted_session_rental",
          siteWorldId: publicDemoSiteWorldId,
          sku: `hosted-session-${publicDemoSiteWorldId}`,
        },
      });
    }
    if (method === "POST" && path === "/api/agent-access/commerce/dry-run-checkout") {
      return json({
        order: { id: mockOrderId, status: "fulfilled" },
        entitlement: {
          id: mockEntitlementId,
          access_state: "provisioned",
          sku: `hosted-session-${publicDemoSiteWorldId}`,
        },
        receipt: { mode: "dry_run", liveStripeTouched: false },
      }, 201);
    }
    if (method === "GET" && path === `/api/agent-access/commerce/orders/${mockOrderId}`) {
      return json({
        order: { id: mockOrderId, status: "fulfilled" },
        entitlement: { id: mockEntitlementId, access_state: "provisioned" },
        receipt: { mode: "dry_run", liveStripeTouched: false },
      });
    }
    if (method === "GET" && path === `/api/agent-access/commerce/entitlements/${mockEntitlementId}`) {
      return json({
        entitlement: {
          id: mockEntitlementId,
          access_state: "provisioned",
          sku: `hosted-session-${publicDemoSiteWorldId}`,
        },
      });
    }
    if (method === "GET" && path === "/api/agent-access/commerce/entitlement-readiness") {
      return json({
        mode: "dry_run",
        entitled: true,
        launchable: true,
        blockers: [],
      });
    }
    if (method === "POST" && path === "/api/site-worlds/sessions") {
      if (hasAuthorizationHeader(init)) {
        return json({ error: "Mock demo session creation must run without credentials" }, 400);
      }
      return json({ sessionId: mockSessionId, status: "ready", workspaceUrl: `/world-models/${publicDemoSiteWorldId}/workspace?sessionId=${mockSessionId}` }, 201);
    }
    if (method === "POST" && path === `/api/site-worlds/sessions/${mockSessionId}/reset`) {
      return json({ episode: { episodeId: "episode-1", status: "running", stepIndex: 0 } });
    }
    if (method === "POST" && path === `/api/site-worlds/sessions/${mockSessionId}/step`) {
      return json({ episode: { episodeId: "episode-1", status: "running", stepIndex: 1 } });
    }
    if (method === "POST" && path === `/api/site-worlds/sessions/${mockSessionId}/run-batch`) {
      return json({ summary: { batchRunId: "batch-1", status: "completed", numEpisodes: 1, numSuccess: 1 } });
    }
    if (method === "POST" && path === `/api/site-worlds/sessions/${mockSessionId}/control`) {
      return json({ control: { mode: "pause", accepted: true } });
    }
    if (method === "POST" && path === `/api/site-worlds/sessions/${mockSessionId}/explorer-render`) {
      return json({ explorerState: { frameUri: "mock://frames/explorer.png", cameraId: "head_rgb" } });
    }
    if (method === "POST" && path === `/api/site-worlds/sessions/${mockSessionId}/export`) {
      return json({
        artifact_uris: { export_manifest: "mock://exports/session-export.json" },
        dataset_artifacts: { label: "mock export artifact" },
      });
    }

    return json({ error: `Unhandled mock route ${method} ${path}` }, 404);
  }) as FetchLike;
}

async function runStep<T>(
  steps: SmokeStep[],
  name: string,
  run: () => Promise<T>,
) {
  try {
    const payload = await run();
    steps.push({ name, ok: true });
    return payload;
  } catch (error) {
    steps.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function runHeadlessAgentSmoke(options: SmokeOptions = {}): Promise<HeadlessSmokeResult> {
  const mode = options.mode || "mock";
  const stdout = options.stdout || ((line: string) => process.stdout.write(`${line}\n`));
  const steps: SmokeStep[] = [];
  const client = new BlueprintAgentApiClient({
    baseUrl: mode === "mock" ? "https://mock.tryblueprint.local" : undefined,
    authToken: null,
    fetchImpl: options.fetchImpl || (mode === "mock" ? createMockFetch() : undefined),
  });

  await runStep(steps, "discover", () => client.discover());
  const agentAccess = await runStep(steps, "agentAccess.manifest", () => client.agentAccess()) as Record<string, unknown>;
  const openApi = await runStep(steps, "agentAccess.openapi", () => client.openApiContract()) as Record<string, unknown>;
  await runStep(steps, "catalog", () => client.listCatalog(1));
  const sessionDefaults = buildPublicDemoSessionDefaults(
    agentAccess,
    await runStep(steps, "siteWorld.publicDemo", () => client.getSiteWorld(publicDemoIdFromManifest(agentAccess))),
  );
  const search = await runStep(steps, "siteWorld.search", () =>
    client.searchSiteWorlds({ q: "Whole Foods near Durham", limit: 5 }),
  ) as Record<string, unknown>;
  const requestCandidate =
    search.requestCandidate && typeof search.requestCandidate === "object"
      ? search.requestCandidate as Record<string, unknown>
      : {};
  const inboundDraft =
    requestCandidate.inboundRequestDraft && typeof requestCandidate.inboundRequestDraft === "object"
      ? requestCandidate.inboundRequestDraft as Record<string, unknown>
      : {};
  const searchRequestCandidateIntakeOnly =
    requestCandidate.source === "site-worlds" &&
    requestCandidate.buyerType === "robot_team" &&
    !("entitlementId" in inboundDraft) &&
    !("paymentStatus" in inboundDraft) &&
    !("providerRunId" in inboundDraft) &&
    !("hostedSessionId" in inboundDraft);
  if (!searchRequestCandidateIntakeOnly) {
    throw new Error("Smoke site-world search requestCandidate is not intake-only.");
  }
  await runStep(steps, "commerce.quote", () =>
    client.quoteCommerce({ siteWorldId: sessionDefaults.siteWorldId, product: "hosted_session_rental", sessionHours: 1 }),
  );
  const checkout = await runStep(steps, "commerce.checkoutDryRun", () =>
    client.createDryRunCheckout({ siteWorldId: sessionDefaults.siteWorldId, product: "hosted_session_rental", sessionHours: 1 }),
  ) as { order?: { id?: string }; entitlement?: { id?: string } };
  const orderId = String(checkout.order?.id || "");
  const entitlementId = String(checkout.entitlement?.id || "");
  if (!orderId || !entitlementId) {
    throw new Error("Smoke dry-run checkout did not return order and entitlement ids.");
  }
  await runStep(steps, "commerce.order", () => client.getCommerceOrder(orderId));
  await runStep(steps, "commerce.entitlement", () => client.getCommerceEntitlement(entitlementId));
  if (mode === "public-demo") {
    await runStep(steps, "session.launchReadiness", () => client.readiness(sessionDefaults.siteWorldId));
  } else {
    await runStep(steps, "commerce.entitlementReadiness", () =>
      client.entitlementReadiness({
        siteWorldId: sessionDefaults.siteWorldId,
        entitlementId,
        buyerUserId: "agent-dry-run-buyer",
        product: "hosted_session_rental",
      }),
    );
  }
  const created = await runStep(steps, "session.create", () =>
    client.createSession({
      siteWorldId: sessionDefaults.siteWorldId,
      entitlementId,
      orderId,
      commerceMode: "dry_run",
      sessionMode: "runtime_only",
      robotProfileId: sessionDefaults.robotProfileId,
      taskId: sessionDefaults.taskId,
      scenarioId: sessionDefaults.scenarioId,
      startStateId: sessionDefaults.startStateId,
      requestedOutputs: ["observation_frames", "action_trace", "export_bundle"],
    }),
  ) as { sessionId?: string };
  const sessionId = String(created.sessionId || "");
  if (!sessionId) {
    throw new Error("Smoke session create did not return sessionId.");
  }
  await runStep(steps, "session.reset", () =>
    client.resetSession(sessionId, {
      taskId: sessionDefaults.taskId,
      scenarioId: sessionDefaults.scenarioId,
      startStateId: sessionDefaults.startStateId,
      seed: 17,
    }),
  );
  await runStep(steps, "session.step", () => client.stepSession(sessionId, { autoPolicy: true }));
  await runStep(steps, "session.runBatch", () =>
    client.runBatch(sessionId, {
      numEpisodes: 1,
      taskId: sessionDefaults.taskId,
      scenarioId: sessionDefaults.scenarioId,
      startStateId: sessionDefaults.startStateId,
      seed: 17,
      maxSteps: 2,
    }),
  );
  await runStep(steps, "session.control", () => client.controlSession(sessionId, { mode: "pause" }));
  await runStep(steps, "session.explorerRender", () => client.renderExplorer(sessionId, { cameraId: "head_rgb" }));
  await runStep(steps, "session.export", () => client.exportSession(sessionId));

  const result = {
    mode,
    ok: steps.every((step) => step.ok),
    sessionId,
    orderId,
    entitlementId,
    truthLabels: Array.from(new Set([
      ...arrayOfStrings(agentAccess.truthLabels),
      ...arrayOfStrings(openApi["x-blueprint-truth-labels"]),
    ])),
    searchRequestCandidateIntakeOnly,
    steps,
  };
  stdout(JSON.stringify(result, null, 2));
  return result;
}

function parseMode(argv: string[]): "mock" | "public-demo" {
  const index = argv.indexOf("--mode");
  const value = index >= 0 ? argv[index + 1] : "";
  if (value === "public-demo") return "public-demo";
  return "mock";
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runHeadlessAgentSmoke({ mode: parseMode(process.argv.slice(2)) }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
