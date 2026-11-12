export const operatorQaOutputRoot = "output/qa/operator-surfaces/latest";

export type OperatorQaViewport = {
  name: "desktop" | "mobile";
  width: number;
  height: number;
};

export type OperatorQaSurface = {
  label: string;
  path: string;
  expectedTexts: string[];
  fixtureIds: string[];
};

export type OperatorQaFixtureMetadata = {
  id: string;
  label: string;
  endpoints: string[];
  proves: string;
};

export type OperatorQaFixtureResponse = {
  fixtureId: string;
  status: number;
  body: unknown;
};

export type OperatorQaCheckResult = {
  name: string;
  status: "pass" | "fail";
  detail: string;
};

export type OperatorQaRouteResult = {
  surfaceLabel: string;
  routePath: string;
  viewportName: string;
  screenshotPath: string;
  status: "pass" | "fail";
  checks: OperatorQaCheckResult[];
};

export type OperatorQaReportInput = {
  generatedAt: string;
  baseUrl: string;
  routeResults: OperatorQaRouteResult[];
  issues: string[];
  apiFixtureHits: Record<string, number>;
  blockedLiveEndpoints: string[];
  stubbedExternalAssets?: string[];
};

export const operatorQaViewports: OperatorQaViewport[] = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

export const operatorQaSurfaces: OperatorQaSurface[] = [
  {
    label: "Admin Leads",
    path: "/admin/leads",
    expectedTexts: [
      "Qualification submissions",
      "Durham Facility",
      "Scene readiness",
      "Request path: Site operator claim",
      "Whole-home",
    ],
    fixtureIds: ["admin-leads"],
  },
];

export const operatorQaApiFixtures: OperatorQaFixtureMetadata[] = [
  {
    id: "csrf",
    label: "CSRF token",
    endpoints: ["GET /api/csrf"],
    proves: "Client security header plumbing can run without live session state.",
  },
  {
    id: "analytics-ingest",
    label: "Analytics ingest",
    endpoints: ["POST /api/analytics/ingest"],
    proves: "Page-view and private-surface telemetry calls are intercepted locally.",
  },
  {
    id: "admin-leads",
    label: "Admin leads",
    endpoints: [
      "GET /api/admin/leads",
      "GET /api/admin/leads/stats/summary",
      "GET /api/admin/leads/op-qa-ready",
      "GET /api/admin/leads/op-qa-ready/site-task-clarification",
      "GET /api/admin/leads/op-qa-ready/pipeline/dashboard",
    ],
    proves: "The admin queue and scene readiness detail render from local operator fixtures.",
  },
];

const generatedAt = "2026-05-26T12:00:00.000Z";

function requestFixture(overrides: {
  requestId: string;
  siteSubmissionId: string;
  siteName: string;
  siteLocation: string;
  qualificationState: "qualified_ready" | "needs_more_evidence";
  opportunityState: "handoff_ready" | "escalated_to_geometry";
  previewStatus: string;
  providerStatus: string;
  providerFailureReason?: string | null;
  nextStep: string;
}) {
  return {
    requestId: overrides.requestId,
    site_submission_id: overrides.siteSubmissionId,
    createdAt: "2026-05-26T10:00:00.000Z",
    status: overrides.qualificationState,
    qualification_state: overrides.qualificationState,
    opportunity_state: overrides.opportunityState,
    priority: "high",
    contact: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada.operator-qa@example.com",
      company: "Analytical Logistics",
      roleTitle: "Robotics Ops",
    },
    request: {
      budgetBucket: "$50K-$300K",
      requestedLanes: ["preview_simulation", "deeper_evaluation"],
      helpWith: ["benchmark-packs", "scene-library"],
      buyerType: "robot_team",
      commercialRequestPath: "hosted_evaluation",
      proofPathPreference: "exact_site_required",
      siteName: overrides.siteName,
      siteLocation: overrides.siteLocation,
      taskStatement: "Validate tote picking and staging paths before a robot deployment.",
      workflowContext: "Backroom tote pickup, aisle navigation, and staging handoff.",
      operatingConstraints: "Use only approved operator hours and marked public work zones.",
      privacySecurityConstraints: "No staff-only rooms, no faces, no private inventory labels.",
      knownBlockers: "Rights and provider execution must be confirmed outside local QA.",
      displayCaptureMetadata: {
        targetName: overrides.siteName,
        addressLabel: overrides.siteLocation,
        requestId: overrides.requestId,
        captureJobId: "capture-job-op-qa",
        captureBrief: "Capture the inbound receiving aisle, staging table, and tote handoff.",
        privacyReminder: "Capture only approved areas.",
        allowedAdvisoryHints: ["slow_down", "hold_steady", "scan_corners"],
      },
    },
    owner: {
      email: "operator-qa@tryblueprint.local",
    },
    context: {
      sourcePageUrl: "https://tryblueprint.io/contact",
      utm: {
        source: "operator-qa",
        medium: "fixture",
        campaign: "operator-surface-harness",
      },
    },
    enrichment: {
      companyDomain: "example.com",
      geo: "fixture",
      notes: "Local QA fixture. No enrichment service contacted.",
    },
    events: {
      confirmationEmailSentAt: null,
      slackNotifiedAt: null,
      crmSyncedAt: null,
    },
    structured_intake: {
      mode: "structured_intake_first",
      primary_cta: "Request proof",
      secondary_cta: "Book review",
      calendar_disposition: "not_needed_yet",
      calendar_reasons: [],
      missing_structured_fields: [],
      missing_structured_field_labels: [],
      owner_lane: "buyer-solutions-agent",
      recommended_path: "proof_path_review",
      next_action: overrides.nextStep,
      routing_summary: "Robot-team request with exact-site hosted evaluation path.",
      calendar_summary: "Calendar stays secondary until proof path review needs a human call.",
      proof_path_summary: "Exact-site proof path is ready for local UI inspection.",
      proof_ready_outcome: "proof_ready_intake",
      proof_path_outcome: "exact_site",
      proof_readiness_score: overrides.qualificationState === "qualified_ready" ? 86 : 52,
      proof_ready_criteria: ["facility_name", "workflow_context", "capture_scope"],
      missing_proof_ready_fields:
        overrides.qualificationState === "qualified_ready" ? [] : ["rights_confirmation"],
      site_operator_claim_outcome: "not_site_operator",
      access_boundary_outcome: "not_applicable",
      site_claim_readiness_score: 0,
      site_claim_criteria: [],
      missing_site_claim_fields: [],
    },
    ops: {
      assigned_region_id: "austin-tx",
      rights_status: overrides.qualificationState === "qualified_ready" ? "verified" : "permission_required",
      capture_policy_tier: "review_required",
      capture_status: overrides.qualificationState === "qualified_ready" ? "approved" : "under_review",
      quote_status: "not_started",
      next_step: overrides.nextStep,
      recapture_reason:
        overrides.qualificationState === "qualified_ready"
          ? null
          : "Rights confirmation is missing before provider preview can be trusted.",
      proof_path: {
        exact_site_requested_at: "2026-05-26T10:00:00.000Z",
        qualified_inbound_at:
          overrides.qualificationState === "qualified_ready" ? "2026-05-26T10:15:00.000Z" : null,
      },
    },
    evaluation_readiness: {
      qualification_state: overrides.qualificationState,
      opportunity_state: overrides.opportunityState,
      capture_source: "local_fixture",
      capture_modality: "mobile_video",
      buyer_trust_score: {
        score: overrides.qualificationState === "qualified_ready" ? 86 : 48,
        band: overrides.qualificationState === "qualified_ready" ? "high" : "low",
        reasons:
          overrides.qualificationState === "qualified_ready"
            ? [
                "Capture scope is attached.",
                "Rights and privacy labels are present as fixture records.",
              ]
            : ["Provider package is blocked pending rights clearance."],
      },
      capture_quality_summary: {
        status: "ready",
        coverage: "Receiving aisle, staging table, and tote handoff are represented.",
      },
      rights_and_compliance: {
        consent_scope: ["approved operator hours", "public work zones"],
        restrictions: ["no staff-only rooms", "no private inventory labels"],
      },
      missing_evidence:
        overrides.qualificationState === "qualified_ready" ? [] : ["rights_confirmation"],
      preview_status: overrides.previewStatus,
      provider_run: {
        provider_name: "World Labs",
        provider_model: "world-model-preview",
        provider_run_id: `provider-${overrides.requestId}`,
        status: overrides.providerStatus,
        preview_manifest_uri:
          overrides.providerStatus === "failed" ? null : "gs://operator-qa/preview_manifest.json",
        failure_reason: overrides.providerFailureReason || null,
        provenance: {
          fixtureOnly: true,
          liveProviderCalled: false,
        },
      },
    },
    notes: [
      {
        id: "note-op-qa",
        content: "Fixture note: prove UI state only, never live operational readiness.",
        authorUid: "operator-qa-local-user",
        authorEmail: "operator-qa@tryblueprint.local",
        createdAt: generatedAt,
      },
    ],
    pipeline: {
      scene_id: "scene-op-qa",
      capture_id: "cap-op-qa",
      pipeline_prefix: "scenes/scene-op-qa/captures/cap-op-qa/pipeline",
      synced_at: generatedAt,
      artifacts: {
        dashboard_summary_uri:
          "gs://operator-qa/scenes/scene-op-qa/captures/cap-op-qa/pipeline/dashboard_summary.json",
      },
    },
  };
}

const requestReadyFixture = requestFixture({
  requestId: "op-qa-ready",
  siteSubmissionId: "site-op-qa-ready",
  siteName: "Test Fixture Grocery Annex",
  siteLocation: "Austin, TX",
  qualificationState: "qualified_ready",
  opportunityState: "handoff_ready",
  previewStatus: "succeeded",
  providerStatus: "succeeded",
  nextStep: "Prepare proof packet review while live payments, sends, and provider execution stay out of scope.",
});

const adminLeadsListFixture = {
  leads: [
    {
      requestId: "op-qa-ready",
      site_submission_id: "site-op-qa-ready",
      createdAt: "2026-05-26T10:00:00.000Z",
      status: "qualified_ready",
      qualification_state: "qualified_ready",
      opportunity_state: "handoff_ready",
      priority: "high",
      contact: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada.operator-qa@example.com",
        company: "Analytical Logistics",
        roleTitle: "Robotics Ops",
      },
      request: {
        budgetBucket: "$50K-$300K",
        requestedLanes: ["qualification", "preview_simulation"],
        helpWith: ["benchmark-packs"],
        buyerType: "site_operator",
        commercialRequestPath: "site_claim",
        proofPathPreference: "exact_site_required",
        siteName: "Durham Facility",
        siteLocation: "Durham, NC",
        taskStatement: "Review picking readiness in a receiving aisle.",
      },
      owner: {
        email: "operator-qa@tryblueprint.local",
      },
      pipeline: {
        scene_id: "scene-op-qa",
        capture_id: "cap-op-qa",
        pipeline_prefix: "scenes/scene-op-qa/captures/cap-op-qa/pipeline",
        artifacts: {
          dashboard_summary_uri:
            "gs://operator-qa/scenes/scene-op-qa/captures/cap-op-qa/pipeline/dashboard_summary.json",
        },
      },
    },
  ],
};

const adminLeadsStatsFixture = {
  total: 1,
  newLast24h: 1,
  byStatus: { qualified_ready: 1 },
  byPriority: { high: 1 },
  byQueue: { exact_site_hosted_review_queue: 1 },
  byWedge: { exact_site_hosted_review: 1 },
  byRequestPath: {
    site_claim: 1,
    world_model: 0,
    hosted_evaluation: 0,
    capture_access: 0,
  },
};

const adminLeadDetailFixture = {
  ...requestReadyFixture,
  requestId: "op-qa-ready",
  site_submission_id: "site-op-qa-ready",
  request: {
    ...(requestReadyFixture as { request: Record<string, unknown> }).request,
    buyerType: "site_operator",
    commercialRequestPath: "site_claim",
    siteName: "Durham Facility",
    siteLocation: "Durham, NC",
    taskStatement: "Review picking readiness in a receiving aisle.",
    workflowContext: "Backroom to staging handoff.",
  },
  structured_intake: {
    ...(requestReadyFixture as { structured_intake: Record<string, unknown> }).structured_intake,
    mode: "calendar_accelerated",
    owner_lane: "site-operator-partnership-agent",
    recommended_path: "intake_then_required_scoping_call",
    next_action: "Review structured intake before any access or commercialization commitment.",
    routing_summary: "Site operator claim is ready for access-boundary review.",
    calendar_summary: "Required scoping call follows local proof inspection.",
    proof_path_summary: "Exact-site proof packet is attached as fixture data only.",
    proof_ready_outcome: "operator_handoff",
    proof_path_outcome: "operator_handoff",
    site_operator_claim_outcome: "site_claim_access_boundary_ready",
    access_boundary_outcome: "access_boundary_defined",
    site_claim_readiness_score: 100,
    site_claim_criteria: ["facility_name", "access_boundary"],
  },
};

const adminLeadSceneDashboardFixture = {
  schema_version: "v1",
  scene: "scene-op-qa",
  // AdminLeads renders "<site_type> status" (falls back to "Site"); the QA
  // expectation "Whole-home" depends on this field being present.
  site_type: "Whole-home",
  whole_home: {
    capture_id: "cap-op-qa",
    status: "qualified_ready",
    confidence: 0.9,
    memo_path: "/tmp/operator-qa-scene-memo.md",
    memo_uri: "gs://operator-qa/memo.md",
  },
  categories: {
    pick: {
      counts: { ready: 1, risky: 0, not_ready_yet: 0 },
      tasks: [
        {
          task_text: "Pick up tote at staging shelf",
          capture_id: "pick-op-qa",
          status: "ready",
          next_action: "advance to human signoff",
          themes: ["human review only"],
          memo_path: "/tmp/operator-qa-pick.md",
          memo_uri: "gs://operator-qa/pick.md",
        },
      ],
    },
    open_close: {
      counts: { ready: 0, risky: 0, not_ready_yet: 1 },
      tasks: [
        {
          task_text: "Open receiving gate",
          capture_id: "open-op-qa",
          status: "not_ready_yet",
          next_action: "redesign",
          themes: ["route clearance"],
          memo_path: "/tmp/operator-qa-open.md",
          memo_uri: "gs://operator-qa/open.md",
        },
      ],
    },
    navigate: {
      counts: { ready: 0, risky: 0, not_ready_yet: 1 },
      tasks: [
        {
          task_text: "Navigate to staging aisle",
          capture_id: "nav-op-qa",
          status: "not_ready_yet",
          next_action: "defer",
          themes: ["reach"],
          memo_path: "/tmp/operator-qa-nav.md",
          memo_uri: "gs://operator-qa/nav.md",
        },
      ],
    },
  },
  theme_counts: { reach: 1, "route clearance": 1 },
  action_counts: {
    redesign: 1,
    defer: 1,
    "advance to human signoff": 1,
  },
  deployment_summary: {
    total_tasks: 3,
    ready_now: 1,
    needs_redesign: 1,
    outside_robot_envelope: 1,
  },
};

export function operatorQaArtifactSlugForSurface(routePath: string, viewportName: string) {
  const routeSlug = routePath
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${routeSlug || "home"}-${viewportName}`;
}

export function getOperatorQaFixtureForRequest(
  rawUrl: string,
  method = "GET",
): OperatorQaFixtureResponse | null {
  const url = new URL(rawUrl, "http://127.0.0.1");
  const pathname = url.pathname;
  const normalizedMethod = method.toUpperCase();

  if (normalizedMethod === "GET" && pathname === "/api/csrf") {
    return {
      fixtureId: "csrf",
      status: 200,
      body: { csrfToken: "operator-qa-local-csrf" },
    };
  }

  if (normalizedMethod === "POST" && pathname === "/api/analytics/ingest") {
    return {
      fixtureId: "analytics-ingest",
      status: 200,
      body: { ok: true, mocked: true },
    };
  }

  if (normalizedMethod === "GET" && pathname === "/api/admin/leads/stats/summary") {
    return {
      fixtureId: "admin-leads",
      status: 200,
      body: adminLeadsStatsFixture,
    };
  }

  if (
    normalizedMethod === "GET" &&
    pathname === "/api/admin/leads/op-qa-ready/pipeline/dashboard"
  ) {
    return {
      fixtureId: "admin-leads",
      status: 200,
      body: adminLeadSceneDashboardFixture,
    };
  }

  if (normalizedMethod === "GET" && pathname === "/api/admin/leads/op-qa-ready/site-task-clarification") {
    return { fixtureId: "admin-leads", status: 200,
      body: { revision: "a".repeat(64), questions: [], needed: false, response: null } };
  }

  if (normalizedMethod === "GET" && pathname === "/api/admin/leads/op-qa-ready") {
    return {
      fixtureId: "admin-leads",
      status: 200,
      body: adminLeadDetailFixture,
    };
  }

  if (normalizedMethod === "GET" && pathname === "/api/admin/leads") {
    return {
      fixtureId: "admin-leads",
      status: 200,
      body: adminLeadsListFixture,
    };
  }

  return null;
}

export function buildOperatorQaReportMarkdown(input: OperatorQaReportInput): string {
  const passedRoutes = input.routeResults.filter((result) => result.status === "pass").length;
  const totalRoutes = input.routeResults.length;
  const fixtureLines = operatorQaApiFixtures.map((fixture) => {
    const hits = input.apiFixtureHits[fixture.id] || 0;
    return `- ${fixture.label}: ${hits} hit(s). ${fixture.proves}`;
  });

  const lines = [
    "# Blueprint Operator Surface QA Report",
    "",
    `Generated: ${input.generatedAt}`,
    `Base URL: ${input.baseUrl}`,
    "Command: `npm run qa:operator`",
    "Boundary: local Playwright dev server with mocked API responses and disabled ops scheduler",
    "",
    "## Summary",
    "",
    `Routes: ${passedRoutes}/${totalRoutes} route/viewports passed.`,
    `Issues: ${input.issues.length}`,
    `Blocked live endpoints: ${input.blockedLiveEndpoints.length}`,
    `Stubbed external static assets: ${input.stubbedExternalAssets?.length || 0}`,
    "",
    "## What this proves",
    "",
    "- Protected operator routes can render through the local React app with fixture-backed API responses.",
    "- The internal screens preserve capture provenance, rights, provider, payment, and fulfillment boundaries in local UI copy.",
    "- Screenshots and route checks are reproducible from one repo-local command without live credentials.",
    "- Known shared static font requests are fulfilled with local empty responses so screenshots do not depend on Google Fonts.",
    "",
    "## What this does not prove",
    "",
    "Does not prove: live Firebase, Stripe, Notion, Paperclip, Render, Redis, provider execution, email/Slack sends, payments, payouts, or production mutation readiness.",
    "",
    "## Fixture Hits",
    "",
    ...fixtureLines,
    "",
    "## Route Results",
    "",
  ];

  for (const result of input.routeResults) {
    lines.push(
      `### ${result.surfaceLabel} - ${result.viewportName}`,
      "",
      `- Path: \`${result.routePath}\``,
      `- Status: ${result.status}`,
      `- Screenshot: \`${result.screenshotPath}\``,
      "",
      "| Check | Status | Detail |",
      "| --- | --- | --- |",
      ...result.checks.map((check) => {
        const detail = check.detail.replace(/\|/g, "\\|");
        return `| ${check.name} | ${check.status} | ${detail} |`;
      }),
      "",
    );
  }

  if (input.issues.length > 0) {
    lines.push("## Issues", "", ...input.issues.map((issue) => `- ${issue}`), "");
  }

  if (input.blockedLiveEndpoints.length > 0) {
    lines.push(
      "## Blocked Endpoint Attempts",
      "",
      ...input.blockedLiveEndpoints.map((endpoint) => `- ${endpoint}`),
      "",
    );
  }

  return `${lines.join("\n").trim()}\n`;
}
