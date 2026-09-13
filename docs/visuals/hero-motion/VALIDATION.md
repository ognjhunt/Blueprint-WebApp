# Smoother motion validation

The v2 media replaces the stop-motion release from PR #581. It preserves the
original 36 source frames and retains the four old clips in `baseline/` for
comparison. Four new versioned MP4s are the only motion files served publicly.

Each new clip is 1536 × 1024 H.264, silent, 30 fps, 195 encoded frames, and
6.5 seconds. Total public motion payload is approximately 1.6 MiB, compared
with 3.8 MiB for the previous release. RIFE runs only in local authoring;
no API credits, hosted inference, or browser/server model execution is involved.

## Media measurements

`motion-v2-quality.json` records decoded-frame comparisons at the same 30 fps
cadence and crop. The largest consecutive-frame luma jump decreased by:

| Scene | Peak jump reduction | Frames with visible change |
| --- | ---: | ---: |
| Fixed arm | 85.9% | 139 |
| Humanoid | 89.8% | 125 |
| Wheeled humanoid | 78.9% | 111 |
| Mobile manipulator | 88.0% | 111 |

The previous clips had eight pose transitions. The stationary background crop
has a peak per-frame difference below 0.008 on the 0–255 luma scale. All four
clips pass the offline cadence, format, jump-reduction, and background checks.
The frame-change counts exclude initial/final holds and tiny codec differences.

## Visual and application checks

- Intermediate poses were inspected around arm joints, fingers, carton entry
  into the tote, the loaded tray, and the shelf-picked cube.
- An initial wider arm retraction still deformed during interpolation; it was
  replaced with a short, coherent release/withdrawal using closer source poses.
- Foreground motion regions are feathered into the original stationary room.
- All eight targeted browser tests pass, including all four versioned clips,
  pause, reduced-motion changes, offscreen pause, media failure, scene selection,
  rotation, and mobile layout.
- Full TypeScript check and two homepage unit tests pass. The production bundle
  compiles with `BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1`; local compilation
  is not production Firebase/auth configuration proof.
- Asset audit and architecture-pilot refresh are included in local validation.

Detailed local logs/screenshots are in `output/smooth-hero-review/` and
`output/smooth-hero-test/`. `motion-v2-builds.json` records the source selections,
model/executable identities, and encoded-file hashes for all four clips.

The clips remain generated illustrations. Small synthesized edge or shape
changes may remain during motion; these checks do not establish mechanically
exact robot movement or physical task success. Deployment is verified separately
against the merged commit, live media bytes, and desktop/mobile playback.
