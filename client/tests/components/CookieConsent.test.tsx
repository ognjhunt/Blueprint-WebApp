// @vitest-environment jsdom
/**
 * The cookie banner is a marketing-surface affordance.
 *
 * The capture page is a tool someone was handed a link to: a consent dialog
 * covering the camera or the saved state is noise on the one page that only
 * sets essential cookies. These pin that the banner stays off that page and
 * still appears everywhere else.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CookieConsent, getCookieConsent, openCookieSettings } from "@/components/CookieConsent";

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
  delete (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
});

function sendGlobalPrivacyControl() {
  Object.defineProperty(navigator, "globalPrivacyControl", { value: true, configurable: true });
}

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

  it("pre-selects no optional cookies in the details", () => {
    atPath("/contact/site-operator");
    renderAndElapse();
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    expect(screen.getByRole("checkbox", { name: /Analytics/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Marketing/ })).not.toBeChecked();
  });
});

describe("Global Privacy Control", () => {
  it("does not ask: the signal already keeps optional cookies off", () => {
    sendGlobalPrivacyControl();
    atPath("/contact/site-operator");
    renderAndElapse();
    expect(screen.queryByRole("region", { name: "Cookie preferences" })).not.toBeInTheDocument();
    expect(getCookieConsent()).toBeNull();
  });

  it("overrides an opt-in recorded without the signal", () => {
    window.localStorage.setItem(
      "blueprint_cookie_consent",
      JSON.stringify({ analytics: true, marketing: true, necessary: true }),
    );
    sendGlobalPrivacyControl();
    expect(getCookieConsent()).toMatchObject({ analytics: false, marketing: false, necessary: true });
  });

  it("still lets a visitor opt in explicitly from cookie settings", () => {
    sendGlobalPrivacyControl();
    atPath("/privacy");
    renderAndElapse();
    act(() => openCookieSettings());
    expect(screen.getByText(/Global Privacy Control signal/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Analytics/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /Analytics/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(getCookieConsent()).toMatchObject({ analytics: true, marketing: false, gpc: true });
  });
});
