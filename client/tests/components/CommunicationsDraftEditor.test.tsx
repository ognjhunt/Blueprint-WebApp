import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommunicationsDraftEditor } from "@/components/admin/CommunicationsDraftEditor";

const review = { digest: "a".repeat(64), hardChecksPassed: false, blockers: ["used_fact_missing"], semanticReviewRequired: {} };
const output = { disposition: "draft", subject: "A question", body: "Original message?", reason: "Bounded question", usedFactIds: ["unknown"], refreshFactIds: [], requiresHumanReview: true,
  outreachContract: { senderIdentity: "I'm building Blueprint", value: { offer: "An observation", limits: "Public sources only" }, question: "Original message?", recipientChoice: "Your choice" } };
const payload = { to: "operator@example.com", communications: { job: { intent: "outreach" }, output, brief: { facts: [{ id: "fact-1", claim: "Verified packing workflow" }] } } };

describe("saved communications draft editor", () => {
  it("offers the exact approved manual Gmail copy without sending checkboxes",async()=>{
    const onGmailSave=vi.fn(async()=>({state:"verified",reviewDigest:review.digest,revisionId:"b".repeat(64),sent:false as const}));
    render(<CommunicationsDraftEditor payload={payload} review={{...review,hardChecksPassed:true}} revisionId={"b".repeat(64)} onSave={vi.fn()}
      gmailDraft={{writesEnabled:true,state:"not_copied",draftId:null,verifiedAt:null,currentRevisionVerified:false}} onGmailSave={onGmailSave} />);
    fireEvent.click(screen.getByRole("button",{name:"Save to Gmail Drafts"}));
    await waitFor(()=>expect(onGmailSave).toHaveBeenCalledExactlyOnceWith({expectedReviewDigest:review.digest,expectedRevisionId:"b".repeat(64),mode:"write"}));
    expect(screen.getByText(/Sending review checkboxes are not required/)).toBeVisible();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
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
    expect(screen.getByRole("button",{name:"Save to Gmail Drafts"})).toBeDisabled();fireEvent.click(screen.getByRole("button",{name:"Save to Gmail Drafts"}));expect(onGmailSave).not.toHaveBeenCalled();
    view.rerender(<CommunicationsDraftEditor payload={payload} review={{...review,hardChecksPassed:true}} onSave={onSave} gmailDraft={{...copy,writesEnabled:true}} onGmailSave={onGmailSave} />);
    fireEvent.click(screen.getByRole("button",{name:"Revise draft"}));expect(screen.getByRole("button",{name:"Save to Gmail Drafts"})).toBeDisabled();
  });
  it("does not call an older draft copy verified for the current revision",async()=>{
    const copy={writesEnabled:true,state:"unknown",draftId:null,verifiedAt:null,currentRevisionVerified:false};
    const onGmailSave=vi.fn(async()=>({state:"verified",reviewDigest:"c".repeat(64),revisionId:"d".repeat(64),sent:false as const}));
    render(<CommunicationsDraftEditor payload={payload} review={{...review,hardChecksPassed:true}} revisionId={"b".repeat(64)} onSave={vi.fn()} gmailDraft={copy} onGmailSave={onGmailSave} />);
    fireEvent.click(screen.getByRole("button",{name:"Check Gmail draft"}));
    expect(await screen.findByRole("status")).toHaveTextContent("belongs to an older revision");
    expect(onGmailSave).toHaveBeenCalledWith({expectedReviewDigest:review.digest,expectedRevisionId:"b".repeat(64),mode:"reconcile"});
  });
  it("keeps a verified copy observation-only while allowing explicit readback in the active approved window",async()=>{
    const revisionId="b".repeat(64),copy={writesEnabled:true,state:"verified",draftId:"draft-1",verifiedAt:"2026-10-02T14:00:00Z",currentRevisionVerified:true};
    const onGmailSave=vi.fn(async()=>({state:"verified",reviewDigest:review.digest,revisionId,sent:false as const}));
    const view=render(<CommunicationsDraftEditor payload={payload} review={{...review,hardChecksPassed:true}} revisionId={revisionId} onSave={vi.fn()} gmailDraft={copy} onGmailSave={onGmailSave} />);
    expect(screen.getByRole("button",{name:"Save to Gmail Drafts"})).toBeDisabled();
    expect(screen.getByRole("button",{name:"Check Gmail draft"})).toBeEnabled();
    fireEvent.click(screen.getByRole("button",{name:"Save to Gmail Drafts"}));expect(onGmailSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Check Gmail draft"}));
    await waitFor(()=>expect(onGmailSave).toHaveBeenCalledExactlyOnceWith({expectedReviewDigest:review.digest,expectedRevisionId:revisionId,mode:"reconcile"}));
    expect(await screen.findByText(/Gmail draft readback verified for this saved revision/)).toBeInTheDocument();
    view.rerender(<CommunicationsDraftEditor payload={payload} review={{...review,hardChecksPassed:true}} revisionId={revisionId} onSave={vi.fn()} gmailDraft={{...copy,state:"stale",currentRevisionVerified:false}} onGmailSave={onGmailSave} />);
    expect(screen.getByRole("button",{name:"Save to Gmail Drafts"})).toBeDisabled();
  });

});

describe("LinkedIn people-search link on a hypothesis draft", () => {
  const url = "https://www.linkedin.com/search/results/people/?keywords=operations%20manager%20Synthetic%20Sorting%20Co";
  it("shows a plain link that opens a search in the browser and is never evidence", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    render(<CommunicationsDraftEditor payload={payload} review={review} onSave={vi.fn()}
      linkedinSearch={{ url, role: "operations manager", operator: "Synthetic Sorting Co" }} />);
    const link = screen.getByRole("link", { name: /Search LinkedIn for operations manager at Synthetic Sorting Co/ });
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(screen.getByText(/never fetched or stored, and it is not evidence/)).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it.each([undefined, "https://www.linkedin.com/in/someone", "javascript:alert(1)", "https://linkedin.example/search/results/people/?keywords=x"])(
    "shows no link for %s", value => {
      render(<CommunicationsDraftEditor payload={payload} review={review} onSave={vi.fn()}
        linkedinSearch={value === undefined ? undefined : { url: value, role: "operations manager", operator: "Synthetic Sorting Co" }} />);
      expect(screen.queryByRole("link", { name: /Search LinkedIn/ })).toBeNull();
    });
});
