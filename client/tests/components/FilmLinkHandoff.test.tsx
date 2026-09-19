// @vitest-environment jsdom
/**
 * Getting the record-only link to the person doing the filming.
 *
 * The point of this component is delegation: the owner sends a film-scoped link
 * to whoever is on the floor. The field asks for an email, because texting is
 * not wired into this repo yet — asking for a number that cannot be texted is
 * how a handoff quietly fails. These pin the email send, the email-only field,
 * the graceful server-error path that still hands over a shareable link, and
 * the copy-the-link-yourself route.
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
  fireEvent.change(screen.getByLabelText(/Email of whoever is filming/), { target: { value } });
}

describe("sending the film link", () => {
  it("sends the link by email and confirms it", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, channel: "email", sent: true }) });
    render(<FilmLinkHandoff token="tok" />);

    type("maria@floor.example");
    fireEvent.click(screen.getByRole("button", { name: /Send link/ }));

    await screen.findByText(/Sent to maria@floor.example/);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/film-link/send");
    expect(JSON.parse(String(init.body))).toMatchObject({ channel: "email", to: "maria@floor.example" });
  });

  it("asks for an email, not a phone number", () => {
    render(<FilmLinkHandoff token="tok" />);
    const input = screen.getByLabelText(/Email of whoever is filming/) as HTMLInputElement;
    // Texting is not configured in this repo; a phone-number field would
    // collect destinations the pipeline cannot deliver to.
    expect(input.type).toBe("email");
    expect(input.placeholder).toMatch(/email/i);
    expect(input.placeholder).not.toMatch(/\+1|phone/i);
  });

  it("shows the server's message and a copyable link when a send fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        ok: false,
        code: "email_unavailable",
        error: "We could not send that email. Copy the link and share it.",
        filmUrl: "https://app.example/capture-upload/filmtoken",
      }),
    });
    render(<FilmLinkHandoff token="tok" />);

    type("maria@floor.example");
    fireEvent.click(screen.getByRole("button", { name: /Send link/ }));

    await screen.findByText(/We could not send that email/);
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
