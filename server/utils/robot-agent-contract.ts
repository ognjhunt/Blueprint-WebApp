export const ROBOT_AGENT_CONTRACT_VERSION = "2026-07-16";
export const ROBOT_AGENT_TRUTH_LABELS = [
  "capture_grounded",
  "provider_derived",
  "generated",
  "request_gated",
  "protected_robot_team",
  "dry_run_order",
  "live_checkout",
] as const;
export const ROBOT_AGENT_MCP_TOOL_NAMES = [
  "blueprint.siteWorld.search",
  "blueprint.catalog.search",
  "blueprint.ask",
  "blueprint.request.locationDraft",
  "blueprint.siteWorld.get",
  "blueprint.siteWorld.launchReadiness",
  "blueprint.commerce.quote",
  "blueprint.commerce.checkoutDryRun",
  "blueprint.commerce.checkoutLive",
  "blueprint.commerce.order.get",
  "blueprint.commerce.liveOrder.get",
  "blueprint.commerce.entitlement.get",
  "blueprint.commerce.entitlementReadiness",
  "blueprint.session.create",
  "blueprint.session.reset",
  "blueprint.session.step",
  "blueprint.session.runBatch",
  "blueprint.session.control",
  "blueprint.session.renderExplorer",
  "blueprint.session.export",
] as const;
export const ROBOT_AGENT_CLI_COMMANDS = [
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts help --format json",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts doctor --format json",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts setup-auth --format json",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts plan --q \"Whole Foods near Durham\" --want hosted-review",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts discover",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts site-world search --q \"Whole Foods near Durham\" --limit 5",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts request location --location \"Whole Foods near Durham\" --site-class grocery --workflow \"shelf restocking\"",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts ask --q \"How do I buy a hosted session with a budget?\"",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce quote --site-world-id <pipeline-site-world-id> --product hosted-session-rental --session-hours 1",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce checkout --site-world-id <pipeline-site-world-id> --product hosted-session-rental --mode dry_run",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce checkout --site-world-id <pipeline-site-world-id> --product hosted-session-rental --mode live --budget-cents 20000",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce live-order <live-order-id>",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce entitlement-readiness --site-world-id <pipeline-site-world-id> --entitlement-id <dry-entitlement-id>",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts session create --site-world-id <pipeline-site-world-id> --session-mode runtime_only --robot-profile-id <robot-profile-id> --task-id <task-id> --scenario-id <scenario-id> --start-state-id <start-state-id>",
] as const;

export function buildRobotAgentAccessManifest() {
  return {
    name: "Blueprint Robot-Team Agent Access",
    docs: "/agent-access.openapi.json",
    openapi: "/api/agent-access/openapi.json",
    staticOpenapi: "/agent-access.openapi.json",
    llms: "/llms.txt",
    llmsFull: "/llms-full.txt",
    preferredTool: "blueprint.siteWorld.search",
    compatibilityTool: "blueprint.catalog.search",
    mcpToolNames: ROBOT_AGENT_MCP_TOOL_NAMES,
    env: {
      apiBaseUrl: "BLUEPRINT_API_BASE_URL",
      bearerToken: "BLUEPRINT_AGENT_AUTH_TOKEN",
    },
    credentiallessWorkflow: {
      requiredCredentials: false,
      summary:
        "A headless robot-team agent can discover Blueprint, ask grounded questions, search live public site records, draft a new-location intake request, and create planning-only dry-run commerce records without credentials. Hosted sessions require a scoped robot-team or admin bearer token plus current entitlement and runtime proof.",
      cliCommands: ROBOT_AGENT_CLI_COMMANDS,
    },
    siteWorldSearch: {
      endpoint: "/api/site-worlds/search",
      mcpTool: "blueprint.siteWorld.search",
      publicReadOnly: true,
      requestCandidateIntakeOnly: true,
      filters: [
        "category",
        "industry",
        "city",
        "state",
        "siteType",
        "taskLane",
        "objectTags",
        "robot",
        "availability",
        "readiness",
        "sort",
      ],
      semanticRanking:
        "Embedding-based semantic similarity augments alias/lexical/location ranking when configured; without it, search stays deterministic and flags embeddings_unavailable.",
      truth:
        "Search returns public ranked matches and request candidates. It never grants entitlement, payment, rights clearance, provider execution, fulfillment, private artifact access, or hosted-session access.",
    },
    ask: {
      endpoint: "/api/agent-access/ask",
      methods: ["GET", "POST"],
      mcpTool: "blueprint.ask",
      publicReadOnly: true,
      grounded: true,
      truth:
        "Ask returns curated citation-backed answer snippets over public canonical content with machine next-actions. It never generates unsupported claims, grants access, or proves payment, rights, provider execution, or fulfillment.",
    },
    journeyPlanner: {
      cliCommand:
        "npx tsx scripts/agent-access/blueprint-agent-cli.ts plan --q \"Whole Foods near Durham\" --want hosted-review",
      defaultMode: "read_or_dry_run",
      returnsCompactJson: true,
      nextActions: [
        "exact_catalog_match",
        "request_candidate",
        "dry_run_quote_order",
        "entitlement_readiness",
        "blocked_protected_session_path",
      ],
      livePayment: false,
      privateAccess: false,
      providerExecution: false,
      hostedSessionCreatedByPlanner: false,
      truth:
        "The planner reads public search and may call dry-run agent commerce/readiness endpoints only. It returns the next safe machine action and structured blockers without creating live payment, private access, provider execution, or hosted-session fulfillment.",
    },
    requestCandidate: {
      source: "site-worlds",
      buyerType: "robot_team",
      requestPath: "new-capture",
      intakeOnly: true,
      grantsAccess: false,
      grantsPayment: false,
      grantsEntitlement: false,
      grantsHostedSession: false,
      truth:
        "requestCandidate records intake interest only and stays separate from quote, order, entitlement, rights, provider execution, and fulfillment state.",
    },
    requestLocationDraft: {
      cliCommand:
        "npx tsx scripts/agent-access/blueprint-agent-cli.ts request location --location \"Whole Foods near Durham\" --site-class grocery --workflow \"shelf restocking\"",
      mcpTool: "blueprint.request.locationDraft",
      intakeOnly: true,
      defaultWrites: false,
      scrapesContactPage: false,
      contactUrlPattern: "/contact?source=agent-request-location&buyerType=robot_team&path=new-capture",
      returns: [
        "contactUrl",
        "inboundRequestDraft",
        "missingRequiredFields",
        "truthBoundaries",
        "submitInstructions",
      ],
      requiredSubmitFields: [
        "requestId",
        "firstName",
        "lastName",
        "company",
        "roleTitle",
        "email",
        "budgetBucket",
        "taskStatement",
        "targetSiteTypeOrSiteNameOrLocation",
        "proofPathPreference",
      ],
      truth:
        "request location / blueprint.request.locationDraft builds a local draft for new site scan intake only. It does not write, scrape /contact, grant entitlement, prove payment, clear rights, run providers, fulfill hosted sessions, or open package access.",
    },
    dryRunCommerce: {
      mode: "dry_run",
      liveStripeTouched: false,
      createsLivePayment: false,
      grantsLivePackageAccess: false,
      endpoints: {
        quote: "/api/agent-access/commerce/quote",
        dryRunCheckout: "/api/agent-access/commerce/dry-run-checkout",
        order: "/api/agent-access/commerce/orders/{orderId}",
        entitlement: "/api/agent-access/commerce/entitlements/{entitlementId}",
        entitlementReadiness: "/api/agent-access/commerce/entitlement-readiness",
      },
      tools: [
        "blueprint.commerce.quote",
        "blueprint.commerce.checkoutDryRun",
        "blueprint.commerce.order.get",
        "blueprint.commerce.entitlement.get",
        "blueprint.commerce.entitlementReadiness",
      ],
      truth:
        "Dry-run commerce reuses quote, order, receipt, and entitlement shapes for local/test proof only. It never calls live Stripe or proves fulfillment.",
    },
    liveCommerce: {
      mode: "live",
      liveStripeTouched: true,
      paymentModel:
        "The agent (or its operating team's wallet/payment method) completes a real Stripe Checkout Session; webhook fulfillment marks the order paid and provisions the marketplace entitlement automatically.",
      budgetGuard:
        "Optional budgetCents is enforced server-side: quotes above the declared budget return a structured budget_exceeded blocker and create no order or Stripe session.",
      eligibility:
        "Live checkout is offered only for Pipeline-backed site worlds. Any record without current owner-system identity returns a not_live_purchasable blocker with request-intake alternatives.",
      priceGrounding:
        "Only catalog-grounded prices are charged: when the public catalog has no parseable price for the requested product, live checkout returns a price_unavailable blocker instead of charging a fallback default.",
      buyerIdentity:
        "A Firebase bearer token, buyer.uid, or buyer.email is required so the webhook-provisioned entitlement binds to a usable account; email-bound entitlements unlock for a verified sign-in with the same email.",
      serverPricedSku: true,
      endpoints: {
        liveCheckout: "/api/agent-access/commerce/live-checkout",
        liveOrder: "/api/agent-access/commerce/live-orders/{orderId}",
      },
      tools: ["blueprint.commerce.checkoutLive", "blueprint.commerce.liveOrder.get"],
      truth:
        "Live checkout creates a real Stripe Checkout Session and buyer-order ledger entry. Payment and entitlement provisioning complete only after Stripe checkout succeeds; rights clearance, provider execution, and hosted runtime proof remain owned by their normal systems.",
    },
    protectedFlow: {
      requiresBearer: true,
      authModel: "Firebase robot_team or admin bearer token",
      accessModel: "provisioned entitlement for new protected launches; existing sessions require session ownership, admin access, or an active per-session share grant",
      livePaymentPath: "/api/agent-access/commerce/live-checkout",
      truth:
        "Protected robot-team hosted sessions preserve Firebase, entitlement, session ownership, rights, runtime, and launch-readiness checks. Dry-run commerce is separate from live Stripe/payment/fulfillment.",
    },
    tools: {
      cli: "scripts/agent-access/blueprint-agent-cli.ts",
      mcp: "scripts/agent-access/blueprint-mcp-server.ts",
      mcpToolNames: ROBOT_AGENT_MCP_TOOL_NAMES,
    },
    truthLabels: ROBOT_AGENT_TRUTH_LABELS,
    truth:
      "Hosted sessions require Firebase robot-team/admin bearer auth and current entitlement, package, runtime, and launch-readiness proof. Dry-run commerce never substitutes for live Stripe, rights, provider, package-access, or fulfillment proof.",
  };
}

const jsonResponse = (schemaRef: string, description = "JSON response") => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: schemaRef },
    },
  },
});

const errorResponses = {
  "400": jsonResponse("#/components/schemas/ErrorResponse", "Invalid request"),
  "401": jsonResponse("#/components/schemas/ErrorResponse", "Missing or invalid bearer token"),
  "403": jsonResponse("#/components/schemas/ErrorResponse", "Authenticated account is not allowed to launch protected hosted sessions"),
  "404": jsonResponse("#/components/schemas/ErrorResponse", "Requested site world or session was not found"),
  "409": jsonResponse("#/components/schemas/LaunchBlockedResponse", "Launch or runtime operation is blocked by current readiness, access, or session state"),
};

const bearerSecurity = [{ BlueprintBearer: [] }];

export function buildRobotAgentOpenApiContract() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Blueprint Robot-Team Agent API",
      version: ROBOT_AGENT_CONTRACT_VERSION,
      summary: "Headless catalog, site-world, dry-run commerce, hosted-session, explorer-render, and export contract for robot-team agents.",
      description:
        "Blueprint exposes capture-backed site-world catalog, dry-run quote/order/entitlement proof, and protected hosted-session endpoints for robot-team agents. Hosted-session flows use the existing Firebase bearer path and require robot_team/admin outer auth. A provisioned entitlement can launch a new session; existing sessions require creator ownership, admin access, or an active per-session share grant.",
    },
    servers: [
      {
        url: "https://tryblueprint.io",
        description: "Production public origin. Protected flows require a scoped robot-team/admin bearer token.",
      },
      {
        url: "http://localhost:5000",
        description: "Local development server. Hosted-session routes retain the same bearer and entitlement boundaries.",
      },
    ],
    tags: [
      { name: "Discovery", description: "Public site and API discovery for agents." },
      { name: "Ask", description: "Grounded, citation-backed question answering for agents." },
      { name: "Catalog", description: "Public site-world catalog and detail endpoints." },
      { name: "Agent commerce", description: "Dry-run quote, order, receipt, and entitlement proof. Does not call live Stripe." },
      { name: "Live agent commerce", description: "Real Stripe Checkout for agents with a budget. Server-priced SKUs, structured blockers, webhook-provisioned entitlements." },
      { name: "Hosted sessions", description: "Session lifecycle, rollout, render, and export endpoints." },
    ],
    paths: {
      "/api/agent-access": {
        get: {
          tags: ["Discovery"],
          operationId: "discoverAgentAccess",
          summary: "Discover the robot-team agent access manifest.",
          description:
            "Credential-free discovery manifest for headless robot-team agents. It names blueprint.siteWorld.search as the first-class search tool, keeps requestCandidate intake-only, lists dry-run commerce endpoints, and documents the protected hosted-session boundary.",
          security: [{}],
          responses: {
            "200": jsonResponse("#/components/schemas/AgentAccessManifest"),
          },
        },
      },
      "/api/site-content": {
        get: {
          tags: ["Discovery"],
          operationId: "discoverBlueprint",
          summary: "Discover public Blueprint pages, llms files, and machine-readable resources.",
          security: [{}],
          responses: {
            "200": jsonResponse("#/components/schemas/SiteContentResponse"),
          },
        },
      },
      "/api/site-worlds": {
        get: {
          tags: ["Catalog"],
          operationId: "listSiteWorlds",
          summary: "List public site-world catalog entries.",
          security: [{}],
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 100, default: 24 },
            },
          ],
          responses: {
            "200": jsonResponse("#/components/schemas/SiteWorldListResponse"),
          },
        },
      },
      "/api/site-worlds/search": {
        get: {
          tags: ["Catalog"],
          operationId: "searchSiteWorlds",
          summary: "Search public site-world catalog entries by natural language query, alias, and structured filters.",
          description:
            "Public read-only catalog discovery for robot-team agents. This is the OpenAPI surface behind the MCP tool blueprint.siteWorld.search. Queries such as whole foods, store, supermarket, retail aisle, or warehouse tote return truthful close matches with scores, reasons, matched aliases, matched fields, parsed filters, no-exact scanned package semantics, request-candidate URLs/drafts, warnings, and embedding-use metadata. Brand aliases do not imply exact partner or package availability.",
          security: [{}],
          parameters: [
            { name: "q", in: "query", required: false, schema: { type: "string" }, examples: { wholeFoods: { value: "whole foods" }, store: { value: "store" }, warehouseTote: { value: "warehouse tote" } } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } },
            { name: "category", in: "query", required: false, schema: { type: "string" } },
            { name: "industry", in: "query", required: false, schema: { type: "string" } },
            { name: "city", in: "query", required: false, schema: { type: "string" } },
            { name: "state", in: "query", required: false, schema: { type: "string" } },
            { name: "siteType", in: "query", required: false, schema: { type: "string" } },
            { name: "taskLane", in: "query", required: false, schema: { type: "string" } },
            {
              name: "objectTags",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Comma-separated required object tags, for example tote,pallet.",
            },
            { name: "robot", in: "query", required: false, schema: { type: "string" } },
            { name: "availability", in: "query", required: false, schema: { type: "string" } },
            { name: "readiness", in: "query", required: false, schema: { type: "string" } },
            {
              name: "sort",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["relevance", "name", "city", "category", "readiness", "availability"], default: "relevance" },
            },
          ],
          responses: {
            "200": jsonResponse("#/components/schemas/SiteWorldSearchResponse"),
          },
          "x-blueprint-truth-boundary":
            "This endpoint is public catalog discovery only. It does not grant hosted-session access, buyer entitlement, private artifact access, or exact brand/site availability.",
        },
      },
      "/api/site-worlds/{siteWorldId}": {
        get: {
          tags: ["Catalog"],
          operationId: "getSiteWorld",
          summary: "Get one public site-world detail record.",
          security: [{}],
          parameters: [{ $ref: "#/components/parameters/SiteWorldId" }],
          responses: {
            "200": jsonResponse("#/components/schemas/SiteWorld"),
            "404": errorResponses["404"],
          },
        },
      },
      "/api/site-worlds/sessions/launch-readiness": {
        get: {
          tags: ["Hosted sessions"],
          operationId: "getLaunchReadiness",
          summary: "Inspect launch readiness for a site world before creating a hosted session.",
          security: bearerSecurity,
          parameters: [
            {
              name: "siteWorldId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": jsonResponse("#/components/schemas/LaunchReadiness"),
            ...errorResponses,
          },
        },
      },
      "/api/agent-access/commerce/quote": {
        get: {
          tags: ["Agent commerce"],
          operationId: "quoteAgentCommerce",
          summary: "Quote a site-world package or hosted-session rental for agent planning.",
          security: [{}],
          parameters: [
            { name: "siteWorldId", in: "query", required: true, schema: { type: "string" } },
            {
              name: "product",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["site_world_package", "hosted_session_rental"], default: "hosted_session_rental" },
            },
            { name: "sessionHours", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
          ],
          responses: {
            "200": jsonResponse("#/components/schemas/AgentCommerceQuoteResponse"),
            "400": errorResponses["400"],
          },
          "x-blueprint-dry-run-only": true,
          "x-blueprint-truth-boundary":
            "Quotes are planning artifacts. They do not create live Stripe sessions, charge cards, grant live package access, or prove rights clearance.",
        },
      },
      "/api/agent-access/commerce/dry-run-checkout": {
        post: {
          tags: ["Agent commerce"],
          operationId: "createAgentDryRunCheckout",
          summary: "Create a dry-run order and provisioned entitlement without live Stripe.",
          security: [{}],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentDryRunCheckoutRequest" },
              },
            },
          },
          responses: {
            "201": jsonResponse("#/components/schemas/AgentDryRunOrderResponse", "Dry-run order created"),
            "400": errorResponses["400"],
          },
          "x-blueprint-dry-run-only": true,
          "x-blueprint-truth-boundary":
            "This route reuses buyerOrders and marketplaceEntitlements response shapes for local/test proof only. It never calls live Stripe or opens live package access.",
        },
      },
      "/api/agent-access/commerce/orders/{orderId}": {
        get: {
          tags: ["Agent commerce"],
          operationId: "getAgentDryRunOrder",
          summary: "Read a dry-run order and receipt.",
          security: [{}],
          parameters: [
            { name: "orderId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": jsonResponse("#/components/schemas/AgentDryRunOrderResponse"),
            "404": errorResponses["404"],
          },
          "x-blueprint-dry-run-only": true,
        },
      },
      "/api/agent-access/commerce/entitlements/{entitlementId}": {
        get: {
          tags: ["Agent commerce"],
          operationId: "getAgentDryRunEntitlement",
          summary: "Read a dry-run marketplace entitlement.",
          security: [{}],
          parameters: [
            { name: "entitlementId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": jsonResponse("#/components/schemas/AgentEntitlementResponse"),
            "404": errorResponses["404"],
          },
          "x-blueprint-dry-run-only": true,
        },
      },
      "/api/agent-access/commerce/entitlement-readiness": {
        get: {
          tags: ["Agent commerce"],
          operationId: "getAgentEntitlementReadiness",
          summary: "Check whether a provisioned entitlement would unlock protected hosted-session launch.",
          security: [{}],
          parameters: [
            { name: "siteWorldId", in: "query", required: true, schema: { type: "string" } },
            { name: "entitlementId", in: "query", required: true, schema: { type: "string" } },
            { name: "buyerUserId", in: "query", required: false, schema: { type: "string", default: "agent-dry-run-buyer" } },
          ],
          responses: {
            "200": jsonResponse("#/components/schemas/AgentEntitlementReadiness"),
            "400": errorResponses["400"],
          },
          "x-blueprint-dry-run-only": true,
          "x-blueprint-truth-boundary":
            "Entitlement readiness proves commerce linkage only. Runtime launch, rights, provider execution, and package fulfillment still require their owning systems.",
        },
      },
      "/api/agent-access/ask": {
        get: {
          tags: ["Ask"],
          operationId: "askBlueprint",
          summary: "Ask a grounded question about Blueprint and receive citation-backed answers with machine next-actions.",
          description:
            "Public question answering for headless agents behind the MCP tool blueprint.ask. Answers are curated citation-backed snippets over public canonical content (product, search, live and dry-run commerce, entitlement-to-session flow, pricing ranges, proof boundaries, intake). Ranking combines alias, lexical, and embedding signals with a deterministic fallback. Responses never generate unsupported claims, grant access, or prove payment, rights clearance, provider execution, or fulfillment.",
          security: [{}],
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string" },
              examples: {
                buy: { value: "How can an agent with a budget buy a hosted session?" },
                search: { value: "How do I filter sites by type and location?" },
              },
            },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 10, default: 3 } },
          ],
          responses: {
            "200": jsonResponse("#/components/schemas/AgentAskResponse"),
            "400": errorResponses["400"],
          },
          "x-blueprint-truth-boundary":
            "Answers are curated grounded snippets with citations, not generated claims, and grant no access or commerce state.",
        },
        post: {
          tags: ["Ask"],
          operationId: "askBlueprintPost",
          summary: "POST variant of the grounded ask endpoint for JSON-body agent clients.",
          security: [{}],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentAskRequest" },
              },
            },
          },
          responses: {
            "200": jsonResponse("#/components/schemas/AgentAskResponse"),
            "400": errorResponses["400"],
          },
        },
      },
      "/api/agent-access/commerce/live-checkout": {
        post: {
          tags: ["Live agent commerce"],
          operationId: "createAgentLiveCheckout",
          summary: "Create a real Stripe Checkout Session for an agent purchase with an optional budget guard.",
          description:
            "Live purchase path for agents with a budget/wallet, behind the MCP tool blueprint.commerce.checkoutLive. The server prices the SKU from the public catalog (client prices are ignored; if the catalog has no parseable price for the product a price_unavailable blocker is returned instead of a fallback charge), enforces the optional budgetCents guard, and only offers live checkout for pipeline-backed site worlds. A buyer identity is required so the paid entitlement binds to a usable account: send a Firebase bearer token, buyer.uid, or buyer.email (verified-email sign-in later unlocks email-bound entitlements). Eligible requests create a buyer-order ledger entry plus a Stripe Checkout Session and return the checkout URL; completing payment triggers webhook fulfillment that provisions the marketplace entitlement used by entitlement-readiness and protected hosted-session launch.",
          security: [{}, { BlueprintBearer: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentLiveCheckoutRequest" },
              },
            },
          },
          responses: {
            "201": jsonResponse("#/components/schemas/AgentLiveCheckoutResponse", "Live Stripe checkout created"),
            "400": errorResponses["400"],
            "409": jsonResponse("#/components/schemas/AgentLiveCheckoutBlockedResponse", "Live checkout blocked by eligibility, budget, or configuration"),
          },
          "x-blueprint-live-stripe": true,
          "x-blueprint-truth-boundary":
            "Live checkout creates a real Stripe session and order ledger entry. Payment and entitlement provisioning complete only after Stripe checkout succeeds; rights, provider execution, and hosted runtime proof remain owned by their normal systems.",
        },
      },
      "/api/agent-access/commerce/live-orders/{orderId}": {
        get: {
          tags: ["Live agent commerce"],
          operationId: "getAgentLiveOrderStatus",
          summary: "Poll a live agent order for payment and entitlement-provisioning status.",
          description:
            "Non-PII status projection of the buyer-order ledger for agent-commerce SKUs, behind the MCP tool blueprint.commerce.liveOrder.get. Poll after live checkout until paid=true and provisioned=true, then continue with entitlement-readiness and protected hosted-session launch.",
          security: [{}],
          parameters: [
            { name: "orderId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": jsonResponse("#/components/schemas/AgentLiveOrderStatus"),
            "404": errorResponses["404"],
          },
          "x-blueprint-live-stripe": true,
        },
      },
      "/api/site-worlds/sessions": {
        post: {
          tags: ["Hosted sessions"],
          operationId: "createHostedSession",
          summary: "Create a hosted session for an entitled robot-team account.",
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateHostedSessionRequest" },
              },
            },
          },
          responses: {
            "201": jsonResponse("#/components/schemas/CreateHostedSessionResponse", "Session created"),
            "200": jsonResponse("#/components/schemas/CreateHostedSessionResponse", "Reusable protected session returned"),
            ...errorResponses,
          },
          "x-blueprint-truth-boundary":
            "Creation requires Firebase robot_team/admin authentication plus a provisioned entitlement and current owner-system launch readiness.",
        },
      },
      "/api/site-worlds/sessions/{sessionId}": {
        get: {
          tags: ["Hosted sessions"],
          operationId: "getHostedSession",
          summary: "Read a hosted session record.",
          security: bearerSecurity,
          parameters: [{ $ref: "#/components/parameters/SessionId" }],
          responses: {
            "200": jsonResponse("#/components/schemas/HostedSession"),
            ...errorResponses,
          },
        },
      },
      "/api/site-worlds/sessions/{sessionId}/reset": {
        post: sessionMutationOperation("resetHostedSession", "Reset scenario, start state, task, and seed for a hosted rollout.", "#/components/schemas/ResetHostedSessionRequest"),
      },
      "/api/site-worlds/sessions/{sessionId}/step": {
        post: sessionMutationOperation("stepHostedSession", "Advance one rollout step with an action or autopolicy request.", "#/components/schemas/StepHostedSessionRequest"),
      },
      "/api/site-worlds/sessions/{sessionId}/run-batch": {
        post: sessionMutationOperation("runBatchHostedSession", "Run a headless batch rollout and return summary/artifact references.", "#/components/schemas/RunBatchRequest"),
      },
      "/api/site-worlds/sessions/{sessionId}/control": {
        post: sessionMutationOperation("controlHostedSession", "Send runtime control intent for camera, policy, or playback state.", "#/components/schemas/ControlRequest"),
      },
      "/api/site-worlds/sessions/{sessionId}/render": {
        get: {
          tags: ["Hosted sessions"],
          operationId: "renderHostedSessionFrame",
          summary: "Render a robot-observation frame for the selected camera.",
          security: bearerSecurity,
          parameters: [
            { $ref: "#/components/parameters/SessionId" },
            { name: "cameraId", in: "query", required: false, schema: { type: "string", default: "head_rgb" } },
          ],
          responses: {
            "200": {
              description: "Rendered frame or fallback artifact frame.",
              content: {
                "image/png": { schema: { type: "string", format: "binary" } },
                "application/octet-stream": { schema: { type: "string", format: "binary" } },
              },
            },
            ...errorResponses,
          },
        },
      },
      "/api/site-worlds/sessions/{sessionId}/explorer-render": {
        post: sessionMutationOperation("renderHostedSessionExplorer", "Render an explorer frame from a requested camera pose.", "#/components/schemas/ExplorerRenderRequest"),
      },
      "/api/site-worlds/sessions/{sessionId}/explorer-frame": {
        get: {
          tags: ["Hosted sessions"],
          operationId: "getHostedSessionExplorerFrame",
          summary: "Fetch the latest explorer-rendered PNG frame.",
          security: bearerSecurity,
          parameters: [
            { $ref: "#/components/parameters/SessionId" },
            { name: "cameraId", in: "query", required: false, schema: { type: "string", default: "head_rgb" } },
          ],
          responses: {
            "200": {
              description: "Explorer-rendered PNG frame.",
              content: { "image/png": { schema: { type: "string", format: "binary" } } },
            },
            ...errorResponses,
          },
        },
      },
      "/api/site-worlds/sessions/{sessionId}/export": {
        post: sessionMutationOperation("exportHostedSession", "Export session dataset artifacts and manifest references.", "#/components/schemas/ExportRequest"),
      },
    },
    components: {
      securitySchemes: {
        BlueprintBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Firebase ID token or future scoped robot-team machine token",
          description:
            "Protected flows currently use Firebase Admin token verification. The bearer must resolve to an admin user or a user profile with buyerType robot_team.",
        },
      },
      parameters: {
        SiteWorldId: {
          name: "siteWorldId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
        SessionId: {
          name: "sessionId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      },
      schemas: buildSchemas(),
    },
    "x-blueprint-truth-labels": ROBOT_AGENT_TRUTH_LABELS,
  } as const;
}

function sessionMutationOperation(operationId: string, summary: string, requestSchemaRef: string) {
  return {
    tags: ["Hosted sessions"],
    operationId,
    summary,
    security: bearerSecurity,
    parameters: [{ $ref: "#/components/parameters/SessionId" }],
    requestBody: {
      required: false,
      content: {
        "application/json": {
          schema: { $ref: requestSchemaRef },
        },
      },
    },
    responses: {
      "200": jsonResponse("#/components/schemas/HostedSessionOperationResponse"),
      "202": jsonResponse("#/components/schemas/PendingOperationResponse", "Accepted for async runtime mutation"),
      ...errorResponses,
    },
    "x-blueprint-truth-boundary":
      "Hosted-session mutation requires bearer auth and preserves entitlement, ownership, runtime, and launch-readiness checks.",
  } as const;
}

function buildSchemas() {
  return {
    TruthLabel: {
      type: "string",
      enum: [
        "capture_grounded",
        "provider_derived",
        "generated",
        "request_gated",
        "protected_robot_team",
        "dry_run_order",
        "live_checkout",
      ],
    },
    AgentCommerceProduct: {
      type: "string",
      enum: ["site_world_package", "hosted_session_rental"],
    },
    StatusLabel: {
      type: "string",
      enum: [
        "ready",
        "launchable",
        "blocked",
        "running",
        "completed",
        "failed",
        "request_gated",
        "not_configured",
      ],
    },
    SiteContentResponse: {
      type: "object",
      required: ["summary", "definitions", "pages", "machineReadableFiles"],
      properties: {
        summary: { type: "string" },
        definitions: { type: "array", items: { type: "object" } },
        pages: { type: "array", items: { $ref: "#/components/schemas/PublicPage" } },
        queryThemes: { type: "array", items: { type: "string" } },
        privateOrNoindex: { type: "array", items: { type: "string" } },
        machineReadableFiles: { type: "object", additionalProperties: { type: "string" } },
      },
    },
    PublicPage: {
      type: "object",
      required: ["path", "title", "description"],
      properties: {
        path: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
      },
    },
    AgentAccessManifest: {
      type: "object",
      required: [
        "name",
        "preferredTool",
        "compatibilityTool",
        "mcpToolNames",
        "credentiallessWorkflow",
        "siteWorldSearch",
        "ask",
        "journeyPlanner",
        "requestCandidate",
        "requestLocationDraft",
        "dryRunCommerce",
        "liveCommerce",
        "protectedFlow",
        "truthLabels",
      ],
      additionalProperties: true,
      properties: {
        name: { type: "string" },
        docs: { type: "string" },
        openapi: { type: "string" },
        staticOpenapi: { type: "string" },
        llms: { type: "string" },
        llmsFull: { type: "string" },
        preferredTool: { type: "string", enum: ["blueprint.siteWorld.search"] },
        compatibilityTool: { type: "string", enum: ["blueprint.catalog.search"] },
        mcpToolNames: {
          type: "array",
          items: { type: "string", enum: [...ROBOT_AGENT_MCP_TOOL_NAMES] },
        },
        credentiallessWorkflow: {
          type: "object",
          required: ["requiredCredentials", "summary", "cliCommands"],
          additionalProperties: true,
          properties: {
            requiredCredentials: { type: "boolean" },
            summary: { type: "string" },
            cliCommands: { type: "array", items: { type: "string" } },
          },
        },
        siteWorldSearch: { type: "object", additionalProperties: true },
        ask: { type: "object", additionalProperties: true },
        journeyPlanner: { type: "object", additionalProperties: true },
        requestCandidate: { type: "object", additionalProperties: true },
        requestLocationDraft: { type: "object", additionalProperties: true },
        dryRunCommerce: { type: "object", additionalProperties: true },
        liveCommerce: { type: "object", additionalProperties: true },
        protectedFlow: { type: "object", additionalProperties: true },
        tools: { type: "object", additionalProperties: true },
        truthLabels: { type: "array", items: { $ref: "#/components/schemas/TruthLabel" } },
        truth: { type: "string" },
      },
    },
    SiteWorldListResponse: {
      type: "object",
      required: ["items", "count"],
      properties: {
        items: { type: "array", items: { $ref: "#/components/schemas/SiteWorld" } },
        count: { type: "integer" },
      },
    },
    SiteWorldSearchResponse: {
      type: "object",
      required: ["query", "results", "parsed", "appliedFilters", "matchSemantics", "requestCandidate", "warnings", "meta"],
      properties: {
        query: { type: "string" },
        results: { type: "array", items: { $ref: "#/components/schemas/SiteWorldSearchResult" } },
        parsed: { $ref: "#/components/schemas/SiteWorldSearchParsed" },
        appliedFilters: { $ref: "#/components/schemas/SiteWorldSearchFilters" },
        matchSemantics: { $ref: "#/components/schemas/SiteWorldSearchMatchSemantics" },
        requestCandidate: { anyOf: [{ $ref: "#/components/schemas/SiteWorldSearchRequestCandidate" }, { type: "null" }] },
        warnings: { type: "array", items: { type: "string" } },
        meta: { $ref: "#/components/schemas/SiteWorldSearchMeta" },
      },
    },
    SiteWorldSearchMatchSemantics: {
      type: "object",
      required: ["exactMatch", "noExactScannedPackage", "message", "truthBoundary"],
      properties: {
        exactMatch: { type: "boolean" },
        noExactScannedPackage: { type: "boolean" },
        message: { type: "string" },
        truthBoundary: { type: "string" },
      },
    },
    SiteWorldSearchRequestCandidate: {
      type: "object",
      required: [
        "buyerType",
        "source",
        "requestPath",
        "requestUrl",
        "query",
        "siteName",
        "siteLocation",
        "taskStatement",
        "requestedOutputs",
        "proofPathPreference",
        "inboundRequestDraft",
      ],
      properties: {
        buyerType: { type: "string", enum: ["robot_team"] },
        source: { type: "string", enum: ["site-worlds"] },
        requestPath: { type: "string", enum: ["new-capture"] },
        requestUrl: { type: "string" },
        query: { type: "string" },
        siteName: { type: "string" },
        siteLocation: { type: "string" },
        targetSiteType: { type: "string" },
        workflow: { type: "string" },
        taskStatement: { type: "string" },
        requestedOutputs: { type: "string" },
        proofPathPreference: { type: "string", enum: ["exact_site_required"] },
        inboundRequestDraft: { $ref: "#/components/schemas/SiteWorldInboundRequestDraft" },
      },
      description:
        "Agent-safe request candidate for no-exact scanned package states. It records intake interest only and does not grant entitlement, payment, rights clearance, provider execution, hosted-session availability, fulfillment, or private artifact access.",
    },
    SiteWorldInboundRequestDraft: {
      type: "object",
      required: ["buyerType", "commercialRequestPath", "requestedLanes", "siteName", "siteLocation", "taskStatement", "proofPathPreference", "context"],
      additionalProperties: false,
      properties: {
        buyerType: { type: "string", enum: ["robot_team"] },
        commercialRequestPath: { type: "string", enum: ["capture_access"] },
        requestedLanes: { type: "array", items: { type: "string", enum: ["deeper_evaluation"] } },
        siteName: { type: "string" },
        siteLocation: { type: "string" },
        targetSiteType: { type: "string" },
        taskStatement: { type: "string" },
        proofPathPreference: { type: "string", enum: ["exact_site_required"] },
        workflowContext: { type: "string" },
        details: { type: "string" },
        context: {
          type: "object",
          required: ["sourcePageUrl", "buyerChannelSourceRaw", "utm"],
          properties: {
            sourcePageUrl: { type: "string" },
            buyerChannelSourceRaw: { type: "string", enum: ["site-worlds"] },
            utm: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    SiteWorldSearchResult: {
      type: "object",
      required: ["siteWorld", "score", "reasons", "matchedAliases", "matchedFields"],
      properties: {
        siteWorld: { $ref: "#/components/schemas/SiteWorld" },
        score: { type: "number" },
        reasons: { type: "array", items: { type: "string" } },
        matchedAliases: { type: "array", items: { type: "string" } },
        matchedFields: { type: "array", items: { type: "string" } },
      },
    },
    SiteWorldSearchParsed: {
      type: "object",
      required: ["q", "tokens", "aliases", "filters"],
      properties: {
        q: { type: "string" },
        tokens: { type: "array", items: { type: "string" } },
        aliases: { type: "array", items: { $ref: "#/components/schemas/SiteWorldSearchAlias" } },
        filters: { $ref: "#/components/schemas/SiteWorldSearchFilters" },
      },
    },
    SiteWorldSearchAlias: {
      type: "object",
      required: ["alias", "mapsTo", "categories", "industries", "siteTypes", "objectTags", "terms"],
      properties: {
        alias: { type: "string" },
        mapsTo: { type: "string" },
        categories: { type: "array", items: { type: "string" } },
        industries: { type: "array", items: { type: "string" } },
        siteTypes: { type: "array", items: { type: "string" } },
        objectTags: { type: "array", items: { type: "string" } },
        terms: { type: "array", items: { type: "string" } },
        truthNote: { type: "string" },
      },
    },
    SiteWorldSearchFilters: {
      type: "object",
      additionalProperties: false,
      properties: {
        category: { type: ["string", "null"] },
        industry: { type: ["string", "null"] },
        city: { type: ["string", "null"] },
        state: { type: ["string", "null"] },
        siteType: { type: ["string", "null"] },
        taskLane: { type: ["string", "null"] },
        objectTags: { type: "array", items: { type: "string" } },
        robot: { type: ["string", "null"] },
        availability: { type: ["string", "null"] },
        readiness: { type: ["string", "null"] },
        sort: { type: "string", enum: ["relevance", "name", "city", "category", "readiness", "availability"] },
      },
    },
    SiteWorldSearchMeta: {
      type: "object",
      required: ["backend", "embeddingModel", "usedEmbeddings", "totalCandidates", "returned"],
      properties: {
        backend: { type: "string", enum: ["firestore-live"] },
        embeddingModel: { type: "string" },
        usedEmbeddings: { type: "boolean" },
        totalCandidates: { type: "integer" },
        returned: { type: "integer" },
      },
    },
    SiteWorld: {
      type: "object",
      required: ["id", "siteName"],
      additionalProperties: true,
      properties: {
        id: { type: "string" },
        siteName: { type: "string" },
        siteAddress: { type: "string" },
        commercialStatus: { type: "string" },
        truthLabels: { type: "array", items: { $ref: "#/components/schemas/TruthLabel" } },
        robotProfiles: { type: "array", items: { $ref: "#/components/schemas/RobotProfile" } },
        taskCatalog: { type: "array", items: { $ref: "#/components/schemas/TaskCatalogEntry" } },
        scenarioCatalog: { type: "array", items: { $ref: "#/components/schemas/ScenarioCatalogEntry" } },
        startStateCatalog: { type: "array", items: { $ref: "#/components/schemas/StartStateCatalogEntry" } },
      },
    },
    RobotProfile: {
      type: "object",
      required: ["displayName", "embodimentType", "observationCameras", "actionSpace", "actionSpaceSummary"],
      properties: {
        id: { type: "string" },
        displayName: { type: "string" },
        embodimentType: {
          type: "string",
          enum: ["humanoid", "mobile_manipulator", "fixed_arm", "mobile_base", "cart", "other"],
        },
        observationCameras: { type: "array", items: { $ref: "#/components/schemas/RobotObservationCamera" } },
        actionSpace: { $ref: "#/components/schemas/RobotActionSpace" },
        actionSpaceSummary: { type: "string" },
        gripperSemantics: { type: ["string", "null"] },
        baseSemantics: { type: ["string", "null"] },
        urdfRef: { type: ["string", "null"] },
        usdRef: { type: ["string", "null"] },
        allowedPolicyAdapters: { type: "array", items: { type: "string" } },
        defaultPolicyAdapter: { type: ["string", "null"] },
      },
    },
    RobotObservationCamera: {
      type: "object",
      required: ["id", "role", "required", "defaultEnabled"],
      properties: {
        id: { type: "string" },
        role: { type: "string" },
        required: { type: "boolean" },
        defaultEnabled: { type: "boolean" },
        available: { type: "boolean" },
        framePath: { type: ["string", "null"] },
      },
    },
    RobotActionSpace: {
      type: "object",
      required: ["name", "dim", "labels"],
      properties: {
        name: { type: "string" },
        dim: { type: "integer" },
        labels: { type: "array", items: { type: "string" } },
      },
    },
    TaskCatalogEntry: {
      type: "object",
      required: ["id", "taskText"],
      properties: {
        id: { type: "string" },
        taskId: { type: ["string", "null"] },
        taskText: { type: "string" },
        taskCategory: { type: ["string", "null"] },
      },
    },
    ScenarioCatalogEntry: {
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        source: { type: ["string", "null"] },
      },
    },
    StartStateCatalogEntry: {
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        taskId: { type: ["string", "null"] },
        source: { type: ["string", "null"] },
      },
    },
    RobotTeamTestSubmissionModalityId: {
      type: "string",
      enum: [
        "policy_api_endpoint",
        "docker_container",
        "recorded_action_trace",
        "high_level_skill_trace",
        "teleop_demo",
        "sim_controller_plugin",
      ],
    },
    RobotTeamTestSubmissionModality: {
      type: "object",
      required: ["selected", "fields"],
      additionalProperties: true,
      properties: {
        selected: { type: "boolean" },
        fields: {
          type: "object",
          additionalProperties: { type: "string" },
          description:
            "CamelCase reference fields from the WebApp/Pipeline robot-team test submission schema.",
        },
        artifactReferenceUris: { type: "array", items: { type: "string" } },
        missingFields: { type: "array", items: { type: "string" } },
        missingEvidenceStatus: { type: ["string", "null"] },
        reviewStatus: {
          type: "string",
          enum: ["not_selected", "missing_required_refs", "ready_for_review"],
        },
      },
    },
    RobotTeamTestSubmission: {
      type: "object",
      required: ["schemaVersion", "selectedModalities", "modalities"],
      additionalProperties: true,
      properties: {
        schemaVersion: {
          type: "string",
          enum: ["blueprint.robot_team_test_submission.v1"],
        },
        submissionId: { type: ["string", "null"] },
        siteWorldId: { type: ["string", "null"] },
        taskId: { type: ["string", "null"] },
        scenarioId: { type: ["string", "null"] },
        robotProfileId: { type: ["string", "null"] },
        selectedModalities: {
          type: "array",
          items: { $ref: "#/components/schemas/RobotTeamTestSubmissionModalityId" },
        },
        modalities: {
          type: "object",
          additionalProperties: {
            $ref: "#/components/schemas/RobotTeamTestSubmissionModality",
          },
        },
        missingEvidenceStatuses: { type: "array", items: { type: "string" } },
        requestedOutputs: { type: "array", items: { type: "string" } },
        pipelineDatasetSchemaRefs: {
          type: "array",
          items: { type: "string" },
          examples: [["robot_team_test_submission_modalities.v0.1"]],
        },
        proofBoundary: {
          type: "object",
          additionalProperties: true,
          description:
            "Submitted references are artifact pointers only and do not prove simulator completion, rights clearance, package access, or policy pass/fail outcome.",
        },
      },
    },
    HostedSessionPolicy: {
      type: "object",
      additionalProperties: true,
      properties: {
        runMode: { type: "string" },
        robotTeamTestSubmission: {
          $ref: "#/components/schemas/RobotTeamTestSubmission",
        },
        proofBoundary: { type: "string" },
      },
    },
    CreateHostedSessionRequest: {
      type: "object",
      required: ["siteWorldId", "robotProfileId", "taskId", "scenarioId", "startStateId"],
      properties: {
        siteWorldId: { type: "string", examples: ["sw-<pipeline-site-world-id>"] },
        sessionMode: { type: "string", enum: ["runtime_only", "presentation_demo"], default: "runtime_only" },
        runtimeUi: { type: ["string", "null"], enum: ["neoverse_gradio", null] },
        autoStartDemo: { type: "boolean" },
        robotProfileId: { type: "string" },
        robotProfileOverride: { type: "object", additionalProperties: true },
        policy: { $ref: "#/components/schemas/HostedSessionPolicy" },
        taskId: { type: "string" },
        scenarioId: { type: "string" },
        startStateId: { type: "string" },
        requestedBackend: { type: ["string", "null"] },
        runtimeSessionConfig: { $ref: "#/components/schemas/HostedRuntimeSessionConfig" },
        requestedOutputs: { type: "array", items: { type: "string" } },
        exportModes: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
        entitlementId: { type: "string" },
        orderId: { type: "string" },
        commerceMode: { type: "string", enum: ["dry_run"] },
      },
    },
    AgentCommerceQuote: {
      type: "object",
      required: ["quoteId", "mode", "product", "siteWorldId", "sku", "quantity", "unitAmountCents", "totalAmountCents", "currency"],
      properties: {
        quoteId: { type: "string" },
        mode: { type: "string", enum: ["dry_run"] },
        product: { $ref: "#/components/schemas/AgentCommerceProduct" },
        siteWorldId: { type: "string" },
        sku: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        quantity: { type: "integer" },
        quantityLabel: { type: "string" },
        unitAmountCents: { type: "integer" },
        totalAmountCents: { type: "integer" },
        currency: { type: "string", enum: ["usd"] },
        priceSource: {
          type: "string",
          enum: ["catalog", "default"],
          description:
            "catalog means the amount was parsed from the public site-world package pricing; default means the planning fallback. Live checkout only charges catalog-grounded prices.",
        },
        entitlementType: { type: "string", enum: ["package_access", "hosted_session"] },
        truthLabels: { type: "array", items: { $ref: "#/components/schemas/TruthLabel" } },
      },
    },
    AgentCommerceQuoteResponse: {
      type: "object",
      required: ["quote", "truth"],
      properties: {
        quote: { $ref: "#/components/schemas/AgentCommerceQuote" },
        siteWorld: { type: ["object", "null"], additionalProperties: true },
        truth: { type: "string" },
      },
    },
    AgentAskRequest: {
      type: "object",
      required: ["q"],
      properties: {
        q: { type: "string", description: "Natural-language question about Blueprint." },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 3 },
      },
    },
    AgentAskAction: {
      type: "object",
      required: ["description", "method", "endpoint"],
      properties: {
        description: { type: "string" },
        method: { type: "string", enum: ["GET", "POST"] },
        endpoint: { type: "string" },
        mcpTool: { type: "string" },
      },
    },
    AgentAskAnswer: {
      type: "object",
      required: ["id", "title", "answer", "citations", "actions", "score"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        answer: { type: "string" },
        citations: { type: "array", items: { type: "string" } },
        actions: { type: "array", items: { $ref: "#/components/schemas/AgentAskAction" } },
        score: { type: "number" },
        matchedAliases: { type: "array", items: { type: "string" } },
      },
    },
    AgentAskResponse: {
      type: "object",
      required: ["question", "answers", "bestAnswer", "noConfidentMatch", "fallback", "truthBoundary", "meta"],
      properties: {
        question: { type: "string" },
        answers: { type: "array", items: { $ref: "#/components/schemas/AgentAskAnswer" } },
        bestAnswer: { anyOf: [{ $ref: "#/components/schemas/AgentAskAnswer" }, { type: "null" }] },
        noConfidentMatch: { type: "boolean" },
        fallback: {
          type: "object",
          required: ["message", "contactUrl", "discoveryEndpoints"],
          properties: {
            message: { type: "string" },
            contactUrl: { type: "string" },
            discoveryEndpoints: { type: "array", items: { type: "string" } },
          },
        },
        truthBoundary: { type: "string" },
        meta: { type: "object", additionalProperties: true },
      },
    },
    AgentLiveCheckoutRequest: {
      type: "object",
      required: ["siteWorldId", "mode"],
      properties: {
        mode: { type: "string", enum: ["live"] },
        siteWorldId: { type: "string" },
        product: { $ref: "#/components/schemas/AgentCommerceProduct" },
        sessionHours: { type: "integer", minimum: 1, default: 1 },
        budgetCents: {
          type: "integer",
          minimum: 0,
          description:
            "Optional agent budget guard in USD cents. Quotes above this value are rejected with a budget_exceeded blocker and no order or Stripe session is created.",
        },
        successPath: { type: "string", description: "Optional site-relative path for Stripe success redirect." },
        cancelPath: { type: "string", description: "Optional site-relative path for Stripe cancel redirect." },
        buyer: {
          type: "object",
          properties: {
            uid: { type: "string" },
            email: { type: "string" },
          },
          description:
            "Optional buyer identity for anonymous agents. A Firebase bearer token, when present, takes precedence.",
        },
      },
    },
    AgentLiveCheckoutBlocker: {
      type: "object",
      required: ["code", "severity", "ownerSystem", "message", "retryAction"],
      properties: {
        code: {
          type: "string",
          enum: [
            "site_world_not_found",
            "not_live_purchasable",
            "price_unavailable",
            "buyer_identity_required",
            "budget_exceeded",
            "stripe_unavailable",
          ],
        },
        severity: { type: "string", enum: ["blocking"] },
        ownerSystem: { type: "string", enum: ["catalog", "stripe", "agent_budget", "buyer_identity"] },
        message: { type: "string" },
        retryAction: { type: "string" },
      },
    },
    AgentLiveCheckoutResponse: {
      type: "object",
      required: ["mode", "quote", "order", "checkout", "statusUrl", "truth"],
      properties: {
        mode: { type: "string", enum: ["live"] },
        quote: { $ref: "#/components/schemas/AgentCommerceQuote" },
        budgetCents: { type: ["integer", "null"] },
        withinBudget: { type: ["boolean", "null"] },
        order: { type: "object", additionalProperties: true },
        checkout: {
          type: "object",
          required: ["provider", "sessionId", "url"],
          properties: {
            provider: { type: "string", enum: ["stripe"] },
            sessionId: { type: "string" },
            url: { type: ["string", "null"] },
            livemode: { type: "boolean" },
          },
        },
        statusUrl: { type: "string" },
        nextSteps: { type: "array", items: { type: "string" } },
        truth: { type: "string" },
      },
    },
    AgentLiveCheckoutBlockedResponse: {
      type: "object",
      required: ["error", "code", "blockers"],
      properties: {
        error: { type: "string" },
        code: { type: "string", enum: ["live_checkout_blocked"] },
        mode: { type: "string", enum: ["live"] },
        quote: { $ref: "#/components/schemas/AgentCommerceQuote" },
        budgetCents: { type: ["integer", "null"] },
        withinBudget: { type: ["boolean", "null"] },
        blockers: { type: "array", items: { $ref: "#/components/schemas/AgentLiveCheckoutBlocker" } },
        truth: { type: "string" },
      },
    },
    AgentLiveOrderStatus: {
      type: "object",
      required: ["mode", "order", "paid", "provisioned", "truth"],
      properties: {
        mode: { type: "string", enum: ["live"] },
        order: { type: "object", additionalProperties: true },
        checkoutUrl: { type: ["string", "null"] },
        livemode: { type: "boolean" },
        paid: { type: "boolean" },
        provisioned: { type: "boolean" },
        nextSteps: { type: "array", items: { type: "string" } },
        truth: { type: "string" },
      },
    },
    AgentDryRunCheckoutRequest: {
      type: "object",
      required: ["siteWorldId", "mode"],
      properties: {
        mode: { type: "string", enum: ["dry_run"] },
        siteWorldId: { type: "string" },
        product: { $ref: "#/components/schemas/AgentCommerceProduct" },
        sessionHours: { type: "integer", minimum: 1, default: 1 },
        buyer: {
          type: "object",
          properties: {
            uid: { type: "string" },
            email: { type: "string" },
          },
        },
      },
    },
    AgentDryRunOrder: {
      type: "object",
      required: ["id", "dry_run", "status", "payment_status", "fulfillment_status", "item", "pricing", "entitlement_id"],
      additionalProperties: true,
      properties: {
        id: { type: "string" },
        dry_run: { type: "boolean" },
        status: { type: "string", enum: ["fulfilled"] },
        payment_status: { type: "string", enum: ["dry_run_paid"] },
        fulfillment_status: { type: "string", enum: ["provisioned"] },
        item: { type: "object", additionalProperties: true },
        pricing: { type: "object", additionalProperties: true },
        stripe: { type: "object", additionalProperties: true },
        entitlement_id: { type: "string" },
      },
    },
    AgentMarketplaceEntitlement: {
      type: "object",
      required: ["id", "order_id", "sku", "access_state"],
      additionalProperties: true,
      properties: {
        id: { type: "string" },
        order_id: { type: "string" },
        sku: { type: "string" },
        item_type: { $ref: "#/components/schemas/AgentCommerceProduct" },
        delivery_mode: { type: "string" },
        access_state: { type: "string", enum: ["provisioned", "manual_review_required", "revoked"] },
        dry_run: { type: "boolean" },
      },
    },
    AgentDryRunOrderResponse: {
      type: "object",
      properties: {
        quote: { $ref: "#/components/schemas/AgentCommerceQuote" },
        order: { $ref: "#/components/schemas/AgentDryRunOrder" },
        receipt: { type: "object", additionalProperties: true },
        entitlement: { $ref: "#/components/schemas/AgentMarketplaceEntitlement" },
        truth: { type: "string" },
      },
    },
    AgentEntitlementResponse: {
      type: "object",
      required: ["entitlement"],
      properties: {
        entitlement: { $ref: "#/components/schemas/AgentMarketplaceEntitlement" },
      },
    },
    AgentEntitlementReadiness: {
      type: "object",
      required: ["mode", "siteWorldId", "entitled", "launchable", "blockers"],
      properties: {
        mode: { type: "string", enum: ["dry_run"] },
        siteWorldId: { type: "string" },
        entitlement: { type: ["object", "null"], additionalProperties: true },
        entitled: { type: "boolean" },
        launchable: { type: "boolean" },
        blockers: { type: "array", items: { type: "string" } },
        truth: { type: "string" },
      },
    },
    HostedRuntimeSessionConfig: {
      type: "object",
      properties: {
        canonical_package_uri: { type: ["string", "null"] },
        canonical_package_version: { type: ["string", "null"] },
        prompt: { type: ["string", "null"] },
        trajectory: { type: ["string", "null"] },
        presentation_model: { type: ["string", "null"] },
        debug_mode: { type: "boolean" },
        unsafe_allow_blocked_site_world: {
          type: "boolean",
          description: "Internal/local escape hatch only. Do not use for public or protected production flows.",
        },
      },
    },
    ResetHostedSessionRequest: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        scenarioId: { type: "string" },
        startStateId: { type: "string" },
        seed: { type: "integer" },
      },
    },
    StepHostedSessionRequest: {
      type: "object",
      properties: {
        episodeId: { type: "string" },
        action: { type: "array", items: { type: "number" } },
        autoPolicy: { type: "boolean", default: true },
      },
    },
    RunBatchRequest: {
      type: "object",
      properties: {
        numEpisodes: { type: "integer", minimum: 1, default: 1 },
        taskId: { type: "string" },
        scenarioId: { type: "string" },
        startStateId: { type: "string" },
        seed: { type: "integer" },
        maxSteps: { type: "integer", minimum: 1 },
      },
    },
    ControlRequest: {
      type: "object",
      additionalProperties: true,
      properties: {
        mode: { type: "string" },
        cameraId: { type: "string" },
        playback: { type: "string" },
      },
    },
    ExplorerRenderRequest: {
      type: "object",
      properties: {
        cameraId: { type: "string", default: "head_rgb" },
        pose: { $ref: "#/components/schemas/ExplorerPose" },
        viewportWidth: { type: "integer" },
        viewportHeight: { type: "integer" },
        refineMode: { type: ["string", "null"] },
      },
    },
    ExportRequest: {
      type: "object",
      properties: {
        format: { type: "string", default: "manifest" },
      },
    },
    ExplorerPose: {
      type: "object",
      required: ["x", "y", "z", "yaw", "pitch"],
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
        yaw: { type: "number" },
        pitch: { type: "number" },
      },
    },
    LaunchReadiness: {
      type: "object",
      required: ["entitled", "status", "launchable", "blockers"],
      properties: {
        entitled: { type: "boolean" },
        status: { $ref: "#/components/schemas/StatusLabel" },
        launchable: { type: "boolean" },
        blockers: { type: "array", items: { type: "string" } },
        blocker_details: { type: "array", items: { $ref: "#/components/schemas/LaunchBlockerDetail" } },
        presentation_demo: { type: "object", additionalProperties: true },
        runtime_only: { type: "object", additionalProperties: true },
      },
    },
    LaunchBlockerDetail: {
      type: "object",
      required: ["code", "message", "source"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        source: { type: "string", enum: ["access", "qualification", "runtime", "presentation_demo"] },
      },
    },
    CreateHostedSessionResponse: {
      type: "object",
      required: ["sessionId", "status", "site", "workspaceUrl"],
      properties: {
        sessionId: { type: "string" },
        status: { type: "string" },
        site: { type: "object", additionalProperties: true },
        runtimeBackend: { type: "string" },
        launchable: { type: "boolean" },
        uiReady: { type: "boolean" },
        uiMode: { type: "string" },
        workspaceUrl: { type: "string" },
      },
    },
    HostedSession: {
      type: "object",
      required: ["sessionId", "sessionMode", "status", "site"],
      additionalProperties: true,
      properties: {
        sessionId: { type: "string" },
        sessionMode: { type: "string", enum: ["runtime_only", "presentation_demo"] },
        status: { type: "string", enum: ["creating", "ready", "running", "stopped", "failed"] },
        site: { type: "object", additionalProperties: true },
        robotProfile: { $ref: "#/components/schemas/RobotProfile" },
        taskSelection: { type: "object", additionalProperties: true },
        runtimeConfig: { type: "object", additionalProperties: true },
        latestEpisode: { type: "object", additionalProperties: true },
        batchSummary: { type: "object", additionalProperties: true },
        explorerState: { type: "object", additionalProperties: true },
        artifactUris: { type: "object", additionalProperties: { type: "string" } },
        datasetArtifacts: { type: "object", additionalProperties: true },
      },
    },
    HostedSessionOperationResponse: {
      type: "object",
      additionalProperties: true,
      properties: {
        episode: { type: "object", additionalProperties: true },
        summary: { type: "object", additionalProperties: true },
        artifact_uris: { type: "object", additionalProperties: { type: "string" } },
        dataset_artifacts: { type: "object", additionalProperties: true },
        explorerState: { type: "object", additionalProperties: true },
      },
    },
    PendingOperationResponse: {
      type: "object",
      required: ["accepted", "pendingOperation"],
      properties: {
        accepted: { type: "boolean" },
        pendingOperation: { type: "object", additionalProperties: true },
        episode: { type: ["object", "null"], additionalProperties: true },
      },
    },
    ErrorResponse: {
      type: "object",
      required: ["error"],
      properties: {
        error: { type: "string" },
        code: { type: "string" },
        diagnostic: { type: "object", additionalProperties: true },
      },
    },
    LaunchBlockedResponse: {
      type: "object",
      required: ["error", "code"],
      properties: {
        error: { type: "string" },
        code: { type: "string" },
        blockers: { type: "array", items: { type: "string" } },
        blocker_details: { type: "array", items: { $ref: "#/components/schemas/LaunchBlockerDetail" } },
        diagnostic: { type: "object", additionalProperties: true },
      },
    },
  } as const;
}
