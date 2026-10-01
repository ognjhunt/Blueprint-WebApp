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
