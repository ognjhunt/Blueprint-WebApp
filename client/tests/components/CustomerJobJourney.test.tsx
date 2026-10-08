// @vitest-environment jsdom
// One joined software proof, using the existing req-1 intake fixture pattern.
// Video analysis and Calendar are safe fixtures; this never books a physical pilot.
import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import express from "express";
import nodeFetch from "node-fetch";
import { createServer } from "node:http";
import { sharedFakeFirestore as store, sharedFakeFirestoreState as state } from "../../../server/tests/helpers/fake-firestore";
import { TaskBriefReview } from "@/components/site/TaskBriefReview";
import { PublicTaskListing } from "@/components/site/PublicTaskListing";
import { RecommendedPilot } from "@/components/site/RecommendedPilot";
import { SiteAdvisoryReport } from "@/components/site/SiteAdvisoryReport";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => headers }));
vi.mock("../../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: store, storageAdmin: null,
  default: { firestore: { FieldValue: { serverTimestamp: () => "fixture-time", delete: () => "fixture-delete" } } } }));
vi.mock("../../../server/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("express-rate-limit", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../../../server/middleware/requireAdminRole", () => ({ requireAdminRole: (_req: unknown, res: any, next: () => void) => { res.locals.firebaseUser = { uid: "fixture-reviewer" }; next(); } }));
vi.mock("../../../server/utils/siteMatchRun", () => ({ runSiteMatch: vi.fn(async () => null) }));
vi.mock("../../../server/utils/slack", () => ({ notifySlackScreeningCallNeeded: vi.fn(async () => undefined) }));
vi.mock("../../../server/utils/email", () => ({ sendEmail: vi.fn(() => { throw new Error("No live correspondence permitted in this proof"); }) }));
vi.mock("../../../server/utils/captureOutbox", async original => ({ ...(await original<typeof import("../../../server/utils/captureOutbox")>()), deliverOutbox: vi.fn(async () => ({ sent: 0 })) }));
const participant = vi.hoisted(() => ({ email: "team@example.test" }));
vi.mock("../../../server/middleware/verifyFirebaseToken", () => ({ default: (_req: unknown, res: any, next: () => void) => { res.locals.firebaseUser = { uid: "fixture-team-user", email: participant.email, email_verified: true }; next(); } }));
const calendar = vi.hoisted(() => vi.fn(async () => ({ calendarEventId: "fixture_calendar", calendarId: "simulated", startsAt: "2026-11-10T15:00:00Z", endsAt: "2026-11-10T17:00:00Z" })));
vi.mock("../../../server/utils/google-calendar", () => ({ readPilotCalendarEvent: calendar }));
vi.mock("../../../server/utils/siteAssessmentPublic", async original => {
  const module = await original<typeof import("../../../server/utils/siteAssessmentPublic")>();
  const packet = { schema_version: "site_assessment.v2", sources: [{ source_id: "video:synthetic", kind: "video", content: { duration_seconds: 10,
    evidence: { summary: "Synthetic carton movement", not_observable: ["weight"], observations: [{ category: "motion", finding: "A carton moves onto the pallet", basis: "observed", start_seconds: 1, end_seconds: 3, uncertainty: "Weight is not visible" }] } } }],
    raw_model_assessment: { status: "assessment", job: [{ text: "Untrusted prose must not be shown", basis: "observed", evidence: [{ source_id: "video:synthetic", at_seconds: 2, selector: { kind: "video_observation", observation_index: 0, field_path: null } }] }], objects_motions_conditions_variations: [], operator_success: [], known: [], estimates: [], missing: [], approaches: [], questions: [], next_action: { kind: "measure", action: "Untrusted action", why: { text: "Unknown weight", basis: "unknown", evidence: [] } } } };
  return { ...module, loadCurrentSiteAdvisory: vi.fn(async () => module.projectCustomerSiteAdvisory(packet, "safe-simulated-assessment", 10)) };
});
const briefRouter = (await import("../../../server/routes/site-task-brief")).default;
const listingRouter = (await import("../../../server/routes/task-listings")).default;
const teamRouter = (await import("../../../server/routes/site-worlds")).default;
const adminRouter = (await import("../../../server/routes/admin-robot-teams")).default;
const { draftBrief, saveBrief, confirmBrief } = await import("../../../server/utils/siteTaskBrief");
const { createCaptureUploadToken } = await import("../../../server/utils/captureUploadToken");
const { accessRecordId } = await import("../../../server/utils/robotTeamEarlyAccess");
const { humanDecisionDigest } = await import("../../../server/utils/human-reply-admission");
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("joins the existing job, bounded review, proposal acceptance and evidence-gated simulated scheduling", async () => {
  state.docs.clear(); calendar.mockClear();
  state.docs.set("inboundRequests/req-1", { requestId: "req-1", contact: { firstName: "Dana", email: "owner@example.test" },
    request: { buyerType: "site_operator", capture_mode: "self_capture", taskStatement: "Move cartons onto a pallet" },
    siteTaskGates: { sceneStability: "stable", taskShape: "single", objectVariety: "under_10" } });
  state.docs.set("robotTeams/fixture-team", { id: "fixture-team", name: "Fixture admitted team", status: "engaged", contactEmail: "team@example.test" });
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
  const notices = (kind: string) => [...state.docs.values()].filter(row => row.kind === kind);
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
    const assessment = render(<SiteAdvisoryReport advisory={draft.assessment} />);
    expect(screen.getByText(/A carton moves onto the pallet/)).toBeInTheDocument();
    expect(screen.queryByText(/Untrusted prose/)).toBeNull(); assessment.unmount();
    expect(draft.sources.successCondition).toMatch(/siteTaskBriefs\/req-1/);
    expect(draft.teams).toHaveLength(1);
    expect(draft.dependency).toMatch(/communications agent/);
    const plan = { ...draft.draft, teamId: "fixture-team", briefRevision: draft.briefRevision,
      siteProvides: "Escort and isolated station", teamProvides: "Robot, operator and setup", pilotCost: "Fixture quote $18,000", costBasis: "Simulated quote, not an authorized purchase", window: "November, provisional",
      sitePreparation: "Site isolates the station; team reviews guarding", humanWork: "Named escort and robot operator", capabilityBasis: "Hypothesis from admitted team's supplied capability; untested here", providerCommitment: "Not yet committed" };
    const proposal = await (await request("/api/admin/robot-teams/recommendations/req-1", plan)).json();
    expect(proposal.ok).toBe(true);
    expect((await (await request("/api/admin/robot-teams/recommendations/req-1", plan)).json()).id).toBe(proposal.id);
    expect(notices("pilot_recommended")).toHaveLength(1);
    const teamResponse = (body: unknown) => originalFetch(`${base}/api/site-worlds/tasks/req-1/interest`, { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": "fixture-csrf", cookie: "csrf_token=fixture-csrf", authorization: "Bearer fixture" }, body: JSON.stringify(body) });
    const commitment = { state: "committed", inputs: "Simulated provider confirms quoted scope; date still subject to site agreement", recommendationId: proposal.id, authorized: true };
    participant.email = "unadmitted@example.test";
    expect((await teamResponse(commitment)).status).toBe(403);
    participant.email = "other@example.test";
    state.docs.set(`robotTeamAccess/${accessRecordId(participant.email)}`, { status: "approved", company: "Other team" });
    expect((await teamResponse(commitment)).status).toBe(409);
    participant.email = "team@example.test";
    expect((await teamResponse({ ...commitment, authorized: false })).status).toBe(400);
    expect((await teamResponse({ ...commitment, recommendationId: "obsolete" })).status).toBe(409);
    expect((await teamResponse(commitment)).status).toBe(200);
    expect((await teamResponse(commitment)).status).toBe(200);
    expect([...state.docs.keys()].filter(key => key.startsWith("inboundRequests/req-1/robotTeamInterest/"))).toHaveLength(1);
    expect(job().pilot_booking).toBeUndefined();
    const pilot = render(<RecommendedPilot token={token} />);
    fireEvent.click(await screen.findByLabelText(/authorized to accept/i));
    fireEvent.click(screen.getByRole("button", { name: /Accept proposal/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/awaiting coordination/);
    const acceptance = { recommendationId: proposal.id, authorized: true };
    expect((await request(`/api/task-listings/owner/${token}/book`, acceptance)).status).toBe(200);
    expect(notices("pilot_booked")).toHaveLength(1);
    expect(notices("pilot_booked")[0].body).toMatch(/No date is reserved/);
    expect(job().pilot_booking.bookedAtIso).toBeUndefined();
    pilot.unmount();
    // Material corrections retain the public customer edits and accepted commercial record, deliberately pausing dependent grants.
    const accepted = { ...job().pilot_booking };
    await confirmBrief({ requestId: "req-1", confirmedBy: "Dana", successCriteria: { successDefinition: "Carton reaches pallet intact", successRate: 98, cycleTimeSeconds: 20, unknown: false } });
    expect(job().public_task_listing).toMatchObject({ enabled: false, reviewRequired: true, details: { title: "Public customer-edited job title" } });
    expect(job().pilot_booking).toEqual(accepted);
    const latestBrief = state.docs.get("siteTaskBriefs/req-1");
    const evidence = { providerAgreement: { agreedBy: "Fixture provider representative", evidenceRef: "https://example.test/simulated-provider-agreement" }, siteAgreement: { agreedBy: "Fixture site representative", evidenceRef: "https://example.test/simulated-site-agreement" } };
    const coordinate = { recommendationId: proposal.id, calendarEventId: "fixture_calendar", ...evidence, sitePreparation: "Site isolates station; team provides robot operator and verifies guarding", verifiedAgreements: true };
    expect((await request("/api/admin/robot-teams/recommendations/req-1/coordination", coordinate)).status).toBe(409);
    expect((await request("/api/admin/robot-teams/recommendations/req-1/reconcile", { recommendationId: proposal.id, briefRevision: humanDecisionDigest(latestBrief), ...evidence, verifiedUnchangedScope: true })).status).toBe(200);
    expect((await request("/api/admin/robot-teams/recommendations/req-1/coordination", { ...coordinate, verifiedAgreements: false })).status).toBe(400);
    const scheduled = await request("/api/admin/robot-teams/recommendations/req-1/coordination", coordinate);
    expect(scheduled.status).toBe(200);
    expect((await scheduled.json()).coordination.state).toBe("scheduled");
    expect((await request("/api/admin/robot-teams/recommendations/req-1/coordination", coordinate)).status).toBe(200);
    expect(notices("pilot_scheduled")).toHaveLength(1);
    const scheduledView = render(<RecommendedPilot token={token} />);
    expect(await screen.findByRole("status")).toHaveTextContent(/Scheduled:/);
    expect(screen.getByRole("status")).toHaveTextContent(/Site isolates station/);
    scheduledView.unmount();
    const retry = await (await request(`/api/task-listings/owner/${token}/book`, acceptance)).json();
    expect(retry.coordination.state).toBe("scheduled");
    expect(job().pilot_booking.amountUsd).toBe(accepted.amountUsd);
    expect(state.docs.has("inboundRequests/req-2")).toBe(false);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
