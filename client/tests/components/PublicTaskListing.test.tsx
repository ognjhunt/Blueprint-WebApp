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
  it("asks for the match fee only when the card is open to pilot proposals, and sends it", async () => {
    fetchMock.mockResolvedValueOnce(savedCard("not_seeking")).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<PublicTaskListing token="tok" />);

    const availability = await screen.findByLabelText(/pilot availability/i);
    expect(screen.queryByLabelText(/if blueprint finds a match/i)).toBeNull();

    fireEvent.change(availability, { target: { value: "open" } });
    const fee = screen.getByLabelText(/if blueprint finds a match/i);
    expect(fee).toBeRequired();
    fireEvent.click(fee);
    fireEvent.click(screen.getByLabelText(/authorized to make them public/i));
    fireEvent.click(screen.getByRole("button", { name: /save public card/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body)).toMatchObject({
      enabled: true, consent: true, matchFee: true, details: { opportunity: "open" },
    });
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
