// @vitest-environment jsdom
/**
 * The laptop learning what the phone did — from the server, never a guess.
 *
 * Two rules make this honest rather than theater, and these tests pin both:
 * it shows only what the signed status actually returns, and when there is
 * nothing to show — no token, no headline yet, or a status it cannot read —
 * it renders nothing at all, so a page whose job is already done never sprouts
 * an error or a fabricated stage.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaptureLiveStatus } from "@/components/site/CaptureLiveStatus";

vi.mock("@/components/site/TaskClarification", () => ({TaskClarification: ({mode}: {mode?: string}) => <div>Inline {mode} questions</div>}));
vi.mock("@/components/site/TaskFollowUp", () => ({TaskFollowUp: () => <div>Inline follow-up questions</div>}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CAPTURE_URL = "https://tryblueprint.io/capture-upload/signed.token.value?x=1";

describe("the desktop reflecting the phone from server state", () => {
  it("shows loading immediately and retries a failed initial read inline",async()=>{
    fetchMock.mockResolvedValueOnce({ok:false}).mockResolvedValue({ok:true,json:async()=>({scope:"owner",status:{headline:"Video received"}})});
    render(<CaptureLiveStatus compact captureUrl={CAPTURE_URL} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading job updates");
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button",{name:"Retry job updates"}));
    await screen.findByText("Video received");
    expect(screen.queryByText("Inline follow-up questions")).not.toBeInTheDocument();
  });
  it("keeps the assessment's questions and proposed steps out of the compact saved-job view", async () => {
    fetchMock.mockResolvedValue({ok: true, json: async () => ({
      status: {headline: "Checking the work area", stage: "review"},
      siteAdvisory: {state: "ready", sections: [], unknowns: ["Generic caveat"], nextAction: "Generic proposal", correlationId: "fixture-reference"},
    })});
    render(<CaptureLiveStatus compact captureUrl={CAPTURE_URL} />);
    await screen.findByText("Checking the work area");
    expect(screen.queryByText("Your job assessment")).not.toBeInTheDocument();
    expect(screen.queryByText("Generic caveat")).not.toBeInTheDocument();
    expect(screen.queryByText("Generic proposal")).not.toBeInTheDocument();
    expect(screen.queryByText("Assessment notes")).not.toBeInTheDocument();
    expect(screen.getByText("Support reference").closest("details")).not.toHaveAttribute("open");
  });

  it("shows what the video shows in a disclosure, never a question or a step for the site", async () => {
    fetchMock.mockResolvedValue({ok: true, json: async () => ({
      status: {headline: "Checking the work area", stage: "review"},
      siteAdvisory: {state: "ready", sections: [{title: "Observed task", claims: [{text: "A carton moves from the conveyor to a tote.", verificationStatus: "source_bound", basis: "observed", evidence: [{kind: "video", atSeconds: 4}]}]}], unknowns: ["Question to resolve: What is the measured pull force?"], nextAction: "Recommended next step (proposal): Measure the carton weight.", correlationId: "fixture-reference"},
    })});
    render(<CaptureLiveStatus compact captureUrl={CAPTURE_URL} />);
    await screen.findByText("Assessment notes");
    expect(screen.getByText("Assessment notes").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("A carton moves from the conveyor to a tote.")).toBeInTheDocument();
    expect(screen.queryByText(/pull force/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Measure the carton weight/)).not.toBeInTheDocument();
    expect(screen.queryByText(/proposed next step/)).not.toBeInTheDocument();
  });

  it.each(["needs_review", "unavailable"])("keeps an assessment %s notice visible", async state => {
    fetchMock.mockResolvedValue({ok: true, json: async () => ({
      status: {headline: "Recording received", stage: "review"},
      siteAdvisory: {state, sections: [], unknowns: [], nextAction: null, correlationId: "fixture-reference"},
    })});
    render(<CaptureLiveStatus compact captureUrl={CAPTURE_URL} />);
    const notice = await screen.findByText(/Keep your original video/);
    expect(notice.closest("details")).toBeNull();
    expect(screen.queryByRole("link", {name: "Contact Blueprint"})).not.toBeInTheDocument();
  });

  it.each(["owner", "film"])("never shows answer forms, for signed %s authority either", async scope => {
    fetchMock.mockResolvedValue({ok: true, json: async () => ({scope,
      status: {headline: "Recording received", stage: "review"}, siteAdvisory: null,
    })});
    render(<CaptureLiveStatus compact captureUrl={CAPTURE_URL} />);
    await screen.findByText("Recording received");
    expect(screen.queryByText("Inline assessment questions")).not.toBeInTheDocument();
    expect(screen.queryByText("Inline follow-up questions")).not.toBeInTheDocument();
  });

  it("shows the stage the server reports, polling the token from the capture URL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: { headline: "Recording received — checking coverage", stage: "review" },
      }),
    });

    render(<CaptureLiveStatus captureUrl={CAPTURE_URL} />);

    await waitFor(() =>
      expect(screen.getByText(/Recording received — checking coverage/)).toBeInTheDocument(),
    );
    // The token is the one carried in the capture URL, query string stripped.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/site-task-brief/signed.token.value/status"),
      expect.objectContaining({signal: expect.any(AbortSignal)}),
    );
  });

  it("renders nothing until the server has a real headline to show", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: { headline: "", stage: null } }),
    });

    const { container } = render(<CaptureLiveStatus captureUrl={CAPTURE_URL} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Where this stands/)).not.toBeInTheDocument();
  });

  it("tells the page when the server holds the recording", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: { headline: "Checking coverage", stage: "review" }, captureReceived: true }),
    });
    const received = vi.fn();

    render(<CaptureLiveStatus captureUrl={CAPTURE_URL} onCaptureReceived={received} />);

    await waitFor(() => expect(received).toHaveBeenCalled());
  });

  it("never fetches or renders when the URL carries no capture token", () => {
    const { container } = render(
      <CaptureLiveStatus captureUrl="https://tryblueprint.io/somewhere-else" />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("stays silent when the status cannot be read, never surfacing an error", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const { container } = render(<CaptureLiveStatus captureUrl={CAPTURE_URL} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
