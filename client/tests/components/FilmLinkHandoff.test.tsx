// @vitest-environment jsdom
/**
 * Getting the record-only link to the person doing the filming.
 *
 * The point of this component is delegation: the owner sends a film-scoped link
 * to whoever is on the floor. These pin that the channel is inferred from the
 * destination, and that when texting is off the operator is told and handed the
 * link to share rather than left thinking it went.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers ?? {},
}));

import { FilmLinkHandoff } from "@/components/site/FilmLinkHandoff";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function type(value: string) {
  fireEvent.change(screen.getByLabelText(/Phone number or email/), { target: { value } });
}

describe("the channel is inferred from what the owner types", () => {
  it("emails when the destination has an @, and confirms it sent", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, channel: "email", sent: true }) });
    render(<FilmLinkHandoff token="tok" />);

    type("maria@floor.example");
    fireEvent.click(screen.getByRole("button", { name: /Send link/ }));

    await screen.findByText(/Sent to maria@floor.example/);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/film-link/send");
    expect(JSON.parse(String(init.body))).toMatchObject({ channel: "email", to: "maria@floor.example" });
  });

  it("texts when the destination is a phone number", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, channel: "sms", sent: true }) });
    render(<FilmLinkHandoff token="tok" />);

    type("+15551234567");
    fireEvent.click(screen.getByRole("button", { name: /Send link/ }));

    await screen.findByText(/Sent to \+15551234567/);
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({
      channel: "sms",
    });
  });
});

describe("when texting is off, say so and hand over the link", () => {
  it("shows the fallback message and a copyable link", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        ok: false,
        code: "sms_unavailable",
        error: "Text messaging is not set up here yet. Send it by email, or copy the link and share it.",
        filmUrl: "https://app.example/capture-upload/filmtoken",
      }),
    });
    render(<FilmLinkHandoff token="tok" />);

    type("+15551234567");
    fireEvent.click(screen.getByRole("button", { name: /Send link/ }));

    await screen.findByText(/Text messaging is not set up/);
    const link = screen.getByLabelText(/Record-only link to copy/) as HTMLInputElement;
    expect(link.value).toBe("https://app.example/capture-upload/filmtoken");
  });
});

describe("the owner can still copy a link to share by hand", () => {
  it("mints a record-only link on demand", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, filmUrl: "https://app.example/capture-upload/copytoken" }),
    });
    render(<FilmLinkHandoff token="tok" />);

    fireEvent.click(screen.getByRole("button", { name: /copy a record-only link/ }));

    await waitFor(() => {
      const link = screen.getByLabelText(/Record-only link to copy/) as HTMLInputElement;
      expect(link.value).toBe("https://app.example/capture-upload/copytoken");
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/film-link");
  });
});
