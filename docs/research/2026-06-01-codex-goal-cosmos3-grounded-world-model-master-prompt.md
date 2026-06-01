# Codex /goal Master Prompt: Cosmos 3 Grounded World Model Investigation

Date: 2026-06-01

This handoff is for a fresh Codex session using `/goal`. It is intentionally repo-grounded and proof-bounded. The goal is not to hype Cosmos 3. The goal is to pressure-test whether Blueprint can use Cosmos 3 as a site-grounded world-model and evaluation layer on BlueprintCapture data, and what would have to be true before sim-ready digital twins are no longer required for the core Blueprint product.

## How To Start The Next Session

Start Codex in:

```bash
cd /Users/nijelhunt_1/workspace/Blueprint-WebApp
```

Paste this compact goal first:

```text
/goal Run a repo-grounded, web-researched Cosmos 3 feasibility and implementation pass for Blueprint's capture-first site-grounded world-model thesis. Determine whether Cosmos 3 can act as Blueprint's world model/eval layer on BlueprintCapture data, what data/proof gaps remain before sim-ready digital twins can be avoided, and land bounded repo-local docs/code/tests that make the conclusion reusable without live provider jobs or unsupported public claims.
```

Then paste the full context below.

## Full Context To Paste After The Goal

You are working across Blueprint, starting from `/Users/nijelhunt_1/workspace/Blueprint-WebApp`. Treat this as a multi-repo research-and-implementation goal, but keep the first implementation slice repo-local, safe, and verifiable.

### Core Question

Investigate NVIDIA Cosmos 3 under Blueprint's most aggressive working hypothesis:

World models may become good enough that Blueprint does not need hand-authored, sim-ready digital twins for the main product. Instead, BlueprintCapture may collect enough first-party site data that a model like Cosmos 3 can create, reason over, evaluate, and adapt a site-grounded world model directly from capture data.

The output must answer:

1. Can Cosmos 3 plausibly become Blueprint's world model and/or evaluation layer for exact-site captures?
2. What does "ground truth" actually mean here, given Blueprint's raw capture, pose, depth, provenance, rights, and revisit data?
3. What BlueprintCapture data is already sufficient, what is missing, and what must be collected differently?
4. Does Cosmos 3 reduce or eliminate the need for sim-ready digital twins, and for which use cases?
5. If Blueprint uses Cosmos 3, what should be the first repo-local proof slice?
6. What should Blueprint not claim yet?

### Non-Negotiable Doctrine

Preserve Blueprint doctrine:

- Blueprint is capture-first and world-model-product-first.
- Raw capture, provenance, poses, intrinsics, depth, timestamps, device metadata, rights/privacy records, and revisit evidence are stronger truth than generated media.
- A generated Cosmos output is never ground truth by itself.
- A Cosmos prediction can become evaluation evidence only when compared against held-out real capture, measured geometry, action-labeled logs, or a clearly defined external benchmark.
- Do not drift into qualification-first, checkpoint-first, or "generic AI simulation" framing.
- Keep model backends swappable. Cosmos 3 can be a leading candidate, not a permanent dependency unless the evidence supports it.
- Public Launch Ready and Operational Launch Ready remain separate.
- Do not add public copy that claims live Cosmos 3 execution, active customer proof, provider fulfillment, payment readiness, or city coverage unless backed by current proof.

### Required First Steps

1. Run:

```bash
git status --short
```

Inspect dirty/untracked files before editing. Preserve unrelated user work.

2. Read the root WebApp guidance and doctrine:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/README.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/DEPLOYMENT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/package.json`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/architecture/source-of-truth-map.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/architecture/command-safety-matrix.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/architecture/public-display-ready-claims-matrix.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/architecture/ai-onboarding-map.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/ai-tooling-adoption-implementation-2026-04-07.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/ai-skills-governance-2026-04-07.md`

3. Use Graphify if available:

- Prefer `/Users/nijelhunt_1/workspace/Blueprint-WebApp/graphify-out/GRAPH_REPORT.md`
- If missing, use `/Users/nijelhunt_1/workspace/Blueprint-WebApp/derived/graphify/webapp-architecture/corpus/graphify-out/GRAPH_REPORT.md`

4. Inspect adjacent repo truth without modifying it until you have a plan:

- `/Users/nijelhunt_1/workspace/BlueprintCapture/docs/CAPTURE_RAW_CONTRACT_V3.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapture/docs/CAPTURE_BRIDGE_CONTRACT.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapture/BlueprintCapture/Services/CaptureRawContractV3Validator.swift`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/docs/IOS_SITE_GROUNDED_WORLD_MODEL_SPEC.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/docs/GEOMETRY_LANE_CONTRACT.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/docs/SITE_REFERENCE_DATABASE_V1_CONTRACT.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/src/blueprint_pipeline/world_model_policy.py`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/src/blueprint_pipeline/evaluation_prep_stage.py`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/src/blueprint_pipeline/local_bundle_workflow.py`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/src/blueprint_pipeline/video_to_world_client.py`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/src/blueprint_pipeline/synthesis/cosmos_benchmark.py`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/src/blueprint_pipeline/synthesis/cosmos_training_export.py`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/src/blueprint_pipeline/synthesis/cosmos_inference.py`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/scripts/bootstrap_cosmos_official_repo.sh`
- Cosmos-related tests under `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/tests/`

### Required Web Research

Use web search. Start with official sources and then use third-party commentary as secondary evidence only.

Minimum official sources to inspect:

- OpenAI Codex goals cookbook: `https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex`
- OpenAI Codex best practices: `https://developers.openai.com/codex/learn/best-practices`
- NVIDIA Cosmos 3 technical blog: `https://developer.nvidia.com/blog/develop-physical-ai-reasoning-world-and-action-models-with-nvidia-cosmos-3/`
- NVIDIA Cosmos GitHub: `https://github.com/NVIDIA/Cosmos`
- NVIDIA Cosmos inference benchmarks: `https://github.com/NVIDIA/cosmos/blob/main/inference_benchmarks.md`
- NVIDIA Cosmos 3 Nano model card: `https://huggingface.co/nvidia/Cosmos3-Nano`
- NVIDIA Cosmos 3 Hugging Face blog: `https://huggingface.co/blog/nvidia/cosmos-3-for-physical-ai`
- NVIDIA newsroom Cosmos 3 launch post: `https://nvidianews.nvidia.com/news/nvidia-launches-cosmos-3-the-open-frontier-foundation-model-for-physical-ai`

Also review the user-supplied practitioner links about `/goal`:

- `https://mlearning.substack.com/p/codex-goal-beginner-guide-to-openai-new-autonomous-goal-feature-ralph-loop-official-practical-tips-trics`
- `https://pub.towardsai.net/i-walked-away-from-openais-new-codex-goal-for-18-hours-it-shipped-14-of-18-features-solo-a280f8407707`
- `https://www.reddit.com/r/codex/comments/1t3opdd/goal_is_the_best_thing_ever/`
- `https://simonwillison.net/2026/Apr/30/codex-goals/`

For Cosmos 3, specifically verify:

- What was actually released on 2026-05-31 or 2026-06-01.
- Whether Cosmos 3 Super and Cosmos 3 Nano are available now, and whether Cosmos 3 Edge is only "coming soon".
- Model sizes and naming. Do not confuse "8B reasoner plus 8B generator" with "16B trainable parameters"; similarly, verify Super parameter counting.
- Modalities: text, image, video, ambient sound/audio, and action trajectories.
- Architecture: mixture-of-transformers with reasoner/generator tower split.
- Whether post-training scripts, Diffusers support, NIM deployment, and datasets are available.
- Hardware reality: what can run on a single adequate NVIDIA GPU, what needs workstation/datacenter GPUs, and what should not be assumed to run on a local Mac.
- Benchmark claims and whether leaderboards are NVIDIA-provided, external, or independent.
- Safety/license limits from model cards.

For world-model grounding, search beyond NVIDIA marketing:

- Current research on embodied world models, forward dynamics, inverse dynamics, held-out prediction, and world model evaluation.
- Robotics or smart-space papers that distinguish visual realism from task success, pose accuracy, collision/contact fidelity, and policy transfer.
- Evidence on whether generative world models can replace engineered simulators today or mostly augment them.

### Important Repo Findings To Confirm Or Update

Previous audit context to verify before relying on it:

- WebApp is the buyer/licensing/ops/hosted-access surface. It should not become the capture or training repo.
- WebApp doctrine says capture/provenance is authoritative and generated artifacts are not ground truth.
- BlueprintCapture's raw contract already points in the right direction: video, timestamps, poses, intrinsics, depth/confidence, meshes, motion, route/pass/revisit metadata, quality signals, and hash manifests.
- BlueprintCapturePipeline already has the strongest Cosmos-adjacent work:
  - `IOS_SITE_GROUNDED_WORLD_MODEL_SPEC.md`
  - `GEOMETRY_LANE_CONTRACT.md`
  - `SITE_REFERENCE_DATABASE_V1_CONTRACT.md`
  - `world_model_policy.py`
  - `evaluation_prep_stage.py`
  - `cosmos_training_export.py`
  - `cosmos_benchmark.py`
  - `cosmos_inference.py`
- Existing code appears oriented around Cosmos Predict 2.5 naming and package assumptions. Treat Cosmos 3 as a new surface that must be mapped, not a drop-in rename.
- Pipeline already distinguishes local fallback, contract readiness, provider-native readiness, and world-model readiness. Preserve that split.

### Analysis Shape

Answer the core question in a matrix with at least these rows:

- Exact-site buyer walkthrough / hosted review
- Visual site-memory and future-frame prediction
- Capture quality evaluation
- Coverage/completeness evaluation
- Provider package generation
- Synthetic data generation
- Robot policy or action evaluation
- Contact-rich manipulation or collision reasoning
- Regulatory/rights/privacy proof

For each row, include:

- Cosmos 3 role: generator, reasoner, evaluator, policy backbone, or not applicable
- Blueprint data required
- Existing repo support
- Missing capture/pipeline fields
- Whether sim-ready digital twins can be avoided
- Whether a simpler geometric/site-reference representation is still needed
- What proof would upgrade the claim
- What claim remains forbidden

Use these categories:

- Ready now with local/no-provider proof
- Plausible with Cosmos 3 integration and held-out captures
- Plausible only with action-labeled robot/sim logs
- Still requires engineered simulation or geometry
- Not a Blueprint claim

### Preferred Conclusion Style

Do not answer "yes" or "no" globally. The likely correct shape is:

- Cosmos 3 can reduce the need for sim-ready digital twins for visual world generation, site review, synthetic data generation, and some capture/evaluation workflows.
- Cosmos 3 does not eliminate the need for explicit capture provenance, camera poses, depth/geometry, quality signals, rights/privacy records, held-out revisits, or action-labeled evidence.
- For robot policy, contact, collision, safety, and precise physical evaluation, Blueprint still needs a verifier layer: measured geometry, held-out real capture, action logs, simulator traces, robot trials, or some equivalent evidence.
- If the world model becomes good enough, the "digital twin" shifts from a hand-authored simulator asset to a capture-grounded neural site model plus evidence ledger. That is still a digital twin in the operational sense, just not a traditional sim-ready one.

### Implementation Slice

After research, land a bounded repo-local artifact. Prefer starting in `BlueprintCapturePipeline`, because that repo owns capture-derived world-model substrates. If you cannot safely edit Pipeline from this WebApp session, write the implementation plan in WebApp docs with exact target file paths and stop there.

Recommended first implementation slice:

1. Add a Cosmos 3 feasibility and gap map doc in Pipeline:

```text
/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/docs/COSMOS3_SITE_GROUNDED_WORLD_MODEL_EVAL_PLAN_2026-06-01.md
```

2. Add or plan a deterministic local readiness helper that evaluates a capture bundle against Cosmos 3 grounding requirements without downloading models or calling providers:

```text
/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/src/blueprint_pipeline/synthesis/cosmos3_site_grounding_readiness.py
```

Potential helper output:

```json
{
  "schema_version": "v1",
  "generated_at": "...",
  "status": "ready|blocked|partial",
  "cosmos3_roles": ["reasoner_eval", "future_frame_prediction", "synthetic_generation"],
  "authoritative_inputs_present": ["video", "timestamps", "poses", "intrinsics", "depth", "provenance", "rights"],
  "missing_authoritative_inputs": ["heldout_revisit", "action_trajectories"],
  "ground_truth_level": "capture_grounded_visual_eval|action_grounded_eval|not_ground_truth",
  "sim_ready_digital_twin_requirement": "avoidable_for_visual_review|still_required_for_contact_policy",
  "blocked_reasons": [],
  "forbidden_claims": []
}
```

3. Add focused tests that use fixtures only and do not require CUDA, NGC, Hugging Face auth, model downloads, or provider credentials.

4. If editing Pipeline code, run the narrow relevant tests only, for example:

```bash
cd /Users/nijelhunt_1/workspace/BlueprintCapturePipeline
pytest tests/test_cosmos_benchmark.py tests/test_cosmos_training_export.py
pytest tests/test_cosmos3_site_grounding_readiness.py
```

Adjust commands to the repo's actual test runner after inspecting it.

5. If only WebApp docs are edited, no code tests are required. If any WebApp code is edited, run:

```bash
cd /Users/nijelhunt_1/workspace/Blueprint-WebApp
npm run check
```

And after modifying code files in WebApp, refresh Graphify per repo instructions:

```bash
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

### Deliverables

End with:

1. A source-backed research memo with citations and dates.
2. A repo audit section that lists actual relevant files inspected.
3. A `BlueprintCapture data -> Cosmos 3 capability -> proof gap` matrix.
4. A decision: where Cosmos 3 makes sense now, where it is premature, and what to build next.
5. At least one repo-local artifact, unless blocked by dirty work or repo ownership constraints.
6. If code was added, focused tests and exact command output summary.
7. A short "claims boundary" section that separates:
   - local proof
   - model/provider proof
   - operational launch proof
   - public display language
8. A next-step plan with ordered work items that can be run in future `/goal` sessions.

### Forbidden Actions

Do not:

- Download large model weights unless explicitly approved.
- Run live provider jobs, paid APIs, NGC-authenticated jobs, Firebase/Firestore/Stripe/Render mutations, Notion writes, Slack sends, emails, Paperclip live actions, or production-like jobs.
- Store credentials in the repo.
- Rewrite existing dirty user work.
- Claim Cosmos 3 is integrated unless code has been updated and tested.
- Claim any generated video, image, or action sequence is ground truth.
- Claim sim-ready digital twins are eliminated globally.
- Add broad "coming soon" or "not ready" public copy to WebApp routes just because this is still research.

### Stop Rules

Stop and report a blocker only if:

- Dirty work in the target file makes safe edits ambiguous.
- The required docs/code paths have moved and cannot be found after reasonable search.
- Current official sources contradict the assumed Cosmos 3 release or availability.
- The only remaining work requires credentials, model downloads, paid compute, live provider jobs, or human approval.

Do not stop merely because live Cosmos execution is unavailable. In that case, produce local readiness artifacts and a precise live-proof plan.

### Done When

The goal is complete only when:

- The Cosmos 3 research is sourced from current official docs plus secondary commentary where useful.
- The repo audit maps WebApp, Capture, and Pipeline responsibilities correctly.
- The answer directly evaluates whether Blueprint can build a capture-grounded neural site model instead of a traditional sim-ready digital twin.
- The conclusion separates visual/site-review feasibility from robot/action/contact feasibility.
- A concrete repo-local artifact exists or a precise blocker explains why no artifact could be safely written.
- Any code changes have focused tests, and any docs-only changes are identified as docs-only.
- The final closeout names exact files changed, commands run, and residual risks.

## Current Working Interpretation

Use this as a starting hypothesis, not as a conclusion:

Cosmos 3 is strategically relevant to Blueprint because it unifies reasoning, future-world generation, and action generation in a single open physical-AI model family. It can plausibly become a strong evaluator/generator layer for exact-site capture packages. It does not by itself create ground truth. For Blueprint, ground truth remains the capture evidence and measured/validated outcomes. The highest-value first step is not "run Cosmos 3 once"; it is to define and test the capture substrate that would make any Cosmos 3 output inspectable, reproducible, and bounded.

The likely commercial wedge remains:

```text
Real capture of the exact site -> site-specific package/world-model artifacts -> hosted review -> operator guidance on next action.
```

Cosmos 3 may strengthen the world-model/eval layer underneath that wedge. It should not replace the capture/provenance contract or become the public promise before evidence exists.

