/**
 * One price for self-directed entries, on every public surface.
 *
 * Two commercial models exist in this repo. The self-directed entry price
 * is `@/lib/evaluationPricing`'s $99 per entry. Invited participation in a
 * separately agreed, site-funded pilot project carries no team entry fee.
 * The retired model is
 * `@/lib/deploymentPricing`: $1,000 to evaluate a site-task, $10,000 on award.
 *
 * The second one was reachable. `/internal/opportunity-board` and its five
 * sub-routes were on a `public` layout with an offer flow attached, so a robot
 * team with the URL could read one price there and be quoted another by
 * `/api/agent-team/plan`. Nothing linked to them, which is why it went
 * unnoticed rather than why it was harmless.
 *
 * These tests pin the two facts that keep that from happening again: the
 * opportunity board is not public, and no module feeding a public page names
 * the other model's numbers.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { appRoutes } from "@/app/routes";

const repoRoot = path.resolve(__dirname, "../../..");

describe("the public surface carries one pricing model", () => {
  it("keeps every opportunity-board route off the public layout", () => {
    // Some entries carry no path (catch-alls), so this is optional-chained
    // rather than assumed.
    const boardRoutes = appRoutes.filter((route) =>
      route.path?.startsWith("/internal/opportunity-board"),
    );

    // If this is zero the test has stopped testing anything -- either the
    // routes were renamed or deleted, and either way the assertion below is
    // vacuous. Fail loudly rather than pass silently.
    expect(boardRoutes.length).toBeGreaterThanOrEqual(6);

    for (const route of boardRoutes) {
      expect(route.layout, `${route.path} must not be public`).toBe("protected");
      expect(route.requireRoles, `${route.path} must require a role`).toBeTruthy();
    }
  });

  it("keeps the award-fee model out of the modules that feed public pages", () => {
    // Read as text rather than imported, because the point is that the strings
    // are absent from the source a public page pulls in -- not that some export
    // happens to be unused today.
    const publicCopySources = [
      "client/src/data/publicSiteCopy.ts",
      "client/src/pages/Pricing.tsx",
      "client/src/pages/FAQ.tsx",
    ];

    for (const relativePath of publicCopySources) {
      const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
      // Comments are stripped first. What is forbidden is a price that ships,
      // not prose explaining why the model changed -- and the note left where
      // `pricingHero` used to be quotes the old claim verbatim so the next
      // reader knows what was removed. Scanning it would make this test
      // unpassable by the very comment that documents the fix.
      const shipped = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
      const claims = shipped.match(/\$1,000 to evaluate|total is \$10,000|\$10,000 in total/g);
      expect(claims, `${relativePath} still states the award-fee model`).toBeNull();
    }
  });

  it("states both the free invited path and the flat self-directed price", async () => {
    const { entryPrice } = await import("@/lib/evaluationPricing");
    const { faqItems } = await import("@/pages/FAQ");

    const paymentAnswer = faqItems.find((item) => item.question === "How is Blueprint paid?");
    expect(paymentAnswer).toBeTruthy();

    // The $99 path stays tied to the API, without turning the FAQ into an
    // arithmetic table or charging teams invited to a funded pilot project.
    expect(paymentAnswer?.answer).toContain("Invited robot teams pay no evaluation entry fee");
    expect(paymentAnswer?.answer).toContain(`$${entryPrice}`);
  });

  it("quotes a robot team the same price the server charges it", async () => {
    // The two had to be derived from one constant when the price was episodes
    // times a rate, and they still do now that it is a flat number -- a public
    // page and a server quote that disagree is the same bug either way.
    const { entryPrice } = await import("@/lib/evaluationPricing");
    const { screeningRunCostUsd } = await import("../../../server/utils/teamEvalCandidates");

    expect(screeningRunCostUsd()).toBe(entryPrice);
  });

  it("leaves no import of the renamed pricing module behind", async () => {
    // A stale `episodePricing` import would resolve to nothing, but a stale
    // *reference in prose* points the next reader at a file that no longer
    // exists, which is how a second price gets reintroduced by someone acting
    // in good faith.
    const tracked = execFileSync("git", ["ls-files", "client", "server", "e2e"], {
      cwd: repoRoot,
      encoding: "utf8",
    })
      .split("\n")
      .filter((file) => /\.(ts|tsx)$/.test(file));

    // This file names the old module in order to search for it, so it is the
    // one legitimate hit and is excluded by path rather than by a cuter needle.
    const selfPath = path.relative(repoRoot, __filename);
    const offenders = tracked.filter(
      (file) =>
        file !== selfPath
        && fs.readFileSync(path.join(repoRoot, file), "utf8").includes("episodePricing"),
    );

    expect(offenders).toEqual([]);
  });
});
