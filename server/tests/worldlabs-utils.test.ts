// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  storagePayloads: new Map<string, string>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  storageAdmin: {
    bucket: () => ({
      file: (objectPath: string) => ({
        download: async () => {
          const payload = state.storagePayloads.get(objectPath);
          if (!payload) {
            throw new Error(`missing payload for ${objectPath}`);
          }
          return [Buffer.from(payload, "utf-8")];
        },
      }),
    }),
  },
}));

import {
  DEFAULT_WORLDLABS_TEXT_PROMPT,
  readArtifactJson,
} from "../utils/worldlabs";

describe("World Labs webapp defaults", () => {
  it("keeps the canonical default text prompt available for generation flow", async () => {
    expect(DEFAULT_WORLDLABS_TEXT_PROMPT).toContain("Create a grounded, explorable Marble world");
    expect(DEFAULT_WORLDLABS_TEXT_PROMPT).toContain("Do not invent extra rooms");
  });

  it("can read a stored request manifest without a text prompt", async () => {
    state.storagePayloads.clear();
    state.storagePayloads.set(
      "scenes/demo/captures/cap/pipeline/worldlabs_request_manifest.json",
      JSON.stringify({
        generation_request: {
          model: "Marble 0.1-mini",
          permission: "private",
          world_prompt: {
            type: "video",
            video_prompt: {
              source: "media_asset",
            },
          },
        },
      }),
    );

    const payload = await readArtifactJson(
      "gs://blueprint-8c1ca.appspot.com/scenes/demo/captures/cap/pipeline/worldlabs_request_manifest.json",
    );

    expect(payload).toMatchObject({
      generation_request: {
        model: "Marble 0.1-mini",
      },
    });
  });
});
