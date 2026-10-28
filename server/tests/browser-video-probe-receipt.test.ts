// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore }));
import { completeBrowserStoredUploadProbe, type BrowserStoredUpload, type BrowserWriteReservation } from "../utils/websiteBrowserPending";

const reservation: BrowserWriteReservation = { schema_version: "website_browser_write_reservation.v1", request_id: "one",
  scene_id: "site-one", capture_id: "walkthrough-one", id: "lease-one", expires_at_ms: Date.now() + 60_000 };
const source = { object_name: "scenes/site-one/captures/walkthrough-one/raw/walkthrough.mp4", generation: "1",
  size_bytes: 100, crc32c: "AAAAAA==" };
const measured = { widthPx: 160, heightPx: 120, fps: 30, durationSeconds: 1, recordedAtEpochMs: 1_000,
  recordedAtBasis: "upload_received" as const };
let original: BrowserStoredUpload;
beforeEach(() => {
  state.docs.clear();
  const manifest = JSON.stringify({ scene_id: "site-one", request_id: "one", capture_id: "walkthrough-one",
    video_uri: source.object_name, media_probe_pending: true,
    capture_rights: { original_permission: "retained-grant" }, site_task_context: { description: "original task" } });
  original = { schema_version: "website_browser_stored_upload.v1", request_id: "one", scene_id: "site-one",
    capture_id: "walkthrough-one", completed_at_iso: "2026-10-28T00:00:00Z", video: source,
    manifest_json: manifest, manifest_sha256: `sha256:${createHash("sha256").update(manifest).digest("hex")}` };
  state.docs.set("captureUploadSessions/walkthrough-one", { browser_stored_upload: structuredClone(original),
    browser_upload_reservation: reservation });
});
it("adds measurements to the retained receipt without recreating the source or its permission/task snapshot", async () => {
  const completed = await completeBrowserStoredUploadProbe(original, measured, reservation);
  expect(completed.video).toEqual(source);
  expect(completed.completed_at_iso).toBe(original.completed_at_iso);
  expect(JSON.parse(completed.manifest_json)).toEqual({ ...JSON.parse(original.manifest_json), media_probe_pending: undefined,
    fps_source: 30, width: 160, height: 120, duration_seconds: 1, capture_start_epoch_ms: 1_000,
    capture_start_time_basis: "upload_received", media_metadata_source: "server_file_probe" });
  expect(state.docs.get("captureUploadSessions/walkthrough-one")).not.toHaveProperty("browser_pending_delivery");
});
it.each(["source", "reservation", "published"])("refuses a concurrent %s change rather than reusing a stale probe", async change => {
  const record = state.docs.get("captureUploadSessions/walkthrough-one") as any;
  if (change === "source") record.browser_stored_upload.video.generation = "2";
  if (change === "reservation") record.browser_upload_reservation = { ...reservation, id: "other" };
  if (change === "published") record.browser_pending_delivery = { state: "published" };
  const before = structuredClone(record);
  await expect(completeBrowserStoredUploadProbe(original, measured, reservation)).rejects.toThrow("browser_pending_changed");
  expect(state.docs.get("captureUploadSessions/walkthrough-one")).toEqual(before);
});
