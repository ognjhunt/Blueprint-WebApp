// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "csrf" }),
}));
vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string>) => ({ ...headers, Authorization: "Bearer token" }),
}));

import { JobWorkflowPanel } from "@/components/admin/JobWorkflowPanel";
import type { JobMarketplaceWorkflow } from "@/types/jobMarketplace";

const fetchMock = vi.fn();
function workflow(patch: Partial<JobMarketplaceWorkflow> = {}): JobMarketplaceWorkflow {
  return { schemaVersion: "job_marketplace.v1", briefAgreed: true, ...patch };
}

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function open(patch: Partial<JobMarketplaceWorkflow> = {}) {
  fetchMock.mockResolvedValueOnce(json(workflow(patch)));
  // The admin job page mounts the tool only when staff open it; mounted, it reads.
  const result = render(<JobWorkflowPanel requestId="job-1" currentUser={null} />);
  await screen.findByRole("heading", { name: "Evidence for this job" });
  return result;
}

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("JobWorkflowPanel", () => {
  it("loads the job's records when mounted and offers no proposal, agreement or options review", async () => {
    fetchMock.mockResolvedValueOnce(json(workflow()));
    render(<JobWorkflowPanel requestId="job/1" currentUser={null} />);
    expect(await screen.findByRole("heading", { name: "Evidence for this job" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/job-workflow/admin/job%2F1");
    expect(screen.getByText(/These records do not establish a passed evaluation, physical performance or safety/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /proposal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Record pilot agreement" })).not.toBeInTheDocument();
    // Blueprint's written options review was removed (2026-11-19).
    expect(screen.queryByText(/options assessment/i)).not.toBeInTheDocument();
  });

  it("asks no evidence question before the site confirms its brief", async () => {
    await open({ briefAgreed: false });
    expect(screen.getByRole("button", { name: "Ask Pipeline" })).toBeDisabled();
  });

  it("keeps an uncertain change blocked until records are refreshed", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Question that changes the decision"), { target: { value: "Can the arm reach the shelf?" } });
    fetchMock.mockRejectedValueOnce(new Error("connection closed after request"));
    fireEvent.click(screen.getByRole("button", { name: "Ask Pipeline" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Refresh the workflow before trying again.");
    expect(screen.getByRole("button", { name: "Ask Pipeline" })).toBeDisabled();
    fetchMock.mockResolvedValueOnce(json(workflow()));
    fireEvent.click(screen.getByRole("button", { name: "Refresh job records" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask Pipeline" })).not.toBeDisabled());
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });
});

it("operates the scoped evidence question and local execution through existing admin actions", async () => {
  const evidence = { requestId: "question-1", publicationDigest: `sha256:${"e".repeat(64)}`, briefDigest: `sha256:${"b".repeat(64)}`,
    current: true, state: "planned", question: "Can the configured arm reach the target?", summary: "A qualified local method can answer reach only.",
    nextAction: "Run the selected local method.", limitations: ["This does not establish physical success."], runId: null,
    decisionDigest: null, planDigest: `sha256:${"a".repeat(64)}`, testbedDigest: `sha256:${"c".repeat(64)}`, approvedTaskDigest: null, claims: [] };
  await open();
  fireEvent.change(screen.getByLabelText("Question that changes the decision"), { target: { value: evidence.question } });
  fetchMock.mockResolvedValueOnce(json(workflow({ evidence: [evidence] })));
  fireEvent.click(screen.getByRole("button", { name: "Ask Pipeline" }));
  await screen.findByText(/qualified local method can answer/);
  const submitted = fetchMock.mock.calls.find(([path]) => String(path).endsWith("/evidence"))!;
  expect(JSON.parse(submitted[1].body)).toEqual({ question: evidence.question });
  expect(submitted[1].headers["Idempotency-Key"]).toBeTruthy();
  expect(submitted[1].headers.Authorization).toBe("Bearer token");
  expect(submitted[1].headers["X-CSRF-Token"]).toBe("csrf");
  fetchMock.mockResolvedValueOnce(json(workflow({ evidence: [evidence] })));
  fireEvent.click(screen.getByRole("button", { name: "Run permitted local evidence" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith("/evidence/question-1/execute"))).toBe(true));
  await screen.findByText(/Pipeline returned planned/);
  fetchMock.mockResolvedValueOnce(json(workflow({ evidence: [{ ...evidence, state: "abstention", summary: "The method abstained.", nextAction: "Measure target clearance." }] })));
  fireEvent.click(screen.getByRole("button", { name: "Refresh evidence" }));
  await screen.findByText(/The method abstained/);
  expect(screen.queryByRole("button", { name: "Run permitted local evidence" })).not.toBeInTheDocument();
  expect(screen.getByText("This does not establish physical success.")).toBeVisible();
});

it("does not claim cancellation when Pipeline has not acknowledged it", async () => {
  const evidence = { requestId: "question-1", publicationDigest: null, briefDigest: `sha256:${"b".repeat(64)}`,
    current: true, state: "planned", question: "Can the arm reach?", summary: "Plan recorded.", nextAction: "Run the local method.",
    limitations: [], runId: null, decisionDigest: null, planDigest: null, testbedDigest: null, approvedTaskDigest: null, claims: [] };
  await open({ evidence: [evidence] });
  fetchMock.mockResolvedValueOnce(json(workflow({ evidence: [{ ...evidence, serviceMessage: "Pipeline could not accept this action." }] })));
  fireEvent.click(screen.getByRole("button", { name: "Cancel evidence request" }));
  expect(await screen.findByText(/Cancellation was not confirmed/)).toBeVisible();
  expect(screen.queryByText("Evidence request cancelled.")).not.toBeInTheDocument();
});

it("keeps the operator's instruction in the operations view only", async () => {
  await open({ managedEvidence: [{ runId: "setup-repair", state: "blocked", current: true,
    resultDigest: null, summary: "Policy run status: blocked. No accepted scientific result is attached.",
    nextAction: "Nothing is needed from you.",
    opsNextAction: "Fix the setup blockers, then rerun. Nothing is needed from the site.",
    limitations: [], href: "#managed-evidence-setup-repair" }] });
  expect(screen.getByText("Next: Fix the setup blockers, then rerun. Nothing is needed from the site.")).toBeInTheDocument();
  expect(screen.queryByText("Next: Nothing is needed from you.")).toBeNull();
});
