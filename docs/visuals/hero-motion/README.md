# Homepage motion

The current version replaces the original two-pose-per-second playback with
locally interpolated motion. Each of the four 6.5-second clips is encoded at
30 fps. The room stays on the approved original image; softly feathered task
regions carry the moving robot, cargo, and nearby contact shadows.

All scenes remain generated marketing illustrations, not robot execution
records or evidence of physical performance.

## Sources and motion

The original 36 full-resolution 1536 × 1024 source frames remain in `frames/`.
`manifest.json` records their native Codex generation prompts, paths, and hashes.
`motion-v2.json` selects three to six coherent anchors per scene, avoiding
unnecessary pose reversals and a larger arm retraction that deformed during
interpolation. RIFE v4.6 creates 166 intermediate-sequence frames locally.
Initial/final holds bring each encoded clip to 195 frames and 6.5 seconds.

The approved room, floor, shelving, parked bases, and other static details are
composited from the first source frame outside the configured task regions.
This limits the background movement caused by independent image generations.
The regions include the robot and interacted objects, including conveyor cargo.

The original stills remain the loading, reduced-motion, data-saving, and media
failure fallback. Existing pause, visibility, focus, and scene controls also
control the new clips. Versioned `*-smooth-v2.mp4` URLs keep browser caches from
serving the previous stop-motion clips after deployment. The original MP4s are
retained in `baseline/` for visual comparison, outside the public asset bundle.

## Local assembly

The website serves baked MP4s. It runs no model or interpolation in the browser,
server, CI, or Render build. To deliberately rebuild media offline, install the
[portable RIFE ncnn Vulkan release](https://github.com/nihui/rife-ncnn-vulkan/releases/tag/20221029)
and FFmpeg, then run:

```sh
RIFE_BIN=/path/to/rife-ncnn-vulkan \
RIFE_MODEL_DIR=/path/to/rife-v4.6 \
node scripts/creative/build-hero-motion.mjs

node scripts/creative/verify-hero-motion.mjs
```

The builder never downloads anything or reads API credentials. It checks the
source-frame and model hashes, writes a fresh staging directory, and publishes
an MP4 only after encoding and format checks. Rebuild receipts are written to
`output/smooth-hero-build/`. RIFE weights and binaries are not distributed with
the website. The model file hashes and release are recorded in `motion-v2.json`.

The verifier compares old and new media at the same 30 fps cadence. It measures
consecutive-frame luma differences in the same task crop, checks for a material
reduction in the largest jump, verifies movement spans many frames, and checks
a static shelf/wall crop for jitter. It also verifies resolution, duration,
codec, and frame count. Its report is `output/smooth-hero-review/motion-quality.json`.
These measurements support visual QA; they do not prove physical correctness.

## Generation and research history

Source artwork used Codex's built-in `image_gen` tool, without API-key calls.
The user requested GPT-Image-2.5-Sunburst, but the built-in tool exposed no model
selector or verified model identity; `verifiedModel` therefore remains null.
The smoothing pass uses the downloaded local RIFE model and no paid API calls.

- [A creator's frame-grid workflow](https://www.reddit.com/r/aivideos/comments/1wcdj2w/ten_seconds_of_fight_animation_from_one_gpt_image/)
  and [a 16-frame sprite example](https://www.reddit.com/r/aigamedev/comments/1wbmvnm/gpt_image_25_nailed_a_16_frame_combat_sprite_sheet/)
  informed the initial frame-sequence experiment. They are creator reports, not
  robotics-animation quality guarantees.
- [The author's Codex sprite workflow](https://github.com/0x0funky/agent-sprite-forge)
  separates image generation from local assembly. No third-party skill was installed.
- [RIFE's author implementation](https://github.com/hzwer/ECCV2022-RIFE) and
  [the ncnn implementation](https://github.com/nihui/rife-ncnn-vulkan) document
  learned frame interpolation, including local macOS execution.
- [Google's GIF-to-video guidance](https://web.dev/articles/codelab-replace-gifs-with-video)
  supports muted inline video for this delivery role.

The first contact sheet was rejected for low resolution and alignment drift.
The first FFmpeg optical-flow attempt was rejected for ghosted joints. The
initial shipped version consequently used crisp stop motion; user review found
it too jittery. The current pass uses neural interpolation, fewer coherent
anchors, and a stationary background. Slight synthesized edge/shape changes
can remain in moving regions; this is illustrative motion, not a rigged 3D
robot simulation.
