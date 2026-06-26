# Site/Task Robot Deployment Confidence Contract

Date: 2026-06-02

This contract defines the repo-local transition from capture provenance into a reusable site/task robot deployment confidence package. It is for the hybrid world-model plus simulator era, where visual world-model outputs, simulator traces, and robot evidence may all contribute to readiness, but none of them replace capture-grounded truth or owner-system proof.

This document does not authorize live provider jobs, model downloads, deployments, sends, payments, payouts, or unsupported public claims. It is a local contract that WebApp can use to assemble and disclose evidence supplied by the owning systems.

## Research Basis

- Codex `/goal` is currently a goal-oriented task workflow with an objective, status tracking, and resumable execution. For Blueprint, that means the deliverable must be a bounded repo-local improvement with explicit proof and stop rules, not a hidden live workflow.
- Cosmos 3 and adjacent world-model systems are useful candidate reasoner, generator, evaluator, and action-model layers around existing capture artifacts. They do not make a generated clip, future frame, or synthetic trajectory ground truth.
- Current humanoid deployment evidence in the market is strongest when it points to named operational customers, tasks, service agreements, safety controls, and repeated runtime proof. Blueprint should not turn visual plausibility into deployment claims without comparable site/task evidence.
- World-model evaluation needs held-out validation, action evidence, simulator traces, or robot trials depending on the claim. Visual realism alone is not enough for contact, collision, safety, or generated-world rank fidelity.

## Cross-Repo Ownership

`BlueprintCapture` owns raw site truth:

- `scene_id`, `capture_id`, `site_submission_id`, `buyer_request_id`, and `capture_job_id` lineage.
- Raw bundle manifest, hashes, provenance, rights/consent, capture context, recording session, topology, anchors, relocalization, overlap, sync map, motion, walkthrough video, poses, intrinsics, depth, and device metadata.
- Conservative rights/privacy status and fail-closed upstream handoff blockers.
- The boundary that generated or reconstructed outputs are downstream derivatives, not raw truth.

`BlueprintCapturePipeline` owns package and evaluation truth:

- Package manifests, hosted-review artifacts, privacy-safe media, geometry summaries, site-reference manifests, and downstream world-model artifacts.
- Geometry source labels such as `video_to_world`, `local_sfm`, and `fallback_geometry`.
- Local Cosmos/world-model preflight output, including `provider_jobs_called=false`, `model_download_required=false`, and `claim_policy=capture_grounded_local_preflight_only` when applicable.
- Held-out validation, action evidence, simulator traces, and provider/runtime artifacts when those are actually produced by the owning system.

`Blueprint-WebApp` owns buyer, licensing, ops, hosted-access, and public-claim posture:

- It may assemble a confidence packet from Capture and Pipeline evidence.
- It may expose review-ready or advisory status when the evidence supports that narrower claim.
- It must not create raw truth, provider proof, robot-trial proof, rights clearance, payment proof, payout proof, city activation, or hosted runtime proof by copy alone.

## Schema

Schema id: `site_task_robot_deployment_confidence_package.v1`

Required evidence families:

- `capture_provenance`: raw capture and lineage records from Capture.
- `pipeline_package`: package, geometry, privacy-safe media, and site-reference records from Pipeline.
- `world_model_eval`: local preflight, held-out validation, generated-output labeling, and model/provider boundaries.
- `robot_task`: the specific task, scenario, start state, and robot profile being evaluated.
- `deployment_evidence`: simulator traces, action logs, robot trials, safety review, operator approval, rights clearance, and hosted runtime proof.
- `claim_policy`: allowed and forbidden claims for the packet state.

Every packet must declare that the WebApp evaluator itself called no provider jobs, downloaded no models, started no deployments, sent no messages, and attempted no payments.

## State Model

`blocked`

- Required capture lineage, provenance, consent, upload completion, hashes, or walkthrough evidence is missing.
- Rights are blocked or unknown for the requested use.
- The packet tries to rely on live provider or model execution from this repo-local evaluator.
- A requested claim depends on missing owner-system proof.

`capture_review_ready`

- Capture provenance is present enough for human or pipeline review.
- Package, geometry, held-out validation, action, safety, runtime, or rights-clearance evidence is still incomplete.
- This supports capture-grounded inspection, not world-model or robot deployment confidence.

`visual_world_model_review_ready`

- Capture provenance is present.
- Pipeline package and privacy-safe media are present.
- Geometry is non-fallback and clearly labeled.
- World-model outputs are labeled as derived, and held-out validation evidence is linked.
- This supports visual review or evaluator discussion, not robot action, contact, collision, safety, or operational deployment claims.

`deployment_confidence_advisory`

- Visual world-model review is ready.
- A named robot task, scenario, start state, and action evidence are linked.
- Simulator traces, action logs, or robot-trial evidence are linked.
- Safety, rights, operator, and hosted-runtime proof may still be incomplete, so the claim remains advisory and human-reviewed.

`operational_deployment_ready`

- All advisory evidence is present.
- Robot-trial or equivalent owner-system runtime proof, action logs, safety review, operator approval, rights clearance, and hosted-runtime proof are linked.
- This state should be rare and cannot be inferred from local tests, generated media, package manifests, or visual realism alone.

## Claim Matrix

| Intended claim | Minimum local packet state | Additional owner proof required before public operational claim |
| --- | --- | --- |
| Exact-site buyer walkthrough review | `capture_review_ready` | Rights/privacy record for public or buyer-facing display. |
| Capture quality or coverage review | `capture_review_ready` | Capture owner validation for any public quality guarantee. |
| Visual world-model review | `visual_world_model_review_ready` | Provider/runtime proof only if claiming a specific live provider run. |
| Synthetic data or generated scenario review | `visual_world_model_review_ready` | Generated outputs must be labeled derived and non-ground-truth. |
| Robot task/action-policy review | `deployment_confidence_advisory` | Action logs, simulator traces, or robot-trial records for the named task. |
| Contact, collision, safety, or manipulation readiness | `operational_deployment_ready` | Safety review, task-specific action evidence, and owner runtime proof. |
| Hosted operational deployment | `operational_deployment_ready` | Hosted runtime proof, access/entitlement proof, support owner, and human approval. |
| Payments, payouts, city launch, or provider execution complete | Not established by this packet | Stripe, payout, city-launch, provider, or runtime owner-system records. |

## Forbidden Upgrades

The packet must not imply:

- A live Cosmos, world-model, simulator, or provider job ran because WebApp assembled a packet.
- A model was downloaded or executed by this evaluator.
- Generated media, future frames, or synthetic trajectories are ground truth.
- Fallback geometry supports visual world-model, robot policy, or deployment confidence claims.
- Held-out validation, action evidence, contact/collision reasoning, safety, or robot deployment is proven by visual plausibility.
- Rights, privacy, payment, payout, hosted-session runtime, provider execution, customer deployment, or city coverage is complete without owner-system proof.

## WebApp Implementation Boundary

WebApp should expose this contract as a pure local evaluator:

- Input: evidence identifiers, booleans, and owner-system status labels already present in the repos or fixtures.
- Output: packet state, evidence family status, blockers, warnings, allowed claims, forbidden claims, and next evidence moves.
- Side effects: none.

The evaluator may make the buyer and ops posture clearer. It must not mutate Capture/Pipeline artifacts, call live providers, download models, deploy runtimes, send messages, charge payments, or soften unsupported claims into public promises.
