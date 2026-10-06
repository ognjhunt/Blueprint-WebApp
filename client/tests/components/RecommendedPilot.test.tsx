import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecommendedPilot } from "@/components/site/RecommendedPilot";

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });

const recommendation = {
  id: "rec_1", teamName: "Acme Robotics", purpose: "Test carton palletizing at line 3",
  siteProvides: "One escort and a 2-hour window", teamProvides: "Robot, setup and operation",
  pilotCost: "$18,000", window: "Weeks of 3 and 10 November", uncertainties: "Shrink-wrapped cartons",
};
const loaded = (booking: unknown = null) => ({
  ok: true, json: async () => ({ listing: null, thumbnailPng: null, recommendation, booking }),
});

describe("the recommended pilot", () => {
  it("renders nothing until Blueprint recommends a pilot", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendation: null, booking: null }) });
    const { container } = render(<RecommendedPilot token="tok" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows one recommendation and books it in one step", async () => {
    fetchMock.mockResolvedValueOnce(loaded()).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<RecommendedPilot token="tok" />);
    expect(await screen.findByRole("heading", { name: "Your recommended pilot" })).toBeInTheDocument();
    expect(screen.getByText("Acme Robotics")).toBeInTheDocument();
    expect(screen.getByText("Shrink-wrapped cartons")).toBeInTheDocument();

    const authorize = screen.getByLabelText(/authorized to book this pilot/i);
    expect(authorize).toBeRequired();
    fireEvent.click(authorize);
    fireEvent.click(screen.getByRole("button", { name: /Book this pilot · \$2,500 Blueprint fee/ }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Booked/);
    expect(String(fetchMock.mock.calls[1][0])).toBe("/api/task-listings/owner/tok/book");
    expect(JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body)).toEqual({ recommendationId: "rec_1", authorized: true });
  });

  it("shows a booked pilot without a button", async () => {
    fetchMock.mockResolvedValueOnce(loaded({ recommendationId: "rec_1" }));
    render(<RecommendedPilot token="tok" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/Booked/);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
