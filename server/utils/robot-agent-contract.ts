export const ROBOT_AGENT_CONTRACT_VERSION = "2026-05-20";
export const ROBOT_AGENT_PUBLIC_DEMO_SITE_WORLD_ID = "siteworld-f5fd54898cfb";

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
      summary: "Headless catalog, site-world, hosted-session, explorer-render, and export contract for robot-team agents.",
      description:
        "Blueprint exposes capture-backed site-world catalog and hosted-session endpoints for robot-team agents. Public demo calls may run without privileged credentials only when a demo site world is enabled. Protected robot-team flows use the existing Firebase bearer path and do not bypass buyerType robot_team/admin checks.",
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
      { name: "Hosted sessions", description: "Session lifecycle, rollout, render, and export endpoints." },
    ],
    paths: {
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
            "Public unauthenticated creation applies only to demo-eligible site worlds. Protected site worlds continue through Firebase entitlement and robot_team/admin checks.",
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
    "x-blueprint-truth-labels": [
      "capture_grounded",
      "provider_derived",
      "generated",
      "sample_demo",
      "public_demo_eligible",
      "request_gated",
      "protected_robot_team",
    ],
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
      ],
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
    SiteWorldListResponse: {
      type: "object",
      required: ["items", "count"],
      properties: {
        items: { type: "array", items: { $ref: "#/components/schemas/SiteWorld" } },
        count: { type: "integer" },
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
        policy: { type: "object", additionalProperties: true },
        taskId: { type: "string" },
        scenarioId: { type: "string" },
        startStateId: { type: "string" },
        requestedBackend: { type: ["string", "null"] },
        runtimeSessionConfig: { $ref: "#/components/schemas/HostedRuntimeSessionConfig" },
        requestedOutputs: { type: "array", items: { type: "string" } },
        exportModes: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
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
