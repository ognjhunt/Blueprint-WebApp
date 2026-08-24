import { describe, expect, it } from "vitest";

import {
  bomVersusDeployment,
  bottleneckChain,
  capAdoption,
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

describe("primary-source figures verified against the June 2026 deck", () => {
  it("carries the deployment fee's model dependence rather than one number", () => {
    const fee = perRobotEconomics.find((row) => row.id === "deployment-fee");
    expect(fee?.value).toBe("~$25,000");
    // The deck prices the fee differently under ownership; the site says so.
    expect(fee?.note).toMatch(/\$20,000/);
  });

  it("keeps the recurring cost of delivery alongside the one-time cost", () => {
    const delivery = perRobotEconomics.find((row) => row.id === "delivery");
    expect(delivery?.value).toBe("~$15,000 / yr");
    expect(delivery?.basis).toBe("illustrative");
  });

  it("sets deployment cost against the robot's bill of materials", () => {
    expect(bomVersusDeployment.bom).toBe("~$125,000");
    expect(bomVersusDeployment.deployment).toBe("~$15,000");
    expect(bomVersusDeployment.basis).toBe("illustrative");
  });

  it("reports program adoption exactly as the deck's footnote states it", () => {
    expect(capAdoption.totalNamed).toBe(capAdoption.named.length);
    expect(capAdoption.throughProgram).toBe(1);
    expect(capAdoption.named).toContain(capAdoption.throughProgramName);
    expect(capAdoption.headline).toBe(
      `${capAdoption.throughProgram} of ${capAdoption.totalNamed}`,
    );
    expect(capAdoption.basis).toBe("published");
  });
});
