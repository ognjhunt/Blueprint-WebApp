/**
 * The 2026-10-15 reissue: the updated Terms and Privacy Policy are published
 * ahead of their effective date, the previous versions stay in force and stay
 * linked, and a dismissible banner announces the date until it arrives.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CurrentLegalVersionNote, LegalUpdateBanner, PreviousLegalVersionNote } from "@/components/site/LegalVersionNotes";
import { NO_TESTED_ANSWER_VERSION, legalEffectiveAtMs, legalEffectiveDate } from "@/lib/legalAcceptance";

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
// (owner decision 1: Anthropic for new jobs); the Terms did not change and keep 2026-11-12.2. On 2026-11-17 Terms and
// Privacy 2026-11-17.1 replaced Terms 2026-11-12.2 (effective November 12) and Privacy 2026-11-13.1 (effective
// November 13) at once (owner: no face blurring for new jobs). On 2026-11-19 Terms and Privacy 2026-11-19.1 replaced
// both 2026-11-17.1 documents (effective November 17) at once (owner: the early trial dropped). On 2026-11-21 Terms and
// Privacy 2026-11-21.1 replaced both 2026-11-19.1 documents (effective November 19) at once (owner: the launch-copy
// legal edits), and the current version's note lists the past versions by date (launch copy g-047). On 2026-11-23
// Privacy 2026-11-23.1 replaced Privacy 2026-11-21.1 (effective November 21) at once (owner: a company sees the city,
// state and country of a job); the Terms did not change and kept 2026-11-21.1. Later on 2026-11-23 Terms and Privacy
// 2026-11-23.2 replaced Terms 2026-11-21.1 (effective November 21) and Privacy 2026-11-23.1 (effective the same day) at
// once (owner: a company applies, and a site sees its name and website and accepts it). Later again on 2026-11-23 Terms
// 2026-11-23.3 replaced Terms 2026-11-23.2 (effective the same day) at once (owner: a company's estimate is its own,
// before a site visit, not a quote); the Privacy Policy did not change and kept 2026-11-23.2. Later still on 2026-11-23
// Terms 2026-11-23.4 replaced Terms 2026-11-23.3 (effective the same day) at once (owner: a model in a simulation from a
// public library stays under its own license; Blueprint does not own it and the Terms do not restrict it); the Privacy
// Policy did not change and kept 2026-11-23.2. On 2026-11-25 Terms and Privacy 2026-11-25.2 replaced Terms 2026-11-23.4
// and Privacy 2026-11-23.2 (both effective November 23) at once (owner: our first look stays with the site, and a
// company answers Apply, Not a fit or Need more details).
describe("legal update notice", () => {
  it("announces nothing while no update is pending", () => {
    at(new Date(legalEffectiveAtMs(NO_TESTED_ANSWER_VERSION) + 4 * 3_600_000));
    render(<LegalUpdateBanner />);
    expect(screen.queryByRole("region", { name: "Terms and Privacy Policy update" })).toBeNull();
  });

  it("is gone later too", () => {
    at(AFTER);
    render(<LegalUpdateBanner />);
    expect(screen.queryByRole("region", { name: "Terms and Privacy Policy update" })).toBeNull();
  });

  it("links each version to the other and says which one applies", () => {
    at(new Date(legalEffectiveAtMs(NO_TESTED_ANSWER_VERSION) + 4 * 3_600_000));
    render(<><CurrentLegalVersionNote document="terms" /><PreviousLegalVersionNote document="privacy" /></>);
    // Stress test, 2026-11-24: same-day versions are told apart by their ids, said in these shared notes only.
    expect(screen.getByText("Version 2026-11-25.2.")).toBeVisible();
    expect(screen.getByText(/This version replaced the/)).toHaveTextContent("(version 2026-11-23.4, effective November 23, 2026).");
    expect(screen.getByRole("link", { name: "previous version" })).toHaveAttribute("href", "/terms/previous");
    expect(screen.getByText("Version 2026-11-23.2.")).toBeVisible();
    expect(screen.getByText(`This version applied until ${legalEffectiveDate(NO_TESTED_ANSWER_VERSION)}, when the`, { exact: false }))
      .toHaveTextContent("current Privacy Policy (version 2026-11-25.2) took effect.");
    expect(screen.getByRole("link", { name: "current Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });

  // Launch copy g-047 (Terms and Privacy 2026-11-21.1): a site's job keeps the Privacy version it was started under, so
  // the current version lists every past version kept here by its effective date. Only the previous one is online.
  it("lists the past versions by date under the current version, linking only the previous one", () => {
    at(new Date(legalEffectiveAtMs(NO_TESTED_ANSWER_VERSION) + 4 * 3_600_000));
    const { container, unmount } = render(<CurrentLegalVersionNote document="terms" />);
    const details = container.querySelector("details")!;
    expect(details.querySelector("summary")).toHaveTextContent("Past versions");
    // Terms 2026-11-23.4 was replaced on November 25. 2026-11-23.3 was replaced by 2026-11-23.4, and 2026-11-23.2 by
    // 2026-11-23.3, on the day each took effect, as 2026-11-12.1 was by 2026-11-12.2.
    expect([...details.querySelectorAll("li")].map(item => item.textContent)).toEqual([
      "Version 2026-11-23.4, effective November 23, 2026",
      "Version 2026-11-23.3, effective November 23, 2026, replaced the same day",
      "Version 2026-11-23.2, effective November 23, 2026, replaced the same day",
      "Version 2026-11-21.1, effective November 21, 2026", "Version 2026-11-19.1, effective November 19, 2026",
      "Version 2026-11-17.1, effective November 17, 2026", "Version 2026-11-12.2, effective November 12, 2026",
      "Version 2026-11-12.1, effective November 12, 2026, replaced the same day", "Version 2026-11-02.1, effective November 2, 2026",
    ]);
    expect([...details.querySelectorAll("li a")].map(link => link.getAttribute("href"))).toEqual(["/terms/previous"]);
    expect(details.querySelector('a[href^="mailto:"]')).toHaveAttribute("href", "mailto:legal@tryblueprint.io");
    expect(details).toHaveTextContent("Only the previous version is online.");
    unmount();
    const privacy = render(<CurrentLegalVersionNote document="privacy" />).container.querySelector("details")!;
    // Privacy 2026-11-23.2 was replaced on November 25; 2026-11-23.1 was replaced by 2026-11-23.2 on the day it took effect.
    expect([...privacy.querySelectorAll("li")].map(item => item.textContent)).toEqual([
      "Version 2026-11-23.2, effective November 23, 2026",
      "Version 2026-11-23.1, effective November 23, 2026, replaced the same day", "Version 2026-11-21.1, effective November 21, 2026",
      "Version 2026-11-19.1, effective November 19, 2026", "Version 2026-11-17.1, effective November 17, 2026",
      "Version 2026-11-13.1, effective November 13, 2026", "Version 2026-11-12.2, effective November 12, 2026",
      "Version 2026-11-02.1, effective November 2, 2026",
    ]);
    expect([...privacy.querySelectorAll("li a")].map(link => link.getAttribute("href"))).toEqual(["/privacy/previous"]);
    expect(privacy.querySelector('a[href^="mailto:"]')).toHaveAttribute("href", "mailto:privacy@tryblueprint.io");
  });
});
