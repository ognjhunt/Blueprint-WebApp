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
import type { DeliveryProposal, JobMarketplaceWorkflow } from "@/types/jobMarketplace";

const fetchMock = vi.fn();
const proposal: DeliveryProposal = {
  id: "proposal-1", revision: "revision-1", briefRevision: "brief-1", status: "available",
  providerName: "Example Delivery", scope: "Move the specified cases between the tote and tray.",
  equipment: "Fixed arm, parallel gripper and fixed cameras.", software: "Pinned policy and local controller.",
  deliveryCommitment: "Install and support one supervised pilot.", installationCostUsd: 12000,
  monthlyCostUsd: 500, currency: "USD", exclusions: "Customer-provided utilities.",
  sitePreparation: "Clear bench and supply power.", humanAssistance: "Operator replenishes the tote.",
  timing: "Dates agreed after site survey.", support: "Provider technician during pilot operating hours.",
  evidence: [{ level: "simulation", summary: "Simulation report supplied by the provider; physical trial pending." }],
  acceptanceCriteria: "Meet the agreed placement quality and cycle time.", recommendationReason: null,
  createdAtIso: "2026-10-21T10:00:00.000Z", updatedAtIso: "2026-10-21T10:00:00.000Z",
};

function workflow(patch: Partial<JobMarketplaceWorkflow> = {}): JobMarketplaceWorkflow {
  return {
    schemaVersion: "job_marketplace.v1", revision: "workflow-1", briefAgreed: true,
    optionsAssessed: false, reviewRequired: false, stage: "brief_agreed",
    nextAction: "Blueprint assesses suitable options.", actionOwner: "blueprint", review: null,
    requirements: { jobFrequency: null, purchaseReadiness: "exploring", requiredOutput: null,
      installationBudget: null, ongoingBudget: null, currentProcessCost: null, targetStartDate: null },
    proposals: [], selection: null, agreement: null, outcome: null,
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
  await screen.findByRole("heading", { name: "Delivery proposals" });
  return result;
}

const formLabels = {
  providerName: "Delivery company", scope: "Job scope", deliveryCommitment: "Delivery commitment",
  equipment: "Equipment", software: "Software and inference", sitePreparation: "Site preparation",
  humanAssistance: "Human assistance", timing: "Delivery timing", support: "Support commitments",
  exclusions: "Exclusions and remaining costs", acceptanceCriteria: "Pilot acceptance criteria",
} as const;

function completeProposal() {
  for (const [key, label] of Object.entries(formLabels)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: proposal[key as keyof typeof formLabels] } });
  }
  fireEvent.change(screen.getByLabelText("Monthly cost (USD, optional)"), { target: { value: "500" } });
  fireEvent.change(screen.getByLabelText("Evidence summary 1"), { target: { value: "The provider's proposal requires a physical pilot before any performance claim." } });
}

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("JobWorkflowPanel", () => {
  it("loads commercial records only when opened and keeps them distinct from evaluated proof", async () => {
    fetchMock.mockResolvedValueOnce(json(workflow()));
    const result = render(<JobWorkflowPanel requestId="job/1" currentUser={null} />);
    expect(fetchMock).not.toHaveBeenCalled();
    const details = result.container.querySelector("details")!;
    await act(async () => { details.open = true; fireEvent(details, new Event("toggle")); });
    expect(await screen.findByText(/No delivery proposals have been recorded/)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/job-workflow/admin/job%2F1");
    expect(screen.getByText(/These commercial records do not establish a passed evaluation, physical performance or safety/)).toBeInTheDocument();
    expect(screen.getByText(/The customer must choose an available proposal/)).toBeInTheDocument();
  });

  it("saves a real scoped proposal with missing prices represented as unknown rather than zero", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Add delivery proposal" }));
    completeProposal();
    fetchMock.mockResolvedValueOnce(json(workflow({ proposals: [{ ...proposal, installationCostUsd: null }] })));
    fireEvent.click(screen.getByRole("button", { name: "Save proposal" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Delivery proposal saved and available to the customer.");
    expect(screen.getByText("Example Delivery")).toBeInTheDocument();
    expect(screen.getByText("Installation: Not quoted · Monthly: $500.00")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/job-workflow/admin/job-1/proposals");
    expect(init).toMatchObject({ method: "POST", credentials: "include", headers: {
      Authorization: "Bearer token", "X-CSRF-Token": "csrf", "Content-Type": "application/json",
    } });
    expect(JSON.parse(init.body)).toMatchObject({ providerName: "Example Delivery", installationCostUsd: null,
      monthlyCostUsd: 500, currency: "USD", evidence: [{ level: "unverified" }], recommendationReason: null });
    expect(JSON.parse(init.body)).not.toHaveProperty("id");
  });

  it("keeps an uncertain creation blocked until records are refreshed, without discarding the entered proposal", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Add delivery proposal" }));
    completeProposal();
    fetchMock.mockRejectedValueOnce(new Error("connection closed after request"));
    fireEvent.click(screen.getByRole("button", { name: "Save proposal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Refresh the workflow before trying again.");
    expect(screen.getByRole("button", { name: "Save proposal" })).toBeDisabled();
    expect(screen.getByLabelText("Delivery company")).toHaveValue("Example Delivery");
    fetchMock.mockResolvedValueOnce(json(workflow({ proposals: [proposal] })));
    fireEvent.click(screen.getByRole("button", { name: "Refresh delivery records" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save proposal" })).not.toBeDisabled());
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    const originalKey = fetchMock.mock.calls[1][1].headers["Idempotency-Key"];
    expect(originalKey).toMatch(/^[a-f0-9-]{36}$/);
    fetchMock.mockResolvedValueOnce(json(workflow({ proposals: [proposal] })));
    fireEvent.click(screen.getByRole("button", { name: "Save proposal" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Delivery proposal saved");
    expect(fetchMock.mock.calls[3][1].headers["Idempotency-Key"]).toBe(originalKey);
  });

  it("binds edits to the exact quoted revision and leaves the form intact on a conflict", async () => {
    await open({ proposals: [proposal] });
    fireEvent.click(screen.getByRole("button", { name: "Edit proposal" }));
    expect(screen.getByLabelText("Delivery company")).toHaveValue("Example Delivery");
    fireEvent.change(screen.getByLabelText("Support commitments"), { target: { value: "Updated service window." } });
    fetchMock.mockResolvedValueOnce(json({ error: "The proposal changed. Refresh before editing." }, 409));
    fireEvent.click(screen.getByRole("button", { name: "Save proposal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The proposal changed.");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/job-workflow/admin/job-1/proposals/proposal-1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toMatchObject({ expectedRevision: "revision-1", support: "Updated service window." });
    expect(screen.getByLabelText("Support commitments")).toHaveValue("Updated service window.");
  });

  it("locks the customer-chosen version and records both agreement references only after explicit confirmation", async () => {
    const selection = { proposalId: proposal.id, proposalRevision: proposal.revision, selectedAtIso: "2026-10-21T11:00:00.000Z" };
    await open({ proposals: [proposal], selection });
    expect(screen.getByRole("button", { name: "Edit proposal" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Withdraw proposal" })).toBeDisabled();
    const button = screen.getByRole("button", { name: "Record pilot agreement" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Agreement date and time (your local time)"), { target: { value: "2026-10-21T12:30" } });
    fireEvent.change(screen.getByLabelText("Site agreement reference"), { target: { value: "customer-signed-scope-v1" } });
    fireEvent.change(screen.getByLabelText("Provider agreement reference"), { target: { value: "provider-signed-quote-v1" } });
    fireEvent.click(screen.getByLabelText(/I have recorded evidence that the site and delivery company agreed/));
    fetchMock.mockResolvedValueOnce(json(workflow({ proposals: [proposal], selection, agreement: {
      proposalId: proposal.id, proposalRevision: proposal.revision, agreedAtIso: "2026-10-21T12:30:00.000Z",
      plannedStartIso: null, siteAgreementReference: "customer-signed-scope-v1", providerAgreementReference: "provider-signed-quote-v1",
      outcomeRecordingAuthorized: false, outcomeRecordingPermissionReference: null,
      recordedAtIso: "2026-10-21T12:31:00.000Z",
    } })));
    fireEvent.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent("Pilot agreement recorded. This does not record a physical result.");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/job-workflow/admin/job-1/agreement");
    expect(JSON.parse(init.body)).toEqual({ proposalId: "proposal-1", expectedRevision: "revision-1",
      agreedAtIso: new Date("2026-10-21T12:30").toISOString(), plannedStartIso: null,
      siteAgreementReference: "customer-signed-scope-v1", providerAgreementReference: "provider-signed-quote-v1",
      outcomeRecordingAuthorized: false, outcomeRecordingPermissionReference: null });
  });

  it("requires another brief review instead of letting stale proposals become pilot agreements", async () => {
    await open({ reviewRequired: true, proposals: [{ ...proposal, status: "review_required" }],
      selection: { proposalId: proposal.id, proposalRevision: proposal.revision, selectedAtIso: "2026-10-21T11:00:00.000Z" } });
    expect(screen.getByText(/The job brief or buying requirements changed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and update proposal" })).toBeEnabled();
    expect(screen.queryByRole("form", { name: "Record pilot agreement" })).not.toBeInTheDocument();
    expect(screen.getByText(/The customer must choose an available proposal for the current job brief/)).toBeInTheDocument();
  });

  it("requires a written permission reference before enabling outcome recording for both parties", async () => {
    const selection = { proposalId: proposal.id, proposalRevision: proposal.revision, selectedAtIso: "2026-10-21T11:00:00.000Z" };
    await open({ proposals: [proposal], selection });
    fireEvent.change(screen.getByLabelText("Agreement date and time (your local time)"), { target: { value: "2026-10-21T12:30" } });
    fireEvent.change(screen.getByLabelText("Site agreement reference"), { target: { value: "site-scope" } });
    fireEvent.change(screen.getByLabelText("Provider agreement reference"), { target: { value: "provider-quote" } });
    fireEvent.click(screen.getByLabelText(/I have recorded evidence that the site and delivery company agreed/));
    fireEvent.click(screen.getByLabelText(/Both parties have authorized Blueprint to record pilot outcomes/));
    fireEvent.submit(screen.getByRole("form", { name: "Record pilot agreement" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Record the written permission covering both parties");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Written outcome-recording permission reference"), { target: { value: "joint-permission-scoped-metrics-v1" } });
    fetchMock.mockResolvedValueOnce(json(workflow({ proposals: [proposal], selection, agreement: {
      proposalId: proposal.id, proposalRevision: proposal.revision, agreedAtIso: "2026-10-21T12:30:00.000Z", plannedStartIso: null,
      siteAgreementReference: "site-scope", providerAgreementReference: "provider-quote", recordedAtIso: "2026-10-21T12:31:00.000Z",
      outcomeRecordingAuthorized: true, outcomeRecordingPermissionReference: "joint-permission-scoped-metrics-v1",
    } })));
    fireEvent.click(screen.getByRole("button", { name: "Record pilot agreement" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Pilot agreement recorded");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ outcomeRecordingAuthorized: true,
      outcomeRecordingPermissionReference: "joint-permission-scoped-metrics-v1" });
    expect(screen.getByText(/Outcome recording is permitted under joint-permission-scoped-metrics-v1/)).toBeInTheDocument();
  });

  it("requires a separate withdrawal confirmation and preserves the proposal history", async () => {
    await open({ proposals: [proposal] });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw proposal" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(json(workflow({ proposals: [{ ...proposal, status: "withdrawn" }] })));
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Proposal withdrawn.");
    expect(screen.getByText("Example Delivery")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit proposal" })).toBeDisabled();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/job-workflow/admin/job-1/proposals/proposal-1/withdraw");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ expectedRevision: "revision-1" });
  });
});
