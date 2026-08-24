import { describe, expect, it } from "vitest";

import {
  convergenceNote,
  deployedEnvironments,
  environmentsFootnote,
  qualifyingConditions,
  qualifyingStandard,
} from "@/data/qualifyingEnvironments";

/**
 * The standard is Blueprint's own, so these assertions guard the two things
 * that would make it dishonest: a condition that states only the happy case,
 * and a third-party deployment presented as if it were ours.
 */
describe("qualifying-environment standard", () => {
  it("states four gates, each with a test and a failure mode", () => {
    expect(qualifyingConditions).toHaveLength(4);
    qualifyingConditions.forEach((condition) => {
      expect(condition.test.trim().endsWith("?")).toBe(true);
      expect(condition.failure.length).toBeGreaterThan(20);
    });
    expect(new Set(qualifyingConditions.map((c) => c.id)).size).toBe(4);
  });

  it("keeps the headline count consistent with the number of gates", () => {
    expect(qualifyingStandard.headline).toBe(`${["", "One", "Two", "Three", "Four"][qualifyingConditions.length]} gates`);
  });

  it("scores every environment against real condition ids only", () => {
    const ids = new Set(qualifyingConditions.map((c) => c.id));
    expect(deployedEnvironments.length).toBeGreaterThan(0);
    deployedEnvironments.forEach((environment) => {
      expect(environment.satisfies.length).toBeGreaterThan(0);
      environment.satisfies.forEach((id) => expect(ids.has(id)).toBe(true));
    });
  });

  it("reserves the documented status for environments that clear all four gates", () => {
    deployedEnvironments.forEach((environment) => {
      if (environment.status === "documented") {
        expect(environment.satisfies).toHaveLength(qualifyingConditions.length);
      } else {
        // An emerging environment is emerging because it misses a specific gate.
        expect(environment.satisfies.length).toBeLessThan(qualifyingConditions.length);
      }
    });
  });

  it("cites a source for every environment and grades them all as published", () => {
    deployedEnvironments.forEach((environment) => {
      expect(environment.sources.length).toBeGreaterThan(0);
      expect(environment.basis).toBe("published");
      environment.sources.forEach((source) => {
        expect(source.href).toMatch(/^https:\/\//);
        expect(source.label.length).toBeGreaterThan(0);
      });
    });
  });

  it("keeps aggregate shipment volumes out of the environment evidence", () => {
    // The 97% humanoid share is charted elsewhere on the site and is properly
    // sourced. What stays out everywhere is the unpublished volume figure, and
    // neither belongs in an argument about which environments qualify.
    const serialized = JSON.stringify({ deployedEnvironments, qualifyingStandard, convergenceNote });
    expect(serialized).not.toMatch(/40,?000/);
    expect(serialized).not.toMatch(/19,?100/);
  });

  it("disclaims ownership of the cited deployments", () => {
    expect(environmentsFootnote).toMatch(/none is a Blueprint customer/i);
    expect(environmentsFootnote).toMatch(/none was prepared by Blueprint/i);
  });

  it("argues the convergence about the environment, not a company", () => {
    expect(convergenceNote.claim).toMatch(/evidence about the environment/i);
    expect(convergenceNote.reason).toMatch(/all four/i);
  });
});
