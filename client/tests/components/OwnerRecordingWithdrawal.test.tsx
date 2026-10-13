import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { OwnerRecordingWithdrawal, OWNER_WITHDRAWAL_CONFIRMATION } from "@/components/site/OwnerRecordingWithdrawal";

const TOKEN = "owner-token";
const ENDPOINT = `/api/self-capture/uploads/${TOKEN}/withdrawal`;

function status(overrides: Record<string, unknown> = {}) {
  return { state: "uploads_stopped_cleanup_pending", requestedAtIso: "2026-10-13T00:00:00.000Z",
    pipelineAcknowledged: false, deletionConfirmed: false, legalHold: false,
    storageDeletion: { state: "pending", deletedObjectCount: 0, lateUploadCheckAtIso: null, completedAtIso: null },
    ...overrides };
}

function server(initial: Record<string, unknown> | null, post: () => Promise<unknown> = async () => ({
  ok: true, json: async () => ({ ok: true, created: true, withdrawal: status() }) })) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/csrf") return Promise.resolve({ ok: true, json: async () => ({ csrfToken: "csrf" }) });
    if (url === ENDPOINT && init?.method === "POST") return post();
    if (url === ENDPOINT) return Promise.resolve({ ok: true,
      json: async () => ({ ok: true, withdrawn: Boolean(initial), withdrawal: initial }) });
    return Promise.resolve({ ok: false, json: async () => ({}) });
  });
}

beforeEach(() => { vi.stubGlobal("fetch", server(null)); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("owner-link withdrawal", () => {
  it("asks for explicit confirmation before posting, and can be cancelled", async () => {
    const fetcher = server(null);
    vi.stubGlobal("fetch", fetcher);
    render(<OwnerRecordingWithdrawal token={TOKEN} />);
    fireEvent.click(await screen.findByText("Withdraw recording permission"));
    fireEvent.click(screen.getByRole("button", { name: "Withdraw permission…" }));
    expect(screen.getByRole("alertdialog", { name: "Withdraw recording permission?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep permission" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0);
  });

  it("posts the confirmation once and shows uploads stopped with deletion in progress", async () => {
    const fetcher = server(null);
    vi.stubGlobal("fetch", fetcher);
    const onWithdrawn = vi.fn();
    render(<OwnerRecordingWithdrawal token={TOKEN} onWithdrawn={onWithdrawn} />);
    fireEvent.click(await screen.findByText("Withdraw recording permission"));
    fireEvent.click(screen.getByRole("button", { name: "Withdraw permission…" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, withdraw permission" }));
    expect(await screen.findByText("Uploads stopped. Deletion of stored footage is in progress.")).toBeInTheDocument();
    expect(screen.queryByText(/has been deleted/)).not.toBeInTheDocument();
    const posts = fetcher.mock.calls.filter(call => call[1]?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]!.body))).toEqual({ confirm: OWNER_WITHDRAWAL_CONFIRMATION });
    expect((posts[0][1]!.headers as Record<string, string>)["X-CSRF-Token"]).toBe("csrf");
    expect(onWithdrawn).toHaveBeenCalledTimes(1);
  });

  it("keeps the confirmation open and says nothing changed when the server refuses", async () => {
    vi.stubGlobal("fetch", server(null, async () => ({ ok: false, json: async () => ({ error: "We could not record your withdrawal. Nothing changed. Try again shortly." }) })));
    render(<OwnerRecordingWithdrawal token={TOKEN} />);
    fireEvent.click(await screen.findByText("Withdraw recording permission"));
    fireEvent.click(screen.getByRole("button", { name: "Withdraw permission…" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, withdraw permission" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nothing changed");
    expect(screen.queryByText(/Uploads stopped/)).not.toBeInTheDocument();
  });

  it("shows a recorded withdrawal on return instead of the withdraw action", async () => {
    vi.stubGlobal("fetch", server(status({ storageDeletion: { state: "deleted_late_upload_check_pending", deletedObjectCount: 3,
      lateUploadCheckAtIso: "2026-10-20T01:00:00.000Z", completedAtIso: null } })));
    render(<OwnerRecordingWithdrawal token={TOKEN} />);
    expect(await screen.findByText("Uploads stopped. Deletion of stored footage is in progress.")).toBeInTheDocument();
    expect(screen.getByText(/final check for app uploads/)).toBeInTheDocument();
    expect(screen.queryByText("Withdraw recording permission")).not.toBeInTheDocument();
  });

  it("says footage is deleted only once the server confirms deletion", async () => {
    vi.stubGlobal("fetch", server(status({ state: "deletion_confirmed", deletionConfirmed: true, pipelineAcknowledged: true,
      storageDeletion: { state: "deleted", deletedObjectCount: 7, lateUploadCheckAtIso: null, completedAtIso: "2026-10-13T02:00:00.000Z" } })));
    render(<OwnerRecordingWithdrawal token={TOKEN} />);
    expect(await screen.findByText("Recording permission withdrawn. Your stored footage has been deleted.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });

  it("does not claim deletion when storage is removed but Pipeline has not acknowledged", async () => {
    vi.stubGlobal("fetch", server(status({ state: "storage_deleted_pipeline_ack_pending",
      storageDeletion: { state: "deleted", deletedObjectCount: 7, lateUploadCheckAtIso: null, completedAtIso: "2026-10-13T02:00:00.000Z" } })));
    render(<OwnerRecordingWithdrawal token={TOKEN} />);
    await waitFor(() => expect(screen.getByText("Uploads stopped. Deletion of stored footage is in progress.")).toBeInTheDocument());
    expect(screen.getByText(/acknowledges the withdrawal/)).toBeInTheDocument();
  });
});
