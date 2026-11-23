// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
import { notifySlackScreeningCallNeeded } from "../utils/slack";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function sent(screenGateEnded?: boolean) {
  vi.stubEnv("SLACK_INBOUND_WEBHOOK_URL", "https://hooks.example.invalid/x");
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
  await notifySlackScreeningCallNeeded({ requestId: "job-1", openQuestions: ["Cycle time — not sure"],
    ...(screenGateEnded === undefined ? {} : { screenGateEnded }) });
  return JSON.parse(String(fetchSpy.mock.calls[0][1]!.body)).text as string;
}

// Owner decision 2026-11-11: only a job uploaded after it is past the screen.
it("tells staff a job from before the change still needs its call before its scene is built", async () => {
  expect(await sent()).toMatch(/Site needs a screening call before its scene is built/);
  expect(await sent(false)).toMatch(/Site needs a screening call before its scene is built/);
});

it("tells staff the screen is only a note for a job uploaded after the change", async () => {
  const text = await sent(true);
  expect(text).toMatch(/a note; it does not hold the scene/);
  expect(text).not.toMatch(/before its scene is built/);
});
