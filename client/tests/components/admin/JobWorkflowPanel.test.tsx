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
  return {
    schemaVersion: "job_marketplace.v1", revision: "workflow-1", briefAgreed: true,
    optionsAssessed: false, reviewRequired: false, stage: "brief_agreed",
    nextAction: "Blueprint assesses suitable options.", actionOwner: "blueprint", review: null,
    requirements: { jobFrequency: null, purchaseReadiness: "exploring", requiredOutput: null,
      installationBudget: null, ongoingBudget: null, currentProcessCost: null, targetStartDate: null },
    ...patch,
  };
}

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function open(patch: Partial<JobMarketplaceWorkflow> = {}) {
  fetchMock.mockResolvedValueOnce(json(workflow(patch)));
  const result = render(<JobWorkflowPanel requestId="job-1" currentUser={null} />);
  const details = result.container.querySelector("details")!;
  await act(async () => { details.open = true; fireEvent(details, new Event("toggle")); });
  await screen.findByRole("heading", { name: "Evidence for this job" });
  return result;
}

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("JobWorkflowPanel", () => {
  it("loads job records only when opened and offers no proposal or agreement action", async () => {
    fetchMock.mockResolvedValueOnce(json(workflow()));
    const result = render(<JobWorkflowPanel requestId="job/1" currentUser={null} />);
    expect(fetchMock).not.toHaveBeenCalled();
    const details = result.container.querySelector("details")!;
    await act(async () => { details.open = true; fireEvent(details, new Event("toggle")); });
    expect(await screen.findByRole("heading", { name: "Evidence for this job" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/job-workflow/admin/job%2F1");
    expect(screen.getByText(/These records do not establish a passed evaluation, physical performance or safety/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /proposal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Record pilot agreement" })).not.toBeInTheDocument();
  });

  it("records the options assessment against the loaded job", async () => {
    await open();
    fireEvent.click(screen.getByText("Record the options assessment"));
    fireEvent.change(screen.getByLabelText("Assessment"), { target: { value: "more_information" } });
    fireEvent.change(screen.getByLabelText("Assessment summary"), { target: { value: "Carton weight is not visible in the video." } });
    fireEvent.change(screen.getByLabelText("Next action"), { target: { value: "Ask the site for the carton weight." } });
    fetchMock.mockResolvedValueOnce(json(workflow({ optionsAssessed: true, stage: "options_assessed", review: { disposition: "more_information",
      summary: "Carton weight is not visible in the video.", nextAction: "Ask the site for the carton weight.", reviewedAtIso: "2026-10-21T12:00:00.000Z", scopeRevision: "a".repeat(64) } })));
    fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Options assessment saved.");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/job-workflow/admin/job-1/review");
    expect(init).toMatchObject({ method: "POST", credentials: "include", headers: {
      Authorization: "Bearer token", "X-CSRF-Token": "csrf", "Content-Type": "application/json",
    } });
    expect(JSON.parse(init.body)).toEqual({ disposition: "more_information", summary: "Carton weight is not visible in the video.", nextAction: "Ask the site for the carton weight." });
  });

  it("keeps an uncertain change blocked until records are refreshed", async () => {
    await open();
    fireEvent.click(screen.getByText("Record the options assessment"));
    fireEvent.change(screen.getByLabelText("Assessment summary"), { target: { value: "Options identified." } });
    fireEvent.change(screen.getByLabelText("Next action"), { target: { value: "Blueprint checks delivery." } });
    fetchMock.mockRejectedValueOnce(new Error("connection closed after request"));
    fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Refresh the workflow before trying again.");
    expect(screen.getByRole("button", { name: "Save assessment" })).toBeDisabled();
    fetchMock.mockResolvedValueOnce(json(workflow()));
    fireEvent.click(screen.getByRole("button", { name: "Refresh job records" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save assessment" })).not.toBeDisabled());
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("asks for a new assessment when the job scope changed", async () => {
    await open({ reviewRequired: true });
    expect(screen.getByText(/changed since the options assessment/)).toBeInTheDocument();
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
