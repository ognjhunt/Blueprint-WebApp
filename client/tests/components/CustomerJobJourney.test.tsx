// @vitest-environment jsdom
// One joined software proof, using the existing req-1 intake fixture pattern.
// Video analysis is a safe fixture; nothing here arranges a physical pilot.
import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import express from "express";
import nodeFetch from "node-fetch";
import { createServer } from "node:http";
import { sharedFakeFirestore as store, sharedFakeFirestoreState as state } from "../../../server/tests/helpers/fake-firestore";
import { TaskBriefReview } from "@/components/site/TaskBriefReview";
import { PublicTaskListing } from "@/components/site/PublicTaskListing";
import { SiteAdvisoryReport } from "@/components/site/SiteAdvisoryReport";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => headers }));
vi.mock("../../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: store, storageAdmin: null,
  default: { firestore: { FieldValue: { serverTimestamp: () => "fixture-time", delete: () => "fixture-delete" } } } }));
vi.mock("../../../server/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("express-rate-limit", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../../../server/middleware/requireAdminRole", () => ({ requireAdminRole: (_req: unknown, res: any, next: () => void) => { res.locals.firebaseUser = { uid: "fixture-reviewer" }; next(); } }));
vi.mock("../../../server/utils/siteMatchRun", () => ({ runSiteMatch: vi.fn(async () => null) }));
vi.mock("../../../server/utils/slack", () => ({ notifySlackScreeningCallNeeded: vi.fn(async () => undefined), sendSlackMessage: vi.fn(async () => ({ sent: false })) }));
vi.mock("../../../server/utils/email", () => ({ sendEmail: vi.fn(() => { throw new Error("No live correspondence permitted in this proof"); }) }));
vi.mock("../../../server/utils/captureOutbox", async original => ({ ...(await original<typeof import("../../../server/utils/captureOutbox")>()), deliverOutbox: vi.fn(async () => ({ sent: 0 })) }));
const participant = vi.hoisted(() => ({ email: "team@example.test" }));
vi.mock("../../../server/middleware/verifyFirebaseToken", () => ({ default: (_req: unknown, res: any, next: () => void) => { res.locals.firebaseUser = { uid: "fixture-team-user", email: participant.email, email_verified: true }; next(); } }));
vi.mock("../../../server/utils/siteAssessmentPublic", async original => {
  const module = await original<typeof import("../../../server/utils/siteAssessmentPublic")>();
  const packet = { schema_version: "site_assessment.v2", sources: [{ source_id: "video:synthetic", kind: "video", content: { duration_seconds: 10,
    evidence: { summary: "Synthetic carton movement", not_observable: ["weight"], observations: [{ category: "motion", finding: "A carton moves onto the pallet", basis: "observed", start_seconds: 1, end_seconds: 3, uncertainty: "Weight is not visible" }] } } }],
    raw_model_assessment: { status: "assessment", job: [{ text: "Untrusted prose must not be shown", basis: "observed", evidence: [{ source_id: "video:synthetic", at_seconds: 2, selector: { kind: "video_observation", observation_index: 0, field_path: null } }] }], objects_motions_conditions_variations: [], operator_success: [], known: [], estimates: [], missing: [], approaches: [], questions: [], next_action: { kind: "measure", action: "Untrusted action", why: { text: "Unknown weight", basis: "unknown", evidence: [] } } } };
  const view = module.projectCurrentSiteAssessmentView(packet, "safe-simulated-assessment", 10);
  return { ...module, loadCurrentSiteAdvisory: vi.fn(async () => view.customerAdvisory),
    loadCurrentSiteAssessmentView: vi.fn(async () => view) };
});
const briefRouter = (await import("../../../server/routes/site-task-brief")).default;
const listingRouter = (await import("../../../server/routes/task-listings")).default;
const teamRouter = (await import("../../../server/routes/site-worlds")).default;
const adminRouter = (await import("../../../server/routes/admin-robot-teams")).default;
const { draftBrief, saveBrief, confirmBrief } = await import("../../../server/utils/siteTaskBrief");
const { createCaptureUploadToken } = await import("../../../server/utils/captureUploadToken");
const { accessRecordId } = await import("../../../server/utils/robotTeamEarlyAccess");
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("joins the existing job, bounded review, team interest and Blueprint's reviewed decision", async () => {
  state.docs.clear();
  state.docs.set("inboundRequests/req-1", { requestId: "req-1", contact: { firstName: "Dana", email: "owner@example.test" },
    request: { buyerType: "site_operator", capture_mode: "self_capture", taskStatement: "Move cartons onto a pallet" },
    siteTaskGates: { sceneStability: "stable", taskShape: "single", objectVariety: "under_10" } });
  state.docs.set(`robotTeamAccess/${accessRecordId("team@example.test")}`, { status: "approved", company: "Fixture admitted team" });
  const initial = draftBrief({ requestId: "req-1", summary: "Move cartons onto a pallet", captureMode: "self_capture", proposed: [
    { fieldId: "sceneStability", value: "stable", basis: "observation", reading: "Station position in this clip only", atSeconds: 2, confidence: 0.9 },
  ] });
  await saveBrief(initial);
  const app = express(); app.use(express.json()); app.use("/api/site-task-brief", briefRouter); app.use("/api/task-listings", listingRouter); app.use("/api/admin/robot-teams", adminRouter); app.use("/api/site-worlds", teamRouter);
  const server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`, originalFetch = nodeFetch as unknown as typeof globalThis.fetch;
  const token = createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1", scope: "owner" });
  const request = (path: string, body?: unknown) => originalFetch(`${base}${path}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  vi.stubGlobal("fetch", (path: string, options?: RequestInit) => originalFetch(path.startsWith("/") ? `${base}${path}` : path, options));
  const job = () => state.docs.get("inboundRequests/req-1") as any;
  try {
    const intake = await (await request(`/api/site-task-brief/${token}`)).json();
    expect(intake.brief.requestId).toBe("req-1");
    const review = render(<TaskBriefReview token={token} brief={intake.brief} />);
    expect(screen.queryByText(/could not tell from what you sent/i)).toBeNull();
    expect(screen.queryByLabelText(/would you consider/i)).toBeNull();
    expect(screen.getByText(/confidence 90%/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/successful cycle/i), { target: { value: "Carton reaches pallet intact" } });
    fireEvent.change(screen.getByLabelText(/maximum cycle time/i), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));
    await screen.findByText(/that is confirmed/i);
    expect(job().siteTaskGates.sceneStability).toBe("stable");
    expect(job().workspace_task?.pilotIntent).toBeUndefined();
    expect(job().public_task_listing).toBeUndefined();
    const clarification = await (await request(`/api/site-task-brief/${token}/clarification`)).json();
    expect(clarification.questions.join(" ")).toMatch(/robot evaluation/);
    review.unmount();
    const listing = render(<PublicTaskListing token={token} />);
    const title = await screen.findByLabelText(/describe the job/i);
    expect(title).toHaveValue("Move cartons onto a pallet");
    fireEvent.change(title, { target: { value: "Public customer-edited job title" } });
    fireEvent.click(screen.getByRole("button", { name: /save private draft/i }));
    await screen.findByText(/your card is hidden/i);
    expect(job().public_task_listing.enabled).toBe(false);
    fireEvent.change(screen.getByLabelText(/pilot availability/i), { target: { value: "open" } });
    fireEvent.click(screen.getByLabelText(/show this card/i));
    expect(screen.getByLabelText(/authorized to make them public/i)).toBeRequired();
    fireEvent.click(screen.getByLabelText(/authorized to make them public/i));
    fireEvent.click(screen.getByRole("button", { name: /publish reviewed card/i }));
    await screen.findByText(/Public card saved/i); listing.unmount();
    const draft = await (await request("/api/admin/robot-teams/recommendations/req-1")).json();
    expect(draft.assessment, JSON.stringify(draft)).toBeTruthy();
    expect(draft.assessment).not.toHaveProperty("decisionEvidence");
    const assessment = render(<SiteAdvisoryReport advisory={draft.assessment} />);
    expect(screen.getByText("Your job assessment")).toBeInTheDocument();
    expect(screen.queryByText(/A carton moves onto the pallet/)).toBeNull();
    expect(screen.queryByText(/Untrusted prose/)).toBeNull(); assessment.unmount();
    expect(draft).not.toHaveProperty("recommendation");
    expect(draft.communications.route).toBe("/api/admin/robot-teams/jobs/req-1/communications");
    const decision = { sourceDigest: draft.decisionSourceDigest, recommendation: "Investigate an isolated carton-handling pilot with the admitted team",
      why: "The observed transfer is technically plausible; weight and guarding remain unverified", decisiveUncertainty: "Actual carton weight is not established by the video",
      nextAction: "Blueprint will obtain the team’s scope and written quote before any physical commitment", question: null };
    expect((await request("/api/admin/robot-teams/recommendations/req-1/decision", decision)).status).toBe(200);
    expect((await request("/api/admin/robot-teams/recommendations/req-1/decision", decision)).status).toBe(200);
    expect(job().customer_decision).toMatchObject({ recommendation: decision.recommendation, nextAction: decision.nextAction });
    expect((await (await request("/api/admin/robot-teams/recommendations/req-1")).json()).decision).toMatchObject({ recommendation: decision.recommendation });
    const teamResponse = (body: unknown) => originalFetch(`${base}/api/site-worlds/tasks/req-1/interest`, { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": "fixture-csrf", cookie: "csrf_token=fixture-csrf", authorization: "Bearer fixture" }, body: JSON.stringify(body) });
    const interest = { state: "interested", inputs: "Simulated provider can scope this carton transfer" };
    participant.email = "unadmitted@example.test";
    expect((await teamResponse(interest)).status).toBe(403);
    participant.email = "team@example.test";
    // A team can no longer commit to a recommended pilot; the old state is refused.
    expect((await teamResponse({ ...interest, state: "committed" })).status).toBe(400);
    expect((await teamResponse(interest)).status).toBe(200);
    expect((await teamResponse(interest)).status).toBe(200);
    expect([...state.docs.keys()].filter(key => key.startsWith("inboundRequests/req-1/robotTeamInterest/"))).toHaveLength(1);
    // Material corrections retain the public customer edits, deliberately pausing the card.
    await confirmBrief({ requestId: "req-1", confirmedBy: "Dana", successCriteria: { successDefinition: "Carton reaches pallet intact", successRate: 98, cycleTimeSeconds: 20, unknown: false } });
    expect(job().public_task_listing).toMatchObject({ enabled: false, reviewRequired: true, details: { title: "Public customer-edited job title" } });
    expect(job().pilot_booking).toBeUndefined();
    expect(state.docs.has("inboundRequests/req-2")).toBe(false);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
