// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { AGENT_CLI_EXIT_CODES, getAgentCliExitCode, parseAgentCliArgs, runAgentCli } from "./blueprint-agent-cli";

function collectObjectKeys(value: unknown, keys = new Set<string>()) {
  if (!value || typeof value !== "object") return keys;
  Object.keys(value as Record<string, unknown>).forEach((key) => keys.add(key));
  Object.values(value as Record<string, unknown>).forEach((entry) => {
    if (entry && typeof entry === "object") collectObjectKeys(entry, keys);
  });
  return keys;
}

describe("Blueprint agent CLI", () => {
  it("parses nested catalog and session commands", () => {
    expect(parseAgentCliArgs(["catalog", "list", "--limit", "3"])).toMatchObject({
      command: "catalog:list",
      options: { limit: 3 },
    });
    expect(parseAgentCliArgs(["catalog", "search", "--q", "whole foods", "--limit", "5", "--city", "Chicago"])).toMatchObject({
      command: "catalog:search",
      options: { q: "whole foods", limit: 5, city: "Chicago" },
    });
    expect(parseAgentCliArgs(["site-world", "search", "--q", "whole foods", "--limit", "5", "--city", "Durham"])).toMatchObject({
      command: "site-world:search",
      options: { q: "whole foods", limit: 5, city: "Durham" },
    });
    expect(parseAgentCliArgs(["session", "create", "--site-world-id", "demo", "--robot-profile-id", "g1", "--task-id", "task", "--scenario-id", "scenario", "--start-state-id", "start"])).toMatchObject({
      command: "session:create",
      options: {
        siteWorldId: "demo",
        robotProfileId: "g1",
        taskId: "task",
        scenarioId: "scenario",
        startStateId: "start",
      },
    });
    expect(parseAgentCliArgs(["session", "batch", "session-1", "--num-episodes", "2"])).toMatchObject({
      command: "session:batch",
      sessionId: "session-1",
      options: { numEpisodes: 2 },
    });
    expect(parseAgentCliArgs(["commerce", "quote", "--site-world-id", "sw-chi-01", "--product", "hosted-session-rental", "--session-hours", "2"])).toMatchObject({
      command: "commerce:quote",
      options: {
        siteWorldId: "sw-chi-01",
        product: "hosted-session-rental",
        sessionHours: 2,
      },
    });
    expect(parseAgentCliArgs(["commerce", "entitlement-readiness", "--site-world-id", "sw-chi-01", "--entitlement-id", "dry-ent-1"])).toMatchObject({
      command: "commerce:entitlement-readiness",
      options: {
        siteWorldId: "sw-chi-01",
        entitlementId: "dry-ent-1",
      },
    });
    expect(parseAgentCliArgs(["request", "location", "--location", "Whole Foods near Durham", "--workflow", "shelf restocking"])).toMatchObject({
      command: "request:location",
      options: {
        location: "Whole Foods near Durham",
        workflow: "shelf restocking",
      },
    });
  });

  it("parses help, doctor, setup-auth, and ndjson format without treating format as a command option", () => {
    expect(parseAgentCliArgs(["help", "--format", "ndjson"])).toMatchObject({
      command: "help",
      format: "ndjson",
    });
    expect(parseAgentCliArgs(["catalog", "search", "--q", "whole foods", "--format=ndjson"])).toMatchObject({
      command: "catalog:search",
      format: "ndjson",
      options: { q: "whole foods", limit: 10 },
    });
    expect(parseAgentCliArgs(["doctor", "setup-auth", "--require-auth"])).toMatchObject({
      command: "doctor",
      options: { check: "setup-auth", requireAuth: true },
    });
    expect(parseAgentCliArgs(["setup-auth"])).toMatchObject({
      command: "setup-auth",
      options: { check: "setup-auth" },
    });
  });

  it("prints machine-readable help without fetching remote resources", async () => {
    const fetchMock = vi.fn();
    const writes: string[] = [];

    await runAgentCli(["help"], {
      fetchImpl: fetchMock,
      stdout: (line) => writes.push(line),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const payload = JSON.parse(writes.join("\n"));
    expect(payload.commands.map((command: { command: string }) => command.command)).toContain("doctor");
    expect(payload.exitCodes).toMatchObject(AGENT_CLI_EXIT_CODES);
    expect(payload.truthBoundaries.join(" ")).toContain("never grant package access");
  });

  it("prints ndjson result events for harness log streams", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ items: [], count: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const writes: string[] = [];

    await runAgentCli(["catalog", "list", "--limit", "1", "--format", "ndjson"], {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
      stdout: (line) => writes.push(line),
    });

    const event = JSON.parse(writes.join("\n"));
    expect(event).toMatchObject({
      type: "result",
      command: "catalog:list",
      ok: true,
      exitCode: AGENT_CLI_EXIT_CODES.ok,
      payload: { count: 0 },
    });
  });

  it("checks local setup and optional protected auth without calling live services", async () => {
    const fetchMock = vi.fn();
    const writes: string[] = [];

    const payload = await runAgentCli(["doctor"], {
      env: {},
      fetchImpl: fetchMock,
      stdout: (line) => writes.push(line),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      ok: true,
      exitCode: AGENT_CLI_EXIT_CODES.ok,
    });
    expect(JSON.parse(writes.join("\n")).checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "credentialless_public_flow", ok: true }),
        expect.objectContaining({ id: "protected_bearer_auth", level: "warning", ok: true }),
      ]),
    );
  });

  it("fails setup-auth predictably when protected auth is required but missing", async () => {
    const writes: string[] = [];

    const payload = await runAgentCli(["setup-auth", "--require-auth", "--format", "ndjson"], {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      stdout: (line) => writes.push(line),
    });

    expect(payload).toMatchObject({
      ok: false,
      exitCode: AGENT_CLI_EXIT_CODES.setup,
    });
    const event = JSON.parse(writes.join("\n"));
    expect(event).toMatchObject({
      type: "result",
      command: "setup-auth",
      ok: false,
      exitCode: AGENT_CLI_EXIT_CODES.setup,
    });
    expect(event.payload.checks).toContainEqual(
      expect.objectContaining({ id: "protected_bearer_auth", level: "fail", ok: false }),
    );
  });

  it("emits structured usage errors with predictable exit codes", async () => {
    const errors: string[] = [];

    await expect(runAgentCli(["unknown-command"], { stderr: (line) => errors.push(line) })).rejects.toThrow(/Unknown Blueprint agent command/);

    const payload = JSON.parse(errors.join("\n"));
    expect(payload).toMatchObject({
      ok: false,
      code: "usage_error",
      exitCode: AGENT_CLI_EXIT_CODES.usage,
    });
    expect(getAgentCliExitCode(new Error("boom"))).toBe(AGENT_CLI_EXIT_CODES.unexpected);
  });

  it("uses BLUEPRINT_API_BASE_URL and bearer auth when fetching protected flows", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ sessionId: "session-1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const writes: string[] = [];

    await runAgentCli(
      [
        "session",
        "create",
        "--site-world-id",
        "siteworld-f5fd54898cfb",
        "--robot-profile-id",
        "other_sample",
        "--task-id",
        "task-1",
        "--scenario-id",
        "scenario-1",
        "--start-state-id",
        "start-1",
      ],
      {
        env: {
          BLUEPRINT_API_BASE_URL: "https://agent.example",
          BLUEPRINT_AGENT_AUTH_TOKEN: "token-123",
        },
        fetchImpl: fetchMock,
        stdout: (line) => writes.push(line),
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/api/site-worlds/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer token-123",
          "content-type": "application/json",
        }),
      }),
    );
    expect(JSON.parse(writes.join("\n"))).toEqual({ sessionId: "session-1" });
  });

  it("omits auth for public demo read-only commands when no token is set", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await runAgentCli(["catalog", "list"], {
      env: { BLUEPRINT_API_BASE_URL: "http://localhost:5000" },
      fetchImpl: fetchMock,
      stdout: () => undefined,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/site-worlds?limit=24",
      expect.objectContaining({
        method: "GET",
        headers: expect.not.objectContaining({ authorization: expect.any(String) }),
      }),
    );
  });

  it("routes dry-run commerce commands through explicit agent-access endpoints", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const path = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).pathname;
      const payload =
        path.endsWith("/quote")
          ? { quote: { sku: "hosted-session-sw-chi-01", mode: "dry_run" } }
          : { order: { id: "dry-order-1", status: "fulfilled" }, entitlement: { id: "dry-ent-1", access_state: "provisioned" } };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const writes: string[] = [];

    await runAgentCli(
      ["commerce", "quote", "--site-world-id", "sw-chi-01", "--product", "hosted-session-rental"],
      {
        env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
        fetchImpl: fetchMock,
        stdout: (line) => writes.push(line),
      },
    );
    await runAgentCli(
      ["commerce", "checkout", "--site-world-id", "sw-chi-01", "--product", "hosted-session-rental", "--mode", "dry_run"],
      {
        env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
        fetchImpl: fetchMock,
        stdout: (line) => writes.push(line),
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://agent.example/api/agent-access/commerce/quote?siteWorldId=sw-chi-01&product=hosted_session_rental",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://agent.example/api/agent-access/commerce/dry-run-checkout",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"mode\":\"dry_run\""),
      }),
    );
    expect(writes.join("\n")).toContain("dry-ent-1");
  });

  it("routes entitlement readiness through the dry-run agent-access commerce endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        mode: "dry_run",
        entitled: true,
        launchable: true,
        truth: "Entitlement readiness proves commerce linkage only.",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const writes: string[] = [];

    await runAgentCli(
      [
        "commerce",
        "entitlement-readiness",
        "--site-world-id",
        "sw-chi-01",
        "--entitlement-id",
        "dry-ent-1",
        "--buyer-user-id",
        "agent-dry-run-buyer",
      ],
      {
        env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
        fetchImpl: fetchMock,
        stdout: (line) => writes.push(line),
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/api/agent-access/commerce/entitlement-readiness?siteWorldId=sw-chi-01&entitlementId=dry-ent-1&buyerUserId=agent-dry-run-buyer",
      expect.objectContaining({ method: "GET" }),
    );
    expect(JSON.parse(writes.join("\n"))).toMatchObject({
      mode: "dry_run",
      entitled: true,
      launchable: true,
    });
  });

  it("discovers the agent access manifest alongside public site content", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const path = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).pathname;
      const payload =
        path === "/api/agent-access"
          ? {
              preferredTool: "blueprint.siteWorld.search",
              publicDemo: { canRunWithoutCredentials: true },
              truthLabels: ["capture_grounded", "dry_run_order"],
            }
          : {
              summary: "Blueprint public site content",
              machineReadableFiles: { llms: "/llms.txt" },
            };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const writes: string[] = [];

    await runAgentCli(["discover"], {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
      stdout: (line) => writes.push(line),
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://agent.example/api/site-content",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://agent.example/api/agent-access",
      expect.objectContaining({ method: "GET" }),
    );
    const payload = JSON.parse(writes.join("\n"));
    expect(payload.agentAccess.preferredTool).toBe("blueprint.siteWorld.search");
    expect(payload.agentAccess.publicDemo.canRunWithoutCredentials).toBe(true);
  });

  it("calls the public site-world search endpoint with query params", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await runAgentCli(["catalog", "search", "--q", "whole foods", "--limit", "5", "--object-tags", "tote,shelf"], {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
      stdout: () => undefined,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/api/site-worlds/search?q=whole+foods&limit=5&objectTags=tote%2Cshelf",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("accepts the first-class site-world search command alias", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        matchSemantics: { noExactScannedPackage: true },
        requestCandidate: {
          requestUrl: "/contact?source=site-worlds&buyerType=robot_team&path=new-capture",
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const writes: string[] = [];

    await runAgentCli(["site-world", "search", "--q", "Whole Foods near Durham", "--limit", "5"], {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
      stdout: (line) => writes.push(line),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/api/site-worlds/search?q=Whole+Foods+near+Durham&limit=5",
      expect.objectContaining({ method: "GET" }),
    );
    expect(JSON.parse(writes.join("\n")).requestCandidate.requestUrl).toContain("source=site-worlds");
  });

  it("builds a request-location draft locally without access, payment, provider, or hosted proof fields", async () => {
    const fetchMock = vi.fn();
    const writes: string[] = [];

    await runAgentCli(
      [
        "request",
        "location",
        "--location",
        "Whole Foods near Durham",
        "--site-class",
        "grocery retail",
        "--workflow",
        "shelf restocking",
        "--message",
        "Need a new scan request, not access.",
      ],
      {
        env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
        fetchImpl: fetchMock,
        stdout: (line) => writes.push(line),
      },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    const payload = JSON.parse(writes.join("\n"));
    expect(payload).toMatchObject({
      mode: "dry_run",
      action: "request_location_draft",
      contactUrl: expect.stringContaining("/contact?"),
      inboundRequestDraft: {
        buyerType: "robot_team",
        commercialRequestPath: "capture_access",
        requestedLanes: ["deeper_evaluation"],
        siteLocation: "Whole Foods near Durham",
        targetSiteType: "grocery retail",
        proofPathPreference: "exact_site_required",
      },
      missingRequiredFields: expect.arrayContaining(["firstName", "lastName", "company", "roleTitle", "email", "budgetBucket"]),
      submitInstructions: {
        explicitSubmitRequired: true,
        defaultWrites: false,
      },
    });
    const contactUrl = new URL(payload.contactUrl, "https://tryblueprint.io");
    expect(contactUrl.searchParams.get("path")).toBe("new-capture");
    expect(contactUrl.searchParams.get("buyerType")).toBe("robot_team");
    expect([...contactUrl.searchParams.keys()]).not.toEqual(
      expect.arrayContaining(["entitlementId", "paymentStatus", "providerRunId", "hostedSessionId"]),
    );
    expect([...collectObjectKeys(payload)]).not.toEqual(
      expect.arrayContaining(["entitlementId", "paymentStatus", "providerRunId", "hostedSessionId"]),
    );
  });

  it("plans the exact catalog-match action from a robot-team query", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        query: "Harborview Grocery",
        results: [
          {
            siteWorld: {
              id: "sw-chi-01",
              siteName: "Harborview Grocery Distribution Annex",
              category: "Retail",
              siteAddress: "1847 W Fulton St, Chicago, IL 60612",
            },
            score: 1.42,
            matchedFields: ["siteName"],
            matchedAliases: [],
            reasons: ["siteName contains query"],
          },
        ],
        matchSemantics: {
          exactMatch: true,
          noExactScannedPackage: false,
          message: "At least one public catalog record matches the site name, code, or address query.",
          truthBoundary: "Search and request candidates are catalog/intake signals only.",
        },
        requestCandidate: null,
        warnings: [],
        meta: { usedEmbeddings: false, returned: 1 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const writes: string[] = [];

    await runAgentCli(["plan", "--q", "Harborview Grocery", "--want", "catalog-match"], {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
      stdout: (line) => writes.push(line),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/api/site-worlds/search?q=Harborview+Grocery&limit=5",
      expect.objectContaining({ method: "GET" }),
    );
    expect(JSON.parse(writes.join("\n"))).toMatchObject({
      mode: "dry_run",
      action: "agent_journey_plan",
      query: "Harborview Grocery",
      want: "catalog_match",
      nextAction: {
        kind: "exact_catalog_match",
        siteWorldId: "sw-chi-01",
        safeToRun: true,
        command: "npm run agent:cli -- world get sw-chi-01",
      },
      search: {
        exactMatch: true,
        topMatch: {
          siteWorldId: "sw-chi-01",
          siteName: "Harborview Grocery Distribution Annex",
        },
      },
      blockers: [],
    });
  });

  it("plans a no-exact request candidate without creating payment, entitlement, or hosted access", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        query: "Whole Foods near Durham",
        results: [
          {
            siteWorld: {
              id: "sw-chi-01",
              siteName: "Harborview Grocery Distribution Annex",
              category: "Retail",
            },
            score: 0.74,
            matchedFields: ["category"],
            matchedAliases: ["whole foods -> grocery retail"],
            reasons: ["closest grocery/retail match; no exact Whole Foods availability is implied"],
          },
        ],
        matchSemantics: {
          exactMatch: false,
          noExactScannedPackage: true,
          message: "No scanned package for this exact place yet.",
          truthBoundary: "Search and request candidates are catalog/intake signals only.",
        },
        requestCandidate: {
          requestUrl: "/contact?source=site-worlds&buyerType=robot_team&path=new-capture&location=Whole+Foods+near+Durham",
          buyerType: "robot_team",
          source: "site-worlds",
          requestPath: "new-capture",
          proofPathPreference: "exact_site_required",
        },
        warnings: ["embeddings_unavailable"],
        meta: { usedEmbeddings: false, returned: 1 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const writes: string[] = [];

    await runAgentCli(["plan", "--q", "Whole Foods near Durham", "--want", "hosted-review"], {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
      stdout: (line) => writes.push(line),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(writes.join("\n"));
    expect(payload).toMatchObject({
      mode: "dry_run",
      nextAction: {
        kind: "request_candidate",
        safeToRun: true,
        command: expect.stringContaining("npm run agent:cli -- request location"),
      },
      search: {
        exactMatch: false,
        noExactScannedPackage: true,
        requestCandidate: {
          contactUrl: expect.stringContaining("/contact?"),
        },
      },
      blockers: [
        expect.objectContaining({
          code: "no_exact_scanned_package",
          ownerSystem: "site_world_catalog",
        }),
      ],
    });
    expect([...collectObjectKeys(payload)]).not.toEqual(
      expect.arrayContaining(["paymentStatus", "providerRunId", "hostedSessionId"]),
    );
  });

  it("plans the dry-run quote, order, entitlement, and readiness path for an exact hosted-review query", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === "/api/site-worlds/search") {
        return new Response(JSON.stringify({
          query: "Blueprint hosted runtime demo",
          results: [
            {
              siteWorld: {
                id: "siteworld-f5fd54898cfb",
                siteName: "Blueprint hosted runtime demo",
                category: "Retail",
              },
              score: 1.64,
              matchedFields: ["siteName"],
              matchedAliases: [],
              reasons: ["Exact siteName match"],
            },
          ],
          matchSemantics: {
            exactMatch: true,
            noExactScannedPackage: false,
            message: "At least one public catalog record matches the site name, code, or address query.",
            truthBoundary: "Search and request candidates are catalog/intake signals only.",
          },
          requestCandidate: null,
          warnings: [],
          meta: { usedEmbeddings: false, returned: 1 },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.pathname.endsWith("/commerce/quote")) {
        return new Response(JSON.stringify({
          quote: {
            quoteId: "dry-quote-1",
            mode: "dry_run",
            product: "hosted_session_rental",
            siteWorldId: "siteworld-f5fd54898cfb",
            totalAmountCents: 3600,
          },
          truth: "Dry-run quotes do not create live Stripe sessions.",
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.pathname.endsWith("/commerce/dry-run-checkout")) {
        return new Response(JSON.stringify({
          order: { id: "dry-order-1", status: "fulfilled", payment_status: "dry_run_paid" },
          entitlement: { id: "dry-ent-1", access_state: "provisioned", dry_run: true },
          receipt: { mode: "dry_run", liveStripeTouched: false },
        }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.pathname.endsWith("/commerce/entitlement-readiness")) {
        return new Response(JSON.stringify({
          mode: "dry_run",
          entitled: true,
          launchable: true,
          blockers: [],
          truth: "This readiness endpoint proves entitlement linkage only.",
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected URL: ${url.toString()}`);
    });
    const writes: string[] = [];

    await runAgentCli(["plan", "--q", "Blueprint hosted runtime demo", "--want", "hosted-review", "--session-hours", "2"], {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
      stdout: (line) => writes.push(line),
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/create-checkout-session"),
      expect.anything(),
    );
    const payload = JSON.parse(writes.join("\n"));
    expect(payload).toMatchObject({
      mode: "dry_run",
      nextAction: {
        kind: "dry_run_quote_order",
        siteWorldId: "siteworld-f5fd54898cfb",
        safeToRun: true,
      },
      commerce: {
        quoteId: "dry-quote-1",
        orderId: "dry-order-1",
        entitlementId: "dry-ent-1",
        entitlementReadiness: {
          launchable: true,
        },
      },
      blockers: [],
      safeDefaults: {
        livePayment: false,
        privateAccess: false,
        providerExecution: false,
      },
    });
  });

  it("blocks protected hosted-session planning without auth or entitlement instead of creating a session", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        query: "Harborview Grocery",
        results: [
          {
            siteWorld: {
              id: "sw-chi-01",
              siteName: "Harborview Grocery Distribution Annex",
              category: "Retail",
              robotProfiles: [{ id: "other_sample" }],
              taskCatalog: [{ id: "sw-chi-01-task-1" }],
              scenarioCatalog: [{ id: "sw-chi-01-scenario-1" }],
              startStateCatalog: [{ id: "sw-chi-01-start-1" }],
            },
            score: 1.42,
            matchedFields: ["siteName"],
            matchedAliases: [],
            reasons: ["siteName contains query"],
          },
        ],
        matchSemantics: {
          exactMatch: true,
          noExactScannedPackage: false,
          message: "At least one public catalog record matches the site name, code, or address query.",
          truthBoundary: "Search and request candidates are catalog/intake signals only.",
        },
        requestCandidate: null,
        warnings: [],
        meta: { usedEmbeddings: false, returned: 1 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const writes: string[] = [];

    await runAgentCli(["plan", "--q", "Harborview Grocery", "--want", "session"], {
      env: { BLUEPRINT_API_BASE_URL: "https://agent.example" },
      fetchImpl: fetchMock,
      stdout: (line) => writes.push(line),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://agent.example/api/site-worlds/sessions",
      expect.anything(),
    );
    expect(JSON.parse(writes.join("\n"))).toMatchObject({
      nextAction: {
        kind: "blocked_protected_session_path",
        siteWorldId: "sw-chi-01",
        safeToRun: false,
      },
      blockers: [
        expect.objectContaining({ code: "protected_bearer_auth_required", ownerSystem: "firebase_auth" }),
        expect.objectContaining({ code: "hosted_session_entitlement_required", ownerSystem: "marketplace_entitlements" }),
      ],
      suppressedActions: expect.arrayContaining(["private_access", "provider_execution", "hosted_session_creation"]),
    });
  });
});
