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
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaptureLiveStatus } from "@/components/site/CaptureLiveStatus";

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
