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

describe("the site's job workspace", () => {
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
    expect(screen.getByText("Brief agreed").closest("li")).not.toHaveAttribute("data-complete", "true");
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

  it("shows recorded milestones and offers no proposal, booking or outcome action", async () => {
    fetchMock.mockResolvedValue(response(workflow()));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByRole("heading", { name: "Your job, step by step" })).toBeVisible();
    const milestones = screen.getByRole("list", { name: "Job milestones" });
    expect(within(milestones).getAllByRole("listitem")).toHaveLength(3);
    expect(within(milestones).getByText("Job submitted").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(milestones).getByText("Options assessed").closest("li")).not.toHaveAttribute("data-complete", "true");
    expect(screen.queryByText(/proposal/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Choose this/ })).toBeNull();
    expect(screen.queryByText("Record your pilot outcome")).toBeNull();
    expect(screen.getByText("Blueprint will prepare a brief for you to review.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith("/api/job-workflow/owner/owner-token", expect.objectContaining({ cache: "no-store", referrerPolicy: "no-referrer" }));
  });






  it("keeps saved job planning visible when policy results need a retry", async () => {
    fetchMock.mockResolvedValue(response(workflow({ managedEvidenceUnavailable: true })));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByText("Policy results are temporarily unavailable. Reload this page to retry.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your job, step by step" })).toBeVisible();
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
    await screen.findByRole("heading", { name: "Your job, step by step" });
    expect(screen.queryByText("Private review of the first job.")).toBeNull();
  });

  it("refuses malformed success responses and offers a retry", async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: true })).mockResolvedValueOnce(response(workflow()));
    render(<JobWorkspace token="owner-token" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/Job planning could not be loaded/);
    fireEvent.click(screen.getByRole("button", { name: "Try loading job planning again" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your job, step by step" })).toBeVisible());
  });
});

it("shows exact abstention limits without advancing a job", async () => {
  fetchMock.mockResolvedValue(response(workflow({ briefAgreed: true, stage: "brief_agreed", evidence: [{
    requestId: "question-1", publicationDigest: `sha256:${"a".repeat(64)}`, briefDigest: `sha256:${"b".repeat(64)}`,
    current: true, state: "abstention", question: "Can this arm reach the target?", summary: "The available geometry cannot answer clearance.",
    nextAction: "Measure the target clearance.", limitations: ["Physical success has not been established."], runId: null,
    decisionDigest: null, planDigest: null, testbedDigest: null, approvedTaskDigest: null,
    claims: [{ claimId: "reach", verdict: "abstention", rationale: "Missing metric observation." }],
  }] })));
  render(<JobWorkspace token="owner-token" />);
  const details = await screen.findByText("Technical evidence and test details");
  expect(details.closest("details")).not.toHaveAttribute("open");
  expect(screen.getByText(/available geometry cannot answer clearance/)).not.toBeVisible();
  fireEvent.click(details);
  expect(screen.getByText(/available geometry cannot answer clearance/)).toBeVisible();
  expect(screen.getByText("Physical success has not been established.")).toBeVisible();
  expect(screen.getByText(/Missing metric observation/)).toBeVisible();
  expect(screen.getByRole("list", { name: "Job milestones" }).querySelector('[aria-current="step"]')).toHaveTextContent("Brief agreed");
});

it("links missing task-specific evidence to the existing capture surface without creating a run", async () => {
  fetchMock.mockResolvedValue(response(workflow({ jobId: "job-1", briefAgreed: true, evidence: [{
    requestId: "question-1", publicationDigest: null, briefDigest: "brief", current: true, state: "information_required",
    question: "Which metric observation is missing?", summary: "Target clearance is unknown.", nextAction: "Measure target clearance.",
    limitations: [], runId: null, decisionDigest: null, planDigest: null, testbedDigest: null, approvedTaskDigest: null, claims: [],
  }] })));
  render(<JobWorkspace token="owner-token" />);
  expect(await screen.findByRole("link", { name: "Add task-specific capture evidence" })).toHaveAttribute("href", "/app/captures?jobId=job-1");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("shows managed job evidence without any pilot booking surface", async () => {
  fetchMock.mockResolvedValue(response(workflow({ briefAgreed: true, managedEvidence: [{ runId: "managed-run-1", state: "decided", current: true,
    resultDigest: "sha256:result", summary: "Scoped simulator result retained.", nextAction: "Blueprint reviews the estimate.",
    limitations: ["Physical pilot agreement remains separate."], href: "#managed-evidence-managed-run-1" }] })));
  render(<JobWorkspace token="owner-token" />);
  await screen.findByText("Scoped simulator result retained.");
  expect(screen.queryByRole("button", { name: /Choose this/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Pilot booked|Delivery partner selected/)).not.toBeInTheDocument();
});

it("shows every screened candidate without creating a pilot recommendation", async () => {
  fetchMock.mockResolvedValue(response(workflow({ briefAgreed: true, managedEvidence: [{ runId: "screening-one", state: "running", current: true,
    resultDigest: null, summary: "Early policy screening: 36 candidates.", nextAction: "Candidate progress will update.",
    limitations: ["Screening does not qualify a pilot."], href: "#managed-evidence-screening-one", screening: {
      candidates: Array.from({ length: 36 }, (_, index) => ({ candidateId: `candidate-${index}`, name: `Candidate ${index}`,
        state: index ? "pending" : "running", planned: 3, scored: 0, succeeded: 0, failed: 0, void: 0, blockers: [] })) } }] })));
  render(<JobWorkspace token="owner-token" />);
  fireEvent.click(await screen.findByText("Technical evidence and test details"));
  const table = await screen.findByRole("table", { name: "Candidates evaluated for your job" });
  expect(within(table).getAllByRole("row")).toHaveLength(37);
  expect(within(table).getByText("Candidate 35")).toBeVisible();
  expect(screen.getByText("Screening does not qualify a pilot.")).toBeVisible();
});

it("shows the current simulation result before opening technical history", async () => {
  const result = {
    runId: "current-evaluation", state: "completed", current: true, resultDigest: "sha256:accepted-result",
    summary: "Your job's simulation estimate: 1 candidate ran, with 3 episodes scored.",
    nextAction: "Blueprint uses this estimate to recommend the next step.",
    limitations: ["Simulation does not certify physical performance or safety."],
    href: "#managed-evidence-current-evaluation", screening: { candidates: [{ candidateId: "candidate-1", name: "Current candidate",
      state: "completed", planned: 3, scored: 3, succeeded: 2, failed: 1, void: 0, blockers: [] }] },
  };
  fetchMock.mockResolvedValue(response(workflow({ managedEvidence: [result, { ...result,
    runId: "previous-evaluation", current: false, summary: "An estimate for the previous recording.", screening: undefined,
  }] })));
  render(<JobWorkspace token="owner-token" />);
  expect(await screen.findByText(result.summary)).toBeVisible();
  expect(screen.getByRole("table", { name: "Candidates evaluated for your job" })).toBeVisible();
  expect(screen.getByText("2 succeeded · 1 failed · 0 unscorable")).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Simulation results for your job" })).getByText(result.limitations[0])).toBeVisible();
  expect(screen.getByText("Technical evidence and test details").closest("details")).not.toHaveAttribute("open");
  expect(screen.getByText("An estimate for the previous recording.")).not.toBeVisible();
  expect(screen.getByText(/Run: current-evaluation/)).not.toBeVisible();
});

it("uses the current preparation action over the stored workflow action", async () => {
  fetchMock.mockResolvedValue(response(workflow({actionOwner:"site",nextAction:"Confirm the old brief."})));
  render(<JobWorkspace token="owner-token" currentNextAction={{text:"Blueprint is preparing the recording; nothing is needed from you.",owner:"blueprint"}} />);
  expect(await screen.findByText("Next action · Blueprint")).toBeVisible();
  expect(screen.getByText("Blueprint is preparing the recording; nothing is needed from you.")).toBeVisible();
  expect(screen.queryByText("Confirm the old brief.")).not.toBeInTheDocument();
});

