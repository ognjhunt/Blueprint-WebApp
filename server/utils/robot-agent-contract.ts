export const ROBOT_AGENT_CONTRACT_VERSION = "2026-05-31";
export const ROBOT_AGENT_PUBLIC_DEMO_SITE_WORLD_ID = "siteworld-f5fd54898cfb";
export const ROBOT_AGENT_TRUTH_LABELS = [
  "capture_grounded",
  "provider_derived",
  "generated",
  "sample_demo",
  "public_demo_eligible",
  "request_gated",
  "protected_robot_team",
  "dry_run_order",
] as const;
export const ROBOT_AGENT_MCP_TOOL_NAMES = [
  "blueprint.siteWorld.search",
  "blueprint.catalog.search",
  "blueprint.request.locationDraft",
  "blueprint.siteWorld.get",
  "blueprint.siteWorld.launchReadiness",
  "blueprint.commerce.quote",
  "blueprint.commerce.checkoutDryRun",
  "blueprint.commerce.order.get",
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
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce quote --site-world-id siteworld-f5fd54898cfb --product hosted-session-rental --session-hours 1",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce checkout --site-world-id siteworld-f5fd54898cfb --product hosted-session-rental --mode dry_run",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce entitlement-readiness --site-world-id siteworld-f5fd54898cfb --entitlement-id <dry-entitlement-id>",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts session create --site-world-id siteworld-f5fd54898cfb --session-mode runtime_only --robot-profile-id other_sample --task-id sw-chi-01-task-1 --scenario-id sw-chi-01-scenario-1 --start-state-id sw-chi-01-start-1",
] as const;

export function buildRobotAgentAccessManifest() {
  return {
    name: "Blueprint Robot-Team Agent Access",
    docs: "/agents",
    openapi: "/api/agent-access/openapi.json",
    staticOpenapi: "/agent-access.openapi.json",
    llms: "/llms.txt",
    llmsFull: "/llms-full.txt",
    preferredTool: "blueprint.siteWorld.search",
    compatibilityTool: "blueprint.catalog.search",
    mcpToolNames: ROBOT_AGENT_MCP_TOOL_NAMES,
    publicDemoSiteWorldId: ROBOT_AGENT_PUBLIC_DEMO_SITE_WORLD_ID,
    env: {
      apiBaseUrl: "BLUEPRINT_API_BASE_URL",
      bearerToken: "BLUEPRINT_AGENT_AUTH_TOKEN",
    },
    credentiallessWorkflow: {
      requiredCredentials: false,
      summary:
        "A headless robot-team agent can discover Blueprint, plan the next safe journey action, search site worlds, draft a new-location intake request, quote dry-run commerce, create dry-run entitlement proof, and create a public-demo hosted session without credentials.",
      smokeCommand: "npm run smoke:agent-headless",
      cliCommands: ROBOT_AGENT_CLI_COMMANDS,
    },
    siteWorldSearch: {
      endpoint: "/api/site-worlds/search",
      mcpTool: "blueprint.siteWorld.search",
      publicReadOnly: true,
      requestCandidateIntakeOnly: true,
      truth:
        "Search returns public ranked matches and request candidates. It never grants entitlement, payment, rights clearance, provider execution, fulfillment, private artifact access, or hosted-session access.",
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
        "public_demo_session_path",
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
    publicDemo: {
      canRunWithoutCredentials: true,
      siteWorldId: ROBOT_AGENT_PUBLIC_DEMO_SITE_WORLD_ID,
      sessionCreateEndpoint: "/api/site-worlds/sessions",
      sessionMode: "runtime_only",
      truth:
        "Credential-free hosted-session creation is limited to public-demo eligible site worlds and remains sample/demo only.",
    },
    protectedFlow: {
      requiresBearer: true,
      authModel: "Firebase robot_team or admin bearer token",
      accessModel: "session ownership, admin access, or matching provisioned hosted-session entitlement",
      livePaymentPath: "/api/create-checkout-session",
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
      "Public demo endpoints are sample/demo only. Protected site worlds require Firebase robot-team/admin bearer auth and current launch readiness. Dry-run commerce never substitutes for live Stripe, rights, provider, package-access, or fulfillment proof.",
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
const publicOrBearerSecurity = [{}, { BlueprintBearer: [] }];

export function buildRobotAgentOpenApiContract() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Blueprint Robot-Team Agent API",
      version: ROBOT_AGENT_CONTRACT_VERSION,
      summary: "Headless catalog, site-world, dry-run commerce, hosted-session, explorer-render, and export contract for robot-team agents.",
      description:
        "Blueprint exposes capture-backed site-world catalog, dry-run quote/order/entitlement proof, and hosted-session endpoints for robot-team agents. Public demo calls may run without privileged credentials only when a demo site world is enabled. Protected robot-team flows use the existing Firebase bearer path and require robot_team/admin outer auth plus session ownership or a matching provisioned entitlement.",
    },
    servers: [
      {
        url: "https://tryblueprint.io",
        description: "Production public origin. Protected flows require a scoped robot-team/admin bearer token.",
      },
      {
        url: "http://localhost:5000",
        description: "Local development server. Public demo flow can run without auth when demo site worlds are enabled.",
      },
    ],
    tags: [
      { name: "Discovery", description: "Public site and API discovery for agents." },
      { name: "Catalog", description: "Public site-world catalog and detail endpoints." },
      { name: "Agent commerce", description: "Dry-run quote, order, receipt, and entitlement proof. Does not call live Stripe." },
      { name: "Hosted sessions", description: "Session lifecycle, rollout, render, and export endpoints." },
    ],
    paths: {
      "/api/agent-access": {
        get: {
          tags: ["Discovery"],
          operationId: "discoverAgentAccess",
          summary: "Discover the robot-team agent access manifest.",
          description:
            "Credential-free discovery manifest for headless robot-team agents. It names blueprint.siteWorld.search as the first-class search tool, keeps requestCandidate intake-only, lists dry-run commerce endpoints, documents truth labels, and explains the mock/public-demo hosted-session path without credentials.",
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
          security: publicOrBearerSecurity,
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
          "x-blueprint-public-demo": true,
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
      "/api/site-worlds/sessions": {
        post: {
          tags: ["Hosted sessions"],
          operationId: "createHostedSession",
          summary: "Create a hosted session for a public demo site world or protected robot-team account.",
          security: publicOrBearerSecurity,
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
            "200": jsonResponse("#/components/schemas/CreateHostedSessionResponse", "Reusable presentation-demo session returned"),
            ...errorResponses,
          },
          "x-blueprint-public-demo": true,
        "x-blueprint-truth-boundary":
            "Public unauthenticated creation applies only to demo-eligible site worlds. Protected site worlds continue through Firebase robot_team/admin checks plus provisioned entitlement or existing session ownership.",
        },
      },
      "/api/site-worlds/sessions/{sessionId}": {
        get: {
          tags: ["Hosted sessions"],
          operationId: "getHostedSession",
          summary: "Read a hosted session record.",
          security: publicOrBearerSecurity,
          parameters: [{ $ref: "#/components/parameters/SessionId" }],
          responses: {
            "200": jsonResponse("#/components/schemas/HostedSession"),
            ...errorResponses,
          },
          "x-blueprint-public-demo": true,
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
          security: publicOrBearerSecurity,
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
          "x-blueprint-public-demo": true,
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
          security: publicOrBearerSecurity,
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
          "x-blueprint-public-demo": true,
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
    "x-blueprint-public-demo": true,
    "x-blueprint-truth-boundary":
      "Unauthenticated use applies only when the session belongs to a public-demo site world. Protected site worlds require bearer auth and preserve Firebase entitlement checks.",
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
        "sample_demo",
        "public_demo_eligible",
        "request_gated",
        "protected_robot_team",
        "dry_run_order",
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
        "journeyPlanner",
        "requestCandidate",
        "requestLocationDraft",
        "dryRunCommerce",
        "publicDemo",
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
        publicDemoSiteWorldId: { type: "string" },
        credentiallessWorkflow: {
          type: "object",
          required: ["requiredCredentials", "summary", "smokeCommand", "cliCommands"],
          additionalProperties: true,
          properties: {
            requiredCredentials: { type: "boolean" },
            summary: { type: "string" },
            smokeCommand: { type: "string" },
            cliCommands: { type: "array", items: { type: "string" } },
          },
        },
        siteWorldSearch: { type: "object", additionalProperties: true },
        journeyPlanner: { type: "object", additionalProperties: true },
        requestCandidate: { type: "object", additionalProperties: true },
        requestLocationDraft: { type: "object", additionalProperties: true },
        dryRunCommerce: { type: "object", additionalProperties: true },
        publicDemo: { type: "object", additionalProperties: true },
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
        backend: { type: "string", enum: ["firestore-live", "static-fallback"] },
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
        siteWorldId: { type: "string", examples: [ROBOT_AGENT_PUBLIC_DEMO_SITE_WORLD_ID] },
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
