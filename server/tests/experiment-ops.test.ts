// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const growthEvents: Array<Record<string, unknown>> = [];
const experimentRollouts = new Map<string, Record<string, unknown>>();

function resetState() {
  growthEvents.length = 0;
  experimentRollouts.clear();
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name === "growth_events") {
        return {
          where() {
            return {
              orderBy() {
                return {
                  limit() {
                    return {
                      async get() {
                        return {
                          docs: growthEvents.map((event, index) => ({
                            id: `event-${index}`,
                            data: () => event,
                          })),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (name === "experiment_rollouts") {
        return {
          doc(id: string) {
            return {
              async set(payload: Record<string, unknown>) {
                experimentRollouts.set(id, {
                  ...(experimentRollouts.get(id) || {}),
                  ...payload,
                });
              },
            };
          },
          where() {
            return {
              async get() {
                return {
                  docs: [...experimentRollouts.entries()].map(([id, data]) => ({
                    id,
                    data: () => data,
                  })),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  },
}));

import {
  evaluateExperimentWinner,
  getActiveExperimentRollouts,
  runExperimentAutorollout,
} from "../utils/experiment-ops";

beforeEach(() => {
  resetState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("evaluateExperimentWinner", () => {
  it("activates the winning variant when lift clears the threshold", () => {
    const result = evaluateExperimentWinner({
      experimentKey: "exact_site_hosted_review_hero_v1",
      minExposuresPerVariant: 50,
      minRelativeLift: 0.1,
      variantMetrics: {
        proof_first: {
          exposures: 120,
          contactStarts: 20,
          contactSubmissions: 12,
          contactCompleted: 10,
        },
        speed_first: {
          exposures: 115,
          contactStarts: 14,
          contactSubmissions: 8,
          contactCompleted: 7,
        },
      },
    });

    expect(result.status).toBe("active");
    expect(result.winningVariant).toBe("proof_first");
    expect(result.primaryMetric).toBe("contactCompleted");
  });

  it("stays monitoring when fewer than two variants exist", () => {
    const result = evaluateExperimentWinner({
      experimentKey: "exact_site_hosted_review_hero_v1",
      minExposuresPerVariant: 50,
      minRelativeLift: 0.1,
      variantMetrics: {
        proof_first: {
          exposures: 120,
          contactStarts: 20,
          contactSubmissions: 12,
          contactCompleted: 10,
        },
      },
    });

    expect(result.status).toBe("monitoring");
    expect(result.winningVariant).toBeNull();
  });

  it("stays monitoring when variants are below the minimum exposures", () => {
    const result = evaluateExperimentWinner({
      experimentKey: "exact_site_hosted_review_hero_v1",
      minExposuresPerVariant: 100,
      minRelativeLift: 0.1,
      variantMetrics: {
        proof_first: {
          exposures: 80,
          contactStarts: 12,
          contactSubmissions: 8,
          contactCompleted: 5,
        },
        speed_first: {
          exposures: 70,
          contactStarts: 11,
          contactSubmissions: 7,
          contactCompleted: 4,
        },
      },
    });

    expect(result.status).toBe("monitoring");
    expect(result.rationale).toContain("100 exposures");
  });

  it("stays inconclusive when the lift is too small", () => {
    const result = evaluateExperimentWinner({
      experimentKey: "exact_site_hosted_review_hero_v1",
      minExposuresPerVariant: 50,
      minRelativeLift: 0.2,
      variantMetrics: {
        proof_first: {
          exposures: 90,
          contactStarts: 18,
          contactSubmissions: 11,
          contactCompleted: 8,
        },
        speed_first: {
          exposures: 92,
          contactStarts: 17,
          contactSubmissions: 10,
          contactCompleted: 7,
        },
      },
    });

    expect(result.status).toBe("inconclusive");
    expect(result.winningVariant).toBeNull();
  });

  it("uses exposure as the tiebreak when conversion rates match", () => {
    const result = evaluateExperimentWinner({
      experimentKey: "exact_site_hosted_review_hero_v1",
      minExposuresPerVariant: 50,
      minRelativeLift: 0.01,
      variantMetrics: {
        proof_first: {
          exposures: 150,
          contactStarts: 30,
          contactSubmissions: 18,
          contactCompleted: 12,
        },
        speed_first: {
          exposures: 100,
          contactStarts: 20,
          contactSubmissions: 12,
          contactCompleted: 8,
        },
      },
    });

    expect(result.status).toBe("inconclusive");
    expect(result.winningVariant).toBeNull();
    expect(result.conversionRates.proof_first).toBe(result.conversionRates.speed_first);
  });

  it("handles zero exposures without dividing by zero", () => {
    const result = evaluateExperimentWinner({
      experimentKey: "exact_site_hosted_review_hero_v1",
      minExposuresPerVariant: 50,
      minRelativeLift: 0.1,
      variantMetrics: {
        proof_first: {
          exposures: 0,
          contactStarts: 0,
          contactSubmissions: 0,
          contactCompleted: 0,
        },
        speed_first: {
          exposures: 0,
          contactStarts: 0,
          contactSubmissions: 0,
          contactCompleted: 0,
        },
      },
    });

    expect(result.status).toBe("monitoring");
    expect(result.conversionRates.proof_first).toBe(0);
    expect(result.conversionRates.speed_first).toBe(0);
  });
});

describe("runExperimentAutorollout", () => {
  it("aggregates exposures and contact events and persists the evaluation", async () => {
    for (let index = 0; index < 12; index += 1) {
      growthEvents.push({
        event: "experiment_exposure",
        created_at: new Date().toISOString(),
        properties: {
          experiment_key: "exact_site_hosted_review_hero_v1",
          variant: "proof_first",
        },
      });
    }

    for (let index = 0; index < 11; index += 1) {
      growthEvents.push({
        event: "experiment_exposure",
        created_at: new Date().toISOString(),
        properties: {
          experiment_key: "exact_site_hosted_review_hero_v1",
          variant: "speed_first",
        },
      });
    }

    growthEvents.push(
      {
        event: "contact_request_completed",
        created_at: new Date().toISOString(),
        experiments: {
          exact_site_hosted_review_hero_v1: "proof_first",
        },
      },
      {
        event: "contact_request_started",
        created_at: new Date().toISOString(),
        experiments: {
          exact_site_hosted_review_hero_v1: "speed_first",
        },
      },
    );

    const result = await runExperimentAutorollout({
      lookbackDays: 30,
      minExposuresPerVariant: 10,
      minRelativeLift: 0.1,
      limit: 100,
    });

    expect(result.count).toBe(1);
    expect(result.evaluations[0]).toMatchObject({
      experimentKey: "exact_site_hosted_review_hero_v1",
      status: "active",
      winningVariant: "proof_first",
    });
    expect(experimentRollouts.get("exact_site_hosted_review_hero_v1")).toMatchObject({
      experiment_key: "exact_site_hosted_review_hero_v1",
      winning_variant: "proof_first",
      primary_metric: "contactCompleted",
    });
  });

  it("returns no evaluations when no growth events exist", async () => {
    const result = await runExperimentAutorollout({
      lookbackDays: 30,
      minExposuresPerVariant: 1,
      minRelativeLift: 0.1,
      limit: 100,
    });

    expect(result).toEqual({
      count: 0,
      evaluations: [],
    });
  });

  it("exposes active rollouts from the stored evaluation records", async () => {
    experimentRollouts.set("exact_site_hosted_review_hero_v1", {
      experiment_key: "exact_site_hosted_review_hero_v1",
      status: "active",
      winning_variant: "proof_first",
    });

    const active = await getActiveExperimentRollouts();
    expect(active).toEqual({
      exact_site_hosted_review_hero_v1: "proof_first",
    });
  });
});
