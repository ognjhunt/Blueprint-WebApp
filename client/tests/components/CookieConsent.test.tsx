// @vitest-environment jsdom
/**
 * The website stores only what it needs to work, which needs no consent, so no
 * banner appears on a first visit. Cookie settings still open from the footer
 * link and the Privacy Policy, and say plainly that only essential storage is used.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CookieConsent, openCookieSettings } from "@/components/CookieConsent";

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

function renderAndElapse() {
  render(<CookieConsent />);
  act(() => {
    vi.advanceTimersByTime(3000);
  });
}

describe("cookie settings", () => {
  it("shows no banner on a first visit", () => {
    window.history.pushState({}, "", "/");
    renderAndElapse();
    expect(screen.queryByRole("region", { name: "Cookie preferences" })).not.toBeInTheDocument();
  });

  it("opens from cookie settings, says only essential storage is used and offers no choice", () => {
    window.history.pushState({}, "", "/privacy");
    renderAndElapse();
    act(() => openCookieSettings());
    const panel = screen.getByRole("region", { name: "Cookie preferences" });
    expect(panel).toHaveTextContent(/only essential cookies and browser storage/);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept|Reject|Save/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close cookie settings" }));
    expect(screen.queryByRole("region", { name: "Cookie preferences" })).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });
});
