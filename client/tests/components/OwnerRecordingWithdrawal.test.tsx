import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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
    fireEvent.click(await screen.findByText("Stop using my video"));
    fireEvent.click(screen.getByRole("button", { name: "Stop using my video…" }));
    expect(screen.getByRole("alertdialog", { name: "Stop using your video?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0);
  });

  it("posts the confirmation once and says what withdrawal does, without claiming deletion", async () => {
    const fetcher = server(null);
    vi.stubGlobal("fetch", fetcher);
    const onWithdrawn = vi.fn();
    render(<OwnerRecordingWithdrawal token={TOKEN} onWithdrawn={onWithdrawn} />);
    fireEvent.click(await screen.findByText("Stop using my video"));
    fireEvent.click(screen.getByRole("button", { name: "Stop using my video…" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, stop using my video" }));
    expect(await screen.findByText("Video withdrawn.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/We stop using your video/);
    // What a withdrawal does, in the site's words: no "partners", no "evaluations", and no pause (it is not undone).
    expect(screen.getByRole("status")).toHaveTextContent(/your job has left every company's view\. No new uploads are accepted\./);
    expect(screen.getByRole("status")).toHaveTextContent("Each company it was sent to is asked to delete any copy it saved.");
    expect(screen.getByRole("status")).not.toHaveTextContent(/partners|evaluations|paused/);
    expect(screen.queryByText(/deleted|deletion of/i)).not.toBeInTheDocument();
    const posts = fetcher.mock.calls.filter(call => call[1]?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]!.body))).toEqual({ confirm: OWNER_WITHDRAWAL_CONFIRMATION });
    expect((posts[0][1]!.headers as Record<string, string>)["X-CSRF-Token"]).toBe("csrf");
    expect(onWithdrawn).toHaveBeenCalledTimes(1);
  });

  it("keeps the confirmation open and says nothing changed when the server refuses", async () => {
    vi.stubGlobal("fetch", server(null, async () => ({ ok: false, json: async () => ({ error: "We could not record your withdrawal. Nothing changed. Try again shortly." }) })));
    render(<OwnerRecordingWithdrawal token={TOKEN} />);
    fireEvent.click(await screen.findByText("Stop using my video"));
    fireEvent.click(screen.getByRole("button", { name: "Stop using my video…" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, stop using my video" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nothing changed");
    expect(screen.queryByText(/Uploads stopped/)).not.toBeInTheDocument();
  });

  it("shows a recorded withdrawal on return instead of the withdraw action", async () => {
    vi.stubGlobal("fetch", server(status({ storageDeletion: { state: "deleted_late_upload_check_pending", deletedObjectCount: 3,
      lateUploadCheckAtIso: "2026-10-20T01:00:00.000Z", completedAtIso: null } })));
    render(<OwnerRecordingWithdrawal token={TOKEN} />);
    expect(await screen.findByText("Video withdrawn.")).toBeInTheDocument();
    expect(screen.getByText(/We're stopping our systems now; this page updates when that's done\./)).toBeInTheDocument();
    expect(screen.queryByText("Stop using my video")).not.toBeInTheDocument();
  });

  it("never says the recording was deleted, and points retained data to the Privacy Policy", async () => {
    vi.stubGlobal("fetch", server(status({ state: "deletion_confirmed", deletionConfirmed: true, pipelineAcknowledged: true,
      storageDeletion: { state: "deleted", deletedObjectCount: 7, lateUploadCheckAtIso: null, completedAtIso: "2026-10-13T02:00:00.000Z" } })));
    render(<OwnerRecordingWithdrawal token={TOKEN} />);
    expect(await screen.findByText("Video withdrawn.")).toBeInTheDocument();
    expect(screen.getByText(/Our systems have stopped using it\./)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/We keep a copy of the video and any results already made, as our Privacy Policy describes\./);
    expect(screen.queryByText(/has been deleted|footage .*deleted/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });
});
