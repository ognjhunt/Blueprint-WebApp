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
    fireEvent.click(screen.getByRole("button", { name: /Book this pilot/ }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Pilot booked.*awaiting coordination/);
    expect(String(fetchMock.mock.calls[1][0])).toBe("/api/task-listings/owner/tok/book");
    expect(JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body)).toEqual({ recommendationId: "rec_1", authorized: true });
  });

  it("shows the evaluation the recommendation stands on, with the simulation boundary and free beta terms", async () => {
    const evidence = { episodesRun: 20, episodesSucceeded: 19, successRate: 0.95, passMarkSuccessRate: 0.9, passMarkSource: "job_terms",
      cycleTimeTargetSeconds: null, medianCycleSeconds: 12, cycleTimeMet: null, evaluatedAtIso: "2026-10-02T00:00:00Z",
      evidenceScope: "development_only", boundary: "Simulation estimate.", resultUrl: "/app/tasks/req1" };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendation: { ...recommendation, evidence }, booking: null }) });
    render(<RecommendedPilot token="tok" />);
    expect(await screen.findByText(/Acme Robotics evaluated your job: 19 of 20 simulated episodes succeeded \(95%\), meeting your pass mark of 90%/)).toBeInTheDocument();
    expect(screen.getByText(/Simulation estimate — the physical pilot measures the real result/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the evaluation results" })).toHaveAttribute("href", "/app/tasks/req1");
    expect(screen.getByLabelText(/authorized to book this pilot/i).closest("label")).toHaveTextContent(
      "Blueprint charges nothing during the beta; the pilot's cost is agreed with the robot team.");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("states what the simulation tested, and says so when it was not recorded", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendation: { ...recommendation,
      scoredTask: "Pick up the object and place it in the target area" }, booking: null }) });
    const { unmount } = render(<RecommendedPilot token="tok" />);
    const row = await screen.findByText("What the simulation tested");
    expect(row.nextElementSibling).toHaveTextContent(/^Pick up the object and place it in the target area\.This is the task the simulation scored\. It can be narrower than your job/);
    unmount();
    fetchMock.mockResolvedValueOnce(loaded());
    render(<RecommendedPilot token="tok" />);
    expect((await screen.findByText("What the simulation tested")).nextElementSibling)
      .toHaveTextContent(/^Not recorded\. Ask Blueprint what the simulation tested before you book\./);
  });

  it("offers no result link when the site cannot open the results", async () => {
    const evidence = { episodesRun: 20, episodesSucceeded: 18, successRate: 0.9, passMarkSuccessRate: 0.9, passMarkSource: "blueprint_default",
      cycleTimeTargetSeconds: null, medianCycleSeconds: null, cycleTimeMet: null, evaluatedAtIso: "2026-10-02T00:00:00Z",
      evidenceScope: "development_only", boundary: "Simulation estimate.", resultUrl: null };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendation: { ...recommendation, evidence }, booking: null }) });
    render(<RecommendedPilot token="tok" />);
    expect(await screen.findByText(/meeting Blueprint's pass mark of 90%/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See the evaluation results" })).toBeNull();
  });

  it("shows a booked pilot without a button", async () => {
    fetchMock.mockResolvedValueOnce(loaded({ recommendationId: "rec_1" }));
    render(<RecommendedPilot token="tok" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/Pilot booked.*awaiting coordination/);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the robot team's contact once booked, and withholds it after a withdrawal", async () => {
    const contact = { name: null, organization: "Acme Robotics", email: "team@example.test", phone: null };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendation, booking: { recommendationId: "rec_1" },
      pilotBooking: { bookedAtIso: "2026-10-15T00:00:00Z", contact, consentWithdrawn: false } }) });
    const { unmount } = render(<RecommendedPilot token="tok" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/agree the pilot's dates and terms directly/);
    expect(screen.getByRole("link", { name: "team@example.test" })).toHaveAttribute("href", "mailto:team@example.test");
    unmount();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendation, booking: { recommendationId: "rec_1" },
      pilotBooking: { bookedAtIso: "2026-10-15T00:00:00Z", contact: null, consentWithdrawn: true } }) });
    render(<RecommendedPilot token="tok" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/contact details are no longer shared/);
    expect(screen.queryByText("team@example.test")).toBeNull();
  });

  it("requires explicit authorization even for a programmatic form submission", async () => {
    fetchMock.mockResolvedValueOnce(loaded());
    render(<RecommendedPilot token="tok" />);
    const button = await screen.findByRole("button", { name: /Book this pilot/ });
    fireEvent.submit(button.closest("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not mark a different recommendation as booked", async () => {
    fetchMock.mockResolvedValueOnce(loaded({ recommendationId: "previous_rec" }));
    render(<RecommendedPilot token="tok" />);
    expect(await screen.findByRole("button", { name: /Book this pilot/ })).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([null, { ok: false }])("requires a positive server acknowledgment (%s)", async acknowledgment => {
    fetchMock.mockResolvedValueOnce(loaded()).mockResolvedValueOnce({ ok: true, json: async () => acknowledgment });
    render(<RecommendedPilot token="tok" />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /authorized to book/i }));
    fireEvent.click(screen.getByRole("button", { name: /Book this pilot/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not confirm.*Reopen your job page/);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("suppresses repeated clicks and recovers an interrupted acknowledgment by reloading", async () => {
    let rejectBooking!: (reason: Error) => void;
    fetchMock.mockResolvedValueOnce(loaded()).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectBooking = reject; }));
    const { unmount } = render(<RecommendedPilot token="tok" />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /authorized to book/i }));
    const form = screen.getByRole("button", { name: /Book this pilot/ }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    rejectBooking(new Error("response lost after server save"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not confirm/);
    expect(screen.queryByRole("status")).toBeNull();
    unmount();
    fetchMock.mockResolvedValueOnce(loaded({ recommendationId: "rec_1" }));
    render(<RecommendedPilot token="tok" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/Pilot booked.*awaiting coordination/);
    expect(fetchMock.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  });

  it("shows a stale recommendation conflict without booking success", async () => {
    fetchMock.mockResolvedValueOnce(loaded()).mockResolvedValueOnce({ ok: false, status: 409,
      json: async () => ({ error: "This recommendation has changed. Reopen your job page to see the current one." }) });
    render(<RecommendedPilot token="tok" />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /authorized to book/i }));
    fireEvent.click(screen.getByRole("button", { name: /Book this pilot/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/recommendation has changed/);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("resets the private recommendation and authorization on Back/Forward between links", async () => {
    let resolveSecond!: (value: unknown) => void;
    fetchMock.mockResolvedValueOnce(loaded()).mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
    const { rerender } = render(<RecommendedPilot token="first" />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /authorized to book/i }));
    rerender(<RecommendedPilot token="second" />);
    expect(screen.queryByText("Acme Robotics")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    resolveSecond({ ok: true, json: async () => ({ recommendation: { ...recommendation, id: "rec_2", teamName: "Second team" }, booking: null }) });
    expect(await screen.findByText("Second team")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /authorized to book/i })).not.toBeChecked();
    fetchMock.mockResolvedValueOnce(loaded({ recommendationId: "rec_1" }));
    rerender(<RecommendedPilot token="first" />);
    expect(screen.queryByText("Second team")).toBeNull();
    expect(await screen.findByRole("status")).toHaveTextContent(/Pilot booked.*awaiting coordination/);
  });

  it("ignores a late booking response from the previous private link", async () => {
    let resolveBooking!: (value: unknown) => void;
    fetchMock.mockResolvedValueOnce(loaded()).mockImplementationOnce(() => new Promise(resolve => { resolveBooking = resolve; }));
    const { rerender } = render(<RecommendedPilot token="first" />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /authorized to book/i }));
    fireEvent.click(screen.getByRole("button", { name: /Book this pilot/ }));
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendation: { ...recommendation, id: "rec_2" }, booking: null }) });
    rerender(<RecommendedPilot token="second" />);
    await screen.findByRole("button", { name: /Book this pilot/ });
    resolveBooking({ ok: true, json: async () => ({ ok: true }) });
    await waitFor(() => expect(screen.getByRole("button", { name: /Book this pilot/ })).toBeVisible());
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("checkbox", { name: /authorized to book/i })).not.toBeChecked();
  });
});
