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
  it("saves the card with a pilot price left unknown", async () => {
    fetchMock.mockResolvedValueOnce(savedCard("not_seeking")).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<PublicTaskListing token="tok" />);
    await screen.findByLabelText(/pilot availability/i);
    fireEvent.change(screen.getByLabelText(/pilot price status/i), { target: { value: "site_offer" } });
    expect(screen.getByLabelText(/proposed pilot price/i)).not.toBeRequired();
    fireEvent.click(screen.getByLabelText(/authorized to make them public/i));
    fireEvent.click(screen.getByRole("button", { name: /save public card/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    expect(body.details).toMatchObject({ pilotBudget: "", pilotPriceStatus: "site_offer" });
  });

  it("opens the card to pilot proposals with no fee step", async () => {
    fetchMock.mockResolvedValueOnce(savedCard("not_seeking")).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<PublicTaskListing token="tok" />);

    const availability = await screen.findByLabelText(/pilot availability/i);
    fireEvent.change(availability, { target: { value: "open" } });
    expect(screen.queryByLabelText(/Blueprint's \$2,500 fee/i)).toBeNull();
    expect(screen.getByText(/you pay only if you book the pilot we recommend/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/authorized to make them public/i));
    fireEvent.click(screen.getByRole("button", { name: /save public card/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /save public card/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body).matchFee).toBeUndefined();
  });
});
