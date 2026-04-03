// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const creativeFactoryRuns = new Map<string, Record<string, unknown>>();
const researchRuns: Array<Record<string, unknown>> = [];
const contactRequests: Array<Record<string, unknown>> = [];
const getActiveExperimentRollouts = vi.hoisted(() => vi.fn());
const generateGoogleCreativeImages = vi.hoisted(() => vi.fn());
const startRunwayImageToVideoTask = vi.hoisted(() => vi.fn());
const renderProductReel = vi.hoisted(() => vi.fn());

function resetState() {
  creativeFactoryRuns.clear();
  researchRuns.length = 0;
  contactRequests.length = 0;
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
      if (name === "autonomous_growth_runs") {
        return {
          orderBy() {
            return {
              limit() {
                return {
                  async get() {
                    return {
                      empty: researchRuns.length === 0,
                      docs: researchRuns.map((run, index) => ({
                        id: `research-${index}`,
                        data: () => run,
                      })),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (name === "creative_factory_runs") {
        return {
          doc(id: string) {
            return {
              async get() {
                return {
                  exists: creativeFactoryRuns.has(id),
                  data: () => creativeFactoryRuns.get(id),
                };
              },
              async set(payload: Record<string, unknown>) {
                creativeFactoryRuns.set(id, {
                  ...(creativeFactoryRuns.get(id) || {}),
                  ...payload,
                });
              },
            };
          },
        };
      }

      if (name === "contactRequests") {
        return {
          where() {
            return {
              orderBy() {
                return {
                  limit() {
                    return {
                      async get() {
                        return {
                          docs: contactRequests.map((request, index) => ({
                            id: `contact-${index}`,
                            data: () => request,
                          })),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          limit() {
            return {
              async get() {
                return {
                  docs: contactRequests.map((request, index) => ({
                    id: `contact-${index}`,
                    data: () => request,
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

vi.mock("../utils/experiment-ops", () => ({
  getActiveExperimentRollouts,
}));

vi.mock("../utils/google-creative", () => ({
  generateGoogleCreativeImages,
}));

vi.mock("../utils/runway", () => ({
  startRunwayImageToVideoTask,
}));

vi.mock("../utils/remotion-render", () => ({
  renderProductReel,
}));

import { runCreativeAssetFactoryLoop } from "../utils/creative-factory";

beforeEach(() => {
  resetState();
  getActiveExperimentRollouts.mockResolvedValue({
    exact_site_hosted_review_hero_v1: "proof_first",
  });
  researchRuns.push({
    topic: "warehouse robotics",
    signals: [
      {
        title: "Operators are narrowing facility pilots",
        summary: "Teams want one exact site before another travel-heavy review cycle.",
      },
    ],
  });
  contactRequests.push({
    message: "We need pricing clarity before another site visit.",
    summary: "Commercial question",
    voice_concierge: {
      category: "commercial_handoff",
      last_user_message: "What does this cost?",
    },
  });
  generateGoogleCreativeImages.mockResolvedValue({
    images: [
      {
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AAA",
      },
    ],
  });
  startRunwayImageToVideoTask.mockResolvedValue({
    id: "runway-task-1",
    model: "gen4_turbo",
    output: ["https://cdn.runway.test/output.mp4"],
  });
  renderProductReel.mockResolvedValue({
    outputPath: "/tmp/product-reel.mp4",
    storageUri: "gs://blueprint-8c1ca.appspot.com/creative-factory/test-run/product-reel.mp4",
    durationSeconds: 12,
    frames: 360,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("runCreativeAssetFactoryLoop", () => {
  it("skips when the run already exists", async () => {
    const today = new Date().toISOString().slice(0, 10);
    creativeFactoryRuns.set(`${today}__exact-site-hosted-review-warehouse-robotics`, {
      status: "assets_generated",
    });

    const result = await runCreativeAssetFactoryLoop();
    expect(result.status).toBe("skipped_existing");
    expect(generateGoogleCreativeImages).not.toHaveBeenCalled();
  });

  it("generates assets, records buyer objections, and renders a product reel", async () => {
    const result = await runCreativeAssetFactoryLoop();

    expect(result).toMatchObject({
      status: "assets_generated",
      generatedImages: 3,
      runwayTaskId: "runway-task-1",
      remotionReelPath: "/tmp/product-reel.mp4",
      remotionReelUri:
        "gs://blueprint-8c1ca.appspot.com/creative-factory/test-run/product-reel.mp4",
    });
    expect(generateGoogleCreativeImages).toHaveBeenCalledTimes(3);
    expect(startRunwayImageToVideoTask).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gen4_turbo",
      }),
    );
    expect(renderProductReel).toHaveBeenCalledWith(
      expect.objectContaining({
        runwayVideoUrl: "https://cdn.runway.test/output.mp4",
        storyboard: expect.any(Array),
      }),
    );

    const storedRun = [...creativeFactoryRuns.values()][0];
    expect(storedRun).toMatchObject({
      rollout_variant: "proof_first",
      research_topic: "warehouse robotics",
      buyer_objections: expect.arrayContaining(["pricing and commercial clarity"]),
      remotion_reel: expect.objectContaining({
        status: "rendered",
        output_path: "/tmp/product-reel.mp4",
        storage_uri:
          "gs://blueprint-8c1ca.appspot.com/creative-factory/test-run/product-reel.mp4",
      }),
    });
    expect((storedRun.kit as Record<string, unknown>).landingPage).toBeTruthy();
  });

  it("respects the Runway model override", async () => {
    vi.stubEnv("BLUEPRINT_RUNWAY_VIDEO_MODEL", "veo-3.1-fast");

    await runCreativeAssetFactoryLoop();

    expect(startRunwayImageToVideoTask).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "veo-3.1-fast",
      }),
    );
  });

  it("continues when image generation fails for all prompts", async () => {
    generateGoogleCreativeImages.mockRejectedValue(new Error("quota exceeded"));

    const result = await runCreativeAssetFactoryLoop();

    expect(result).toMatchObject({
      status: "prompt_pack_generated",
      generatedImages: 0,
      runwayTaskId: null,
      remotionReelPath: null,
    });
    expect(startRunwayImageToVideoTask).not.toHaveBeenCalled();
    expect(renderProductReel).not.toHaveBeenCalled();
  });

  it("stores a failed remotion status without failing the run", async () => {
    renderProductReel.mockRejectedValue(new Error("ffmpeg missing"));

    const result = await runCreativeAssetFactoryLoop();

    expect(result.status).toBe("assets_generated");
    const storedRun = [...creativeFactoryRuns.values()][0];
    expect(storedRun).toMatchObject({
      remotion_reel: {
        status: "failed",
        output_path: null,
        duration_seconds: null,
        frames: null,
        error: "ffmpeg missing",
      },
    });
  });
});
