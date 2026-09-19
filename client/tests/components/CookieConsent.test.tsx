// @vitest-environment jsdom
/**
 * The cookie banner is a marketing-surface affordance.
 *
 * The capture page is a tool someone was handed a link to: a consent dialog
 * covering the camera or the saved state is noise on the one page that only
 * sets essential cookies. These pin that the banner stays off that page and
 * still appears everywhere else.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CookieConsent } from "@/components/CookieConsent";

function atPath(path: string) {
  window.history.pushState({}, "", path);
}

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
    vi.advanceTimersByTime(1600);
  });
}

describe("cookie consent placement", () => {
  it("does not cover the capture tool", () => {
    atPath("/capture-upload/some-token");
    renderAndElapse();
    expect(screen.queryByRole("region", { name: "Cookie preferences" })).not.toBeInTheDocument();
  });

  it("still appears on the public site", () => {
    atPath("/contact/site-operator");
    renderAndElapse();
    expect(screen.getByRole("region", { name: "Cookie preferences" })).toBeInTheDocument();
  });

  it("stays hidden once a choice is recorded", () => {
    atPath("/contact/site-operator");
    window.localStorage.setItem(
      "blueprint_cookie_consent",
      JSON.stringify({ analytics: false, marketing: false, necessary: true }),
    );
    renderAndElapse();
    expect(screen.queryByRole("region", { name: "Cookie preferences" })).not.toBeInTheDocument();
  });
});
