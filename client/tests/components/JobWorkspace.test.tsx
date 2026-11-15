import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobWorkspace } from "@/components/site/JobWorkspace";
import type { JobMarketplaceWorkflow } from "@/types/jobMarketplace";
import { processingFailure } from "../../../server/utils/taskPreparationOutcome";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
function workflow(overrides: Partial<JobMarketplaceWorkflow> = {}): JobMarketplaceWorkflow {
  return {
    schemaVersion: "job_marketplace.v1", revision: "workflow-1", requirements: { jobFrequency: null, purchaseReadiness: "unsure", requiredOutput: null,
      installationBudget: null, ongoingBudget: null, currentProcessCost: null, targetStartDate: null },
    briefAgreed: false, optionsAssessed: false, reviewRequired: false, stage: "job_submitted", nextAction: "Blueprint will prepare a brief for you to review.", actionOwner: "blueprint",
    review: null, ...overrides,
  };
}
const response = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
/** Every test detail is folded into one block, collapsed until the site opens it. */
async function openSimulation() {
  const summary = await screen.findByText("Simulation details");
  expect(summary.closest("details")).not.toHaveAttribute("open");
  expect(screen.queryByText(/checked against real trials/)).toBeNull();
  fireEvent.click(summary);
}

describe("the site's job workspace", () => {
  it('keeps an earlier object selection review out of view while Blueprint reviews again', async () => {
    fetchMock.mockResolvedValue(response(workflow({stage: 'options_assessed',
      review: {disposition: 'options_identified', summary: 'Old object selection review', nextAction: 'Review the old object',
        reviewedAtIso: '2026-10-29T00:00:00Z', scopeRevision: 'brief-1'}})));
    render(<JobWorkspace token='owner-token' resultSuperseded currentNextAction={{text: 'Blueprint is reviewing saved video.', owner: 'blueprint'}} />);
    expect(await screen.findByText('Earlier results belong to the previous object selection. They remain in the job history.')).toBeVisible();
    expect(screen.getByText('Blueprint is reviewing saved video.')).toBeVisible();
    expect(screen.queryByText('Old object selection review')).toBeNull();
    expect(screen.queryByText(/proposal/i)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("gives a current preparation stop priority without accepting the brief or changing the workflow", async () => {
    const current = workflow({ actionOwner: "site", nextAction: "Review the saved brief.",
      review: { disposition: "more_information", summary: "The brief is still a draft.", nextAction: "Confirm the saved brief.",
        reviewedAtIso: "2026-10-27T15:00:00Z", scopeRevision: "brief-1" } });
    fetchMock.mockResolvedValue(response(current));
    const outcome = processingFailure();
    const { rerender } = render(<JobWorkspace token="owner-token" preparationOutcome={outcome} />);
    expect(await screen.findByText("Next action · Blueprint")).toBeVisible();
    expect(screen.getByText(outcome.nextStep)).toBeVisible();
    expect(screen.queryByText("Review the saved brief.")).not.toBeInTheDocument();
    expect(screen.queryByText("Confirm the saved brief.")).not.toBeInTheDocument();
    expect(screen.queryByText("Brief agreed")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender(<JobWorkspace token="owner-token" preparationOutcome={null} />);
    expect(screen.getByText("Next action · You")).toBeVisible();
    expect(screen.getByText("Review the saved brief.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not assign a stale site action while the current preparation status is unavailable", async () => {
    fetchMock.mockResolvedValue(response(workflow({ actionOwner: "site", nextAction: "Review the saved brief." })));
    render(<JobWorkspace token="owner-token" currentStatusKnown={false} />);
    expect(await screen.findByText("Next action · Blueprint")).toBeVisible();
    expect(screen.getByText("Checking the current job status. Your saved job remains available.")).toBeVisible();
    expect(screen.queryByText("Review the saved brief.")).not.toBeInTheDocument();
  });

  it("shows the current update without a customer checklist or any proposal, booking or outcome action", async () => {
    fetchMock.mockResolvedValue(response(workflow()));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByRole("region", { name: "Job progress" })).toBeVisible();
    // Nothing to show yet: no empty "Results" heading and no simulation block.
    expect(screen.queryByRole("heading", { name: "Results" })).toBeNull();
    expect(screen.queryByText("Simulation details")).toBeNull();
    expect(screen.queryByRole("region", { name: "Early trial of openly available robot software" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Job milestones" })).not.toBeInTheDocument();
    expect(screen.queryByText("Brief agreed")).not.toBeInTheDocument();
    expect(screen.queryByText("Options assessed")).not.toBeInTheDocument();
    expect(screen.queryByText(/proposal/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Choose this/ })).toBeNull();
    expect(screen.queryByText("Record your pilot outcome")).toBeNull();
    expect(screen.getByText("Blueprint will prepare a brief for you to review.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith("/api/job-workflow/owner/owner-token", expect.objectContaining({ cache: "no-store", referrerPolicy: "no-referrer" }));
  });

  it("keeps saved job planning visible when policy results need a retry", async () => {
    fetchMock.mockResolvedValue(response(workflow({ managedEvidenceUnavailable: true })));
    render(<JobWorkspace token="owner-token" />);
    await openSimulation();
    expect(await screen.findByText("Policy results are temporarily unavailable. Reload this page to retry.")).toBeVisible();
    expect(screen.getByRole("region", { name: "Job progress" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Managed policy evidence for your job" })).toBeNull();
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

  it("shows a no-suitable-option decision instead of inventing a supplier", async () => {
    fetchMock.mockResolvedValue(response(workflow({ optionsAssessed: true, stage: "options_assessed", review: { disposition: "no_suitable_option", summary: "No supported setup meets the payload requirement.", nextAction: "Review the handling method with Blueprint.", reviewedAtIso: "2026-10-21T12:00:00Z" } })));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByRole("heading", { name: "No suitable option yet" })).toBeVisible();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("does not carry private job details between owner links", async () => {
    let resolveSecond!: (value: unknown) => void;
    const reviewed = workflow({ optionsAssessed: true, stage: "options_assessed", review: { disposition: "options_identified", summary: "Private review of the first job.",
      nextAction: "Blueprint is checking delivery.", reviewedAtIso: "2026-10-27T15:00:00Z", scopeRevision: "brief-1" } });
    fetchMock.mockResolvedValueOnce(response(reviewed)).mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
    const { rerender } = render(<JobWorkspace token="first" />);
    await screen.findByText("Private review of the first job.");
    rerender(<JobWorkspace token="second" />);
    expect(screen.queryByText("Private review of the first job.")).toBeNull();
    resolveSecond(response(workflow()));
    await screen.findByRole("region", { name: "Job progress" });
    expect(screen.queryByText("Private review of the first job.")).toBeNull();
  });

  it("refuses malformed success responses and offers a retry", async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: true })).mockResolvedValueOnce(response(workflow()));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/Job planning could not be loaded/);
    fireEvent.click(screen.getByRole("button", { name: "Try loading job planning again" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Job progress" })).toBeVisible());
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
  await openSimulation();
  const details = await screen.findByText("Technical evidence and test details");
  expect(details.closest("details")).not.toHaveAttribute("open");
  expect(screen.getByText(/available geometry cannot answer clearance/)).not.toBeVisible();
  fireEvent.click(details);
  expect(screen.getByText(/available geometry cannot answer clearance/)).toBeVisible();
  expect(screen.getByText("Physical success has not been established.")).toBeVisible();
  expect(screen.getByText(/Missing metric observation/)).toBeVisible();
  expect(screen.queryByRole("button", { name: /Choose this proposal/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Job milestones" })).not.toBeInTheDocument();
});

it("links missing task-specific evidence to the existing capture surface without creating a run", async () => {
  fetchMock.mockResolvedValue(response(workflow({ jobId: "job-1", briefAgreed: true, evidence: [{
    requestId: "question-1", publicationDigest: null, briefDigest: "brief", current: true, state: "information_required",
    question: "Which metric observation is missing?", summary: "Target clearance is unknown.", nextAction: "Measure target clearance.",
    limitations: [], runId: null, decisionDigest: null, planDigest: null, testbedDigest: null, approvedTaskDigest: null, claims: [],
  }] })));
  render(<JobWorkspace token="owner-token" />);
  expect(await screen.findByRole("link", { name: "Add more video of the task" })).toHaveAttribute("href", "/app/captures?jobId=job-1");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("shows managed job evidence without any pilot booking surface", async () => {
  fetchMock.mockResolvedValue(response(workflow({ briefAgreed: true, managedEvidence: [{ runId: "managed-run-1", state: "decided", current: true,
    resultDigest: "sha256:result", summary: "Scoped simulator result retained.", nextAction: "Blueprint reviews the estimate.",
    limitations: ["Physical pilot agreement remains separate."], href: "#managed-evidence-managed-run-1" }] })));
  render(<JobWorkspace token="owner-token" />);
  await screen.findByText("Scoped simulator result retained.");
  expect(screen.queryByRole("button", { name: /Choose this/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Pilot booked|Deployment company selected|Proposed pilot/)).not.toBeInTheDocument();
});

it("leaves the parent's current update in one place without repeating a stale workflow action", async () => {
  fetchMock.mockResolvedValue(response(workflow({actionOwner:"site",nextAction:"Confirm the old brief."})));
  const current = "Blueprint is preparing the recording; nothing is needed from you.";
  render(<><p>{current}</p><JobWorkspace token="owner-token" currentNextAction={{text:current,owner:"blueprint"}} /></>);
  await screen.findByRole("region", {name:"Job progress"});
  expect(screen.getAllByText(current)).toHaveLength(1);
  expect(screen.queryByText("Confirm the old brief.")).not.toBeInTheDocument();
  expect(screen.queryByText("Next action · You")).not.toBeInTheDocument();
});

it("shares its one workflow read with the page and shows no early trial", async () => {
  const loaded = workflow({ briefAgreed: true, managedEvidence: [] });
  fetchMock.mockResolvedValue(response(loaded));
  const onWorkflow = vi.fn();
  render(<JobWorkspace token="owner-token" onWorkflow={onWorkflow} />);
  await screen.findByRole("region", { name: "Job progress" });
  await waitFor(() => expect(onWorkflow).toHaveBeenCalledWith(loaded));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).not.toMatch(/early trial|openly available/i);
});
