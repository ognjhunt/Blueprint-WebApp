import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminLeads from "@/pages/AdminLeads";

const useAuthMock = vi.hoisted(() => vi.fn());
const setLocationMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/leads", setLocationMock],
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminLeads />
    </QueryClientProvider>
  );
}

describe("AdminLeads scene readiness", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      currentUser: { email: "ops@tryblueprint.io", uid: "owner-uid", getIdToken: vi.fn(async () => "synthetic-owner-token") },
      userData: { roles: ["admin"] },
      tokenClaims: { roles: ["admin"] },
    });
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/leads?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              leads: [
                {
                  requestId: "req-1",
                  site_submission_id: "req-1",
                  createdAt: "2026-03-11T12:00:00.000Z",
                  status: "qualified_ready",
                  qualification_state: "qualified_ready",
                  opportunity_state: "handoff_ready",
                  priority: "normal",
                  contact: {
                    firstName: "Ada",
                    lastName: "Lovelace",
                    email: "ada@example.com",
                    company: "Analytical Engines",
                    roleTitle: "Ops",
                  },
                  request: {
                    budgetBucket: "$50K-$300K",
                    requestedLanes: ["qualification"],
                    helpWith: ["benchmark-packs"],
                    buyerType: "site_operator",
                    commercialRequestPath: "site_claim",
                    siteName: "Durham Facility",
                    siteLocation: "Durham, NC",
                    taskStatement: "Review a picking workflow.",
                    pilotOpportunity: {
                      requested: true,
                      visibility: "private",
                      dataUsePermissions: {
                        evaluateExistingPolicy: "granted",
                        siteSpecificAdaptation: "not_granted",
                        retainImprovements: "not_granted",
                        generalModelTraining: "not_granted",
                      },
                    },
                  },
                  owner: {},
                  pipeline: {
                    scene_id: "scene-1",
                    capture_id: "cap-1",
                    pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
                    artifacts: {
                      dashboard_summary_uri: "gs://bucket/scenes/scene-1/captures/cap-1/pipeline/dashboard_summary.json",
                    },
                  },
                },
              ],
            }),
          ),
        );
      }
      if (url === "/api/admin/leads/stats/summary") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              total: 1,
              newLast24h: 1,
              byStatus: { qualified_ready: 1 },
              byPriority: { normal: 1 },
            })
          )
        );
      }
      if (url === "/api/admin/leads/req-1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              requestId: "req-1",
              site_submission_id: "req-1",
              createdAt: "2026-03-11T12:00:00.000Z",
              status: "qualified_ready",
              qualification_state: "qualified_ready",
              opportunity_state: "handoff_ready",
              priority: "normal",
              contact: {
                firstName: "Ada",
                lastName: "Lovelace",
                email: "ada@example.com",
                company: "Analytical Engines",
                roleTitle: "Ops",
              },
              request: {
                budgetBucket: "$50K-$300K",
                requestedLanes: ["qualification"],
                helpWith: ["benchmark-packs"],
                buyerType: "site_operator",
                commercialRequestPath: "site_claim",
                siteName: "Durham Facility",
                siteLocation: "Durham, NC",
                taskStatement: "Review a picking workflow.",
                workflowContext: "Backroom to staging handoff.",
                pilotOpportunity: {
                  requested: true,
                  visibility: "private",
                  dataUsePermissions: {
                    evaluateExistingPolicy: "granted",
                    siteSpecificAdaptation: "not_granted",
                    retainImprovements: "not_granted",
                    generalModelTraining: "not_granted",
                  },
                },
              },
              structured_intake: {
                mode: "calendar_accelerated",
                primary_cta: "Submit or claim a site",
                secondary_cta: "Book a scoping call",
                calendar_disposition: "required_before_next_step",
                calendar_reasons: ["operator_named_access_rules"],
                missing_structured_fields: [],
                owner_lane: "site-operator-partnership-agent",
                recommended_path: "intake_then_required_scoping_call",
                next_action: "review structured intake before any access or commercialization commitment",
                proof_ready_outcome: "operator_handoff",
                proof_path_outcome: "operator_handoff",
                proof_readiness_score: 0,
                proof_ready_criteria: [],
                missing_proof_ready_fields: [],
                site_operator_claim_outcome: "site_claim_access_boundary_ready",
                access_boundary_outcome: "access_boundary_defined",
                site_claim_readiness_score: 100,
                site_claim_criteria: ["facility_name"],
                missing_site_claim_fields: [],
                pilot_opportunity_outcome: "review_pending",
                pilot_opportunity_gate_criteria: [],
                missing_pilot_opportunity_fields: ["benchmark_profile"],
              },
              owner: {},
              context: { sourcePageUrl: "https://example.com", utm: {} },
              enrichment: {},
              events: {},
              notes: [],
              pipeline: {
                scene_id: "scene-1",
                capture_id: "cap-1",
                pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
                synced_at: "2026-03-11T12:10:00.000Z",
                artifacts: {
                  dashboard_summary_uri: "gs://bucket/scenes/scene-1/captures/cap-1/pipeline/dashboard_summary.json",
                },
              },
            }),
          ),
        );
      }
      if (url === "/api/admin/leads/req-1/pipeline/dashboard") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schema_version: "v1",
              scene: "scene-1",
              site_type: "Whole-home",
              whole_home: {
                capture_id: "cap-1",
                status: "qualified_ready",
                confidence: 0.9,
                memo_path: "/tmp/memo.md",
                memo_uri: "gs://bucket/memo.md",
              },
              categories: {
                pick: {
                  counts: { ready: 1, risky: 0, not_ready_yet: 0 },
                  tasks: [
                    {
                      task_text: "Pick up part_1",
                      capture_id: "pick-1",
                      status: "ready",
                      next_action: "advance to human signoff",
                      themes: ["human review only"],
                      memo_path: "/tmp/pick.md",
                      memo_uri: "gs://bucket/pick.md",
                    },
                  ],
                },
                open_close: {
                  counts: { ready: 0, risky: 0, not_ready_yet: 1 },
                  tasks: [
                    {
                      task_text: "Open hatch_2",
                      capture_id: "open-1",
                      status: "not_ready_yet",
                      next_action: "redesign",
                      themes: ["route / clearance"],
                      memo_path: "/tmp/open.md",
                      memo_uri: "gs://bucket/open.md",
                    },
                  ],
                },
                navigate: {
                  counts: { ready: 0, risky: 0, not_ready_yet: 1 },
                  tasks: [
                    {
                      task_text: "Navigate to aisle_3",
                      capture_id: "nav-1",
                      status: "not_ready_yet",
                      next_action: "defer",
                      themes: ["reach"],
                      memo_path: "/tmp/nav.md",
                      memo_uri: "gs://bucket/nav.md",
                    },
                  ],
                },
              },
              theme_counts: { reach: 1 },
              action_counts: { redesign: 1, defer: 1, "advance to human signoff": 1 },
              deployment_summary: {
                total_tasks: 3,
                ready_now: 1,
                needs_redesign: 1,
                outside_robot_envelope: 1,
              },
            })
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders scene readiness deployment counts and grouped tasks", async () => {
    renderPage();
    const leadButton = await screen.findByRole("button", { name: /Durham Facility/i });
    fireEvent.click(leadButton);

    expect(await screen.findByText(/Scene readiness/i)).toBeInTheDocument();
    expect(await screen.findByText(/Request path: Site operator claim/i)).toBeInTheDocument();
    expect(await screen.findByText(/Intake routing/i)).toBeInTheDocument();
    expect(await screen.findByText(/site-operator-partnership-agent/i)).toBeInTheDocument();
    expect(await screen.findByText(/Whole-home/i)).toBeInTheDocument();
    expect(screen.getByText(/Need redesign/i)).toBeInTheDocument();
    expect(screen.getByText(/Outside envelope/i)).toBeInTheDocument();
    expect(screen.getByText(/Pick up part_1/i)).toBeInTheDocument();
    expect(screen.getByText(/Open hatch_2/i)).toBeInTheDocument();
    expect(screen.getByText(/Navigate to aisle_3/i)).toBeInTheDocument();
    expect(screen.getByText(/Pilot opportunity dossier/i)).toBeInTheDocument();
    const pilotOutcome = screen.getByLabelText(/Pilot opportunity outcome/i);
    expect(pilotOutcome).toHaveValue("review_pending");
    expect(screen.getByRole("option", { name: /Wrong robot class/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Economics insufficient/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Missing evidence/i })).toBeInTheDocument();

    fireEvent.change(pilotOutcome, { target: { value: "wrong_robot_class" } });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/leads/req-1/status",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"pilot_opportunity_outcome":"wrong_robot_class"'),
        }),
      );
    });
  }, 15_000);

  it("shows a fallback when the request has no scene dashboard attachment", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/leads?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              leads: [
                {
                  requestId: "req-1",
                  site_submission_id: "req-1",
                  createdAt: "2026-03-11T12:00:00.000Z",
                  status: "qualified_ready",
                  qualification_state: "qualified_ready",
                  opportunity_state: "handoff_ready",
                  priority: "normal",
                  contact: {
                    firstName: "Ada",
                    lastName: "Lovelace",
                    email: "ada@example.com",
                    company: "Analytical Engines",
                    roleTitle: "Ops",
                  },
                  request: {
                    budgetBucket: "$50K-$300K",
                    requestedLanes: ["qualification"],
                    helpWith: ["benchmark-packs"],
                    buyerType: "site_operator",
                    siteName: "Durham Facility",
                    siteLocation: "Durham, NC",
                    taskStatement: "Review a picking workflow.",
                  },
                  owner: {},
                  pipeline: {
                    scene_id: "scene-1",
                    capture_id: "cap-1",
                    pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
                    artifacts: {},
                  },
                },
              ],
            })
          )
        );
      }
      if (url === "/api/admin/leads/stats/summary") {
        return Promise.resolve(new Response(JSON.stringify({ total: 1, newLast24h: 1, byStatus: {}, byPriority: {} })));
      }
      if (url === "/api/admin/leads/req-1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              requestId: "req-1",
              site_submission_id: "req-1",
              createdAt: "2026-03-11T12:00:00.000Z",
              status: "qualified_ready",
              qualification_state: "qualified_ready",
              opportunity_state: "handoff_ready",
              priority: "normal",
              contact: {
                firstName: "Ada",
                lastName: "Lovelace",
                email: "ada@example.com",
                company: "Analytical Engines",
                roleTitle: "Ops",
              },
              request: {
                budgetBucket: "$50K-$300K",
                requestedLanes: ["qualification"],
                helpWith: ["benchmark-packs"],
                buyerType: "site_operator",
                siteName: "Durham Facility",
                siteLocation: "Durham, NC",
                taskStatement: "Review a picking workflow.",
              },
              owner: {},
              context: { sourcePageUrl: "https://example.com", utm: {} },
              enrichment: {},
              events: {},
              notes: [],
              pipeline: {
                scene_id: "scene-1",
                capture_id: "cap-1",
                pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
                artifacts: {},
              },
            })
          )
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });

    renderPage();
    const leadButton = await screen.findByRole("button", { name: /Durham Facility/i });
    fireEvent.click(leadButton);

    await waitFor(() => {
      expect(
        screen.getByText(/no scene dashboard has been emitted for this request yet/i)
      ).toBeInTheDocument();
    });
  });

  it("authenticates the queue read and displays a saved communications draft with sending disabled", async () => {
    const body = "I'm building Blueprint. Is this task useful to discuss?";
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      if (String(input).startsWith("/api/admin/leads/action-queue?")) {
        if ((init?.headers as Record<string, string>)?.Authorization !== "Bearer synthetic-owner-token") return Response.json({ error: "Missing or invalid authorization" }, { status: 401 });
        return Response.json({ items: [{ id: "communications_saved-job", status: "pending_approval", lane: "outbound_prospect",
          source_collection: "outboundProspects", source_doc_id: "saved-prospect", action_type: "send_email", action_tier: 3, draft_output: {},
          action_payload: { to: "operator@facility.example", subject: "A task question", body, communications: { output: { body } } }, sending_enabled: false,
          outreach_review: { digest: "a".repeat(64), hardChecksPassed: true, blockers: [], semanticReviewRequired: { evidence: "Verify sources." } } }],
          summary: { total: 1, pending_approval: 1, failed: 0 } });
      }
      return Response.json({ leads: [], total: 0, byStatus: {}, byPriority: {} });
    });
    renderPage();
    const tab = await screen.findByRole("tab", { name: /approvals/i }); fireEvent.mouseDown(tab); fireEvent.click(tab);
    expect(await screen.findByText("To: operator@facility.example")).toBeVisible();
    expect(screen.getByText(body)).toBeVisible(); expect(screen.getByText("Tier 3")).toBeVisible();
    expect(screen.getByText(/Sending is disabled/)).toBeVisible(); expect(screen.getByRole("button", { name: "Approve outreach" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/leads/action-queue?limit=100", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer synthetic-owner-token" }) }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
  it("copies the exact saved revision from Approvals only on a manual authenticated click",async()=>{
    const digest="a".repeat(64),revisionId="b".repeat(64),ledgerId=`communications_${"c".repeat(64)}`;
    const fetchMock=vi.spyOn(global,"fetch").mockImplementation(async(input,init)=>{
      const url=String(input);
      if(url==="/api/communications/gmail/oauth/status")return Response.json({enabled:true,state:"connected_draft_capable",draftScopeGranted:true,sendsEnabled:false});
      if(url.endsWith("/gmail-draft"))return Response.json({state:"verified",draftId:"gmail-draft-1",reviewDigest:digest,revisionId,sent:false});
      if(url.startsWith("/api/admin/leads/action-queue?"))return Response.json({items:[{id:ledgerId,status:"pending_approval",lane:"outbound_prospect",source_collection:"outboundProspects",source_doc_id:"saved-prospect",action_type:"send_email",action_tier:3,draft_output:{},draft_revision_id:revisionId,
        gmail_draft:{writesEnabled:true,state:"not_copied",draftId:null,verifiedAt:null,currentRevisionVerified:false},
        action_payload:{to:"operator@facility.example",subject:"A task question",body:"A bounded question?",communications:{job:{intent:"outreach"},output:{subject:"A task question",body:"A bounded question?",usedFactIds:[],outreachContract:null},brief:{facts:[]}}},sending_enabled:false,
        outreach_review:{digest,hardChecksPassed:true,blockers:[],semanticReviewRequired:{evidence:"Verify sources."}}}],summary:{total:1,pending_approval:1,failed:0}});
      return Response.json({leads:[],total:0,byStatus:{},byPriority:{}});
    });
    renderPage();const tab=await screen.findByRole("tab",{name:/approvals/i});fireEvent.mouseDown(tab);fireEvent.click(tab);
    const save=await screen.findByRole("button",{name:"Save to Gmail Drafts"});await waitFor(()=>expect(save).toBeEnabled());
    expect(fetchMock.mock.calls.some(([,init])=>init?.method==="POST")).toBe(false);fireEvent.click(save);
    expect(await screen.findByText(/Gmail draft readback verified for this saved revision/)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(`/api/admin/leads/action-queue/${ledgerId}/gmail-draft`,expect.objectContaining({method:"POST",credentials:"include",headers:expect.objectContaining({Authorization:"Bearer synthetic-owner-token"}),body:JSON.stringify({expectedReviewDigest:digest,expectedRevisionId:revisionId,mode:"write"})}));
    expect(fetchMock.mock.calls.filter(([,init])=>init?.method==="POST")).toHaveLength(1);expect(screen.getByRole("button",{name:"Approve outreach"})).toBeDisabled();
  });
  it("shows a queue read failure with unknown counts, then retries successfully instead of claiming no approvals", async () => {
    let queueFails = true;
    vi.spyOn(global, "fetch").mockImplementation(async input => {
      if (String(input).startsWith("/api/admin/leads/action-queue?")) return queueFails
        ? Response.json({ error: "Missing or invalid authorization" }, { status: 401 })
        : Response.json({ items: [], summary: { total: 0, pending_approval: 0, failed: 0 } });
      return Response.json({ leads: [], total: 0, byStatus: {}, byPriority: {} });
    });
    renderPage();
    const tab = await screen.findByRole("tab", { name: /approvals/i }); fireEvent.mouseDown(tab); fireEvent.click(tab);
    expect(await screen.findByText(/Could not load the action queue \(401\)/)).toBeVisible();
    expect(screen.queryByText("No pending approvals or failed actions right now.")).not.toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(4);
    queueFails = false; fireEvent.click(screen.getByRole("button", { name: "Retry loading approvals" }));
    expect(await screen.findByText("No pending approvals or failed actions right now.")).toBeVisible();
    expect(screen.queryByText(/Could not load the action queue/)).not.toBeInTheDocument();
  });
  it("preserves an unsaved draft edit when a queue refresh fails", async () => {
    let queueFails = false;
    vi.spyOn(global, "fetch").mockImplementation(async input => {
      if (String(input).startsWith("/api/admin/leads/action-queue?")) return queueFails
        ? Response.json({ error: "Read unavailable" }, { status: 500 })
        : Response.json({ items: [{ id: "communications_saved-job", status: "pending_approval", lane: "outbound_prospect",
          source_collection: "outboundProspects", source_doc_id: "saved-prospect", action_type: "send_email", action_tier: 3, draft_output: {},
          action_payload: { to: "operator@facility.example", subject: "A question", body: "Original message?", communications: { output: {
            subject: "A question", body: "Original message?", usedFactIds: [], outreachContract: null }, brief: { facts: [] } } }, sending_enabled: false,
          outreach_review: { digest: "a".repeat(64), hardChecksPassed: true, blockers: [], semanticReviewRequired: { evidence: "Verify sources." } } },
          { id: "generic-pending", status: "pending_approval", lane: "waitlist", source_collection: "waitlistSubmissions", source_doc_id: "generic",
            action_type: "send_email", action_tier: 3, draft_output: {}, action_payload: { to: "synthetic@example.com", subject: "Synthetic pending action", body: "A pending reply" } }],
          summary: { total: 2, pending_approval: 2, failed: 0 } });
      return Response.json({ leads: [], total: 0, byStatus: {}, byPriority: {} });
    });
    renderPage();
    const tab = await screen.findByRole("tab", { name: /approvals/i }); fireEvent.mouseDown(tab); fireEvent.click(tab);
    fireEvent.click(await screen.findByRole("button", { name: "Revise draft" }));
    fireEvent.change(screen.getByLabelText("Draft message"), { target: { value: "My unsaved revision?" } });
    queueFails = true; fireEvent.click(screen.getByRole("button", { name: "Refresh", exact: true }));
    expect(await screen.findByText(/Showing the last loaded drafts/)).toBeVisible();
    expect(screen.getByLabelText("Draft message")).toHaveValue("My unsaved revision?");
    expect(screen.getByRole("button", { name: "Approve outreach" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Approve", exact: true })).toBeDisabled();
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.queryByText("No pending approvals or failed actions right now.")).not.toBeInTheDocument();
  });
  it("submits the exact outreach digest and human checks from the existing approval card", async () => {
    const checks = {
      connection: "Check connection.", evidence: "Check sources.", boundedValue: "Check value limits.",
      easyQuestion: "Check one question.", recipientChoice: "Check recipient choice.", workflow: "Check workflow.",
    };
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/ledger-outreach/approve") && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ state: "sent", ledgerDocId: "ledger-outreach" })));
      }
      if (url.startsWith("/api/admin/leads/action-queue?")) {
        return Promise.resolve(new Response(JSON.stringify({
          items: [{ id: "ledger-outreach", status: "pending_approval", lane: "outbound_prospect", source_collection: "outboundProspects",
            source_doc_id: "prospect-1", action_type: "send_email", action_tier: 3, draft_output: {},
            action_payload: { to: "ops@packing-facility.co", subject: "A job question", body: "I'm building Blueprint. Is packing relevant?" },
            outreach_review: { digest: "a".repeat(64), hardChecksPassed: true, blockers: [], semanticReviewRequired: checks },
          }], summary: { total: 1, pending_approval: 1, failed: 0, sent: 0 },
        })));
      }
      return Promise.resolve(new Response(JSON.stringify({ leads: [], total: 0, byStatus: {}, byPriority: {} })));
    });
    renderPage();
    const tab = await screen.findByRole("tab", { name: /approvals/i });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    const approve = await screen.findByRole("button", { name: "Approve outreach" });
    expect(approve).toBeDisabled();
    screen.getAllByRole("checkbox").forEach((box) => fireEvent.click(box));
    fireEvent.click(approve);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/leads/action-queue/ledger-outreach/approve",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer synthetic-owner-token" }), body: JSON.stringify({ outreachSemanticReview: {
        digest: "a".repeat(64), checks: { connection: "pass", evidence: "pass", boundedValue: "pass", easyQuestion: "pass", recipientChoice: "pass", workflow: "pass" },
      } }) }),
    ));
  });

  it("renders the approvals queue and triggers operator actions", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/leads?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              leads: [
                {
                  requestId: "req-1",
                  site_submission_id: "req-1",
                  createdAt: "2026-03-11T12:00:00.000Z",
                  status: "qualified_ready",
                  qualification_state: "qualified_ready",
                  opportunity_state: "handoff_ready",
                  priority: "normal",
                  contact: {
                    firstName: "Ada",
                    lastName: "Lovelace",
                    email: "ada@example.com",
                    company: "Analytical Engines",
                    roleTitle: "Ops",
                  },
                  request: {
                    budgetBucket: "$50K-$300K",
                    requestedLanes: ["qualification"],
                    helpWith: ["benchmark-packs"],
                    buyerType: "site_operator",
                    siteName: "Durham Facility",
                    siteLocation: "Durham, NC",
                    taskStatement: "Review a picking workflow.",
                  },
                  owner: {},
                  pipeline: {
                    scene_id: "scene-1",
                    capture_id: "cap-1",
                    pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
                    artifacts: {},
                  },
                },
              ],
            })
          )
        );
      }
      if (url === "/api/admin/leads/stats/summary") {
        return Promise.resolve(new Response(JSON.stringify({ total: 1, newLast24h: 1, byStatus: {}, byPriority: {} })));
      }
      if (url.startsWith("/api/admin/leads/action-queue")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "ledger-1",
                  status: "pending_approval",
                  lane: "waitlist",
                  action_type: "send_email",
                  source_collection: "waitlistSubmissions",
                  source_doc_id: "submission-1",
                  action_tier: 3,
                  idempotency_key: "waitlist:submission-1",
                  auto_approve_reason: null,
                  approval_reason: "requires_human_review",
                  approved_by: null,
                  approved_at: null,
                  rejected_by: null,
                  rejected_reason: null,
                  execution_attempts: 0,
                  last_execution_error: null,
                  created_at: "2026-03-29T12:00:00.000Z",
                  updated_at: "2026-03-29T12:05:00.000Z",
                  sent_at: null,
                  last_execution_at: null,
                  action_payload: {
                    to: "ada@example.com",
                    subject: "Invite now",
                    body: "Please join the capturer beta.",
                  },
                  draft_output: {
                    recommendation: "invite_now",
                    confidence: 0.91,
                  },
                },
                {
                  id: "ledger-2",
                  status: "failed",
                  lane: "support",
                  action_type: "send_email",
                  source_collection: "contactRequests",
                  source_doc_id: "contact-1",
                  action_tier: 1,
                  idempotency_key: "support:contact-1",
                  auto_approve_reason: "policy_auto_approved",
                  approval_reason: null,
                  approved_by: "ops@tryblueprint.io",
                  approved_at: "2026-03-29T12:03:00.000Z",
                  rejected_by: null,
                  rejected_reason: null,
                  execution_attempts: 2,
                  last_execution_error: "SMTP timeout",
                  created_at: "2026-03-29T11:50:00.000Z",
                  updated_at: "2026-03-29T12:06:00.000Z",
                  sent_at: null,
                  last_execution_at: "2026-03-29T12:06:00.000Z",
                  action_payload: {
                    to: "support@example.com",
                    subject: "Support reply",
                    body: "We can help with that.",
                  },
                  draft_output: {
                    category: "general_support",
                    confidence: 0.87,
                  },
                },
              ],
              summary: {
                total: 2,
                pending_approval: 1,
                failed: 1,
              },
            })
          ),
        );
      }
      if (url.includes("/action-queue/") && url.endsWith("/reject")) {
        return Promise.resolve(new Response(JSON.stringify({ state: "rejected" })));
      }
      if (url.includes("/action-queue/") && url.endsWith("/retry")) {
        return Promise.resolve(new Response(JSON.stringify({ state: "sent" })));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });

    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Needs manual review");

    renderPage();

    const approvalsTab = await screen.findByRole("tab", { name: /approvals/i });
    fireEvent.mouseDown(approvalsTab);
    fireEvent.click(approvalsTab);

    expect(await screen.findByRole("button", { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(promptSpy).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/leads/action-queue/ledger-1/reject"),
        expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer synthetic-owner-token" }) }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/leads/action-queue/ledger-2/retry"),
        expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer synthetic-owner-token" }) }),
      );
    });

    promptSpy.mockRestore();
  });

  it("renders the field ops workspace and triggers assignment/outreach actions", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/leads?")) {
        return Promise.resolve(new Response(JSON.stringify({ leads: [] })));
      }
      if (url === "/api/admin/leads/stats/summary") {
        return Promise.resolve(new Response(JSON.stringify({ total: 0, newLast24h: 0, byStatus: {}, byPriority: {} })));
      }
      if (url.startsWith("/api/admin/field-ops/capture-jobs?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              jobs: [
                {
                  id: "job-1",
                  title: "Durham Facility",
                  address: "123 Main St",
                  status: "scheduled",
                  buyer_request_id: "req-1",
                  marketplace_state: "claimable",
                  rights_status: "review_required",
                  capture_policy_tier: "review_required",
                  field_ops: {},
                  site_access: {},
                  updated_at: "2026-03-29T12:00:00.000Z",
                },
              ],
            }),
          ),
        );
      }
      if (url.endsWith("/candidates")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  uid: "creator-1",
                  name: "Casey Capturer",
                  email: "capturer@example.com",
                  phone_number: "555-000-1111",
                  market: "Durham",
                  availability: "flexible",
                  equipment: ["iPhone 15 Pro"],
                  totalCaptures: 9,
                  approvedCaptures: 8,
                  avgQuality: 21,
                  score: 94,
                  score_breakdown: {
                    market: 30,
                    availability: 20,
                    equipment: 25,
                    quality: 9,
                    reliability: 10,
                  },
                  travel_estimate_minutes: 15,
                  travel_estimate_source: "heuristic_market",
                },
              ],
            }),
          ),
        );
      }
      if (url.endsWith("/site-access/contacts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              contacts: [
                {
                  email: "operator@example.com",
                  name: "Pat Operator",
                  source: "inbound_request_contact",
                  company: "Durham Facility",
                  roleTitle: "Site lead",
                },
              ],
            }),
          ),
        );
      }
      if (url === "/api/admin/field-ops/reschedule-queue") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "booking-1",
                  businessName: "Durham Facility",
                  email: "buyer@example.com",
                  current_date: "2026-04-01",
                  current_time: "10:00 AM",
                  requested_date: "2026-04-01",
                  requested_time: "3:00 PM",
                  requested_by: "buyer",
                  status: "pending_approval",
                  reason: "schedule_conflict",
                },
              ],
            }),
          ),
        );
      }
      if (url === "/api/admin/field-ops/finance-queue") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "payout-1",
                  status: "review_required",
                  creator_id: "creator-1",
                  capture_id: "cap-1",
                  stripe_payout_id: "po_1",
                  failure_reason: "Bank account needs review",
                  queue: "payout_exception_queue",
                  ops_automation: {},
                  finance_review: {},
                  updated_at: "2026-03-29T12:00:00.000Z",
                },
              ],
            }),
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });

    renderPage();

    const fieldOpsTab = await screen.findByRole("tab", { name: /field ops/i });
    fireEvent.mouseDown(fieldOpsTab);
    fireEvent.click(fieldOpsTab);

    expect((await screen.findAllByText(/Durham Facility/i)).length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: /Assign \+ confirm/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Send outreach/i })).toBeInTheDocument();
    expect(await screen.findByText(/Dispatch remains heuristic-only/i)).toBeInTheDocument();
    expect(await screen.findByText(/Site access is structured, not autonomous/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Run overdue review scan/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Assign to me \+ investigate/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Assign \+ confirm/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/field-ops/capture-jobs/job-1/assign-capturer"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Send outreach/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/field-ops/capture-jobs/job-1/site-access/outreach"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders proof-path milestones and records operator milestone marks", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input, init) => {
      const url = String(input);
      if (url.startsWith("/api/admin/leads?")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              leads: [
                {
                  requestId: "req-robot",
                  site_submission_id: "req-robot",
                  createdAt: "2026-03-11T12:00:00.000Z",
                  status: "qualified_ready",
                  qualification_state: "qualified_ready",
                  opportunity_state: "handoff_ready",
                  priority: "high",
                  contact: {
                    firstName: "Grace",
                    lastName: "Hopper",
                    email: "grace@example.com",
                    company: "Fleet Systems",
                    roleTitle: "Deployment lead",
                  },
                  request: {
                    budgetBucket: "$300K-$1M",
                    requestedLanes: ["preview_simulation"],
                    helpWith: ["scene-library"],
                    buyerType: "robot_team",
                    siteName: "Boston Warehouse",
                    siteLocation: "Boston, MA",
                    taskStatement: "Review our exact-site picking flow.",
                  },
                  owner: {},
                  ops: {
                    proof_path: {
                      exact_site_requested_at: "2026-03-11T12:00:00.000Z",
                      qualified_inbound_at: "2026-03-11T13:00:00.000Z",
                    },
                  },
                },
              ],
            }),
          ),
        );
      }
      if (url === "/api/admin/leads/stats/summary") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              total: 1,
              newLast24h: 1,
              byStatus: { qualified_ready: 1 },
              byPriority: { high: 1 },
            }),
          ),
        );
      }
      if (url === "/api/admin/leads/req-robot") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              requestId: "req-robot",
              site_submission_id: "req-robot",
              createdAt: "2026-03-11T12:00:00.000Z",
              status: "qualified_ready",
              qualification_state: "qualified_ready",
              opportunity_state: "handoff_ready",
              priority: "high",
              contact: {
                firstName: "Grace",
                lastName: "Hopper",
                email: "grace@example.com",
                company: "Fleet Systems",
                roleTitle: "Deployment lead",
              },
              request: {
                budgetBucket: "$300K-$1M",
                requestedLanes: ["preview_simulation"],
                helpWith: ["scene-library"],
                buyerType: "robot_team",
                siteName: "Boston Warehouse",
                siteLocation: "Boston, MA",
                taskStatement: "Review our exact-site picking flow.",
                proofPathPreference: "exact_site_required",
              },
              owner: {},
              context: { sourcePageUrl: "https://example.com/contact", utm: {} },
              enrichment: {},
              events: {},
              notes: [],
              ops: {
                assigned_region_id: "managed-alpha",
                rights_status: "unknown",
                capture_policy_tier: "review_required",
                capture_status: "not_requested",
                quote_status: "not_started",
                next_step: "Send proof pack",
                last_buyer_ready_at: null,
                proof_path: {
                  exact_site_requested_at: "2026-03-11T12:00:00.000Z",
                  qualified_inbound_at: "2026-03-11T13:00:00.000Z",
                  proof_pack_delivered_at: null,
                  proof_pack_reviewed_at: null,
                  hosted_review_ready_at: null,
                  hosted_review_started_at: null,
                  hosted_review_follow_up_at: null,
                  artifact_handoff_delivered_at: null,
                  artifact_handoff_accepted_at: null,
                  human_commercial_handoff_at: null,
                },
              },
            }),
          ),
        );
      }
      if (url === "/api/admin/leads/req-robot/ops") {
        return Promise.resolve(new Response(JSON.stringify({ ok: true })));
      }
      if (typeof init?.method === "string" && init.method === "PATCH") {
        return Promise.resolve(new Response(JSON.stringify({ ok: true })));
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });

    renderPage();

    const leadButton = await screen.findByRole("button", { name: /Boston Warehouse/i });
    fireEvent.click(leadButton);

    expect(await screen.findByText(/Proof-path milestones/i)).toBeInTheDocument();
    expect(screen.getByText(/Exact-site request/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark proof pack delivered/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Mark proof pack delivered/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/leads/req-robot/ops",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            requestId: "req-robot",
            proof_path_stage: "proof_pack_delivered",
          }),
        }),
      );
    });
  });
});


describe("founder Gmail callback landing in the actual approvals page", () => {
  afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
  it.each(["prepare", "returned"])("mounts and expands %s on the fixed host without starting or saving automatically", async mode => {
    window.history.replaceState(null, "", `/admin/leads?founder_gmail=${mode}`);
    vi.spyOn(window.location, "origin", "get").mockReturnValue("https://tryblueprint.io");
    useAuthMock.mockReturnValue({ currentUser: { uid: "mock-owner", getIdToken: vi.fn(async () => "mock-owner-token") },
      userData: { roles: ["admin"] }, tokenClaims: { roles: ["admin"] } });
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith("/communications/connection")) return Response.json({ connection: {
        account: "nijel@tryblueprint.io", binding: { state: "private_storage_selected_unverified" }, oauth: {
          ownerAction: "Owner-controlled confirmation", initialScopes: ["gmail.readonly"], sendScopeAfterSeparateApproval: "gmail.send", dataAccess: "Mailbox messages/settings" },
          secretDestination: { services: ["Blueprint web", "worker"] } } });
      if (url.endsWith("/gmail/oauth/status")) return Response.json({ enabled: true, state: mode === "prepare" ? "idle" : "awaiting_owner", sendsEnabled: false });
      return Response.json({ items: [], summary: { total: 0, pending_approval: 0, failed: 0 }, total: 0, byStatus: {}, byPriority: {} });
    });
    renderPage();
    expect(await screen.findByRole("button", { name: mode === "prepare" ? "Prepare Google read-only consent" : "Verify and save founder read-only connection" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prepare founder mailbox" })).toHaveAttribute("aria-expanded", "true");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
});
