import { describe, expect, it } from "vitest";

import {
  bottleneckChain,
  contractedAnchor,
  deploymentCostSplit,
  deploymentPipelineMeta,
  installations2024,
  installationTotals,
  marketSources,
  observedDeployments,
  oemDeploymentPhases,
  perRobotEconomics,
} from "@/data/deploymentMarket";

/**
 * These assertions guard the one rule the public site cannot break: every
 * charted number carries a real source, and any number a third party called an
 * assumption is graded `illustrative` rather than passed off as a transaction.
 */
describe("deployment market evidence", () => {
  it("keeps Blueprint scoped to the first phase of the published OEM path", () => {
    expect(oemDeploymentPhases.map((phase) => phase.window)).toEqual([
      "Months 0–2",
      "Months 2–3",
      "Months 4–6",
      "Month 6+",
    ]);
    expect(oemDeploymentPhases.filter((phase) => phase.blueprint)).toEqual([
      expect.objectContaining({ window: "Months 0–2" }),
    ]);
  });

  it("lays the phases out on a monotonic, gapless month axis", () => {
    oemDeploymentPhases.forEach((phase, index) => {
      expect(phase.endMonth).toBeGreaterThan(phase.startMonth);
      if (index > 0) {
        expect(phase.startMonth).toBe(oemDeploymentPhases[index - 1].endMonth);
      }
    });
  });

  it("grades every modelled economic figure as illustrative, never published", () => {
    perRobotEconomics.forEach((row) => {
      expect(row.basis).toBe("illustrative");
    });
    expect(deploymentPipelineMeta.basis).toBe("illustrative");
    expect(deploymentPipelineMeta.caveat).toMatch(/illustrative/i);
    expect(deploymentCostSplit.basis).toBe("illustrative");
    expect(deploymentCostSplit.known).toMatch(/does not publish/i);
  });

  it("links every source to a primary document", () => {
    expect(marketSources.ifr2025.href).toContain("ifr.org");
    expect(marketSources.agilityDeck.href).toContain("sec.gov");
    expect(marketSources.agilityProcess.href).toContain("agilityrobotics.com");
    expect(marketSources.gxoAgreement.href).toContain("gxo.com");
    Object.values(marketSources).forEach((source) => {
      expect(source.href).toMatch(/^https:\/\//);
    });
  });

  it("charts the installation gap as IFR reported it", () => {
    const china = installations2024.find((row) => row.emphasis === "china");
    const us = installations2024.find((row) => row.emphasis === "us");
    expect(china?.units).toBe(295_000);
    expect(us?.units).toBe(34_200);
    expect(installationTotals.basis).toBe("published");
    // The headline ratio on the page must follow from the charted bars.
    expect(installationTotals.chinaToUsRatio).toBeCloseTo(
      Number(((china?.units ?? 0) / (us?.units ?? 1)).toFixed(1)),
      1,
    );
  });

  it("names exactly one binding constraint", () => {
    expect(bottleneckChain.filter((link) => link.state === "binding")).toHaveLength(1);
    expect(bottleneckChain.find((link) => link.state === "binding")?.id).toBe("deployment");
  });

  it("sources every observed deployment it times", () => {
    expect(observedDeployments.length).toBeGreaterThan(0);
    observedDeployments.forEach((entry) => {
      expect(entry.sources.length).toBeGreaterThan(0);
      expect(entry.elapsedMonths).toBeGreaterThan(0);
      entry.sources.forEach((source) => expect(source.href).toMatch(/^https:\/\//));
    });
  });

  it("shows the contracted anchor's arithmetic rather than asserting a price", () => {
    expect(contractedAnchor.basis).toBe("published");
    expect(contractedAnchor.derivation).toMatch(/÷/);
    expect(contractedAnchor.note).toMatch(/milestones/i);
  });
});
