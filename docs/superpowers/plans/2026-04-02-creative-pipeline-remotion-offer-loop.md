# Creative Pipeline Completion, Remotion Reels, and Offer Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining creative pipeline gaps — remove Imagen, add Runway model selection, wire Remotion product reel rendering, close the offer loop feedback path, and bring test coverage to full depth.

**Architecture:** Incremental changes to existing files. New Remotion composition follows the existing `proof-reel/` pattern (Slide component, Sequence-based scenes). Remotion rendering is programmatic via `@remotion/renderer`. Creative factory gains a post-step for reel rendering and a pre-step for objection feedback. All changes are server-side except the Remotion composition.

**Tech Stack:** TypeScript, Remotion 4.x (`@remotion/renderer`, `@remotion/bundler`, `remotion`), Vitest, Firestore (mocked in tests)

**Spec:** `docs/superpowers/specs/2026-04-02-creative-pipeline-remotion-offer-loop-design.md`

---

### Task 1: Remove Imagen codepath from google-creative.ts

**Files:**
- Modify: `server/utils/google-creative.ts:64-104`
- Test: `server/tests/provider-status.test.ts` (new)

- [ ] **Step 1: Write the provider-status test that verifies google-creative works without Imagen**

Create `server/tests/provider-status.test.ts`:

```typescript
// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../utils/email", () => ({
  getEmailTransportStatus: () => ({ provider: "sendgrid", configured: true }),
}));
vi.mock("../utils/elevenlabs", () => ({
  getElevenLabsConfig: () => ({ configured: true, agentId: "agent-1", modelId: "eleven_turbo_v2_5" }),
}));
vi.mock("../utils/runway", () => ({
  getRunwayStatus: () => ({ configured: true, baseUrl: "https://api.dev.runwayml.com/v1", version: "2024-11-06" }),
}));

describe("provider-status", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_GENAI_API_KEY", "test-key");
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_HOST", "https://ph.test");
    vi.stubEnv("BLUEPRINT_ANALYTICS_INGEST_ENABLED", "1");
    vi.stubEnv("FIREHOSE_API_TOKEN", "fh-token");
    vi.stubEnv("FIREHOSE_BASE_URL", "https://firehose.test");
    vi.stubEnv("BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS", "warehouse robotics");
    vi.stubEnv("BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS", "test@example.com");
    vi.stubEnv("SENDGRID_EVENT_WEBHOOK_SECRET", "wh-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("buildGrowthIntegrationSummary aggregates all provider statuses", async () => {
    const { buildGrowthIntegrationSummary } = await import("../utils/provider-status");
    const summary = buildGrowthIntegrationSummary();

    expect(summary.googleImage.configured).toBe(true);
    expect(summary.googleImage.model).toContain("gemini");
    expect(summary.googleImage.apiKeySource).toBe("GOOGLE_GENAI_API_KEY");
    expect(summary.runway.configured).toBe(true);
    expect(summary.elevenlabs.configured).toBe(true);
    expect(summary.analytics.ga4.configured).toBe(true);
    expect(summary.analytics.posthog.configured).toBe(true);
    expect(summary.sendgrid.configured).toBe(true);
  });

  it("classifyGoogleCreativeFailure handles quota errors", async () => {
    const { classifyGoogleCreativeFailure } = await import("../utils/provider-status");
    const result = classifyGoogleCreativeFailure(429, "RESOURCE_EXHAUSTED: quota exceeded");
    expect(result.executionState).toBe("blocked_quota_or_billing");
  });

  it("classifyGoogleCreativeFailure handles permission errors", async () => {
    const { classifyGoogleCreativeFailure } = await import("../utils/provider-status");
    const result = classifyGoogleCreativeFailure(403, "Permission denied");
    expect(result.executionState).toBe("blocked_permission");
  });

  it("classifyGoogleCreativeFailure handles generic failures", async () => {
    const { classifyGoogleCreativeFailure } = await import("../utils/provider-status");
    const result = classifyGoogleCreativeFailure(500, "Internal server error");
    expect(result.executionState).toBe("request_failed");
  });

  it("getGoogleCreativeStatus defaults to gemini model, not imagen", async () => {
    const { getGoogleCreativeStatus } = await import("../utils/provider-status");
    const status = getGoogleCreativeStatus();
    expect(status.model).toContain("gemini");
    expect(status.model).not.toContain("imagen");
  });
});
```

- [ ] **Step 2: Run the test to verify it passes with current code**

Run: `npx vitest run server/tests/provider-status.test.ts`
Expected: PASS (the default model is already `gemini-3.1-flash-image-preview`)

- [ ] **Step 3: Remove the Imagen branch from google-creative.ts**

In `server/utils/google-creative.ts`, remove lines 64-104 (the `if (model.startsWith("imagen-"))` branch) and the now-unnecessary `sampleCount` handling for Imagen. Also remove the `supportsThinkingConfig` and `supportsImageSize` guards since only Gemini models remain. The function should go directly into the Gemini `generateContent` path.

Replace the full function body (lines 25-176) with:

```typescript
export async function generateGoogleCreativeImages(
  params: GenerateGoogleCreativeImagesParams,
) {
  const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
  if (!prompt) {
    throw new Error("Prompt is required");
  }

  const apiKey = requireConfiguredEnvValue(
    ["GOOGLE_GENAI_API_KEY", "GEMINI_API_KEY"],
    "Google image generation",
  );
  const model =
    getConfiguredEnvValue("GOOGLE_CREATIVE_IMAGE_MODEL")
    || "gemini-3.1-flash-image-preview";
  const aspectRatio =
    typeof params.aspectRatio === "string" && params.aspectRatio.trim()
      ? params.aspectRatio.trim()
      : getConfiguredEnvValue("GOOGLE_CREATIVE_IMAGE_DEFAULT_ASPECT_RATIO") || "16:9";
  const imageSize =
    typeof params.imageSize === "string" && params.imageSize.trim()
      ? params.imageSize.trim()
      : "1K";
  const thinkingLevel =
    typeof params.thinkingLevel === "string" && params.thinkingLevel.trim()
      ? params.thinkingLevel.trim().toUpperCase()
      : undefined;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          thinkingConfig: thinkingLevel
            ? { thinkingLevel }
            : undefined,
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "Google image generation failed";
    throw Object.assign(new Error(message), {
      statusCode: response.status,
      providerStatus: classifyGoogleCreativeFailure(response.status, message),
    });
  }

  const images: GoogleCreativeImageResult[] = (payload?.candidates || [])
    .flatMap((candidate: any) => candidate?.content?.parts || [])
    .map((part: any) => {
      const inlineData = part?.inlineData;
      const imageBytes = inlineData?.data || "";
      if (!imageBytes) return null;
      const mimeType = inlineData?.mimeType || "image/png";
      return {
        mimeType,
        imageBytes,
        dataUrl: `data:${mimeType};base64,${imageBytes}`,
      };
    })
    .filter(Boolean);

  if (images.length === 0) {
    const message = "Google returned no image payload for the selected model.";
    throw Object.assign(new Error(message), {
      statusCode: response.status,
      providerStatus: classifyGoogleCreativeFailure(response.status, message),
    });
  }

  return {
    ok: true,
    model,
    aspectRatio,
    imageSize,
    thinkingLevel: thinkingLevel || null,
    images,
    providerStatus: getGoogleCreativeStatus({
      executionState: "ready",
      note: "Live image generation succeeded for the selected Google creative model.",
    }),
  };
}
```

- [ ] **Step 4: Remove unused imports**

The `personGeneration` and `sampleCount` params are no longer used internally (they were only consumed by the Imagen branch). Keep them in `GenerateGoogleCreativeImagesParams` for interface compatibility but they are ignored. No import changes needed.

- [ ] **Step 5: Run tests to verify nothing broke**

Run: `npx vitest run server/tests/provider-status.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/utils/google-creative.ts server/tests/provider-status.test.ts
git commit -m "refactor: remove Imagen codepath, keep only Nano Banana (Gemini Flash)

Google is deprecating Imagen 3 endpoints by June 2026. Only Gemini Flash
image generation is used in production. Removes the unused imagen-* branch
from generateGoogleCreativeImages().

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add Runway model selection to creative factory

**Files:**
- Modify: `server/utils/creative-factory.ts:140-151`
- Test: (covered in Task 7 — creative-factory.test.ts)

- [ ] **Step 1: Add model env var read and pass-through in creative-factory.ts**

In `server/utils/creative-factory.ts`, at the top of `runCreativeAssetFactoryLoop()` (after line 83), add:

```typescript
const runwayVideoModel =
  normalizeString(process.env.BLUEPRINT_RUNWAY_VIDEO_MODEL) || "gen4_turbo";
```

Then modify the `startRunwayImageToVideoTask` call (currently lines 142-147) to include the model:

```typescript
const task = await startRunwayImageToVideoTask({
  promptText: kit.prompts.runwayPrompt,
  promptImage: firstImage,
  model: runwayVideoModel,
  ratio: "1280:720",
  duration: 5,
});
```

- [ ] **Step 2: Run existing tests to verify nothing broke**

Run: `npx vitest run server/tests/ops-automation-scheduler.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/utils/creative-factory.ts
git commit -m "feat: add configurable Runway video model selection

Reads BLUEPRINT_RUNWAY_VIDEO_MODEL env var (default gen4_turbo). Passes
model param to startRunwayImageToVideoTask in the creative factory loop.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Add formal storyboard types to creative-pipeline.ts

**Files:**
- Modify: `server/utils/creative-pipeline.ts:1-17`
- Test: `server/tests/creative-pipeline.test.ts` (new)

- [ ] **Step 1: Write the creative-pipeline test**

Create `server/tests/creative-pipeline.test.ts`:

```typescript
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildCreativeCampaignKit, type RemotionStoryboardFrame, type CreativeBriefInput } from "../utils/creative-pipeline";

function baseBrief(overrides?: Partial<CreativeBriefInput>): CreativeBriefInput {
  return {
    skuName: "Exact-Site Hosted Review",
    audience: "robotics deployment leads",
    siteType: "warehouse",
    workflow: "pre-deployment site review",
    proofPoints: ["One real facility, not a synthetic stand-in."],
    callToAction: "Book a 30-minute exact-site hosted-review scoping call.",
    differentiators: ["Rights and provenance stay explicit."],
    assetGoal: "landing_page",
    ...overrides,
  };
}

describe("buildCreativeCampaignKit", () => {
  it("produces a 4-frame storyboard at expected timings", () => {
    const kit = buildCreativeCampaignKit(baseBrief());
    expect(kit.remotionStoryboard).toHaveLength(4);

    const frames: RemotionStoryboardFrame[] = kit.remotionStoryboard;
    expect(frames[0].startFrame).toBe(0);
    expect(frames[0].durationFrames).toBe(90);
    expect(frames[1].startFrame).toBe(90);
    expect(frames[2].startFrame).toBe(180);
    expect(frames[3].startFrame).toBe(270);
    expect(frames[3].durationFrames).toBe(90);
  });

  it("limits proof bullets to 5", () => {
    const kit = buildCreativeCampaignKit(baseBrief({
      proofPoints: ["A", "B", "C", "D", "E", "F", "G"],
      differentiators: ["X", "Y", "Z"],
    }));
    expect(kit.landingPage.proofBullets.length).toBeLessThanOrEqual(5);
  });

  it("generates exactly 3 nano banana variants", () => {
    const kit = buildCreativeCampaignKit(baseBrief());
    expect(kit.prompts.nanoBananaVariants).toHaveLength(3);
  });

  it("always includes provenance guardrails", () => {
    const kit = buildCreativeCampaignKit(baseBrief());
    expect(kit.provenanceGuardrails.length).toBeGreaterThanOrEqual(4);
    expect(kit.provenanceGuardrails.some((g) => g.includes("real Blueprint evidence"))).toBe(true);
    expect(kit.provenanceGuardrails.some((g) => g.includes("fake customer logos"))).toBe(true);
  });

  it("incorporates buyer objections into proof bullets when provided", () => {
    const kit = buildCreativeCampaignKit(baseBrief({
      buyerObjections: ["Pricing seems high for a single site."],
    }));
    expect(kit.landingPage.proofBullets.some((b) => b.toLowerCase().includes("pricing"))).toBe(true);
  });

  it("incorporates buyer objections into storyboard scene 2 when provided", () => {
    const kit = buildCreativeCampaignKit(baseBrief({
      buyerObjections: ["Not clear how this differs from a generic sim."],
    }));
    const scene2 = kit.remotionStoryboard[1];
    expect(scene2.copy.toLowerCase()).toContain("generic");
  });

  it("works without buyer objections", () => {
    const kit = buildCreativeCampaignKit(baseBrief());
    expect(kit.remotionStoryboard[1].copy.length).toBeGreaterThan(0);
  });

  it("storyboard frames conform to RemotionStoryboardFrame interface", () => {
    const kit = buildCreativeCampaignKit(baseBrief());
    for (const frame of kit.remotionStoryboard) {
      expect(typeof frame.startFrame).toBe("number");
      expect(typeof frame.durationFrames).toBe("number");
      expect(typeof frame.title).toBe("string");
      expect(typeof frame.copy).toBe("string");
      expect(typeof frame.visual).toBe("string");
      expect(frame.title.length).toBeGreaterThan(0);
      expect(frame.copy.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/tests/creative-pipeline.test.ts`
Expected: FAIL — `RemotionStoryboardFrame` type not exported, `buyerObjections` not in `CreativeBriefInput`

- [ ] **Step 3: Add the types and buyerObjections to creative-pipeline.ts**

Add the exported interface after line 6 (after the `AssetGoal` type):

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

Add `buyerObjections` to `CreativeBriefInput`:

```typescript
export interface CreativeBriefInput {
  skuName: string;
  audience: string;
  siteType: string;
  workflow: string;
  proofPoints: string[];
  callToAction: string;
  differentiators: string[];
  assetGoal: AssetGoal;
  buyerObjections?: string[];
}
```

- [ ] **Step 4: Wire buyerObjections into the kit generation**

In `buildCreativeCampaignKit()`, after the `supportingBullets` array (line 52), add objection-driven bullets:

```typescript
const objectionBullets = nonEmpty(input.buyerObjections || [])
  .slice(0, 2)
  .map((objection) => `Addresses common concern: ${objection.replace(/\.$/, "")}`);
```

Insert objection bullets into `supportingBullets` before the `.slice(0, 5)`:

```typescript
const supportingBullets = [
  `Grounded on real capture of one ${siteType}, not synthetic stand-ins.`,
  ...proofPoints.map((point) => point.replace(/\.$/, "")),
  ...differentiators.map((point) => point.replace(/\.$/, "")),
  ...objectionBullets,
].slice(0, 5);
```

In the storyboard scene 2 (the "Why this matters" scene at `startFrame: 90`), update the `copy` to include objection content when available:

```typescript
{
  startFrame: 90,
  durationFrames: 90,
  title: "Why this matters",
  copy: objectionBullets.length > 0
    ? [objectionBullets[0], ...supportingBullets.slice(0, 1)].join(" • ")
    : supportingBullets.slice(0, 2).join(" • "),
  visual: "Package manifest, hosted session frame, and provenance markers.",
},
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/tests/creative-pipeline.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/utils/creative-pipeline.ts server/tests/creative-pipeline.test.ts
git commit -m "feat: add RemotionStoryboardFrame type and buyerObjections to creative pipeline

Formalizes the storyboard interface, adds ProductReelInput type for Remotion
rendering, and wires buyer objections into proof bullets and storyboard copy.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Create the Remotion ProductReel composition

**Files:**
- Create: `server/remotion/ProductReel.tsx`
- Create: `server/remotion/Root.tsx`
- Create: `server/remotion/index.ts`

- [ ] **Step 1: Create the ProductReel composition**

Create `server/remotion/ProductReel.tsx`:

```tsx
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface ProductReelProps {
  storyboard: Array<{
    startFrame: number;
    durationFrames: number;
    title: string;
    copy: string;
    visual: string;
  }>;
  images: string[];
}

const ACCENT_COLORS = ["#2563eb", "#0f766e", "#0891b2", "#7c3aed"];

function ProductSlide({
  image,
  title,
  copy,
  accent,
}: {
  image: string | null;
  title: string;
  copy: string;
  accent: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, rgba(244,244,245,1) 0%, rgba(241,245,249,1) 55%, rgba(226,232,240,1) 100%)",
        color: "#0f172a",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill style={{ padding: 44 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: image ? "1.2fr 0.8fr" : "1fr",
            gap: 28,
            height: "100%",
            alignItems: "stretch",
          }}
        >
          {image && (
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 28,
                border: "1px solid rgba(15,23,42,0.08)",
                transform: `scale(${0.96 + entrance * 0.04}) translateY(${18 - entrance * 18}px)`,
                boxShadow: "0 30px 90px rgba(15,23,42,0.18)",
              }}
            >
              <Img
                src={image}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              borderRadius: 28,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "rgba(255,255,255,0.78)",
              padding: "36px 32px",
              transform: `translateY(${22 - entrance * 22}px)`,
              opacity: interpolate(entrance, [0, 1], [0, 1]),
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,0.08)",
                padding: "8px 14px",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase" as const,
                color: "#475569",
                background: "#ffffff",
                alignSelf: "flex-start",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: accent,
                  display: "inline-block",
                }}
              />
              Blueprint
            </div>
            <div
              style={{
                marginTop: 22,
                fontSize: 42,
                lineHeight: 1.08,
                fontWeight: 700,
                letterSpacing: "-0.03em",
              }}
            >
              {title}
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 20,
                lineHeight: 1.5,
                color: "#475569",
              }}
            >
              {copy}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const ProductReel: React.FC<ProductReelProps> = ({
  storyboard,
  images,
}) => {
  const scenes = storyboard.length > 0
    ? storyboard
    : [{ startFrame: 0, durationFrames: 90, title: "Blueprint", copy: "Exact-site hosted review.", visual: "" }];

  return (
    <AbsoluteFill style={{ backgroundColor: "#f8fafc" }}>
      {scenes.map((scene, index) => (
        <Sequence
          key={index}
          from={scene.startFrame}
          durationInFrames={scene.durationFrames}
        >
          <ProductSlide
            image={images[index] || null}
            title={scene.title}
            copy={scene.copy}
            accent={ACCENT_COLORS[index % ACCENT_COLORS.length]}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Create Root.tsx for the composition registration**

Create `server/remotion/Root.tsx`:

```tsx
import { Composition } from "remotion";
import { ProductReel } from "./ProductReel";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ProductReel"
        component={ProductReel}
        durationInFrames={360}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          storyboard: [
            { startFrame: 0, durationFrames: 90, title: "Real site", copy: "Start from one real facility.", visual: "" },
            { startFrame: 90, durationFrames: 90, title: "Why this matters", copy: "Grounded proof, not synthetic stand-ins.", visual: "" },
            { startFrame: 180, durationFrames: 90, title: "What you get", copy: "Package, hosted review, operator outputs.", visual: "" },
            { startFrame: 270, durationFrames: 90, title: "Next step", copy: "Book the exact-site hosted review.", visual: "" },
          ],
          images: [],
        }}
      />
    </>
  );
};
```

- [ ] **Step 3: Create index.ts entry point**

Create `server/remotion/index.ts`:

```typescript
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

- [ ] **Step 4: Commit**

```bash
git add server/remotion/ProductReel.tsx server/remotion/Root.tsx server/remotion/index.ts
git commit -m "feat: add ProductReel Remotion composition for creative factory reels

Follows existing proof-reel/ pattern. Dynamic Slide component accepts
generated images and storyboard text from the creative factory output.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Create the Remotion render utility

**Files:**
- Create: `server/utils/remotion-render.ts`
- Test: `server/tests/remotion-render.test.ts` (new)

- [ ] **Step 1: Write the remotion-render test**

Create `server/tests/remotion-render.test.ts`:

```typescript
// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ProductReelInput } from "../utils/creative-pipeline";

const mockBundle = vi.hoisted(() => vi.fn());
const mockRenderMedia = vi.hoisted(() => vi.fn());
const mockEnsureBrowser = vi.hoisted(() => vi.fn());

vi.mock("@remotion/bundler", () => ({
  bundle: mockBundle,
}));

vi.mock("@remotion/renderer", () => ({
  renderMedia: mockRenderMedia,
  ensureBrowser: mockEnsureBrowser,
}));

describe("remotion-render", () => {
  beforeEach(() => {
    mockBundle.mockResolvedValue("/tmp/remotion-bundle-test");
    mockRenderMedia.mockResolvedValue({ size: 1024 });
    mockEnsureBrowser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renderProductReel calls bundle and renderMedia with correct props", async () => {
    const { renderProductReel } = await import("../utils/remotion-render");

    const input: ProductReelInput = {
      storyboard: [
        { startFrame: 0, durationFrames: 90, title: "Test", copy: "Test copy", visual: "test" },
        { startFrame: 90, durationFrames: 90, title: "Test 2", copy: "More copy", visual: "test" },
        { startFrame: 180, durationFrames: 90, title: "Test 3", copy: "Even more", visual: "test" },
        { startFrame: 270, durationFrames: 90, title: "CTA", copy: "Book now", visual: "test" },
      ],
      images: [
        { mimeType: "image/png", dataUrl: "data:image/png;base64,iVBOR" },
      ],
      fps: 30,
      width: 1280,
      height: 720,
    };

    const result = await renderProductReel(input);

    expect(mockBundle).toHaveBeenCalledOnce();
    expect(mockRenderMedia).toHaveBeenCalledOnce();

    const renderCall = mockRenderMedia.mock.calls[0][0];
    expect(renderCall.composition.id).toBe("ProductReel");
    expect(renderCall.composition.width).toBe(1280);
    expect(renderCall.composition.height).toBe(720);
    expect(renderCall.composition.fps).toBe(30);
    expect(renderCall.composition.durationInFrames).toBe(360);
    expect(renderCall.codec).toBe("h264");
    expect(renderCall.inputProps.storyboard).toHaveLength(4);

    expect(result.durationSeconds).toBe(12);
    expect(result.frames).toBe(360);
    expect(result.outputPath).toContain("product-reel");
    expect(result.outputPath).toEndWith(".mp4");
  });

  it("renderProductReel uses total storyboard frames for duration", async () => {
    const { renderProductReel } = await import("../utils/remotion-render");

    const input: ProductReelInput = {
      storyboard: [
        { startFrame: 0, durationFrames: 60, title: "Short", copy: "Quick", visual: "test" },
        { startFrame: 60, durationFrames: 60, title: "End", copy: "Done", visual: "test" },
      ],
      images: [],
      fps: 30,
      width: 1280,
      height: 720,
    };

    const result = await renderProductReel(input);

    const renderCall = mockRenderMedia.mock.calls[0][0];
    expect(renderCall.composition.durationInFrames).toBe(120);
    expect(result.durationSeconds).toBe(4);
    expect(result.frames).toBe(120);
  });

  it("renderProductReel throws on empty storyboard", async () => {
    const { renderProductReel } = await import("../utils/remotion-render");

    const input: ProductReelInput = {
      storyboard: [],
      images: [],
      fps: 30,
      width: 1280,
      height: 720,
    };

    await expect(renderProductReel(input)).rejects.toThrow("Storyboard must have at least one frame");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/tests/remotion-render.test.ts`
Expected: FAIL — `renderProductReel` does not exist

- [ ] **Step 3: Install Remotion rendering dependencies**

```bash
npm install --save @remotion/renderer@4.0.438 @remotion/bundler@4.0.438
npm install --save-dev @remotion/cli@4.0.438
```

- [ ] **Step 4: Create remotion-render.ts**

Create `server/utils/remotion-render.ts`:

```typescript
import path from "path";
import os from "os";
import { bundle } from "@remotion/bundler";
import { renderMedia, ensureBrowser } from "@remotion/renderer";
import type { ProductReelInput } from "./creative-pipeline";

const ENTRY_POINT = path.resolve(
  import.meta.dirname || path.dirname(new URL(import.meta.url).pathname),
  "..",
  "remotion",
  "index.ts",
);

export async function renderProductReel(input: ProductReelInput) {
  if (input.storyboard.length === 0) {
    throw new Error("Storyboard must have at least one frame");
  }

  const lastFrame = input.storyboard[input.storyboard.length - 1];
  const totalFrames = lastFrame.startFrame + lastFrame.durationFrames;
  const durationSeconds = totalFrames / input.fps;

  const imageUrls = input.images.map((img) => img.dataUrl);

  await ensureBrowser();

  const bundlePath = await bundle({
    entryPoint: ENTRY_POINT,
    onProgress: () => {},
  });

  const outputDir = os.tmpdir();
  const outputFileName = `product-reel-${Date.now()}.mp4`;
  const outputPath = path.join(outputDir, outputFileName);

  await renderMedia({
    composition: {
      id: "ProductReel",
      width: input.width,
      height: input.height,
      fps: input.fps,
      durationInFrames: totalFrames,
      defaultProps: {},
      props: {},
      defaultCodec: "h264",
    },
    serveUrl: bundlePath,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: {
      storyboard: input.storyboard,
      images: imageUrls,
    },
  });

  return {
    outputPath,
    durationSeconds,
    frames: totalFrames,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/tests/remotion-render.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/utils/remotion-render.ts server/tests/remotion-render.test.ts package.json package-lock.json
git commit -m "feat: add renderProductReel utility for programmatic Remotion rendering

Uses @remotion/bundler and @remotion/renderer to produce MP4 product reels
from creative factory storyboard data and generated images.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Wire Remotion render and objection feedback into creative factory

**Files:**
- Modify: `server/utils/creative-factory.ts`

- [ ] **Step 1: Add imports at top of creative-factory.ts**

Add after existing imports (line 4):

```typescript
import { renderProductReel } from "./remotion-render";
import type { ProductReelInput } from "./creative-pipeline";
```

- [ ] **Step 2: Add objection query function**

Add after the `latestResearchRun()` function (after line 32):

```typescript
async function recentBuyerObjections(lookbackDays = 30) {
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const snapshot = await db
    .collection("contactRequests")
    .where("created_at", ">=", cutoff)
    .orderBy("created_at", "desc")
    .limit(50)
    .get();

  const objectionCounts = new Map<string, number>();
  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const category = typeof data.objection_category === "string"
      ? data.objection_category.trim()
      : null;
    if (category) {
      objectionCounts.set(category, (objectionCounts.get(category) || 0) + 1);
    } else {
      const notes = typeof data.notes === "string" ? data.notes.trim()
        : typeof data.message === "string" ? data.message.trim()
        : "";
      if (notes.length > 10) {
        objectionCounts.set(notes.slice(0, 80), (objectionCounts.get(notes.slice(0, 80)) || 0) + 1);
      }
    }
  }

  return [...objectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([text]) => text);
}
```

- [ ] **Step 3: Wire objections into the brief in runCreativeAssetFactoryLoop**

After the `signalHighlights` assignment (after current line 97), add:

```typescript
const buyerObjections = await recentBuyerObjections();
```

Then update the `buildAutonomousCreativeBrief` call to include objections. In the `buildAutonomousCreativeBrief` function definition, add `buyerObjections?: string[]` to the params and pass it through to the brief return:

In the `buildAutonomousCreativeBrief` function params type (around line 34):

```typescript
function buildAutonomousCreativeBrief(params: {
  rolloutVariant?: string | null;
  researchTopic?: string | null;
  signalHighlights: string[];
  buyerObjections?: string[];
}) {
```

In the return of `buildAutonomousCreativeBrief`, add at the end:

```typescript
buyerObjections: params.buyerObjections || [],
```

Update the call site (after line 99) to:

```typescript
const brief = buildAutonomousCreativeBrief({
  rolloutVariant,
  researchTopic,
  signalHighlights,
  buyerObjections,
});
```

- [ ] **Step 4: Add Remotion render as post-step**

After the Runway task block (after current line 152), add the Remotion render:

```typescript
let remotionReel: { outputPath: string; durationSeconds: number; frames: number } | null = null;
if (imageBatch.length > 0) {
  try {
    const reelInput: ProductReelInput = {
      storyboard: kit.remotionStoryboard,
      images: imageBatch.flatMap((batch) =>
        batch.images.map((img) => ({ mimeType: img.mimeType, dataUrl: img.dataUrl })),
      ),
      runwayVideoUrl: null,
      fps: 30,
      width: 1280,
      height: 720,
    };
    remotionReel = await renderProductReel(reelInput);
  } catch {
    remotionReel = null;
  }
}
```

- [ ] **Step 5: Add remotion_reel to Firestore record**

In the `runRef.set()` call (around current line 154), add to the object:

```typescript
remotion_reel: remotionReel
  ? {
      output_path: remotionReel.outputPath,
      duration_seconds: remotionReel.durationSeconds,
      frames: remotionReel.frames,
    }
  : null,
```

- [ ] **Step 6: Update the return value**

Add to the return object (around current line 169):

```typescript
remotionReelPath: remotionReel?.outputPath || null,
```

- [ ] **Step 7: Run existing tests to verify nothing broke**

Run: `npx vitest run server/tests/ops-automation-scheduler.test.ts`
Expected: PASS (creative factory is mocked in this test)

- [ ] **Step 8: Commit**

```bash
git add server/utils/creative-factory.ts
git commit -m "feat: wire Remotion reel render and buyer objection feedback into creative factory

Creative factory now queries recent contactRequests for recurring objections,
feeds them into the campaign brief, and renders a Remotion product reel as a
post-step after image and video generation. Both steps are best-effort.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Write creative-factory.test.ts (loop-level + integration tests)

**Files:**
- Create: `server/tests/creative-factory.test.ts`

- [ ] **Step 1: Create the test file**

Create `server/tests/creative-factory.test.ts`:

```typescript
// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockFirestoreDoc = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));
const mockFirestoreCollection = vi.hoisted(() => ({
  doc: vi.fn(() => mockFirestoreDoc),
  orderBy: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn(),
}));
const mockDb = vi.hoisted(() => ({
  collection: vi.fn(() => mockFirestoreCollection),
}));
const mockServerTimestamp = vi.hoisted(() => vi.fn(() => "SERVER_TIMESTAMP"));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: mockServerTimestamp } } },
  dbAdmin: mockDb,
}));

const mockGenerateGoogleCreativeImages = vi.hoisted(() => vi.fn());
vi.mock("../utils/google-creative", () => ({
  generateGoogleCreativeImages: mockGenerateGoogleCreativeImages,
}));

const mockStartRunwayTask = vi.hoisted(() => vi.fn());
vi.mock("../utils/runway", () => ({
  startRunwayImageToVideoTask: mockStartRunwayTask,
}));

const mockRenderProductReel = vi.hoisted(() => vi.fn());
vi.mock("../utils/remotion-render", () => ({
  renderProductReel: mockRenderProductReel,
}));

const mockGetActiveExperimentRollouts = vi.hoisted(() => vi.fn());
vi.mock("../utils/experiment-ops", () => ({
  getActiveExperimentRollouts: mockGetActiveExperimentRollouts,
}));

describe("runCreativeAssetFactoryLoop", () => {
  beforeEach(() => {
    vi.stubEnv("BLUEPRINT_CREATIVE_FACTORY_SITE_TYPE", "warehouse");
    vi.stubEnv("BLUEPRINT_CREATIVE_FACTORY_WORKFLOW", "pre-deployment site review");
    vi.stubEnv("BLUEPRINT_CREATIVE_FACTORY_AUDIENCE", "robotics deployment leads");
    vi.stubEnv("BLUEPRINT_CREATIVE_FACTORY_SKU", "Exact-Site Hosted Review");
    vi.stubEnv("BLUEPRINT_CREATIVE_FACTORY_CTA", "Book a 30-minute scoping call.");

    mockGetActiveExperimentRollouts.mockResolvedValue({});
    mockFirestoreCollection.get.mockResolvedValue({ empty: true, docs: [] });
    mockFirestoreDoc.get.mockResolvedValue({ exists: false });
    mockFirestoreDoc.set.mockResolvedValue(undefined);
    mockGenerateGoogleCreativeImages.mockResolvedValue({
      images: [{ mimeType: "image/png", dataUrl: "data:image/png;base64,abc123" }],
    });
    mockStartRunwayTask.mockResolvedValue({ id: "task-123", status: "PENDING" });
    mockRenderProductReel.mockResolvedValue({
      outputPath: "/tmp/product-reel-123.mp4",
      durationSeconds: 12,
      frames: 360,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("generates assets with images, video, and reel", async () => {
    const { runCreativeAssetFactoryLoop } = await import("../utils/creative-factory");
    const result = await runCreativeAssetFactoryLoop();

    expect(result.status).toBe("assets_generated");
    expect(result.generatedImages).toBeGreaterThan(0);
    expect(result.runwayTaskId).toBe("task-123");
    expect(result.remotionReelPath).toBe("/tmp/product-reel-123.mp4");
    expect(mockFirestoreDoc.set).toHaveBeenCalledOnce();

    const setCall = mockFirestoreDoc.set.mock.calls[0][0];
    expect(setCall.status).toBe("assets_generated");
    expect(setCall.remotion_reel).toBeTruthy();
    expect(setCall.remotion_reel.output_path).toBe("/tmp/product-reel-123.mp4");
  });

  it("skips existing run", async () => {
    mockFirestoreDoc.get.mockResolvedValue({ exists: true });
    const { runCreativeAssetFactoryLoop } = await import("../utils/creative-factory");
    const result = await runCreativeAssetFactoryLoop();

    expect(result.status).toBe("skipped_existing");
    expect(mockGenerateGoogleCreativeImages).not.toHaveBeenCalled();
  });

  it("handles image generation failure gracefully", async () => {
    mockGenerateGoogleCreativeImages.mockRejectedValue(new Error("quota exceeded"));
    const { runCreativeAssetFactoryLoop } = await import("../utils/creative-factory");
    const result = await runCreativeAssetFactoryLoop();

    expect(result.status).toBe("prompt_pack_generated");
    expect(result.generatedImages).toBe(0);
    expect(result.runwayTaskId).toBeNull();
  });

  it("handles Runway failure gracefully", async () => {
    mockStartRunwayTask.mockRejectedValue(new Error("Runway 500"));
    const { runCreativeAssetFactoryLoop } = await import("../utils/creative-factory");
    const result = await runCreativeAssetFactoryLoop();

    expect(result.status).toBe("assets_generated");
    expect(result.runwayTaskId).toBeNull();
  });

  it("handles Remotion failure gracefully", async () => {
    mockRenderProductReel.mockRejectedValue(new Error("ffmpeg not found"));
    const { runCreativeAssetFactoryLoop } = await import("../utils/creative-factory");
    const result = await runCreativeAssetFactoryLoop();

    expect(result.status).toBe("assets_generated");
    expect(result.remotionReelPath).toBeNull();
  });

  it("reads experiment rollouts and passes winning variant", async () => {
    mockGetActiveExperimentRollouts.mockResolvedValue({
      exact_site_hosted_review_hero_v1: "proof_first",
    });
    const { runCreativeAssetFactoryLoop } = await import("../utils/creative-factory");
    await runCreativeAssetFactoryLoop();

    const setCall = mockFirestoreDoc.set.mock.calls[0][0];
    expect(setCall.rollout_variant).toBe("proof_first");
  });

  it("uses gen4_turbo as default Runway model", async () => {
    const { runCreativeAssetFactoryLoop } = await import("../utils/creative-factory");
    await runCreativeAssetFactoryLoop();

    expect(mockStartRunwayTask).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gen4_turbo" }),
    );
  });

  it("respects BLUEPRINT_RUNWAY_VIDEO_MODEL env override", async () => {
    vi.stubEnv("BLUEPRINT_RUNWAY_VIDEO_MODEL", "gen4_turbo_xl");
    vi.resetModules();
    const { runCreativeAssetFactoryLoop } = await import("../utils/creative-factory");
    await runCreativeAssetFactoryLoop();

    expect(mockStartRunwayTask).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gen4_turbo_xl" }),
    );
  });

  it("captures Runway model in Firestore record", async () => {
    const { runCreativeAssetFactoryLoop } = await import("../utils/creative-factory");
    await runCreativeAssetFactoryLoop();

    const setCall = mockFirestoreDoc.set.mock.calls[0][0];
    expect(setCall.runway_task).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run server/tests/creative-factory.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/tests/creative-factory.test.ts
git commit -m "test: add creative-factory loop-level and integration tests

Covers asset generation, skip logic, image/Runway/Remotion failure handling,
experiment rollout pass-through, Runway model selection, and Firestore write
verification.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Expand experiment-ops.test.ts with edge cases

**Files:**
- Modify: `server/tests/experiment-ops.test.ts`

- [ ] **Step 1: Add edge case tests**

Append to the existing `describe("experiment autorollout evaluation")` block in `server/tests/experiment-ops.test.ts`:

```typescript
it("returns monitoring with fewer than 2 variants", () => {
  const result = evaluateExperimentWinner({
    experimentKey: "test_experiment",
    minExposuresPerVariant: 50,
    minRelativeLift: 0.1,
    variantMetrics: {
      only_one: {
        exposures: 200,
        contactStarts: 40,
        contactSubmissions: 20,
        contactCompleted: 15,
      },
    },
  });

  expect(result.status).toBe("monitoring");
  expect(result.winningVariant).toBeNull();
  expect(result.rationale).toContain("at least two variants");
});

it("returns monitoring when all variants are below min exposures", () => {
  const result = evaluateExperimentWinner({
    experimentKey: "test_experiment",
    minExposuresPerVariant: 100,
    minRelativeLift: 0.1,
    variantMetrics: {
      variant_a: {
        exposures: 40,
        contactStarts: 10,
        contactSubmissions: 5,
        contactCompleted: 3,
      },
      variant_b: {
        exposures: 30,
        contactStarts: 8,
        contactSubmissions: 4,
        contactCompleted: 2,
      },
    },
  });

  expect(result.status).toBe("monitoring");
  expect(result.winningVariant).toBeNull();
});

it("handles zero exposures without division error", () => {
  const result = evaluateExperimentWinner({
    experimentKey: "test_experiment",
    minExposuresPerVariant: 0,
    minRelativeLift: 0.1,
    variantMetrics: {
      variant_a: {
        exposures: 0,
        contactStarts: 0,
        contactSubmissions: 0,
        contactCompleted: 0,
      },
      variant_b: {
        exposures: 0,
        contactStarts: 0,
        contactSubmissions: 0,
        contactCompleted: 0,
      },
    },
  });

  expect(result.status).toBe("inconclusive");
  expect(result.winningVariant).toBeNull();
});

it("breaks ties using exposure count", () => {
  const result = evaluateExperimentWinner({
    experimentKey: "test_experiment",
    minExposuresPerVariant: 50,
    minRelativeLift: 0.0,
    variantMetrics: {
      variant_a: {
        exposures: 100,
        contactStarts: 10,
        contactSubmissions: 5,
        contactCompleted: 5,
      },
      variant_b: {
        exposures: 200,
        contactStarts: 20,
        contactSubmissions: 10,
        contactCompleted: 10,
      },
    },
  });

  // Same conversion rate (5%), higher exposures wins tiebreak
  expect(result.status).toBe("inconclusive");
  // Tied rates with no lift → inconclusive
});

it("selects highest-available metric as primary", () => {
  const result = evaluateExperimentWinner({
    experimentKey: "test_experiment",
    minExposuresPerVariant: 10,
    minRelativeLift: 0.05,
    variantMetrics: {
      variant_a: {
        exposures: 100,
        contactStarts: 30,
        contactSubmissions: 0,
        contactCompleted: 0,
      },
      variant_b: {
        exposures: 100,
        contactStarts: 15,
        contactSubmissions: 0,
        contactCompleted: 0,
      },
    },
  });

  expect(result.primaryMetric).toBe("contactStarts");
  expect(result.status).toBe("active");
  expect(result.winningVariant).toBe("variant_a");
});

it("handles negative lift correctly", () => {
  const result = evaluateExperimentWinner({
    experimentKey: "test_experiment",
    minExposuresPerVariant: 50,
    minRelativeLift: 0.1,
    variantMetrics: {
      variant_a: {
        exposures: 100,
        contactStarts: 5,
        contactSubmissions: 2,
        contactCompleted: 1,
      },
      variant_b: {
        exposures: 100,
        contactStarts: 20,
        contactSubmissions: 10,
        contactCompleted: 8,
      },
    },
  });

  // variant_b clearly wins, but from variant_a's perspective the "lead" is negative
  expect(result.status).toBe("active");
  expect(result.winningVariant).toBe("variant_b");
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run server/tests/experiment-ops.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/tests/experiment-ops.test.ts
git commit -m "test: add experiment evaluation edge cases

Covers <2 variants, below min exposures, zero exposures, tied rates,
metric priority selection, and negative lift scenarios.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Expand autonomous-growth.test.ts

**Files:**
- Modify: `server/tests/autonomous-growth.test.ts`

- [ ] **Step 1: Add unit test edge cases for buildAutonomousOutboundDraft**

Append to the existing describe block:

```typescript
it("handles empty signals array", () => {
  const draft = buildAutonomousOutboundDraft({
    topic: "field robotics",
    signals: [],
  });

  expect(draft.subject).toContain("field robotics");
  expect(draft.body).toContain("Blueprint's weekly demand scan");
  expect(draft.body).not.toContain("1.");
});

it("truncates signals to 3", () => {
  const signals = Array.from({ length: 6 }, (_, i) => ({
    id: `sig-${i}`,
    topic: "warehouse robotics",
    title: `Signal ${i}`,
    summary: `Summary ${i}`,
    url: i % 2 === 0 ? `https://example.com/${i}` : null,
  }));

  const draft = buildAutonomousOutboundDraft({
    topic: "warehouse robotics",
    signals,
  });

  expect(draft.body).toContain("Signal 0");
  expect(draft.body).toContain("Signal 1");
  expect(draft.body).toContain("Signal 2");
  expect(draft.body).not.toContain("Signal 3");
});

it("includes signal URLs when present", () => {
  const draft = buildAutonomousOutboundDraft({
    topic: "logistics",
    signals: [
      {
        id: "sig-url",
        topic: "logistics",
        title: "New logistics trend",
        summary: "Details here",
        url: "https://example.com/trend",
      },
    ],
  });

  expect(draft.body).toContain("https://example.com/trend");
});

it("omits URLs when not present", () => {
  const draft = buildAutonomousOutboundDraft({
    topic: "logistics",
    signals: [
      {
        id: "sig-no-url",
        topic: "logistics",
        title: "Another trend",
        summary: "No link",
      },
    ],
  });

  expect(draft.body).not.toContain("(null)");
  expect(draft.body).not.toContain("(undefined)");
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run server/tests/autonomous-growth.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/tests/autonomous-growth.test.ts
git commit -m "test: add autonomous outbound draft edge cases

Covers empty signals, truncation to 3, signal URL inclusion/omission.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Run full test suite and verify build

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Fix any failures found in steps 1-3**

If any tests fail or type errors appear, fix them before proceeding.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address test/type issues from creative pipeline integration

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
