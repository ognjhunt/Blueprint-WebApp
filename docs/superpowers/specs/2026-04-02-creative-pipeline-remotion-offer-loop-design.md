# Creative Pipeline Completion, Remotion Reels, and Offer Loop Tightening

**Date:** 2026-04-02
**Status:** Approved

## Context

Blueprint's autonomous org infrastructure is production-ready across analytics, email, voice, growth ops, experiments, agent runtime, and ops automation. The remaining gaps are:

1. Imagen codepath still exists in google-creative.ts but is being deprecated by Google (June 2026) and is not used — only Nano Banana (Gemini Flash) is the intended image provider.
2. Runway video generation works but doesn't pass an explicit model — should default to `gen4_turbo` and be configurable.
3. Remotion storyboard types exist in creative-pipeline.ts but no actual render execution exists — product reels are not being generated.
4. The offer loop (creative → landing page → growth events → experiment rollout → next creative cycle) has a gap: inbound buyer objections don't feed back into the creative factory.
5. Test coverage on growth ops, creative pipeline, and experiment ops is thin.

## Decisions

- **Image generation:** Nano Banana (Gemini Flash) only. Remove Imagen codepath entirely.
- **Video generation:** Runway Gen-4 Turbo via existing Runway API. Configurable via env var. No direct Gemini API video integration. Veo 3.1 available through Runway if needed later (same API, different model param).
- **Remotion scope:** Product reels from generated assets (images + video + campaign kit text). Not evidence reels from capture data (future phase).
- **Offer loop:** Human-gated, request-based sales motion. Tighten the automated pipeline around it by closing the objection feedback loop.
- **Test coverage:** Full — unit, loop-level, and integration-style.

## Section 1: Imagen Removal

Remove the `if (model.startsWith("imagen-"))` branch from `server/utils/google-creative.ts` (current lines 64-104). Only the Gemini/Nano Banana codepath remains.

Default model is already `gemini-3.1-flash-image-preview` — no config change needed. Provider status in `provider-status.ts` doesn't reference Imagen by name — no changes there.

### Files changed
- `server/utils/google-creative.ts` — remove Imagen branch

## Section 2: Runway Model Selection

Make video model explicit and configurable in the creative factory.

- Add env var `BLUEPRINT_RUNWAY_VIDEO_MODEL` (default `gen4_turbo`)
- Pass model through in `creative-factory.ts` when calling `startRunwayImageToVideoTask()`
- Model is already captured in `RunwayTaskRecord.model` field and Firestore record

### Files changed
- `server/utils/creative-factory.ts` — read env var, pass model param

## Section 3: Remotion Product Reel Rendering

### New interfaces in `server/utils/creative-pipeline.ts`

```typescript
export interface RemotionStoryboardFrame {
  startFrame: number;
  durationFrames: number;
  title: string;
  copy: string;
  visual: string;
}

export interface ProductReelInput {
  storyboard: RemotionStoryboardFrame[];
  images: Array<{ mimeType: string; dataUrl: string }>;
  runwayVideoUrl?: string | null;
  fps: number;
  width: number;
  height: number;
}
```

The existing storyboard objects in `buildCreativeCampaignKit()` already conform to `RemotionStoryboardFrame` — this formalizes the interface.

### New file: `server/remotion/ProductReel.tsx`

React component for the Remotion composition:
- 4 scenes matching the storyboard (360 frames total at 30fps = 12 seconds)
- Each scene: background image + text overlay (title, copy) + fade transitions
- Final scene: CTA frame with call-to-action
- Resolution: 1280x720

### New file: `server/utils/remotion-render.ts`

`renderProductReel(input: ProductReelInput)`:
- Writes temp image files from dataUrls
- Calls `renderMedia()` from `@remotion/renderer` with the ProductReel composition
- Returns `{ outputPath: string; durationSeconds: number; frames: number }`
- Output to temp directory; creative factory records path in Firestore

### Integration into creative factory

After Runway task starts in `creative-factory.ts`, if images exist, call `renderProductReel()`. Firestore record gets `remotion_reel` field with output metadata.

Remotion render is best-effort. Failure doesn't block the creative factory run — status remains `assets_generated`.

### Dependencies
- `@remotion/core`
- `@remotion/renderer`
- `@remotion/cli` (dev)
- Requires `ffmpeg` available on system

### Files changed
- `server/utils/creative-pipeline.ts` — add interfaces
- `server/utils/creative-factory.ts` — call renderProductReel after asset generation

### Files created
- `server/remotion/ProductReel.tsx`
- `server/utils/remotion-render.ts`

## Section 4: Offer Loop Tightening

Close the feedback loop from inbound buyer interactions back to the creative factory.

### The full cycle

```
Experiment rollout (winning variant)
       |
Creative factory (brief + images + video + reel)
       |
Landing page (serves winning variant + fresh creative)
       |
Growth events (exposures, contact starts/submissions/completed)
       |
Experiment autorollout (evaluates lift -> new winner)
       |
Autonomous research (Firehose signals -> outbound campaigns)
       |
Inbound (voice concierge -> support queue -> objection capture)
       |
Creative factory (reads objections + signals + rollout -> next cycle)
```

### Changes

1. **`creative-factory.ts`:** Before building the brief, query recent `contactRequests` (last 30 days) for recurring objection patterns. If `objection_category` field exists on documents, group by it. If not, fall back to extracting recurring keywords from `notes` or `message` fields. Add top objection as a signal highlight in the brief.

2. **`creative-pipeline.ts`:** Add optional `buyerObjections: string[]` field to `CreativeBriefInput`. When present, generate a counter-objection proof bullet and adjust the "Why this matters" storyboard scene.

### Files changed
- `server/utils/creative-factory.ts` — add objection query, pass to brief
- `server/utils/creative-pipeline.ts` — add buyerObjections to CreativeBriefInput, use in kit generation

## Section 5: Test Coverage

### Tier 1 — Unit tests (pure functions)

**`server/tests/experiment-ops.test.ts` (expand):**
- `evaluateExperimentWinner` edge cases: <2 variants (monitoring), all below min exposures, negative lift, tied rates with exposure tiebreak, zero exposures, single variant

**`server/tests/autonomous-growth.test.ts` (expand):**
- `buildAutonomousOutboundDraft`: empty signals, many signals truncated to 3, signals with/without URLs

**`server/tests/creative-pipeline.test.ts` (new):**
- `buildCreativeCampaignKit`: storyboard frame count/timing, proof bullet limits, nano banana variant count, provenance guardrails always present, buyer objections flow through

**`server/tests/remotion-render.test.ts` (new):**
- `ProductReelInput` validation, storyboard frame interface conformance

### Tier 2 — Loop-level tests (mocked Firestore + API)

**`server/tests/creative-factory.test.ts` (new):**
- `runCreativeAssetFactoryLoop`: mock Firestore, google-creative, runway, remotion-render
- Cases: skips existing run, generates assets, handles image failure, handles Runway failure, handles Remotion failure, reads rollouts and research, writes correct Firestore record

**`server/tests/autonomous-growth.test.ts` (expand):**
- `runAutonomousResearchOutboundLoop`: mock Firestore + Firehose + growth-ops
- Cases: skips existing, no signals, draft without recipients, queues with recipients, multiple topics

**`server/tests/experiment-ops.test.ts` (expand):**
- `runExperimentAutorollout`: mock Firestore growth_events query
- Cases: aggregates exposures, maps contact events, persists to Firestore, empty events

### Tier 3 — Integration-style tests

**`server/tests/creative-factory.test.ts`:**
- Runway model selection: verify gen4_turbo default, env override, model in Firestore record

**`server/tests/remotion-render.test.ts`:**
- Mock `@remotion/renderer`, verify composition props, output path, non-fatal failure

**`server/tests/provider-status.test.ts` (new):**
- `buildGrowthIntegrationSummary`: all providers aggregate, Imagen removal doesn't break, Runway status reflects config

### Test patterns
- All server tests: `// @vitest-environment node` header
- Firestore: `vi.mock("../../client/src/lib/firebaseAdmin")`
- External APIs: `vi.mock("../utils/...")` at module level

## Files Summary

| Section | Files changed | Files created |
|---------|--------------|---------------|
| 1. Imagen removal | `server/utils/google-creative.ts` | — |
| 2. Runway model selection | `server/utils/creative-factory.ts` | — |
| 3. Remotion reels | `server/utils/creative-factory.ts`, `server/utils/creative-pipeline.ts` | `server/utils/remotion-render.ts`, `server/remotion/ProductReel.tsx` |
| 4. Offer loop | `server/utils/creative-factory.ts`, `server/utils/creative-pipeline.ts` | — |
| 5. Tests | `server/tests/autonomous-growth.test.ts`, `server/tests/experiment-ops.test.ts` | `server/tests/creative-pipeline.test.ts`, `server/tests/creative-factory.test.ts`, `server/tests/remotion-render.test.ts`, `server/tests/provider-status.test.ts` |

## Dependencies to add
- `@remotion/core`
- `@remotion/renderer`
- `@remotion/cli` (dev)
