import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommunicationsDraftEditor } from "@/components/admin/CommunicationsDraftEditor";

const review = { digest: "a".repeat(64), hardChecksPassed: false, blockers: ["used_fact_missing"], semanticReviewRequired: {} };
const output = { disposition: "draft", subject: "A question", body: "Original message?", reason: "Bounded question", usedFactIds: ["unknown"], refreshFactIds: [], requiresHumanReview: true,
  outreachContract: { senderIdentity: "I'm building Blueprint", value: { offer: "An observation", limits: "Public sources only" }, question: "Original message?", recipientChoice: "Your choice" } };
const payload = { to: "operator@example.com", communications: { job: { intent: "outreach" }, output, brief: { facts: [{ id: "fact-1", claim: "Verified packing workflow" }] } } };

describe("saved communications draft editor", () => {
  it("repairs wording, known facts and question anchors without editing the source or granting approval", async () => {
    const onSave = vi.fn(async () => ({ review: { ...review, digest: "b".repeat(64), hardChecksPassed: true, blockers: [] } }));
    render(<CommunicationsDraftEditor payload={payload} review={review} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Revise draft" }));
    expect(screen.getByText(/Saving adds the approved mailing and unsubscribe footer/)).toHaveTextContent("previous full message stays in private revision history");
    fireEvent.change(screen.getByLabelText("Draft subject"), { target: { value: "Revised question" } });
    fireEvent.change(screen.getByLabelText("Draft message"), { target: { value: "I'm building Blueprint. Is this relevant?" } });
    fireEvent.click(screen.getByLabelText(/unknown: Unknown fact/));
    fireEvent.click(screen.getByLabelText(/fact-1: Verified packing/));
    fireEvent.click(screen.getByText("Review anchors", { exact: true }));
    fireEvent.change(screen.getByLabelText("One learning question"), { target: { value: "Is this relevant?" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and revalidate" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ expectedReviewDigest: review.digest, output: { ...output,
      subject: "Revised question", body: "I'm building Blueprint. Is this relevant?", usedFactIds: ["fact-1"],
      outreachContract: { ...output.outreachContract, question: "Is this relevant?" } } }));
    expect(await screen.findByRole("status")).toHaveTextContent("Revision saved. It is ready for human review");
    expect(output.usedFactIds).toEqual(["unknown"]);
  });

  it("keeps an in-progress edit and original digest when the server detects a concurrent change", async () => {
    const onSave = vi.fn(async () => { throw new Error("The draft changed while you were editing; reload it before saving"); });
    const view = render(<CommunicationsDraftEditor payload={payload} review={review} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Revise draft" }));
    fireEvent.change(screen.getByLabelText("Draft message"), { target: { value: "Unsubmitted edit?" } });
    view.rerender(<CommunicationsDraftEditor payload={payload} review={{ ...review, digest: "b".repeat(64) }} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Save and revalidate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("draft changed");
    expect(screen.getByLabelText("Draft message")).toHaveValue("Unsubmitted edit?");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ expectedReviewDigest: review.digest }));
  });

  it("shows remaining diagnostics after a save and permits another revision", async () => {
    render(<CommunicationsDraftEditor payload={payload} review={review} onSave={async () => ({ review })} />);
    fireEvent.click(screen.getByRole("button", { name: "Revise draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and revalidate" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Repair these remaining issues: used_fact_missing");
    expect(screen.getByRole("button", { name: "Revise draft" })).toBeEnabled();
  });

  it("repairs a partial JSON anchor object through the ordinary fields", () => {
    render(<CommunicationsDraftEditor payload={payload} review={review} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Revise draft" }));
    fireEvent.click(screen.getByText("Review anchors", { exact: true }));
    fireEvent.click(screen.getByText("All review anchors (JSON)", { exact: true }));
    fireEvent.change(screen.getByLabelText("Draft review anchors (JSON)"), { target: { value: '{"value":null}' } });
    fireEvent.change(screen.getByLabelText("Bounded offer"), { target: { value: "A bounded observation" } });
    expect(screen.getByLabelText("Bounded offer")).toHaveValue("A bounded observation");
    fireEvent.change(screen.getByLabelText("Draft review anchors (JSON)"), { target: { value: '"unfinished"' } });
    expect(screen.queryByLabelText("Bounded offer")).toBeNull();
    expect(screen.getByLabelText("Draft review anchors (JSON)")).toHaveValue('"unfinished"');
  });  it("keeps Gmail draft copying disabled without activation and during an unsaved edit",()=>{
    const onGmailSave=vi.fn(),onSave=vi.fn(),copy={writesEnabled:false,state:"not_copied",draftId:null,verifiedAt:null,currentRevisionVerified:false};
    const view=render(<CommunicationsDraftEditor payload={payload} review={{...review,hardChecksPassed:true}} onSave={onSave} gmailDraft={copy} onGmailSave={onGmailSave} />);
    expect(screen.getByRole("button",{name:"Save Gmail draft"})).toBeDisabled();fireEvent.click(screen.getByRole("button",{name:"Save Gmail draft"}));expect(onGmailSave).not.toHaveBeenCalled();
    view.rerender(<CommunicationsDraftEditor payload={payload} review={{...review,hardChecksPassed:true}} onSave={onSave} gmailDraft={{...copy,writesEnabled:true}} onGmailSave={onGmailSave} />);
    fireEvent.click(screen.getByRole("button",{name:"Revise draft"}));expect(screen.getByRole("button",{name:"Save Gmail draft"})).toBeDisabled();
  });
  it("does not call an older draft copy verified for the current revision",async()=>{
    const copy={writesEnabled:true,state:"unknown",draftId:null,verifiedAt:null,currentRevisionVerified:false};
    const onGmailSave=vi.fn(async()=>({state:"verified",reviewDigest:"c".repeat(64),revisionId:"d".repeat(64),sent:false as const}));
    render(<CommunicationsDraftEditor payload={payload} review={{...review,hardChecksPassed:true}} revisionId={"b".repeat(64)} onSave={vi.fn()} gmailDraft={copy} onGmailSave={onGmailSave} />);
    fireEvent.click(screen.getByRole("button",{name:"Check Gmail draft"}));
    expect(await screen.findByRole("status")).toHaveTextContent("belongs to an older revision");
    expect(onGmailSave).toHaveBeenCalledWith({expectedReviewDigest:review.digest,expectedRevisionId:"b".repeat(64),mode:"reconcile"});
  });

});
