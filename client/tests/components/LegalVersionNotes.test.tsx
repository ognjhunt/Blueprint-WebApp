/**
 * The 2026-10-15 reissue: the updated Terms and Privacy Policy are published
 * ahead of their effective date, the previous versions stay in force and stay
 * linked, and a dismissible banner announces the date until it arrives.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CurrentLegalVersionNote, LegalUpdateBanner, PreviousLegalVersionNote } from "@/components/site/LegalVersionNotes";

const BEFORE = new Date("2026-10-20T12:00:00Z");
const AFTER = new Date("2026-11-16T12:00:00Z");

function at(date: Date) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(date);
}

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("legal update notice", () => {
  it("announces the effective date until it arrives, and remembers a dismissal", () => {
    at(BEFORE);
    const { unmount } = render(<LegalUpdateBanner />);
    const banner = screen.getByRole("region", { name: "Terms and Privacy Policy update" });
    expect(banner).toHaveTextContent("take effect on November 15, 2026. Until then, the previous versions apply.");
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    fireEvent.click(screen.getByRole("button", { name: /Dismiss/ }));
    expect(screen.queryByRole("region", { name: "Terms and Privacy Policy update" })).toBeNull();
    unmount();
    render(<LegalUpdateBanner />);
    expect(screen.queryByRole("region", { name: "Terms and Privacy Policy update" })).toBeNull();
  });

  it("is gone once the update is in force", () => {
    at(AFTER);
    render(<LegalUpdateBanner />);
    expect(screen.queryByRole("region", { name: "Terms and Privacy Policy update" })).toBeNull();
  });

  it("links each version to the other and says which one applies", () => {
    at(BEFORE);
    render(<><CurrentLegalVersionNote document="terms" /><PreviousLegalVersionNote document="privacy" /></>);
    expect(screen.getByText(/This version takes effect on November 15, 2026/)).toHaveTextContent("(effective October 14, 2026) applies.");
    expect(screen.getByRole("link", { name: "previous version" })).toHaveAttribute("href", "/terms/previous");
    expect(screen.getByText(/This version applies until November 15, 2026/)).toHaveTextContent("updated Privacy Policy takes effect.");
    expect(screen.getByRole("link", { name: "updated Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });
});
