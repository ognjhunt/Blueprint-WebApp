import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutreachApprovalReview, type OutreachReviewSummary } from "@/components/admin/OutreachApprovalReview";

const review: OutreachReviewSummary = {
  digest: "a".repeat(64), hardChecksPassed: true, blockers: [],
  semanticReviewRequired: {
    connection: "Verify any connection.", evidence: "Verify public sources and relevance.",
    boundedValue: "Verify bounded value.", easyQuestion: "Verify one easy question.",
    recipientChoice: "Verify recipient choice.", workflow: "Verify the discovery workflow.",
  },
};
const payload = { to: "ops@packing-facility.co", subject: "A packing question", body: "I'm building Blueprint. Is packing relevant?", outreachContext: { observations: [] } };

describe("existing queue outreach approval review", () => {
  it("shows the exact founder sender and full transport message while sending is disabled", () => {
    const onApprove = vi.fn();
    render(<OutreachApprovalReview review={review} payload={{ ...payload, from: "nijel@tryblueprint.io", transportBody: payload.body + "\nPrivacy and opt-out footer" }} pending={false} onApprove={onApprove} sendingEnabled={false} />);
    expect(screen.getByText("From: nijel@tryblueprint.io")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Sending is disabled");
    screen.getAllByRole("checkbox").forEach(box => fireEvent.click(box));
    expect(screen.getByRole("button", { name: "Approve outreach" })).toBeDisabled();
    expect(onApprove).not.toHaveBeenCalled();
    expect(screen.getByText("Full message including footer")).toBeVisible();
  });
  it("shows the exact message and requires every semantic check before approval", () => {
    const onApprove = vi.fn();
    render(<OutreachApprovalReview review={review} payload={payload} pending={false} onApprove={onApprove} />);
    expect(screen.getByText(payload.body)).toBeVisible();
    expect(screen.getByText("To: " + payload.to)).toBeVisible();
    const approve = screen.getByRole("button", { name: "Approve outreach" });
    expect(approve).toBeDisabled();
    const boxes = screen.getAllByRole("checkbox");
    boxes.slice(0, -1).forEach((box) => fireEvent.click(box));
    expect(approve).toBeDisabled();
    fireEvent.click(boxes.at(-1)!);
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    expect(onApprove).toHaveBeenCalledWith({ digest: review.digest, checks: {
      connection: "pass", evidence: "pass", boundedValue: "pass", easyQuestion: "pass", recipientChoice: "pass", workflow: "pass",
    } });
  });

  it("invalidates checked decisions when the server changes the reviewed draft", () => {
    const onApprove = vi.fn();
    const view = render(<OutreachApprovalReview review={review} payload={payload} pending={false} onApprove={onApprove} />);
    screen.getAllByRole("checkbox").forEach((box) => fireEvent.click(box));
    expect(screen.getByRole("button", { name: "Approve outreach" })).toBeEnabled();
    view.rerender(<OutreachApprovalReview review={{ ...review, digest: "b".repeat(64) }} payload={{ ...payload, subject: "Changed" }} pending={false} onApprove={onApprove} />);
    expect(screen.getByRole("button", { name: "Approve outreach" })).toBeDisabled();
    expect(screen.getAllByRole("checkbox").every((box) => !(box as HTMLInputElement).checked)).toBe(true);
  });

  it.each([undefined, { ...review, hardChecksPassed: false, blockers: ["outreach_contract_missing_or_invalid"] }])("fails closed for missing or invalid legacy review data", (invalidReview) => {
    render(<OutreachApprovalReview review={invalidReview} payload={payload} pending={false} onApprove={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve outreach" })).toBeDisabled();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("outreach-ready hypothesis drafts (draft only)", () => {
  const QUESTION = "Which parts of sorting returned parcels at Synthetic sorting site still need people, and what has kept them from being automated?";
  const hypothesisPayload = { to: "sortingops@hypothesis-operator.example", subject: "About sorting returned parcels",
    body: `Hello, I'm hoping this reaches whoever runs sorting returned parcels at Synthetic sorting site.\n\n${QUESTION}`,
    communications: { brief: { qualification: { tier: "outreach_ready", label: "hypothesis", openQuestions: [QUESTION],
      openChecks: ["manual_workflow", "existing_automation", "fit", "interest"], sendsAuthorized: false },
    facts: [{ id: "fact-1", claim: "Synthetic hypothesis operator runs the Synthetic sorting site", sourceUrl: "https://hypothesis-operator.example/locations/sorting" },
      { id: "fact-2", claim: "Associates sort returned parcels at the Synthetic sorting site", sourceUrl: "https://hypothesis-operator.example/careers/sorting-associate" }] } } };
  it("labels the draft, shows its one question and proven quotes, and offers no approve control", () => {
    const onApprove = vi.fn();
    render(<OutreachApprovalReview review={review} payload={hypothesisPayload} pending={false} onApprove={onApprove} draftOnly />);
    expect(screen.getByText("Hypothesis · draft only")).toBeVisible();
    expect(screen.getByText(QUESTION, { selector: "q" })).toBeVisible();
    expect(screen.getByText("Synthetic hypothesis operator runs the Synthetic sorting site")).toBeVisible();
    expect(screen.getByText("Associates sort returned parcels at the Synthetic sorting site")).toBeVisible();
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(onApprove).not.toHaveBeenCalled();
  });
  it("fails closed to draft only when the payload carries a hypothesis even without the server flag", () => {
    render(<OutreachApprovalReview review={review} payload={hypothesisPayload} pending={false} onApprove={vi.fn()} />);
    expect(screen.getByText("Hypothesis · draft only")).toBeVisible();
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
  });
  it("shows the current launch contract question and keeps archival qualification separate", () => {
    const question = "Where, if anywhere, could Blueprint help with your current process for finding customers and assessing their tasks?";
    render(<OutreachApprovalReview review={review} payload={{ ...hypothesisPayload,
      body: `I'm building Blueprint.\n\n${question}`,
      outreachContract: { version: "blueprint.outreach.v3", questions: [{ question, checks: ["interest"] }] },
    }} pending={false} onApprove={vi.fn()} />);
    expect(screen.getByText(question, { selector: "q" })).toBeVisible();
    expect(screen.queryByText(QUESTION, { selector: "q" })).toBeNull();
    expect(screen.getByText("Historical research question · unresolved")).toBeVisible();
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
  });
  it("never substitutes an archived question for missing current launch contract data", () => {
    render(<OutreachApprovalReview review={review} payload={{ ...hypothesisPayload,
      outreachContract: { version: "blueprint.outreach.v3", questions: [] },
    }} pending={false} onApprove={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("no published question");
    expect(screen.queryByText(QUESTION, { selector: "q" })).toBeNull();
  });
});
