# World-model reconstruction

How a paid walkthrough becomes a 3D scene, and what changes when Atlas arrives.

Blueprint does not reconstruct anything. A capturer is sent to a site, records
one video, and a World Labs world model turns that video into a navigable
scene. This document covers the path that runs today and the single switch that
moves it to Atlas.

## The chain

Nothing in this sequence waits for a person.

| Step | Where | What happens |
|---|---|---|
| 1 | BlueprintCapture (iOS) | Capturer records one walkthrough and uploads it |
| 2 | `cloud/extract-frames` | Frames decoded at 5 FPS to `frames/*.jpg` + `index.jsonl` |
| 3 | `cloud/extract-frames` | POSTs the frame prefix to the WebApp |
| 4 | `server/utils/worldReconstruction.ts` | Frames selected and sent to World Labs |
| 5 | same, on `advance` | Operation polled; on completion the files are exported |
| 6 | Pipeline | Configures the robot, spawns it, runs policies against the scene |

Steps 4 and 5 are reachable two ways. `routes/internal-capture-worlds.ts`
authenticates with the Pipeline sync credential and is what step 3 calls.
`routes/admin-site-worlds.ts` exposes the same adapter to an operator who wants
to drive it by hand.

## Why frames and not the video

Marble's video prompt caps at **30 seconds and 100 MB**. No walkthrough of a
real site fits in that, so handing over the whole video is not an option for the
work we actually sell.

Frames are. They are also the input shape Atlas is built around — its
announcement describes folding 100+ images into a single shared spatial
context — so the path that works today is the same path that gets better later.

## The frame budget is the only thing that changes

Every model profile lives in `server/utils/worldModelProfiles.ts`.

| Model | Frames per request | Notes |
|---|---|---|
| `marble-1.1-plus` | 4, or **8** with `reconstruct_images` | Default. Best generally-available model |
| `marble-1.1` | 4 / 8 | |
| `marble-1.0` | 4 / 8 | |
| `marble-1.0-draft` | 4 / 8 | Cheapest |
| `atlas` | **100** | `available: false` — see below |

A 5 FPS two-minute walk is 600 frames against a budget of 8. Taking the first
eight would reconstruct the first 1.6 seconds of the site, so
`selectFramesForModel` splits the walkthrough into equal buckets and takes the
sharpest frame from each. Coverage spans the whole walk; sharpness is optional
and it degrades to even spacing when a capture carries no per-frame quality
data.

The full extracted frame set is kept regardless of what gets sent. Raising the
budget later re-reads frames that already exist rather than needing a re-capture.

## Switching to Atlas

**Atlas is not callable yet.** It is early access with select partners, and no
request schema, endpoint, model string or pricing has been published. Its
profile therefore ships `available: false`, and `startWorldReconstruction`
returns the blocker `worldlabs_model_unavailable` rather than sending a request
built on a guess.

When access arrives:

1. Set `WORLDLABS_API_KEY` to the key with Atlas access.
2. Set `WORLDLABS_DEFAULT_MODEL=atlas`.
3. In `worldModelProfiles.ts`, flip `ATLAS_PROFILE.available` to `true` and set
   `model` to the real model string.

Then **check the assumption the profile records**: it inherits Marble's request
shape on the expectation that `worlds:generate` is retained. If Atlas's schema
differs, `generateWorldFromFrames` is where that lands — the multi-image prompt
construction, not the frame selection or the orchestration.

Nothing else moves. The frame budget goes from 8 to 100 on the profile alone.

## What comes back

Available on the world object as soon as generation completes:

| Asset | Field | Notes |
|---|---|---|
| Gaussian splats | `assets.splats.spz_urls` | Object keyed `100k` / `500k` / `full_res` — **not a list** |
| Collider mesh | `assets.mesh.collider_mesh_url` | GLB, ~100–200k triangles, for physics |
| Panorama | `assets.imagery.pano_url` | |
| Thumbnail, caption | `assets.thumbnail_url`, `assets.caption` | |

Exported on demand by `advance`:

| Asset | Request | Timing |
|---|---|---|
| Splat PLY | `asset_type: splats`, `format: ply`, `resolution` | **Synchronous**, cached, currently free |
| HQ mesh GLB | `asset_type: mesh`, `format: glb`, `mesh_variant` | **Asynchronous** — returns an operation |

`resolution` accepts `full_res` / `500k` / `150k` / `100k`. `mesh_variant`
accepts `textured` (~600k triangles) or `vertex_colored` (~1M).

Because the mesh export is asynchronous, a first `advance` reports `exporting`
and records the mesh operation id rather than returning a null URL that reads
like a missing file. The collider mesh ships with every world, so the Pipeline
always has geometry to work with in the meantime.

**There is no USD or USDZ export.** The format enum is `ply` and `glb` only.
World Labs documents converting the PLY splat and GLB collider to USD for Isaac
Sim as a downstream step, which is where that conversion belongs if we need it.

## Configuration

WebApp:

- `WORLDLABS_API_KEY` — required. Sent as `WLT-Api-Key`.
- `WORLDLABS_DEFAULT_MODEL` — optional; defaults to `marble-1.1-plus`.
- `WORLDLABS_API_BASE_URL` — optional; defaults to `https://api.worldlabs.ai`.
- `PIPELINE_SYNC_TOKEN` — verifies the request from `extract-frames`.

`cloud/extract-frames`:

- `BLUEPRINT_WEBAPP_BASE_URL` — WebApp origin. Unset means no request is made.
- `BLUEPRINT_PIPELINE_SYNC_TOKEN` — same secret as `PIPELINE_SYNC_TOKEN`.

The default model is pinned rather than inherited: the API currently defaults to
`marble-1.0` for back-compat and has announced that default will change, and a
silent upstream flip should not change which model reconstructs our captures.

## Failure states worth knowing

Blockers are values, not exceptions, because the caller is usually a background
trigger that has to write the reason down.

| Blocker | Means |
|---|---|
| `capture_frames_empty` | Extraction produced no frames |
| `capture_frames_unreadable` | The frame index could not be read |
| `worldlabs_model_unavailable` | The configured model is not callable yet — **a config state, not a bad capture** |
| `worldlabs_generation_failed` | The model rejected or failed the request |
| `worldlabs_splat_export_failed` | The world exists; the PLY export did not settle |
| `webapp_unreachable` | `extract-frames` could not reach the WebApp; the capture stays reconstructible |

A `402` from World Labs means the account is out of API credits.
`getWorldLabsCredits()` reads the balance so that can be seen coming.

## A note on what leaves our infrastructure

The world's `display_name` is the capture id, never the buyer's site name. That
field is an `EncryptableString` and may carry customer PII, and this call is to
a third party whose dashboard shows it.
