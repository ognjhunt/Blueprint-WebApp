# Ad Studio Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Ad Studio harness end-to-end so Blueprint can generate reviewable capturer and buyer creative runs, gate them through claims QA, and create paused Meta Marketing API draft objects.

**Architecture:** Add a new Firestore-backed Ad Studio service layer under `server/utils/`, wire it into `server/routes/admin-growth.ts`, and extend `client/src/pages/AdminGrowthStudio.tsx` with an ops review surface. Reuse the existing creative-factory and OpenRouter video conventions where they already match the design, but keep Ad Studio as a distinct audited workflow with its own run state, claims ledger, and Meta write contract.

**Tech Stack:** TypeScript, Express, Firestore Admin SDK, TanStack Query, Vitest, OpenRouter video integration, Meta Marketing API over `fetch`

---

### Task 1: Add Ad Studio domain model and Firestore service layer

**Files:**
- Create: `server/utils/ad-studio.ts`
- Create: `server/tests/ad-studio.test.ts`
- Modify: `server/config/env.ts`

- [ ] **Step 1: Write the failing service-layer tests**

```ts
// server/tests/ad-studio.test.ts
it("creates an ad studio run with normalized lane, claims, and paused meta placeholders", async () => {
  const result = await createAdStudioRun({
    lane: "capturer",
    audience: "public indoor capturers",
    cta: "Apply to capture public indoor spaces",
    budgetCapUsd: 250,
    city: "Atlanta",
    allowedClaims: ["Illustrative public-indoor scenes are allowed"],
    blockedClaims: ["No fabricated proof claims"],
    aspectRatio: "9:16",
  });

  expect(result.run.lane).toBe("capturer");
  expect(result.run.status).toBe("draft_requested");
  expect(result.run.metaDraft).toEqual({
    campaignId: null,
    adSetId: null,
    adId: null,
    status: "not_created",
  });
});

it("rejects runs missing the brief contract", async () => {
  await expect(
    createAdStudioRun({
      lane: "capturer",
      audience: "",
      cta: "",
      budgetCapUsd: 0,
      city: null,
      allowedClaims: [],
      blockedClaims: [],
      aspectRatio: "",
    }),
  ).rejects.toThrow("Ad Studio run requires audience, CTA, budget cap, aspect ratio, and claim boundaries.");
});
```

- [ ] **Step 2: Run the new test to verify red**

Run: `npm exec vitest run server/tests/ad-studio.test.ts`

Expected: FAIL with missing module or missing `createAdStudioRun`.

- [ ] **Step 3: Add the minimal domain model and persistence API**

```ts
// server/utils/ad-studio.ts
export type AdStudioLane = "capturer" | "buyer";
export type AdStudioRunStatus =
  | "draft_requested"
  | "brief_ready"
  | "image_prompt_ready"
  | "video_pending"
  | "review_pending"
  | "failed_claims_review"
  | "draft_safe"
  | "meta_draft_created"
  | "blocked_missing_brief_contract"
  | "blocked_asset_incomplete";

export interface CreateAdStudioRunInput {
  lane: AdStudioLane;
  audience: string;
  cta: string;
  budgetCapUsd: number;
  city?: string | null;
  allowedClaims: string[];
  blockedClaims: string[];
  aspectRatio: string;
}

export async function createAdStudioRun(input: CreateAdStudioRunInput) {
  // validate and persist to db.collection("ad_studio_runs")
}
```

- [ ] **Step 4: Add env parsing for Meta credentials**

```ts
// server/config/env.ts
META_AD_ACCOUNT_ID: z.string().trim().optional(),
META_MARKETING_API_ACCESS_TOKEN: z.string().trim().optional(),
META_MARKETING_API_BASE_URL: z.string().trim().url().optional(),
META_MARKETING_API_VERSION: z.string().trim().optional(),
```

- [ ] **Step 5: Run the focused tests to verify green**

Run: `npm exec vitest run server/tests/ad-studio.test.ts`

Expected: PASS with 2 tests passing.

- [ ] **Step 6: Commit**

```bash
git add server/utils/ad-studio.ts server/tests/ad-studio.test.ts server/config/env.ts
git commit -m "feat: add ad studio run service"
```

### Task 2: Add lane-specific brief building and claims review

**Files:**
- Modify: `server/utils/ad-studio.ts`
- Modify: `server/tests/ad-studio.test.ts`

- [ ] **Step 1: Write the failing brief/reviewer tests**

```ts
it("builds a capturer brief with synthetic public-indoor scene guidance", async () => {
  const { brief } = await buildAdStudioBrief({
    lane: "capturer",
    audience: "public indoor capturers",
    city: "Atlanta",
    cta: "Apply to capture public indoor spaces",
    allowedClaims: ["Illustrative scenes allowed"],
    blockedClaims: ["No fabricated payout proof"],
    budgetCapUsd: 250,
    aspectRatio: "9:16",
  });

  expect(brief.visualDirection).toContain("public-facing indoor");
  expect(brief.copyHooks.length).toBeGreaterThan(0);
});

it("fails review when synthetic proof is presented as real", async () => {
  const result = reviewAdStudioCreative({
    headline: "Earn $430 today capturing a real Atlanta gym",
    primaryText: "Three capturers already got paid this week.",
    claimsLedger: {
      allowedClaims: ["Illustrative scenes allowed"],
      blockedClaims: ["No fabricated earnings or captured sites"],
      evidenceLinks: [],
    },
  });

  expect(result.status).toBe("failed_claims_review");
  expect(result.reasons).toContain("Creative presents fabricated proof as real.");
});
```

- [ ] **Step 2: Run the tests to verify red**

Run: `npm exec vitest run server/tests/ad-studio.test.ts -t "builds a capturer brief|fails review"`

Expected: FAIL because the brief/reviewer functions do not exist yet.

- [ ] **Step 3: Add the minimal brief and reviewer implementation**

```ts
export async function buildAdStudioBrief(input: CreateAdStudioRunInput) {
  const visualDirection =
    input.lane === "capturer"
      ? "Synthetic public-facing indoor scenes, iPhone-style or wearable POV, creator workflow overlays."
      : "Synthetic exact-site hosted-review dramatization, operator review surfaces, deployment-risk framing.";

  return {
    brief: {
      lane: input.lane,
      visualDirection,
      copyHooks: input.lane === "capturer"
        ? ["POV: you get paid to map public indoor spaces", "Capture once, unlock repeated local work"]
        : ["Review the exact site before your robot shows up", "Hosted review for one real deployment question"],
      claimsLedger: {
        allowedClaims: input.allowedClaims,
        blockedClaims: input.blockedClaims,
      },
    },
  };
}

export function reviewAdStudioCreative(input: {
  headline: string;
  primaryText: string;
  claimsLedger: { allowedClaims: string[]; blockedClaims: string[]; evidenceLinks?: string[] };
}) {
  const text = `${input.headline} ${input.primaryText}`.toLowerCase();
  const fabricatedProof = /(earned \\$|already got paid|captured a real|real customer|real site)/i.test(text);
  if (fabricatedProof) {
    return {
      status: "failed_claims_review" as const,
      reasons: ["Creative presents fabricated proof as real."],
    };
  }
  return {
    status: "draft_safe" as const,
    reasons: [],
  };
}
```

- [ ] **Step 4: Run the tests to verify green**

Run: `npm exec vitest run server/tests/ad-studio.test.ts`

Expected: PASS with the new brief/reviewer coverage green.

- [ ] **Step 5: Commit**

```bash
git add server/utils/ad-studio.ts server/tests/ad-studio.test.ts
git commit -m "feat: add ad studio brief builder and claims review"
```

### Task 3: Add Seedance handoff and Meta Marketing API paused-draft writer

**Files:**
- Create: `server/utils/meta-marketing.ts`
- Modify: `server/utils/ad-studio.ts`
- Modify: `server/tests/ad-studio.test.ts`
- Create: `server/tests/meta-marketing.test.ts`

- [ ] **Step 1: Write the failing Meta API and video contract tests**

```ts
// server/tests/meta-marketing.test.ts
it("creates paused campaign, ad set, and ad payloads", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(okJson({ id: "cmp_1" }))
    .mockResolvedValueOnce(okJson({ id: "adset_1" }))
    .mockResolvedValueOnce(okJson({ id: "ad_1" }));

  const result = await createPausedMetaDraft(
    {
      accountId: "act_123",
      campaignName: "Blueprint Capturer Test",
      objective: "OUTCOME_TRAFFIC",
      dailyBudgetMinorUnits: 2500,
      primaryText: "Illustrative capturer concept ad.",
      headline: "Capture public indoor spaces",
      videoId: "vid_1",
      destinationUrl: "https://tryblueprint.io/capture",
    },
    fetchMock as unknown as typeof fetch,
  );

  expect(result).toEqual({
    campaignId: "cmp_1",
    adSetId: "adset_1",
    adId: "ad_1",
  });
  expect(fetchMock.mock.calls[0][0]).toContain("/campaigns");
});
```

```ts
// server/tests/ad-studio.test.ts
it("starts a Seedance task from an approved first frame", async () => {
  const startVideo = vi.fn().mockResolvedValue({ id: "task_1", status: "PENDING" });

  const result = await queueAdStudioVideo(
    {
      runId: "run_1",
      promptText: "Public indoor capture POV",
      firstFrameUrl: "https://cdn.example.com/frame.png",
      ratio: "9:16",
    },
    startVideo,
  );

  expect(result.videoTaskId).toBe("task_1");
});
```

- [ ] **Step 2: Run the tests to verify red**

Run: `npm exec vitest run server/tests/meta-marketing.test.ts server/tests/ad-studio.test.ts`

Expected: FAIL because the Meta writer and video queue helpers do not exist yet.

- [ ] **Step 3: Add the minimal Meta writer and video helper**

```ts
// server/utils/meta-marketing.ts
export async function createPausedMetaDraft(input: CreatePausedMetaDraftInput, fetchImpl = fetch) {
  const campaign = await postForm(fetchImpl, `${baseUrl}/${apiVersion}/act_${input.accountId}/campaigns`, {
    name: input.campaignName,
    objective: input.objective,
    status: "PAUSED",
    special_ad_categories: "[]",
  }, accessToken);

  const adSet = await postForm(fetchImpl, `${baseUrl}/${apiVersion}/act_${input.accountId}/adsets`, {
    name: `${input.campaignName} Ad Set`,
    campaign_id: campaign.id,
    status: "PAUSED",
    daily_budget: String(input.dailyBudgetMinorUnits),
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    destination_type: "WEBSITE",
  }, accessToken);

  const ad = await postForm(fetchImpl, `${baseUrl}/${apiVersion}/act_${input.accountId}/ads`, {
    name: `${input.campaignName} Ad`,
    adset_id: adSet.id,
    status: "PAUSED",
    creative: JSON.stringify(input.creative),
  }, accessToken);

  return { campaignId: campaign.id, adSetId: adSet.id, adId: ad.id };
}
```

```ts
// server/utils/ad-studio.ts
export async function queueAdStudioVideo(
  input: { runId: string; promptText: string; firstFrameUrl: string; ratio: string },
  startVideo = startRunwayImageToVideoTask,
) {
  const task = await startVideo({
    promptText: input.promptText,
    promptImage: input.firstFrameUrl,
    ratio: input.ratio,
  });
  return { videoTaskId: task.id, status: task.status };
}
```

- [ ] **Step 4: Run the tests to verify green**

Run: `npm exec vitest run server/tests/meta-marketing.test.ts server/tests/ad-studio.test.ts`

Expected: PASS with paused Meta payload and Seedance queue coverage green.

- [ ] **Step 5: Commit**

```bash
git add server/utils/meta-marketing.ts server/utils/ad-studio.ts server/tests/meta-marketing.test.ts server/tests/ad-studio.test.ts
git commit -m "feat: add ad studio video and meta draft writers"
```

### Task 4: Add admin routes for Ad Studio runs, briefing, review, video queue, and Meta draft creation

**Files:**
- Modify: `server/routes/admin-growth.ts`
- Create: `server/tests/admin-growth-routes.test.ts`

- [ ] **Step 1: Write the failing route tests**

```ts
it("creates an ad studio run", async () => {
  const response = await request(app)
    .post("/api/admin/growth/ad-studio/runs")
    .send({
      lane: "capturer",
      audience: "public indoor capturers",
      cta: "Apply now",
      budgetCapUsd: 250,
      allowedClaims: ["Illustrative scenes allowed"],
      blockedClaims: ["No fabricated proof"],
      aspectRatio: "9:16",
    });

  expect(response.status).toBe(201);
  expect(response.body.run.lane).toBe("capturer");
});
```

- [ ] **Step 2: Run the route test to verify red**

Run: `npm exec vitest run server/tests/admin-growth-routes.test.ts`

Expected: FAIL with missing route.

- [ ] **Step 3: Add the minimal routes**

```ts
router.post("/ad-studio/runs", requireOps, async (req, res) => {
  const result = await createAdStudioRun(normalizeAdStudioRunInput(req.body));
  return res.status(201).json(result);
});

router.post("/ad-studio/runs/:runId/brief", requireOps, async (req, res) => {
  const result = await buildAndPersistAdStudioBrief(req.params.runId);
  return res.json(result);
});

router.post("/ad-studio/runs/:runId/video", requireOps, async (req, res) => {
  const result = await queuePersistedAdStudioVideo(req.params.runId);
  return res.json(result);
});

router.post("/ad-studio/runs/:runId/review", requireOps, async (req, res) => {
  const result = await reviewPersistedAdStudioCreative(req.params.runId, req.body);
  return res.json(result);
});

router.post("/ad-studio/runs/:runId/meta-draft", requireOps, async (req, res) => {
  const result = await createPersistedAdStudioMetaDraft(req.params.runId, req.body);
  return res.json(result);
});
```

- [ ] **Step 4: Run the route tests to verify green**

Run: `npm exec vitest run server/tests/admin-growth-routes.test.ts`

Expected: PASS with the new endpoints registered and returning JSON.

- [ ] **Step 5: Commit**

```bash
git add server/routes/admin-growth.ts server/tests/admin-growth-routes.test.ts
git commit -m "feat: add ad studio admin routes"
```

### Task 5: Extend Admin Growth Studio with Ad Studio request and review UI

**Files:**
- Modify: `client/src/pages/AdminGrowthStudio.tsx`
- Create: `client/tests/admin-growth-studio.test.ts`

- [ ] **Step 1: Add the failing component-level test or state assertion**

```ts
// If no existing client test harness is practical, add one focused render test:
expect(screen.getByText("Ad Studio")).toBeInTheDocument();
expect(screen.getByRole("button", { name: /Create Ad Studio Run/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run the UI test to verify red**

Run: `npm exec vitest run client/tests/admin-growth-studio.test.ts`

Expected: FAIL because the Ad Studio section is not rendered yet.

- [ ] **Step 3: Add the minimal UI controls and run list**

```tsx
<section>
  <h2>Ad Studio</h2>
  <p>Create capturer or buyer campaign drafts, then review claims and paused Meta IDs.</p>
  <select value={adStudioForm.lane} onChange={...}>
    <option value="capturer">Capturer</option>
    <option value="buyer">Buyer</option>
  </select>
  <button onClick={createAdStudioRun}>Create Ad Studio Run</button>
  {adStudioRuns.map((run) => (
    <article key={run.id}>
      <h3>{run.lane} · {run.status}</h3>
      <p>{run.audience}</p>
      <p>Meta draft: {run.metaDraft?.adId || "Not created"}</p>
    </article>
  ))}
</section>
```

- [ ] **Step 4: Run the UI test to verify green**

Run: `npm exec vitest run client/tests/admin-growth-studio.test.ts`

Expected: PASS with the Ad Studio section visible.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AdminGrowthStudio.tsx client/tests/admin-growth-studio.test.ts
git commit -m "feat: add ad studio ops review ui"
```

### Task 6: Verify the full flow with focused tests and the existing repo checks

**Files:**
- Modify: `server/tests/ad-studio.test.ts`
- Modify: `server/tests/meta-marketing.test.ts`
- Modify: `server/tests/admin-growth-routes.test.ts`

- [ ] **Step 1: Add end-to-end service-path coverage**

```ts
it("creates a buyer run, approves review, and persists paused meta ids", async () => {
  const run = await createAdStudioRun(validBuyerInput);
  await persistAdStudioBrief(run.run.id, validBuyerBrief);
  await persistAdStudioAsset(run.run.id, validAsset);
  const review = await reviewPersistedAdStudioCreative(run.run.id, safeCreative);
  expect(review.status).toBe("draft_safe");
  const meta = await createPersistedAdStudioMetaDraft(run.run.id, metaInput, fetchMock);
  expect(meta.metaDraft.status).toBe("meta_draft_created");
  expect(meta.metaDraft.adId).toBe("ad_1");
});
```

- [ ] **Step 2: Run focused test suites**

Run: `npm exec vitest run server/tests/ad-studio.test.ts server/tests/meta-marketing.test.ts server/tests/admin-growth-routes.test.ts`

Expected: PASS with all Ad Studio coverage green.

- [ ] **Step 3: Run repo verification commands**

Run: `npm run check`
Expected: PASS

Run: `npm run test:coverage`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/tests/ad-studio.test.ts server/tests/meta-marketing.test.ts server/tests/admin-growth-routes.test.ts
git commit -m "test: verify ad studio flow end to end"
```
