/**
 * The promise a site reads before consenting has to match the one it reads
 * before buying.
 *
 * Two documents described the same thing differently. `/pricing` said, as an
 * absolute, that robot teams "never receive your recording". The privacy annex
 * said buyer visibility of raw walkthrough media "depends on listing rights and
 * privacy state" -- a conditional. A site consents on the strength of the first
 * and is bound by the second, so the disagreement pointed the wrong way.
 *
 * The absolute is the true one. These tests keep the annex from drifting back
 * into a conditional, and keep the pricing page from softening.
 */
import { describe, expect, it } from "vitest";

import { capturePrivacyAnnex } from "@/pages/Privacy";
import { siteAssessment } from "@/lib/episodePricing";

function annexRow(label: string): string {
  const row = capturePrivacyAnnex.find((entry) => entry[0] === label);
  expect(row, `annex row "${label}" is missing`).toBeTruthy();
  return row![1];
}

describe("raw walkthrough media", () => {
  it("is never delivered to a buyer, with no rights carve-out", () => {
    const detail = annexRow("Raw walkthrough media");

    expect(detail).toMatch(/never delivered to a robot team/i);
    // The specific softener that used to be here. A right that "depends" is a
    // right that can be granted, which is the opposite of the promise.
    expect(detail).not.toMatch(/visibility depends/i);
    expect(detail).toMatch(/no listing right/i);
  });

  it("is excluded from the scope of every sharing agreement", () => {
    expect(annexRow("Buyer sharing")).toMatch(/raw walkthrough is outside the scope/i);
  });

  it("says what a policy is sent instead, because the promise alone is not enough", () => {
    // A vision policy served through an endpoint has to be sent something to
    // look at. Saying only "never the recording" leaves a site to assume
    // nothing visual reaches the team, which is false.
    const detail = annexRow("What a robot team's policy is sent");

    expect(detail).toMatch(/rendered from the reconstructed scene/i);
    expect(detail).toMatch(/never the walkthrough/i);
    expect(detail).toMatch(/not licensed for training/i);
  });

  it("agrees with the pricing page it is read alongside", () => {
    expect(siteAssessment.whatWeGetFromIt).toMatch(/never receive your recording/i);
  });
});
