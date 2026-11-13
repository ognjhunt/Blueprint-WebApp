/**
 * The 2026-10-15 reissue: the updated Terms and Privacy Policy are published
 * ahead of their effective date, the previous versions stay in force and stay
 * linked, and a dismissible banner announces the date until it arrives.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CurrentLegalVersionNote, LegalUpdateBanner, PreviousLegalVersionNote } from "@/components/site/LegalVersionNotes";

// The 2026-11-11 revision (filming visits retired) follows the same convention.
const AFTER = new Date("2026-11-26T12:00:00Z");

function at(date: Date) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(date);
}

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

// 2026-11-12 (sharing is the service): the new version 2026-11-12.1 took effect at once, replacing the version published
// ahead for November 25 before that date, so no update is announced; the notes say which version replaced which. Later the
// same day 2026-11-12.2 replaced 2026-11-12.1 at once (owner: no limit on introductions), so the Terms' previous version
// is now 2026-11-12.1 (effective November 12). On 2026-11-13 Privacy 2026-11-13.1 replaced Privacy 2026-11-12.2 at once
// (owner decision 1: Anthropic for new jobs); the Terms did not change and keep 2026-11-12.2.
describe("legal update notice", () => {
  it("announces nothing while no update is pending", () => {
    at(new Date("2026-11-13T12:00:00Z"));
    render(<LegalUpdateBanner />);
    expect(screen.queryByRole("region", { name: "Terms and Privacy Policy update" })).toBeNull();
  });

  it("is gone later too", () => {
    at(AFTER);
    render(<LegalUpdateBanner />);
    expect(screen.queryByRole("region", { name: "Terms and Privacy Policy update" })).toBeNull();
  });

  it("links each version to the other and says which one applies", () => {
    at(new Date("2026-11-13T12:00:00Z"));
    render(<><CurrentLegalVersionNote document="terms" /><PreviousLegalVersionNote document="privacy" /></>);
    expect(screen.getByText(/This version replaced the/)).toHaveTextContent("(effective November 12, 2026).");
    expect(screen.getByRole("link", { name: "previous version" })).toHaveAttribute("href", "/terms/previous");
    expect(screen.getByText(/This version applied until November 13, 2026/)).toHaveTextContent("current Privacy Policy took effect.");
    expect(screen.getByRole("link", { name: "current Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });
});
