# World-model reconstruction

How a paid walkthrough becomes a 3D scene, and why Atlas is not a model switch.

Blueprint does not reconstruct anything. A capturer is sent to a site, records
one video, and a World Labs world model turns that video into a navigable
scene. This document covers the path that runs today, why World Labs Atlas
cannot be switched on inside it, and which service should own World Labs calls.

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

Frames are.

## The frame budget

Every Marble model profile lives in `server/utils/worldModelProfiles.ts`.

| Model | Frames per request | Notes |
|---|---|---|
| `marble-1.1-plus` | 4, or **8** with `reconstruct_images` | Default. Best generally-available model |
| `marble-1.1` | 4 / 8 | |
| `marble-1.0` | 4 / 8 | |
| `marble-1.0-draft` | 4 / 8 | Cheapest |
| any name starting `atlas` | **0** | Refused. Atlas is not a `worlds:generate` model; see below |

A 5 FPS two-minute walk is 600 frames against a budget of 8. Taking the first
eight would reconstruct the first 1.6 seconds of the site, so
`selectFramesForModel` splits the walkthrough into equal buckets and takes the
sharpest frame from each. Coverage spans the whole walk; sharpness is optional
and it degrades to even spacing when a capture carries no per-frame quality
data.

The full extracted frame set is kept regardless of what gets sent. Raising the
budget later re-reads frames that already exist rather than needing a re-capture.

## Atlas is not a model switch

This section replaces an earlier three-step "Switching to Atlas" procedure: set
`WORLDLABS_DEFAULT_MODEL=atlas`, then flip the profile to available. That
procedure assumed Atlas kept Marble's `worlds:generate` request. It does not.
Following it would have sent Atlas a Marble-shaped request.

The Atlas beta docs (https://atlas-beta.worldlabs.ai/docs, read 2026-10-19)
describe a separate task API under `/api/v2`, with its own project-scoped keys
and asset uploads:

| Task | Returns | Not in the docs |
|---|---|---|
| `POST /api/v2/tasks:images2PosedRGBD`, described as a Marble 2 beta endpoint | Per frame: a camera, a linear-depth EXR and a confidence map, in "world units". The docs state no metric scale. Delivered as an async operation. | A world, splats, a collider or a mesh |
| `POST /api/v2/tasks:atlasGenerate`, enabled per account | RGB frames at target cameras on a 1280×720 grid, with optional depth | Splats, a mesh, a collider or USD |

Pricing is not published. The billing page says the beta converts 1,000
credits per US dollar and that usage appears only on the platform's Usage page,
not on the operation.

So the WebApp refuses Atlas under any spelling. `resolveWorldModelProfile`
maps every model name that starts with `atlas` to a refused profile that accepts
no frames. That covers an explicit `model` and `WORLDLABS_DEFAULT_MODEL`.
`generateWorldFromFrames` then throws `worldlabs_model_unavailable` before it
uploads a frame, and `startWorldReconstruction` records that blocker. Without
the refusal, a name such as `atlas-beta` would fall through to the
unknown-model rule and be treated as a newer Marble release.

Atlas does not lift the measurement requirement. Its depth carries no stated
metric scale, so a measured site dimension is still required whichever
registration a scene uses.

## Who calls World Labs (proposal, awaiting the founder)

Two services call World Labs today:

- **WebApp** (this document): Marble `worlds:generate` through
  `server/utils/worldReconstruction.ts`, reached from
  `routes/internal-capture-worlds.ts` and `routes/admin-site-worlds.ts`.
- **Pipeline**: Marble generation for website scene preparation
  (`website_worldlabs.py`), behind its paid-resource admission and the
  WebApp-signed preparation spend reservation.

**Proposal: the Pipeline becomes the single owner of World Labs calls, Atlas
included.** Its paid-resource admission, spend reservation and retained-operation
recovery are where provider spend is bound to a sponsorship. Its geometry stage
is also where Atlas's posed RGB-D output is consumed. Under this proposal:

- The WebApp sends no Atlas request. This is already enforced, as described
  above.
- The Pipeline's admitted `images2PosedRGBD` operation is the only Atlas
  caller. It refuses to run until a reviewed Atlas price is configured.
- The WebApp's Marble path stays as it is until the founder decides whether to
  move it to the Pipeline. Moving it is separate work.

## Atlas in the Pipeline

The Pipeline decides when Atlas is used. Its admitted pose operation is
described in the Pipeline's `docs/website-atlas-pose-operation.md`. It uploads
the source frames, submits one `images2PosedRGBD` operation, saves the operation
ID, polls it, and keeps each output file bound to the input frame it came from.
It refuses to run until a reviewed Atlas price is configured. Every result keeps
`claim_ceiling: development_only` and `metric_measurement_proven: false`.

Captures without a sponsorship still wait at `needs_input`
(`website_source_camera_depth_registration_required`). They keep waiting until a
side-by-side comparison against the pinned MapAnything registration shows
whether Atlas can fill that gap. That plan is the Pipeline's
`docs/atlas-vs-mapanything-registration-plan.md`.

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
| `worldlabs_model_unavailable` | The configured model is not a `worlds:generate` model, for example any Atlas name. **A config state, not a bad capture** |
| `worldlabs_generation_failed` | The model rejected or failed the request |
| `worldlabs_splat_export_failed` | The world exists; the PLY export did not settle |
| `webapp_unreachable` | `extract-frames` could not reach the WebApp; the capture stays reconstructible |

A `402` from World Labs means the account is out of API credits.
`getWorldLabsCredits()` reads the balance so that can be seen coming.

## A note on what leaves our infrastructure

The world's `display_name` is the capture id, never the buyer's site name. That
field is an `EncryptableString` and may carry customer PII, and this call is to
a third party whose dashboard shows it.
