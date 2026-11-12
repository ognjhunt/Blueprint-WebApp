import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicTaskListing } from "@/components/site/PublicTaskListing";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const savedCard = (opportunity: string) => ({
  ok: true,
  json: async () => ({
    listing: { enabled: true, details: { title: "Move cartons onto a pallet", taskFamily: "Palletizing", opportunity } },
    thumbnailPng: null,
  }),
});

describe("the task page's public card", () => {
  it("keeps private-card sharing guidance inside the optional control until the owner chooses to publish", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ listing: null, draft: { details: { title: "Move cartons onto a pallet", taskFamily: "Palletizing", opportunity: "not_seeking" } }, thumbnailPng: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<PublicTaskListing token="tok" />);
    expect(await screen.findByText(/Your job card is not published/)).not.toBeVisible();
    expect(screen.getByText("Manage opportunity sharing (optional)").closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Manage opportunity sharing (optional)"));
    expect(screen.getByText(/Blueprint can process your recording while the card stays private/)).toBeVisible();
    fireEvent.click(screen.getByLabelText(/show this card in the job library/i));
    fireEvent.click(screen.getByLabelText(/authorized to make them public/i));
    fireEvent.click(screen.getByRole("button", { name: /publish reviewed card/i }));
    await screen.findByText(/Public card saved/);
    expect(screen.queryByText(/Your job card is not published/)).toBeNull();
  });

  it("waits to offer publishing until the job has an answer, and keeps a card already published editable", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ listing: null, draft: { details: { title: "Move cartons onto a pallet", taskFamily: "Palletizing", opportunity: "not_seeking" } }, thumbnailPng: null }) });
    const { unmount } = render(<PublicTaskListing token="tok" publishWaits />);
    fireEvent.click(await screen.findByText("Manage opportunity sharing (optional)"));
    expect(await screen.findByText("You can share your job once its job packet is ready.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /publish reviewed card/i })).toBeNull();
    expect(screen.queryByLabelText(/show this card in the job library/i)).toBeNull();
    unmount();
    fetchMock.mockResolvedValueOnce(savedCard("not_seeking"));
    render(<PublicTaskListing token="tok" publishWaits />);
    expect(await screen.findByRole("button", { name: /publish reviewed card/i })).toBeInTheDocument();
    expect(screen.queryByText(/once its job packet is ready/)).toBeNull();
  });

  // Review, 2026-11-12: why sharing waits is said by the job's phase.
  it.each([
    ["ended_by_site", "This job is closed, so it cannot be shared."],
    ["waiting_on_site", "Tell us what the job is first. Then you can share it."],
    ["building", "You can share your job once its job packet is ready."],
  ])("says why publishing waits for a job that is %s", async (phase, line) => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ listing: null, draft: { details: { title: "Move cartons onto a pallet", taskFamily: "Palletizing", opportunity: "not_seeking" } }, thumbnailPng: null }) });
    render(<PublicTaskListing token="tok" publishWaits waitPhase={phase} />);
    fireEvent.click(await screen.findByText("Manage opportunity sharing (optional)"));
    expect(await screen.findByText(line)).toBeVisible();
  });

  it("saves the card with a pilot price left unknown", async () => {
    fetchMock.mockResolvedValueOnce(savedCard("not_seeking")).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<PublicTaskListing token="tok" />);
    await screen.findByLabelText(/pilot availability/i);
    expect(screen.queryByLabelText(/budget|proposed pilot price|price status/i)).toBeNull();
    fireEvent.click(screen.getByLabelText(/authorized to make them public/i));
    fireEvent.click(screen.getByRole("button", { name: /publish reviewed card/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    expect(body.details).toMatchObject({ pilotBudget: "", pilotPriceStatus: "target_budget" });
  });

  it("opens the card to pilot proposals with no fee step", async () => {
    fetchMock.mockResolvedValueOnce(savedCard("not_seeking")).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<PublicTaskListing token="tok" />);

    const availability = await screen.findByLabelText(/pilot availability/i);
    fireEvent.change(availability, { target: { value: "open" } });
    expect(screen.queryByLabelText(/Blueprint's \$2,500 fee/i)).toBeNull();
    expect(screen.getByText(/Any later work needs separately agreed scope and cost/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/authorized to make them public/i));
    fireEvent.click(screen.getByRole("button", { name: /publish reviewed card/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    expect(body).toMatchObject({ enabled: true, consent: true, details: { opportunity: "open" } });
    expect(body.matchFee).toBeUndefined();
  });

  it("sends no fee agreement for an evaluation-only card", async () => {
    fetchMock.mockResolvedValueOnce(savedCard("not_seeking")).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<PublicTaskListing token="tok" />);
    await screen.findByLabelText(/pilot availability/i);

    fireEvent.click(screen.getByLabelText(/authorized to make them public/i));
    fireEvent.click(screen.getByRole("button", { name: /publish reviewed card/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body).matchFee).toBeUndefined();
  });
  it("retains a pending hide choice when the brief refreshes and clears public consent", async () => {
    fetchMock.mockResolvedValueOnce(savedCard("open")).mockResolvedValueOnce(savedCard("open"));
    const view = render(<PublicTaskListing token="tok" jobRevision="one" />);
    const publish = await screen.findByLabelText(/show this card/i);
    fireEvent.click(screen.getByLabelText(/authorized to make them public/i));
    fireEvent.click(publish);
    view.rerender(<PublicTaskListing token="tok" jobRevision="two" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(publish).not.toBeChecked();
    expect(screen.getByLabelText(/authorized to make them public/i)).not.toBeChecked();
    expect(screen.getByRole("button", { name: /save private draft/i })).toBeInTheDocument();
  });

});
