# Validation

- 36 selected source frames: nine per scene at 1536 × 1024.
- Four silent H.264 MP4s: 6.5 seconds each, 24 fps containers with repeated
  source poses, total approximately 3.8 MiB.
- All final source frames were visually inspected. The user-identified partial
  gripper object and affected retraction frames were replaced. Two shelf-pick
  frames with inconsistent tray contents were also replaced.
- Interpolated exports were rejected because they introduced ghosted joints.
  Final exports use only the selected stills and do not perform optical flow.
- Homepage screenshots confirm the original composition, text, controls, and
  illustrative disclosure remain visible with the final frames.
- Full TypeScript check and asset audit pass. The build passes with
  `BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1`; this isolated checkout does not
  contain production Firebase client configuration. This is compile validation,
  not a deployable authentication configuration or production readback.
- Homepage unit tests: 2 passing. Targeted browser coverage checks scene
  selection/rotation, desktop/mobile layout, actual clip decoding and time
  progression, pause, reduced-motion changes, offscreen pause, and failed-media
  fallback.
- Graphify architecture pilot refreshed and published to the worktree's
  canonical `graphify-out/` using an isolated local graphifyy environment.

Local logs and screenshots are under `output/hero-motion-build/` and
`output/hero-motion-review/`. The source prompts and frame hashes are in
`manifest.json`. The work is on `codex/hero-motion-frames-20260912`; no protected
main merge, Render deployment, provider job, or outbound message was performed.

Remaining visual limitation: these are generated keyframe illustrations with
small pose/geometry/background variation, presented as deliberate stop motion.
They are available for visual approval in the local homepage preview; no claim
of continuous video-model quality or mechanically exact motion is made.
