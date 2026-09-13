# Homepage motion frames — 2026-09-12

Owner-requested continuation of the existing illustrative homepage artwork,
including fixed arm, humanoid, wheeled humanoid, and mobile manipulator.
These are generated marketing illustrations, not robot execution evidence.

Each scene has nine full-resolution 1536 × 1024 WebP source frames in `frames/`:
the original approved still plus eight selected edits. `manifest.json` records
the exact prompts and native output paths. Repaired and reordered frames are
selected for complete objects and readable pose progression. The original
homepage stills remain the loading, reduced-motion, and media-error fallback.

Generation used the Codex built-in `image_gen` tool. No API key, API credit,
paid video service, model download, or cloud interpolation was used. The user
requested GPT-Image-2.5-Sunburst; the built-in tool exposes neither a model
selector nor verified model identity, so `verifiedModel` is null.

## Research and frame-count decision

- [A creator's frame-grid workflow](https://www.reddit.com/r/aivideos/comments/1wcdj2w/ten_seconds_of_fight_animation_from_one_gpt_image/)
  describes generating sequential frames together, locking camera/background,
  then setting timing during assembly. This is a creator report, not a guarantee
  of consistent robotics animation.
- [A 16-frame GPT Image 2.5 example](https://www.reddit.com/r/aigamedev/comments/1wbmvnm/gpt_image_25_nailed_a_16_frame_combat_sprite_sheet/)
  demonstrates sprite sequences but also discusses timing and consistency limits.
- [The author's Codex sprite workflow](https://github.com/0x0funky/agent-sprite-forge)
  separates native image generation from local extraction/alignment/assembly.
  Used as a reference; no third-party skill or code was installed.
- [Google's GIF-to-video guidance](https://web.dev/articles/codelab-replace-gifs-with-video)
  supports muted inline video for the same visual role with better delivery.

Nine is an editorial starting point, not a universal smoothness threshold. A
generated 3 × 3 contact sheet was rejected because its cells lost resolution
and alignment. Individual full-size edits preserve more detail. FFmpeg optical
flow was also tried and rejected after inspection found ghosted arm joints.
Final clips repeat the selected source frames exactly, giving a deliberate
stop-motion appearance with small pose and background variation between edits.
They do not claim continuous, mechanically verified motion.

## Local assembly and playback

With FFmpeg installed, run from the repository root:

```sh
node scripts/creative/build-hero-motion.mjs
```

The encoder reads committed WebP frames only. It does not regenerate artwork.
It writes 6.5-second H.264 MP4s to
`client/public/images/site-led/embodiments/motion/`, with nine poses at two poses
per second, a short initial hold, and a final hold. The 24 fps video container
repeats poses; it does not invent additional poses. Each action then crossfades
to the next scene and restarts on its next turn, avoiding reverse playback.

The homepage downloads a clip only when its scene is active and motion is
enabled. Pause, focused scene controls, hidden tabs, and offscreen visibility
freeze playback. Reduced-motion and data-saving preferences use original
stills. Original images remain underneath failed/blocked media.

The frame-level artifacts and prompts are retained for further visual review
or additional in-between generations. This change does not deploy itself.
