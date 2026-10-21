import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobWorkspace } from "@/components/site/JobWorkspace";
import type { DeliveryProposal, JobMarketplaceWorkflow } from "@/types/jobMarketplace";

vi.mock("@/components/site/RecommendedPilot", () => ({ RecommendedPilot: () => null }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
const proposal: DeliveryProposal = {
  id: "proposal-1", revision: "revision-1", briefRevision: "brief-1", status: "available", providerName: "Example Delivery",
  scope: "Move sealed cases from a tote into trays", equipment: "Fixed arm and parallel gripper", software: "Pinned policy and local controller",
  deliveryCommitment: "Install and commission the scoped cell", installationCostUsd: 24000, monthlyCostUsd: 0, currency: "USD",
  exclusions: "Conveyor changes excluded", sitePreparation: "Provide power and an approved work area", humanAssistance: "Refill supply totes",
  timing: "Dates to be agreed", support: "Weekday response under the provider agreement", evidence: [{ level: "simulation", summary: "Tested on bounded case positions" }],
  acceptanceCriteria: "Meet the agreed throughput and placement quality during the pilot", recommendationReason: "Compatible with the required payload and site layout",
  createdAtIso: "2026-10-21T12:00:00Z", updatedAtIso: "2026-10-21T12:00:00Z",
};
function workflow(overrides: Partial<JobMarketplaceWorkflow> = {}): JobMarketplaceWorkflow {
  return {
    schemaVersion: "job_marketplace.v1", revision: "workflow-1", requirements: { jobFrequency: null, purchaseReadiness: "unsure", requiredOutput: null,
      installationBudget: null, ongoingBudget: null, currentProcessCost: null, targetStartDate: null },
    briefAgreed: false, optionsAssessed: false, reviewRequired: false, stage: "job_submitted", nextAction: "Blueprint will prepare a brief for you to review.", actionOwner: "blueprint",
    review: null, proposals: [], selection: null, agreement: null, outcome: null, ...overrides,
  };
}
const response = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

describe("the site's job workspace", () => {
  it("shows recorded milestones and an honest empty proposal state", async () => {
    fetchMock.mockResolvedValue(response(workflow()));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByRole("heading", { name: "Your job, step by step" })).toBeVisible();
    const milestones = screen.getByRole("list", { name: "Job milestones" });
    expect(within(milestones).getAllByRole("listitem")).toHaveLength(6);
    expect(within(milestones).getByText("Job submitted").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(milestones).getByText("Pilot agreed").closest("li")).not.toHaveAttribute("data-complete", "true");
    expect(screen.getByText(/No delivery proposal is ready/)).toBeVisible();
    expect(screen.getByText("Blueprint will prepare a brief for you to review.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith("/api/job-workflow/owner/owner-token", expect.objectContaining({ cache: "no-store", referrerPolicy: "no-referrer" }));
  });

  it("requires an authorized, revision-bound choice and keeps selection separate from agreement", async () => {
    const current = workflow({ stage: "proposals_ready", briefAgreed: true, optionsAssessed: true, proposals: [proposal] });
    const selected = workflow({ ...current, revision: "workflow-2", selection: { proposalId: proposal.id, proposalRevision: proposal.revision, selectedAtIso: "2026-10-21T12:01:00Z" }, actionOwner: "deployment_partner", nextAction: "Agree the pilot scope and terms." });
    fetchMock.mockResolvedValueOnce(response(current)).mockResolvedValueOnce(response(selected));
    render(<JobWorkspace token="owner-token" />);
    const card = await screen.findByRole("article", { name: "Example Delivery delivery proposal" });
    expect(within(card).getByText("$24,000")).toBeVisible();
    expect(within(card).getByText("$0")).toBeVisible();
    const button = within(card).getByRole("button", { name: "Choose this proposal" });
    expect(button).toBeDisabled();
    fireEvent.submit(button.closest("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(within(card).getByRole("checkbox"));
    fireEvent.click(button);
    expect(await screen.findByRole("heading", { name: "Your choice is recorded" })).toBeVisible();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/job-workflow/owner/owner-token/select");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ proposalId: "proposal-1", expectedRevision: "revision-1", authorized: true });
    expect(screen.queryByRole("heading", { name: "Pilot agreement recorded" })).toBeNull();
    expect(screen.queryByText("Record your pilot outcome")).toBeNull();
    expect(screen.getByText(/A proposal selection alone is not an agreement/)).toBeVisible();
  });

  it("retains evidence limits, required support and exclusions for inspection", async () => {
    fetchMock.mockResolvedValue(response(workflow({ stage: "proposals_ready", proposals: [proposal] })));
    render(<JobWorkspace token="owner-token" />);
    const card = await screen.findByRole("article");
    fireEvent.click(within(card).getByText("Review scope, evidence and support"));
    expect(within(card).getByText("Fixed arm and parallel gripper")).toBeInTheDocument();
    expect(within(card).getByText("Pinned policy and local controller")).toBeInTheDocument();
    expect(within(card).getByText("Refill supply totes")).toBeInTheDocument();
    expect(within(card).getByText("Conveyor changes excluded")).toBeInTheDocument();
    expect(within(card).getByText(/does not establish performance at your site/)).toBeInTheDocument();
  });

  it("preserves cents in provider quotes", async () => {
    fetchMock.mockResolvedValue(response(workflow({ proposals: [{ ...proposal, installationCostUsd: 24000.45, monthlyCostUsd: 499.99 }] })));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByText("$24,000.45")).toBeVisible();
    expect(screen.getByText("$499.99")).toBeVisible();
  });

  it("keeps an agreed historical pilot reportable while requiring review before another choice", async () => {
    fetchMock.mockResolvedValue(response(workflow({ stage: "options_assessed", reviewRequired: true,
      proposals: [{ ...proposal, status: "review_required" }], selection: { proposalId: proposal.id, proposalRevision: proposal.revision, selectedAtIso: "2026-10-21T12:01:00Z" },
      agreement: { proposalId: proposal.id, proposalRevision: proposal.revision, agreedAtIso: "2026-10-21T12:02:00Z", plannedStartIso: null, siteAgreementReference: "site-confirmed", providerAgreementReference: "provider-confirmed", outcomeRecordingAuthorized: true, outcomeRecordingPermissionReference: "both-parties-permission", recordedAtIso: "2026-10-21T12:02:00Z" },
    })));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByText(/must review this proposal against the current brief/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Choose this proposal" })).toBeNull();
    expect(screen.getByText("Record your pilot outcome")).toBeVisible();
    expect(screen.getByText(/Report against the originally agreed proposal/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your previous choice needs review" })).toBeVisible();
  });

  it("keeps a current proposal selectable when an unselected alternative needs review", async () => {
    fetchMock.mockResolvedValue(response(workflow({ stage: "proposals_ready", reviewRequired: true,
      proposals: [proposal, { ...proposal, id: "old-alternative", providerName: "Previous alternative", status: "review_required" }],
    })));
    render(<JobWorkspace token="owner-token" />);
    const current = await screen.findByRole("article", { name: "Example Delivery delivery proposal" });
    fireEvent.click(within(current).getByRole("checkbox"));
    expect(within(current).getByRole("button", { name: "Choose this proposal" })).not.toBeDisabled();
    expect(within(screen.getByRole("article", { name: "Previous alternative delivery proposal" })).queryByRole("button", { name: "Choose this proposal" })).toBeNull();
  });

  it("saves optional planning details without requiring a budget", async () => {
    const current = workflow();
    fetchMock.mockResolvedValueOnce(response(current)).mockResolvedValueOnce(response(workflow({ requirements: { ...current.requirements, requiredOutput: "Cases sit flat in their assigned pockets", purchaseReadiness: "exploring" } })));
    render(<JobWorkspace token="owner-token" />);
    fireEvent.click(await screen.findByText("Planning details"));
    fireEvent.change(screen.getByLabelText("Required output and quality"), { target: { value: "Cases sit flat in their assigned pockets" } });
    fireEvent.change(screen.getByLabelText("Where are you in the buying process?"), { target: { value: "exploring" } });
    fireEvent.click(screen.getByRole("button", { name: "Save planning details" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Planning details saved/);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ requiredOutput: "Cases sit flat in their assigned pockets", purchaseReadiness: "exploring", installationBudget: null, ongoingBudget: null });
  });

  it("records a site-reported outcome only after the exact pilot agreement", async () => {
    const agreed = workflow({ proposals: [proposal], stage: "pilot_agreed", briefAgreed: true, optionsAssessed: true,
      selection: { proposalId: proposal.id, proposalRevision: proposal.revision, selectedAtIso: "2026-10-21T12:01:00Z" },
      agreement: { proposalId: proposal.id, proposalRevision: proposal.revision, agreedAtIso: "2026-10-21T12:02:00Z", plannedStartIso: null, siteAgreementReference: "site-confirmed", providerAgreementReference: "provider-confirmed", outcomeRecordingAuthorized: true, outcomeRecordingPermissionReference: "both-parties-permission", recordedAtIso: "2026-10-21T12:02:00Z" },
    });
    fetchMock.mockResolvedValueOnce(response(agreed)).mockResolvedValueOnce(response(workflow({ ...agreed, stage: "results_recorded", outcome: { proposalId: proposal.id, proposalRevision: proposal.revision,
      summary: "The measured pilot met our placement criteria", metCriteria: true, measuredUnitsPerHour: 140, interventionsPerHour: 0,
      notes: null, recordedAtIso: "2026-10-21T13:00:00Z", source: "customer_reported" } })));
    render(<JobWorkspace token="owner-token" />);
    fireEvent.click(await screen.findByText("Record your pilot outcome"));
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "The measured pilot met our placement criteria" } });
    fireEvent.change(screen.getByLabelText("Were the agreed criteria met?"), { target: { value: "yes" } });
    fireEvent.change(screen.getByLabelText("Completed units per hour (optional)"), { target: { value: "140" } });
    fireEvent.change(screen.getByLabelText("Human interventions per hour (optional)"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /authorized to record/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save pilot outcome" }));
    expect(await screen.findByRole("heading", { name: "Outcome reported by your site" })).toBeVisible();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ proposalId: proposal.id, expectedRevision: proposal.revision, metCriteria: true, measuredUnitsPerHour: 140, interventionsPerHour: 0, authorized: true });
    expect(screen.getByText(/does not change evaluation scores or establish independent physical validation/)).toBeVisible();
  });

  it("requires recorded outcome permission and preserves agreed planning details", async () => {
    fetchMock.mockResolvedValue(response(workflow({ proposals: [proposal], stage: "pilot_agreed",
      selection: { proposalId: proposal.id, proposalRevision: proposal.revision, selectedAtIso: "2026-10-21T12:01:00Z" },
      agreement: { proposalId: proposal.id, proposalRevision: proposal.revision, agreedAtIso: "2026-10-21T12:02:00Z", plannedStartIso: null,
        siteAgreementReference: "site-confirmed", providerAgreementReference: "provider-confirmed", outcomeRecordingAuthorized: false, outcomeRecordingPermissionReference: null, recordedAtIso: "2026-10-21T12:02:00Z" },
    })));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByText(/confirm both parties’ permission before recording pilot results/)).toBeVisible();
    expect(screen.queryByText("Record your pilot outcome")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save planning details" })).toBeNull();
    expect(screen.getByText("Planning details for the agreed pilot")).toBeVisible();
  });

  it("shows a no-suitable-option decision instead of inventing a supplier", async () => {
    fetchMock.mockResolvedValue(response(workflow({ optionsAssessed: true, stage: "options_assessed", review: { disposition: "no_suitable_option", summary: "No supported setup meets the payload requirement.", nextAction: "Review the handling method with Blueprint.", reviewedAtIso: "2026-10-21T12:00:00Z" } })));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByRole("heading", { name: "No suitable option yet" })).toBeVisible();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("does not carry private proposals between owner links", async () => {
    let resolveSecond!: (value: unknown) => void;
    fetchMock.mockResolvedValueOnce(response(workflow({ proposals: [proposal] }))).mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
    const { rerender } = render(<JobWorkspace token="first" />);
    await screen.findByText("Example Delivery");
    rerender(<JobWorkspace token="second" />);
    expect(screen.queryByText("Example Delivery")).toBeNull();
    resolveSecond(response(workflow()));
    await screen.findByRole("heading", { name: "Your job, step by step" });
    expect(screen.queryByText("Example Delivery")).toBeNull();
  });

  it("refuses malformed success responses and offers a retry", async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: true })).mockResolvedValueOnce(response(workflow()));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/Job planning could not be loaded/);
    fireEvent.click(screen.getByRole("button", { name: "Try loading job planning again" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your job, step by step" })).toBeVisible());
  });
});

it("shows exact abstention limits without advancing a job or selecting a proposal", async () => {
  fetchMock.mockResolvedValue(response(workflow({ briefAgreed: true, stage: "brief_agreed", evidence: [{
    requestId: "question-1", publicationDigest: `sha256:${"a".repeat(64)}`, briefDigest: `sha256:${"b".repeat(64)}`,
    current: true, state: "abstention", question: "Can this arm reach the target?", summary: "The available geometry cannot answer clearance.",
    nextAction: "Measure the target clearance.", limitations: ["Physical success has not been established."], runId: null,
    decisionDigest: null, planDigest: null, testbedDigest: null, approvedTaskDigest: null,
    claims: [{ claimId: "reach", verdict: "abstention", rationale: "Missing metric observation." }],
  }] })));
  render(<JobWorkspace token="owner-token" />);
  expect(await screen.findByText(/available geometry cannot answer clearance/)).toBeVisible();
  expect(screen.getByText("Physical success has not been established.")).toBeVisible();
  expect(screen.getByText(/Missing metric observation/)).toBeVisible();
  expect(screen.queryByRole("button", { name: /Choose this proposal/ })).not.toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Job milestones" }).querySelector('[aria-current="step"]')).toHaveTextContent("Brief agreed");
});
