// @vitest-environment node
import { describe, expect, it } from "vitest";
import { selectBrowserPending, type BrowserPending } from "../utils/websiteBrowserPending";

const pending = (generation: string, state: BrowserPending["state"] = "held"): BrowserPending => ({
  schema_version: "website_browser_pending.v1", request_id: "r1", scene_id: "site-r1",
  capture_id: "walkthrough-r1", state, completed_at_iso: "2026-09-29T00:00:00.000Z",
  video: { object_name: "scenes/site-r1/captures/walkthrough-r1/raw/walkthrough.mp4",
    generation, size_bytes: 7, crc32c: "AAAAAA==" },
  manifest: { object_name: "scenes/site-r1/captures/walkthrough-r1/raw/manifest.json",
    generation: `${generation}1`, size_bytes: 8, crc32c: "AAAAAA==",
    sha256: `sha256:${"a".repeat(64)}` },
});

describe("browser pending upload identity", () => {
  it("replays the first exact held identity without changing its completion time", () => {
    expect(selectBrowserPending(pending("1"), pending("1"))).toEqual({
      action: "replay", selected: pending("1"),
    });
  });
  it("refuses a later V2 while V1 is held, rather than pairing V1 privacy with V2", () => {
    expect(selectBrowserPending(pending("1"), pending("2"))).toEqual({ action: "conflict" });
  });
  it("allows a new original delivery after the earlier one has published", () => {
    expect(selectBrowserPending(pending("1", "published"), pending("2"))).toEqual({
      action: "record", selected: pending("2"),
    });
  });
});
