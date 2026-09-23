# Recorded app bundles

What BlueprintCapture's recorder writes for one capture link, before upload,
recorded the way the App Clip records: `lidar/` on the `iphone_arkit_lidar`
profile (poses, intrinsics, depth, confidence, mesh) and `nonlidar/` on
`iphone_arkit_non_lidar` (poses and intrinsics). Neither has `motion.jsonl`;
the manifest declares the missing IMU (`device_imu: false`,
`device_imu_unavailable_reason: "app_clip_runtime"`).

Each profile directory holds:

- `bundle/`: the finalized recording exactly as it sits on the phone. The
  server-owned files in it are the phone's local stand-ins for validation and
  are never uploaded.
- `plan_request.json`: the plan the phone sends to
  `POST /api/self-capture/uploads/:token/bundle`.
- `link_info.json`: the link answer the phone recorded against (the
  BlueprintCapture UI-test stub's identities).

Source: BlueprintCapture `SyntheticCaptureBundleTests`, which drives the shared
recorder with its synthetic camera, finalizes, validates and plans each
bundle, and exports it (CI artifact `synthetic-raw-bundles`, run 35802438288,
commit 7f533a1).

`site-capture-recorded-app-bundles.test.ts` completes both through the capture
link against a fake bucket. With `BLUEPRINT_EXPORT_COMPLETED_BUNDLES=<dir>` it
also writes each completed raw prefix to `<dir>/<profile>/raw`; that is the
fixture BlueprintCapture (extract-frames) and BlueprintCapturePipeline
(`verify_canonical_raw_bundle_path`) test against.

Truth boundary: synthetic content only. No customer, person or physical site
is represented; the pixels are a generated gradient. Owner-directed work in
the website self-capture lane (ADP-009B, `development_only`); it unblocks no
gate and qualifies nothing.
