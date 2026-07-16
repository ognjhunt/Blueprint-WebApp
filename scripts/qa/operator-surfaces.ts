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
    label: "Company Metrics",
    path: "/admin/company-metrics",
    expectedTexts: [
      "CEO Operating Screen",
      "Founder/operator truth map",
      "Capture To Hosted Review",
      "Local checks do not prove Operational Launch Ready",
    ],
    fixtureIds: ["company-metrics"],
  },
  {
    label: "Growth Studio",
    path: "/admin/growth-studio",
    expectedTexts: [
      "Growth Studio",
      "Growth truth boundary",
      "Ship-broadcast approval queue",
      "Ad Studio",
    ],
    fixtureIds: ["growth-studio"],
  },
  {
    label: "Request Console Ready Overview",
    path: "/requests/op-qa-ready",
    expectedTexts: [
      "Harborview Grocery Annex",
      "Private review truth map",
      "Firestore request record",
      "Access Boundary",
    ],
    fixtureIds: ["request-console-ready"],
  },
  {
    label: "Request Console Ready Evidence",
    path: "/requests/op-qa-ready/evidence",
    expectedTexts: [
      "Harborview Grocery Annex",
      "Evidence bundle",
      "Operating constraints",
      "approved operator hours",
    ],
    fixtureIds: ["request-console-ready"],
  },
  {
    label: "Request Console Ready Qualification",
    path: "/requests/op-qa-ready/qualification",
    expectedTexts: [
      "Harborview Grocery Annex",
      "Readiness review",
      "Buyer trust score",
      "Why this score exists",
    ],
    fixtureIds: ["request-console-ready"],
  },
  {
    label: "Request Console Provider Blocked Preview",
    path: "/requests/op-qa-provider-blocked/preview",
    expectedTexts: [
      "Riverbend Cold Storage Cell",
      "Preview and provenance",
      "Provider preview state",
      "Provider package is blocked pending rights clearance.",
    ],
    fixtureIds: ["request-console-provider-blocked"],
  },
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
    id: "company-metrics",
    label: "Company metrics",
    endpoints: ["GET /api/admin/company-metrics"],
    proves: "The CEO operating screen renders from a local scoreboard fixture.",
  },
  {
    id: "growth-studio",
    label: "Growth Studio",
    endpoints: [
      "GET /api/admin/growth/campaigns",
      "GET /api/admin/growth/creative-runs",
      "GET /api/admin/growth/ad-studio/runs",
      "GET /api/admin/growth/campaigns/ship-broadcast/pending-approval",
    ],
    proves: "Growth Studio read lanes render without Notion writes, provider calls, or sends.",
  },
  {
    id: "request-console-ready",
    label: "Request console ready state",
    endpoints: ["GET /api/requests/op-qa-ready"],
    proves: "Buyer review overview, evidence, and qualification views render from protected request fixtures.",
  },
  {
    id: "request-console-provider-blocked",
    label: "Request console provider-blocked state",
    endpoints: ["GET /api/requests/op-qa-provider-blocked"],
    proves: "Provider-blocked preview copy remains explicit about rights and provider boundaries.",
  },
  {
    id: "admin-leads",
    label: "Admin leads",
    endpoints: [
      "GET /api/admin/leads",
      "GET /api/admin/leads/stats/summary",
      "GET /api/admin/leads/op-qa-ready",
      "GET /api/admin/leads/op-qa-ready/pipeline/dashboard",
    ],
    proves: "The admin queue and scene readiness detail render from local operator fixtures.",
  },
];

const generatedAt = "2026-05-26T12:00:00.000Z";

const companyMetricsFixture = {
  ok: true,
  operatorEmail: "operator-qa@tryblueprint.local",
  scoreboard: {
    generatedAt,
    ceoOperatingScreen: {
      generatedAt,
      activeCity: {
        city: "Austin, TX",
        citySlug: "austin-tx",
        currentStage: "hosted_review_ready",
        latestSummary: "Exact-site hosted-review wedge is waiting on proof packet inspection.",
        latestEventAtIso: generatedAt,
        blockers: [
          {
            id: "op-qa-provider-proof",
            status: "partial",
            summary: "Provider package proof is present as fixture data only.",
            owner: "operator-qa",
          },
        ],
        nextActionCount: 2,
      },
      lifecycleStop: {
        stage: "hosted_review_ready",
        summary:
          "Austin exact-site hosted review is held on package evidence inspection, not on public copy.",
        blockers: [
          {
            id: "rights-clearance-fixture",
            status: "blocked",
            summary: "Rights clearance remains fixture-only in this local harness.",
            owner: "operator-qa",
          },
        ],
        waitingActions: [
          {
            id: "human-commercial-handoff",
            owner: "founder",
            status: "awaiting_human_decision",
            summary: "Founder must approve live commercial language outside this QA proof.",
          },
        ],
      },
      needsFounder: [
        {
          id: "founder-blocker-operator-qa",
          title: "Approve first buyer proof packet",
          reason: "Requires a human decision before external commitment.",
          source: "humanBlockerThreads/founder-blocker-operator-qa",
        },
      ],
      nextAutonomousActions: [
        {
          id: "run-local-request-console-proof",
          owner: "webapp-codex",
          summary: "Verify private request console state from local fixtures.",
          sourceRef: "scripts/qa/operator-surfaces.ts",
        },
        {
          id: "refresh-operator-screenshots",
          owner: "webapp-codex",
          summary: "Refresh local screenshots after UI changes.",
          sourceRef: "output/qa/operator-surfaces/latest",
        },
      ],
      recentChangeSummary: {
        operatingGraphEvents: 4,
        buyerOutcomes: 1,
        founderThreads: 1,
        latestEvents: [
          {
            id: "operator-qa-event-1",
            city: "Austin, TX",
            stage: "hosted_review_ready",
            summary: "Fixture records separate public surface polish from runtime proof.",
            sourceRepo: "Blueprint-WebApp",
            recordedAtIso: generatedAt,
          },
        ],
      },
      metricHealth: {
        daily: {
          truthful: 3,
          partial: 1,
          blocked: 1,
          blockedMetrics: [
            {
              key: "live_payment_state",
              label: "Live payment state",
              note: "Stripe is intentionally not called by this harness.",
            },
          ],
          partialMetrics: [
            {
              key: "provider_execution_state",
              label: "Provider execution state",
              note: "Provider state is represented by fixture records only.",
            },
          ],
        },
        weekly: {
          truthful: 4,
          partial: 2,
          blocked: 1,
          blockedMetrics: [
            {
              key: "live_provider_execution",
              label: "Live provider execution",
              note: "No World Labs, Render, or provider runtime is contacted.",
            },
          ],
          partialMetrics: [
            {
              key: "hosted_review_package",
              label: "Hosted review package",
              note: "Fixture package refs prove UI rendering, not live fulfillment.",
            },
          ],
        },
      },
      captureToHostedReviewLifecycle: {
        summary: {
          uploadedCaptures: 2,
          packageReadyCaptures: 1,
          hostedReviewReadyCaptures: 1,
          hostedReviewStartedCaptures: 0,
          currentStageCounts: {
            capture_uploaded: 1,
            package_ready: 1,
            hosted_review_ready: 1,
            hosted_review_started: 0,
          },
        },
        rows: [
          {
            captureId: "cap-operator-qa-austin",
            city: "Austin, TX",
            citySlug: "austin-tx",
            currentStage: "hosted_review_ready",
            completedStages: ["capture_uploaded", "package_ready", "hosted_review_ready"],
            nextMissingStage: "hosted_review_started",
            latestEvidenceAtIso: generatedAt,
            sourceRepos: ["BlueprintCapture", "BlueprintCapturePipeline", "Blueprint-WebApp"],
            evidenceRefs: [
              "capture_submissions/cap-operator-qa-austin",
              "operatorQaFixtures/companyMetrics",
            ],
            packageRunIds: ["package_run:operator-qa-austin"],
            hostedReviewRunIds: [],
            nextAction: {
              id: "capture_to_hosted_review:cap-operator-qa-austin:hosted_review_started",
              owner: "operator-qa",
              status: "ready_to_execute",
              summary: "Confirm live rights and payment state before hosted review start.",
              sourceRef: "scripts/qa/operator-surfaces.ts",
            },
          },
          {
            captureId: "cap-operator-qa-durham",
            city: "Durham, NC",
            citySlug: "durham-nc",
            currentStage: "capture_uploaded",
            completedStages: ["capture_uploaded"],
            nextMissingStage: "package_ready",
            latestEvidenceAtIso: "2026-05-25T18:30:00.000Z",
            sourceRepos: ["BlueprintCapture"],
            evidenceRefs: ["capture_submissions/cap-operator-qa-durham"],
            packageRunIds: [],
            hostedReviewRunIds: [],
            nextAction: {
              id: "capture_to_hosted_review:cap-operator-qa-durham:package_ready",
              owner: "pipeline-codex",
              status: "ready_to_execute",
              summary: "Run package readiness from durable uploaded capture before preview claims.",
              sourceRef: "capture_submissions/cap-operator-qa-durham",
            },
          },
        ],
      },
    },
    views: {
      daily: {
        metrics: [
          {
            key: "operator_screen_rendered",
            label: "Operator screen rendered",
            status: "truthful",
            value: 1,
            note: "Fixture-backed route render completed locally.",
          },
        ],
      },
      weekly: {
        metrics: [
          {
            key: "hosted_review_package_readiness",
            label: "Hosted review package readiness",
            status: "partial",
            value: 0.5,
            note: "Fixture package refs are present; live provider and fulfillment proof are not checked.",
          },
          {
            key: "human_interrupt_blockers",
            label: "Human interrupt blockers",
            status: "blocked",
            value: null,
            note: "Founder approval is represented as a fixture blocker.",
          },
          {
            key: "buyer_review_console_coverage",
            label: "Buyer review console coverage",
            status: "truthful",
            value: 3,
            note: "Overview, evidence, and readiness sections are covered by local request fixtures.",
          },
        ],
      },
    },
  },
};

const growthStudioFixture = {
  campaigns: {
    localCampaigns: [
      {
        id: "growth-campaign-op-qa",
        name: "Exact-Site Hosted Review fixture campaign",
        subject: "Fixture campaign for local operator QA",
        channel: "sendgrid",
        send_status: "draft",
        recipient_count: 0,
        last_ledger_doc_id: "ledger-op-qa",
        last_execution_error: null,
        approval_reason: "Fixture only. No send is executed.",
        rejected_reason: null,
        response_tracking: {
          last_event_type: "draft_created",
          last_event_at: generatedAt,
          last_recipient: null,
        },
        event_counts: {
          created: 1,
          queued: 0,
          sent: 0,
          opened: 0,
        },
      },
    ],
  },
  creativeRuns: {
    items: [
      {
        id: "creative-run-op-qa",
        status: "draft_ready",
        skuName: "Exact-Site Hosted Review",
        researchTopic: "warehouse exact-site proof",
        rolloutVariant: "operator-fixture",
        createdAt: generatedAt,
        generatedImages: 0,
        executionHandoff: {
          issueId: "BLU-OP-QA",
          status: "draft_only",
          assignee: "webapp-codex",
          error: null,
        },
        buyerObjections: ["Need proof from the same site."],
        remotionReel: {
          status: "not_rendered",
          outputPath: null,
          storageUri: null,
          signedUrl: null,
          durationSeconds: null,
          frames: null,
          error: null,
        },
      },
    ],
  },
  adStudioRuns: {
    items: [
      {
        id: "ad-run-op-qa",
        lane: "buyer",
        status: "review_required",
        audience: "robotics deployment leads",
        cta: "Request exact-site proof",
        city: "Austin",
        aspectRatio: "9:16",
        claimsLedger: {
          allowedClaims: ["Fixture UI can show proof-led claims."],
          blockedClaims: ["No fabricated customer traction.", "No live provider execution claimed."],
          evidenceLinks: ["scripts/qa/operator-surfaces.ts"],
          reviewDecision: "pending",
          reviewNotes: ["Harness does not approve Meta drafts or launch ads."],
        },
        brief: {
          visualDirection: "Show capture provenance and review-room boundaries.",
          copyHooks: ["Exact-site proof before deployment claims."],
        },
        promptPack: {
          imagePromptVariants: ["Fixture-only prompt for a warehouse review board."],
          videoPrompt: "Fixture-only proof reel prompt. Do not execute provider calls.",
          headlineOptions: ["Know the site before the robot arrives"],
          primaryTextOptions: ["Blueprint turns real capture into buyer review rooms."],
        },
        assets: [],
        imageExecutionHandoff: {
          issueId: "BLU-OP-QA-IMAGE",
          status: "queued_for_human_review",
          assignee: "webapp-codex",
          error: null,
        },
        videoTask: {
          taskId: null,
          status: "not_requested",
          firstFrameUrl: null,
          ratio: null,
          promptText: null,
        },
        review: {
          status: "pending",
          reasons: ["Requires evidence inspection before publishing."],
          headline: null,
          primaryText: null,
        },
        metaDraft: {
          campaignId: null,
          adSetId: null,
          creativeId: null,
          adId: null,
          status: "not_created",
          provider: null,
          provenanceIds: [],
          ledgerLink: null,
        },
        createdAtIso: generatedAt,
        updatedAtIso: generatedAt,
      },
    ],
  },
  shipBroadcastQueue: {
    items: [
      {
        id: "ledger-op-qa",
        name: "Ship Broadcast: local operator QA fixture",
        subject: "Local fixture only - no send",
        recipientCount: 0,
        sendStatus: "pending_approval",
        createdAt: generatedAt,
        lastLedgerDocId: "ledger-op-qa",
        approvalReason: null,
        assetKey: "operator-qa:fixture:ship-broadcast",
        assetType: "ship_broadcast",
        sourceIssueIds: ["BLU-OP-QA"],
        proofLinks: ["scripts/qa/operator-surfaces.ts"],
      },
    ],
  },
};

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
  siteName: "Harborview Grocery Annex",
  siteLocation: "Austin, TX",
  qualificationState: "qualified_ready",
  opportunityState: "handoff_ready",
  previewStatus: "succeeded",
  providerStatus: "succeeded",
  nextStep: "Prepare proof packet review while live payments, sends, and provider execution stay out of scope.",
});

const requestProviderBlockedFixture = requestFixture({
  requestId: "op-qa-provider-blocked",
  siteSubmissionId: "site-op-qa-provider-blocked",
  siteName: "Riverbend Cold Storage Cell",
  siteLocation: "Durham, NC",
  qualificationState: "needs_more_evidence",
  opportunityState: "escalated_to_geometry",
  previewStatus: "failed",
  providerStatus: "failed",
  providerFailureReason: "Provider package is blocked pending rights clearance.",
  nextStep: "Keep provider preview blocked until rights clearance and runtime proof are attached.",
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

  if (normalizedMethod === "GET" && pathname === "/api/admin/company-metrics") {
    return {
      fixtureId: "company-metrics",
      status: 200,
      body: companyMetricsFixture,
    };
  }

  if (normalizedMethod === "GET" && pathname === "/api/admin/growth/campaigns") {
    return {
      fixtureId: "growth-studio",
      status: 200,
      body: growthStudioFixture.campaigns,
    };
  }

  if (normalizedMethod === "GET" && pathname === "/api/admin/growth/creative-runs") {
    return {
      fixtureId: "growth-studio",
      status: 200,
      body: growthStudioFixture.creativeRuns,
    };
  }

  if (normalizedMethod === "GET" && pathname === "/api/admin/growth/ad-studio/runs") {
    return {
      fixtureId: "growth-studio",
      status: 200,
      body: growthStudioFixture.adStudioRuns,
    };
  }

  if (
    normalizedMethod === "GET" &&
    pathname === "/api/admin/growth/campaigns/ship-broadcast/pending-approval"
  ) {
    return {
      fixtureId: "growth-studio",
      status: 200,
      body: growthStudioFixture.shipBroadcastQueue,
    };
  }

  if (normalizedMethod === "POST" && pathname === "/api/requests/op-qa-ready/bootstrap") {
    return {
      fixtureId: "request-console-ready",
      status: 200,
      body: { ok: true, requestId: "op-qa-ready" },
    };
  }

  if (normalizedMethod === "GET" && pathname === "/api/requests/op-qa-ready") {
    return {
      fixtureId: "request-console-ready",
      status: 200,
      body: requestReadyFixture,
    };
  }

  if (
    normalizedMethod === "POST" &&
    pathname === "/api/requests/op-qa-provider-blocked/bootstrap"
  ) {
    return {
      fixtureId: "request-console-provider-blocked",
      status: 200,
      body: { ok: true, requestId: "op-qa-provider-blocked" },
    };
  }

  if (normalizedMethod === "GET" && pathname === "/api/requests/op-qa-provider-blocked") {
    return {
      fixtureId: "request-console-provider-blocked",
      status: 200,
      body: requestProviderBlockedFixture,
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
