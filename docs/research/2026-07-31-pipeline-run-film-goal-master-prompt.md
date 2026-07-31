# Master Goal Prompt: "The Run Film" — a show-don't-tell pipeline animation

Date: 2026-07-31
Repo: `Blueprint-WebApp` (primary). Read-only reference: `BlueprintCapturePipeline`, `BlueprintCapture`.

This is a handoff for a fresh session. It is implementation-oriented. The goal is to
build one scroll-driven motion graphic on the public site that **shows** how a Task
Evaluation Run actually works — from a real place, to a captured testbed, to a decision
with its edges drawn — so that a non-technical visitor understands the machine in about
sixty seconds without reading a paragraph of doctrine.

The current public site *tells* this story well. Every step is written down. Nothing on
the site *moves it*. That is the gap being closed.

---

## 1. Paste this to start the next session

Compact objective first:

```text
/goal Build "The Run Film" on Blueprint-WebApp: one scroll-driven, prerender-safe, reduced-motion-safe motion graphic on /how-it-works (plus a compact Home variant) that visually shows a real site-task moving through capture -> maintained testbed -> decision -> claim decomposition -> evidence routing -> measurement -> decision envelope. Read docs/research/2026-07-31-pipeline-run-film-goal-master-prompt.md first. Build it as DOM/SVG with framer-motion, no new deps, novice-legible, truth-bounded. Do not stop until it is implemented, tested, typechecked, built, screenshotted at both viewports, and verified.
```

Then paste:

```text
Use the full handoff in docs/research/2026-07-31-pipeline-run-film-goal-master-prompt.md.
The audit in section 2 is already done — trust it, but re-verify file paths before editing.
Work in the seven checkpoints in section 9. After each checkpoint post a short note:
checkpoint, files touched, what was verified, what remains, blocked or not.
If context gets long, compact and keep going.
```

---

## 2. Audit already performed (2026-07-31) — do not redo, just verify paths

### 2a. What the pipeline actually does (from `BlueprintCapturePipeline`)

Two lanes are live. Both matter to the film.

**Site/package lane** (`README.md`, `src/blueprint_pipeline/site_package_orchestrator.py`,
5.5k lines, entry `run_qualification_pipeline`):

```
BlueprintCapture bundle
  -> privacy-safe reconstruction input prep
  -> provider upload/request + persisted manifests
  -> materialized output assets with checksums
  -> CPU/pre-GPU scene + episode preflight
  -> simulation automation manifest
  -> explicitly gated simulator runs
```

**Decision/evidence lane** (`docs/architecture/decision-evidence-router.md`,
`src/blueprint_pipeline/decision_evidence_router.py`). This is the heart of the film.
The doc's own control-plane diagram:

```
Maintained Site-Task Testbed + Decision/Evidence Request
                       |
             deterministic claim router
                       |
      Evidence Plan (zero, one, or many leaf run specs)
          |             |                 |
   analytic/capture   EvaluationRunSpec   physical request/read-only outcome
          \             |                 /
              Normalized Evidence Results
                       |
                 Decision Envelope
                       |
           append-only Physical Outcome Join
                       |
         new testbed version + narrow calibration
```

**The stage ledger the real orchestrator runs** (`src/blueprint_pipeline/run_e2e.py`,
`_RUN_E2E_STAGE_ORDER`):

```
preflight -> materialization -> capture_pipeline -> task_evaluation_supervisor
   -> agent_review -> evaluation_prep -> support_validation -> robot_eval
```

**The seven versioned artifacts** (`src/blueprint_pipeline/decision_evidence_contracts.py`).
These are the real nouns; the film should visually correspond to them even though it must
never print the schema strings as marketing:

| Artifact | Schema version | Plain-language name for the film |
| --- | --- | --- |
| `MaintainedSiteTaskTestbed` | `maintained_site_task_testbed.v1` | the copy of your site we keep |
| `DecisionEvidenceRequest` | `decision_evidence_request.v1` | the question you're asking |
| `EvidenceMethodProfile` | `evidence_method_profile.v1` | what a method can do |
| `QualificationRecord` | `evidence_method_qualification.v1` | proof that method is allowed here |
| `EvidencePlan` | `evidence_plan.v1` | which evidence we'll go get |
| `NormalizedEvidenceResult` | `normalized_evidence_result.v1` | what came back |
| `DecisionEnvelope` | `decision_envelope.v1` | the answer and its edges |
| `PhysicalOutcomeJoin` | `physical_outcome_join.v1` | what really happened, folded back in |

`DecisionEnvelope` validation hard-fails unless `deployment_approval === false` and
`safety_certification === false`, and `overall_outcome` is one of
`decision | partial_decision | abstention`. That is a code-level guarantee, and the film
gets to show it as a visual — it is the single most honest, most differentiating beat
available.

**Router rejection reasons** (real strings, `decision_evidence_router.py`) — good source
material for the routing act, translated to plain English:
`method_not_permitted`, `method_restricted`, `external_processing_rights_incompatible`,
`provider_restricted`, `data_retention_incompatible`, `unsupported_domain:*`,
`claim_type_not_supported`, `method_unavailable`, `reproducibility_insufficient`,
`required_input_missing:*`, `over_budget`, `over_latency_budget`,
`authority_tier_insufficient`, `unqualified_or_out_of_scope`,
`false_safe_limit_exceeded`, `minimum_coverage_not_met`.

### 2b. What the capture app produces (from `BlueprintCapture`)

Canonical raw upload layout — this is what the film's first act should visually stack up:

```
scenes/{scene_id}/captures/{capture_id}/raw/
  manifest.json  intake_packet.json  capture_context.json
  capture_upload_complete.json  task_hypothesis.json
  walkthrough.mov  motion.jsonl
  arkit/ poses.jsonl frames.jsonl intrinsics.json depth/ confidence/ meshes/
```

Then the bridge emits `capture_descriptor.json`, `qa_report.json`, `pipeline_handoff.json`
and publishes to Pub/Sub `blueprint-capture-pipeline-handoff`, which is how the pipeline
picks the capture up automatically. Repo rule: *"Generated scenes are downstream derived
products, not truth."* The film must never invert that.

### 2c. What is currently on the site

Public pages: `client/src/pages/` — `Home.tsx`, `HowItWorks.tsx`, `Proof.tsx`,
`ForRobotTeams.tsx`, `ForSiteOperators.tsx`, `Pricing.tsx`, `About.tsx`, `Vision.tsx`,
`Governance.tsx`, `FAQ.tsx`, `Sites.tsx`, `Contact.tsx`.

**Existing visual system — reuse it, do not reinvent it:**

- `client/src/components/site/motion.tsx` (359 lines) — `Reveal`, `RevealStagger`,
  `ParallaxMedia`, `ScrollProgressRail`, `DrawIn` (SVG stroke-dashoffset draw), `GrowIn`,
  `useHasMounted`. Two invariants stated in its header comment and they are binding:
  1. **Never ship hidden content.** Helpers render children fully visible on server and
     first paint; animation is only armed post-mount for elements still below the fold.
  2. **Reduced motion wins outright.** Every helper has a static branch.
- `client/src/components/site/figures.tsx` (35.5k, 950+ lines) — `Figure` (shared frame
  with the "Illustrative" marker and a values-table toggle), `RunLifecycleRail`,
  `EvidenceLadderChart`, `ClaimThresholdChart`, `OutcomeSpectrum`, `CoverageMeter`,
  `DecisionShiftCompare`, `StatRow`. **Read this file's header comment before writing a
  single line of the film** — it encodes the palette law (section 5c below).
- `client/src/components/site/publicSections.tsx` — `Band`, `Inner`, `PageHero`
  (with `routeTrace` overlay), `SectionHeader`, `MediaSplit`, `FullBleedMedia`,
  `NoteCards`, `ClosingCta`.
- `client/src/components/site/editorial.tsx` — `MonochromeMedia`, `ProofChip`,
  `RouteTraceOverlay`.
- `client/src/components/blueprint/` — `ProofBoundary`, `StatusChip`, `MetricStat`,
  `PolicyRankBar`, `DataField`, `Button`, `Card`, `Tabs`.
- `client/src/components/motion/AnimatedCounter.tsx`.

**Copy source of truth:** `client/src/data/publicSiteCopy.ts`. Already holds
`homeLifecycle` (5 stages), `howItWorksSteps` (6 steps), `howItWorksSplit`
(who-owns-what), `homeEvidenceRungs` (5 rungs with `basis` + `cost` + `stopped`),
`homeClaims` (3 claim intervals + verdicts), `homeClaimThreshold = 0.9`,
`homeOutcomes` (5 outcome bands), `homeLimits`, `homeStats`, `homeDecisionCost`.
**The film's script should be added to this file, not hardcoded in the component.**

**Current `/how-it-works` structure** (`client/src/pages/HowItWorks.tsx`, 233 lines):
`PageHero` → stepped `<ol>` of `howItWorksSteps` inside a `ScrollProgressRail` →
who-owns-what two-column → `EvidenceLadderChart` → `ClaimThresholdChart` + two
`ProofBoundary` cards → `FullBleedMedia` (step 06) → limits → `ClosingCta`.
It is well written and entirely static. Six numbered paragraphs and two charts.

**Current Home structure** (`client/src/pages/Home.tsx`, 324 lines): hero →
`StatRow` → `DecisionShiftCompare` → **`RunLifecycleRail`** (section 03, "Five moves from
a real task to an answer") → `ClaimThresholdChart` → `OutcomeSpectrum` →
`EvidenceLadderChart` → `FullBleedMedia` → personas → limits → CTA.
Section 03 is where the compact film variant belongs.

**Motion that already exists:** `Reveal`/`RevealStagger` fades, `ParallaxMedia` (40px),
`ScrollProgressRail` brass fill, `DrawIn` on the `RunLifecycleRail` connector,
`GrowIn` on bars, `RouteTraceOverlay` on hero images. All are *entrance* motion. There
is no *explanatory* motion anywhere on the site. That is the whole opportunity.

**Remotion exists but is offline-only:** `proof-reel/` (`Root.tsx`,
`BlueprintProofReel.tsx`, `BlueprintSiteMotionLoop.tsx`) renders MP4s via
`npm run render:proof-reel` / `render:site-motion-loop` into `client/public/proof/`.
Deps `remotion@^4.0.438`, `@remotion/bundler`, `@remotion/renderer` are already installed.
**The on-page film is NOT Remotion** — see section 4. Remotion is an optional
stretch goal for a social/export cut only.

**Deps available:** `framer-motion@^11.18.2`, `lucide-react`, `d3-color`, tailwind.
No three.js, no lottie, no gsap. **Do not add any.**

**Build/verify chain:** `npm run check` (tsc), `npm run test:coverage` (vitest,
happy-dom, includes `client/tests/**`), `npm run build` (vite → `scripts/prerender.tsx`
→ sitemap → esbuild), `npm run test:e2e` (playwright, `e2e/`), `npm run perf:pages`.

**Prerender:** `scripts/prerender.tsx` renders `/how-it-works` with the **real**
`HowItWorks` component into static HTML. Anything the film says must survive with
JavaScript switched off.

**Tests that will break and must be updated, not deleted:**
`client/tests/pages/HowItWorks.test.tsx` (asserts the six step headings verbatim,
"Choosing is our job", "The pipeline owns the verdict", "including the decision to
abstain", "Unknown states fail closed"), `client/tests/pages/Home.test.tsx`,
`client/tests/components/site/PublicCopy.test.tsx` (asserts "We build the testbed",
"cheapest evidence that is actually good enough", "A run is allowed to tell you it
cannot tell you", and asserts absence of `Policy Shortlist`, `Robot Match`, `$3,000`,
`$5,000`, `guaranteed winner`), `e2e/brand-polish.spec.ts` (12 routes × 2 viewports:
checks horizontal overflow, missing alt, unnamed interactive elements, unlabeled
controls, placeholder text, and launch-posture patterns).

---

## 3. What to build

**One artifact, two placements.**

`RunFilm` — a scroll-scrubbed, seven-act explanatory animation that follows a single
object (one site-task) all the way through the system. It replaces the *stepped list*
on `/how-it-works` as that page's spine (the prose steps become the film's captions,
not a separate list), and ships a compact three-act variant on Home in place of the
current `RunLifecycleRail` section.

### The seven acts

Each act is one idea, one sentence, one visual change. The site-task object is on screen
in every single act and never teleports.

**Act 1 — A real place, and a real job.**
A plan-view of a working space fades up. A capture route traces through it (reuse the
`RouteTraceOverlay` visual language). As the route draws, small evidence tiles stack in
the margin: frames, poses, depth, timestamps, rights. A lock mark lands on the stack.
Caption: *"Someone walks the site. What the sensors saw is kept exactly as recorded."*
Term chip: `raw capture`.

**Act 2 — It becomes a copy we keep.**
The evidence stack compresses into a single solid tile. A version stamp and a short
digest hash type on beneath it. The tile gets a hairline border and stops moving —
visually, it is now *fixed*.
Caption: *"That becomes a testbed: one exact, versioned copy we maintain and reuse."*
Term chip: `maintained Site-Task Testbed`. **The raw stack does not disappear** — it
stays visible, dimmed, behind the tile, for the rest of the film. Raw stays the source.

**Act 3 — You ask one question.**
A question card slides in from the buyer side and docks against the testbed tile. It
carries: the decision, one threshold with units, and what a wrong yes would cost.
Caption: *"You bring the decision you're about to make — not a benchmark request."*
Term chip: `decision request`.

**Act 4 — The question splits into claims.**
The single question card splits into three claim chips, fanning out. Each chip is a
sentence a person can check: e.g. *"Candidate A can reach the fixture from the approach
lane."* Use `homeClaims` from `publicSiteCopy.ts` verbatim.
Caption: *"A decision is never one question. We break it into claims that can each be
checked on their own."*

**Act 5 — Each claim finds the cheapest evidence strong enough.** ← the centrepiece
A five-rung ladder appears (reuse `homeEvidenceRungs` order and `basis` tags). Each of
the three claim chips climbs independently and **stops at a different rung**. One chip is
turned away at a rung by a gate — show the gate closing and a plain-English reason
("this method isn't qualified for this claim") — and then continues up to the next rung.
Caption: *"Each claim goes to the cheapest evidence that's actually strong enough. You
never pick the method — that's the part you're paying us for."*
**Non-negotiable framing:** the ladder is cost, not authority. The `basis` tag rides on
every rung. A derived rung sitting higher must not read as "better proof" — Act 5 needs
a persistent one-line note saying cost order is not proof order, and the "Real capture"
rung must stay visually anchored as the reference.

**Act 6 — What came back, against the line you set.**
The three claims return as measured intervals drawn against a horizontal threshold line
(the visual grammar of `ClaimThresholdChart`, and it should reuse that component's
palette). One clears the line with room. One falls clearly short. One has its point
estimate above the line and its interval straddling it.
Caption: *"Each method reports what it measured and how sure it is. Where methods
disagreed, you see the disagreement — we don't average it away."*

**Act 7 — The answer, with its edges.**
The three results assemble into one envelope. Three verdict rows resolve with icon +
text label: **supported** / **ruled out** / **not yet**. Two stamps land on the envelope,
deliberately, and stay: `deployment approval: no` and `safety certification: no`. A final
line slides out below: the next cheapest experiment.
Caption: *"You get an answer with its limits attached — including 'not yet', which is a
real result, not a failure. And the cheapest next test that would settle it."*

### The compact Home variant

Three acts only: **capture → route → answer with edges** (acts 1, 5, 7 compressed).
Roughly 40% of the vertical budget. Ends with a link to `/how-it-works` for the full
film. It replaces `RunLifecycleRail` in Home section 03; keep `RunLifecycleRail` exported
in case another page uses it, but stop calling it from Home if the film covers it.

---

## 4. Technical approach — decided, not open

**Build it as DOM + inline SVG, animated with framer-motion, scrubbed by scroll
progress.** Not a video file. Not Remotion. Not canvas. Not WebGL.

Reasons, in order of weight:

1. `/how-it-works` is prerendered to static HTML by `scripts/prerender.tsx`. A video is
   an opaque box to crawlers, LLM agents reading `llms.txt`, and no-JS visitors. Text and
   SVG survive.
2. `client/src/components/site/motion.tsx` already establishes the never-ship-hidden-
   content and reduced-motion-wins invariants. A DOM film inherits them for free.
3. Screen readers get the whole story from the static markup. A video needs a parallel
   transcript that will rot.
4. Zero new dependencies, zero new build steps, no CDN, no asset pipeline.
5. It stays editable in `publicSiteCopy.ts` by anyone, forever. An MP4 requires a
   re-render to fix a typo.

**Scrub mechanism:** one `useScroll({ target, offset })` over a tall pinned section;
map `scrollYProgress` into per-act progress via `useTransform`. Sticky viewport
(`position: sticky`) holding the stage, with a tall scroll track behind it. Cap the total
track height — roughly `280vh` desktop / `220vh` mobile — so nobody feels trapped.

**Motion budget:** transforms and opacity only. No animating width/height/top/left. Never
more than three elements in motion at once. Target 60fps on a mid-tier laptop; verify no
long tasks over 50ms during scrub in devtools.

**Mobile:** below `lg`, do not scroll-scrub. Render the acts as a stepped vertical
sequence — each act a card that reveals on entry, with its caption directly under it.
Same content, same order, no pinning. Scroll-jacking on phones is where explainers go to
die.

**Controls (required, not optional):**
- A visible act stepper (1–7) that is a real `<button>` list; clicking scrolls to that act.
- A "Replay" control once the film completes.
- Under `prefers-reduced-motion: reduce`: no scrub, no pinning — the full static
  sequence, every act at its final resolved state, in reading order.

---

## 5. Truth constraints — these are law, not preferences

Sourced from `PLATFORM_CONTEXT.md`, `CLAUDE.md`, `AGENTS.md`, and the header comment of
`figures.tsx`. A beautiful animation that breaks one of these is a defect.

### 5a. Product truth

1. **One product.** A Task Evaluation Run. No tiers, packages, add-ons, or SKUs. The film
   must not imply a menu.
2. **The customer never picks a backend.** No simulator, world model, provider, or vendor
   name is ever shown as a customer choice — or shown at all. Act 5 names methods
   generically only: geometry / recorded observations / simulation / generated and
   model-based / real hardware. **Never** print Cosmos, Isaac, MuJoCo, World Labs, Marble,
   Vast, RunPod, OSCAR, or any model name on the public site.
3. **Raw capture is authoritative.** Derived evidence — simulation, generated frames,
   model output — is support, never ground truth, and is never visually promoted. In Act 2
   the raw stack persists behind the testbed tile precisely to make this legible.
4. **Cost order is not authority order.** The ladder in Act 5 encodes relative cost. It
   must carry the `basis` tag per rung and an explicit note that a costlier derived method
   does not outrank cheaper real capture.
5. **Abstention is a first-class ending.** "Not yet" must have the same visual weight as
   "supported". Never convert a refusal to decide into a winner, and never show raw scores
   being compared to produce one.
6. **No deployment approval, no safety certification.** The stamps in Act 7 are affirmative
   about this. `DecisionEnvelope` enforces both as `false` at the contract layer; the film
   says it out loud.
7. **Unknown states fail closed.** Anything unestablished is shown as a gap, never as a pass.
8. **The site owns the record; the pipeline owns the verdict.** Match `howItWorksSplit`.
   The film must not imply the website computes or scores anything.
9. **No fabricated operational state.** No fake counters, no "1,247 runs completed", no
   live-looking dashboards, no invented site names or logos, no supply that doesn't exist.
10. **Schematic values must be marked.** Every figure with numbers wears the `Figure`
    component's `illustrative` marker. The film shows numbers (intervals, thresholds), so
    the film is illustrative and must say so — visibly, inside the frame, not in a footnote.
11. **Post-training is not a product.** It is a permitted use of qualifying evidence inside
    a run. Do not give it an act, a chip, or a label.

### 5b. Accessibility

- Full story readable with **JS off** (prerendered static branch is the spine, not a
  fallback afterthought).
- Full story readable under `prefers-reduced-motion: reduce`.
- Status is **never** carried by color alone — icon **and** text label on every verdict.
  Per `figures.tsx`: the status hues sit at ΔE 8.3 under protanopia, so this is already
  repo law.
- Every interactive control has an accessible name. `e2e/brand-polish.spec.ts` fails the
  build on unnamed interactive elements.
- Decorative SVG gets `aria-hidden="true"`; the narrative lives in real text nodes.
- No horizontal overflow at either QA viewport — brand-polish measures this.
- The act stepper is keyboard-navigable and focus-visible.

### 5c. Palette law (verbatim from `figures.tsx` — follow it exactly)

- **Magnitude / "which rung did we stop at"** → emphasis form: one accent
  (`#2563a6` on paper, `#3a79c2` on ink) against de-emphasis warm gray
  (`#817e72` on paper, `#a8a496` on ink). Validated for CVD separation, clears 3:1.
- **Brass (`#c7a775` / deep `#a8854f`) is brand chrome and is deliberately NOT a data
  color** — against the warm neutral ramp it lands at ΔE 8.1 normal-vision, not separable.
  Brass may mark the rail, the eyebrow, the CTA. Never a value.
- **Claim outcomes** use the reserved status scale: `proof` `#1f6b4f` / `warn` `#9a6a16` /
  `block` `#9b3027` / `info` `#1f4f8f`, each with icon + label.
- **Basis tags** already have tones in `figures.tsx`: Real capture & Real world `#1f6b4f`,
  Computed from capture `#45443d`, Derived `#9a6a16`.
- Surfaces: `canvas #faf7f0`, `paper #f5f1e8`, `ink #0d0d0b`, `line #ded7c8`.

### 5d. Simplicity law — the actual hard requirement

The user's constraint is "super detailed but understandable by a novice." Detail lives in
the *fidelity of the mechanism shown*, not in the density of what is on screen.

- **One moving object thread.** The site-task is continuously present and continuously
  identifiable. A viewer must never wonder "wait, what am I looking at now?"
- **≤ 8 words per on-screen label.** One caption sentence per act, ≤ 22 words.
- **Plain language first, jargon second.** Big text is human ("the copy of your site we
  keep"). The internal term is a small mono chip beneath it ("maintained testbed"). Never
  the reverse. This is what lets an expert and a novice read the same frame.
- **Each act answers two questions:** what just happened, and who did it (you / Blueprint).
  Encode the actor as a persistent side-marker, not extra prose.
- **No simultaneous entrances.** Beats are sequential. If two things must appear, they
  appear 150ms apart.
- **Nothing requires hover to be understood.** Hover may add detail; it never carries it.
- **The novice test, run for real:** show the finished film to someone who does not know
  what a Task Evaluation Run is. If they cannot then say, unprompted, *"they capture a
  real place, then answer questions about it with the cheapest evidence that's good
  enough, and they'll tell you when they can't answer"* — the film is not done. Write the
  result of this test into the PR body honestly, including if it failed and what changed.

---

## 6. File map

**New:**

```
client/src/components/site/runFilm/
  RunFilm.tsx          # orchestrator: scroll track, sticky stage, act routing, stepper
  acts.tsx             # the seven act renderers (SVG + DOM), one export each
  RunFilmStatic.tsx    # the no-JS / reduced-motion sequence (the spine)
  useActProgress.ts    # scrollYProgress -> per-act progress + active index
  index.ts
```

**Modified:**

```
client/src/data/publicSiteCopy.ts     # + runFilmScript: acts, captions, term chips, actors
client/src/pages/HowItWorks.tsx       # film becomes the spine; prose steps become captions
client/src/pages/Home.tsx             # compact 3-act variant replaces RunLifecycleRail call
client/tests/pages/HowItWorks.test.tsx
client/tests/pages/Home.test.tsx
client/tests/components/site/PublicCopy.test.tsx
```

**New tests:**

```
client/tests/components/site/RunFilm.test.tsx
```

Must assert: all seven act captions render statically without scroll; the illustrative
marker is present; both `deployment approval: no` and `safety certification: no` render;
every verdict has a text label (not color alone); no provider/model names appear; the
"not yet" outcome is present; the stepper buttons have accessible names.

**Possibly:** `e2e/how-it-works.spec.ts` or an added case in `e2e/brand-polish.spec.ts`
asserting the film renders and the page has no horizontal overflow at both viewports.

Keep `publicSiteCopy.ts` as the single source for every word. Zero hardcoded copy in
`acts.tsx`.

---

## 7. What NOT to do

- Do not add a dependency. Not lottie, not three, not gsap, not react-spring.
- Do not build it in Remotion and embed an MP4 as the primary on-page artifact.
- Do not scroll-jack on mobile.
- Do not autoplay anything with sound, ever.
- Do not put a provider, model, or vendor name on a public page.
- Do not invent metrics, counts, customer names, or logos.
- Do not delete the existing figures (`EvidenceLadderChart`, `ClaimThresholdChart`,
  `OutcomeSpectrum`) — the film is the narrative spine and the figures remain the
  inspectable detail beneath it. The film earns attention; the figures reward it.
- Do not weaken the existing tests to make them pass. Update the assertions to the new
  copy and keep every truth assertion (absence of `Policy Shortlist`, `Robot Match`,
  fixed prices, `guaranteed winner`).
- Do not ship an animation whose static branch is a blank box or a poster image. The
  static branch is a complete, readable telling of the same story.
- Do not let the film become the eighth thing on `/how-it-works`. It replaces the stepped
  list. Net section count on that page should not increase.

---

## 8. Verification loop — run all of it, paste real output

```bash
npm run check                     # tsc, must be clean
npx vitest run client/tests/components/site/RunFilm.test.tsx
npx vitest run client/tests/pages/HowItWorks.test.tsx client/tests/pages/Home.test.tsx \
  client/tests/components/site/PublicCopy.test.tsx
npm run test:coverage             # full unit lane
npm run build                     # MUST succeed: prerender renders the real HowItWorks
npm run perf:pages                # no regression on /how-it-works or /
npm run test:e2e -- brand-polish  # 12 routes x 2 viewports; overflow/alt/naming gates
```

Then, by hand:

1. `npm run dev`, load `/how-it-works`, scroll the film top to bottom at normal speed.
2. Repeat with devtools CPU throttled 4×. Note any frame drops.
3. Repeat at 390px wide — confirm the stepped mobile sequence, not the pinned scrub.
4. Toggle OS reduced-motion on and reload. Confirm the static sequence, fully resolved.
5. Disable JavaScript and reload. Confirm every act's caption and verdict is still there.
6. Tab through the page. Confirm the stepper is reachable and focus is visible.
7. Read the prerendered `dist/public/how-it-works/index.html` and confirm the film's text
   is in it.
8. Screenshot desktop + mobile, both `/` and `/how-it-works`, and attach to the PR.
9. Run the novice test from 5d on an actual person and report the result.

---

## 9. Checkpoints

1. **Read and confirm.** Read `PLATFORM_CONTEXT.md`, `CLAUDE.md`, `figures.tsx` header,
   `motion.tsx` header, `publicSiteCopy.ts`. Re-verify the audit in section 2 still
   matches the tree. Post any drift found.
2. **Script.** Write `runFilmScript` into `publicSiteCopy.ts` — seven acts, captions,
   term chips, actor markers — and get the words right before any pixel moves. Words
   first; this is the step that determines whether a novice understands it.
3. **Static spine.** Build `RunFilmStatic.tsx` and wire it into `/how-it-works`. Ship a
   version that is correct, readable, and truthful with **zero animation**. Tests green,
   build green. This is the floor the rest of the work sits on.
4. **Scrub engine.** `useActProgress.ts` + `RunFilm.tsx` sticky stage, act routing, act
   stepper, replay, reduced-motion and mobile branches. Still no artwork — placeholder
   blocks are fine. Verify the mechanism and the a11y before investing in the visuals.
5. **The seven acts.** Build `acts.tsx` act by act, in order. Verify each in the browser
   before starting the next. Act 5 is the centrepiece — budget the most time there.
6. **Home variant + test updates.** Compact three-act cut into Home section 03; update all
   four affected test files; add `RunFilm.test.tsx`.
7. **Full verification + PR.** Run section 8 end to end. Open the PR with screenshots, the
   novice-test result, and an explicit checklist of the section 5a truth constraints with
   how each is satisfied.

Ship at checkpoint 3 if you run out of room — a truthful static telling beats a
half-finished animation. Every checkpoint after 3 is an upgrade to something already
correct.

---

## 10. Why this is worth building

`/how-it-works` currently opens with *"Six steps, and one of them is allowed to say no."*
That is the best line on the website and it is doing its work as static type. The thing
Blueprint sells is a *mechanism* — a machine that decomposes a decision, routes each piece
to the cheapest sufficient evidence, and is willing to come back and say the evidence
won't carry it. Mechanisms are the single thing that motion explains better than prose.

Every competitor's evaluation product always returns a ranking, because a ranking looks
like a deliverable. Blueprint's differentiator is the refusal. Act 7 is the whole company
in one frame: three verdicts, one of them *not yet*, and two stamps saying what this is
explicitly not. Nobody forgets that image, and nobody can fake it — it is enforced in
`decision_evidence_contracts.py` at the contract layer.

Build the thing that shows it.
