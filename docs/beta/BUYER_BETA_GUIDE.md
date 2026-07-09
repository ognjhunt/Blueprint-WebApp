# Buyer Beta Guide (Robot & Autonomy Teams)

**Welcome to the Blueprint beta.** You're one of ~100 external testers evaluating whether
Blueprint can turn real captured sites into useful pre-pilot evaluation and training data for your
robot policies. This guide is deliberately honest about the proof boundaries — read them before you
interpret any number.

Blueprint is **capture-first**. The sellable outputs are grounded in real-site captures with
preserved provenance, rights, and privacy metadata. World models, simulation, and generated media
are *support substrates* inside a run — never sold as physical-readiness or world-model-fidelity
proof.

---

## The two products

**Task Evaluation Run** — Evaluate a task/policy against one real captured site in a
**sim/review-grade** setting. It answers a narrow pre-pilot question: how does this policy look
against this real-site task before expensive field time? You get an advisory scorecard plus the
evidence behind it (site/task/scenario context, run notes, observation frames).

**Post-Training Data Package** — A structured, capture-grounded package for a real site: site card,
task cards, scenario cards, eval cards, curated clips, generated/model-derived scenario variations,
an export manifest, and a rights packet — with provenance attached so you can inspect the basis of
every artifact.

Policy Improvement Runs are **source-access optional**: you can engage via API endpoint, container,
private-cloud runner, sim plugin, adapter hooks, or recorded action traces — you do not have to
hand over weights or source.

---

## What the beta HONESTLY delivers (proof boundaries)

Everything the beta produces is **advisory** and **sim/review-grade**. It is **not** a deployment
guarantee, not a live-robot result, and not a world-model-fidelity claim. Specifically:

- **`success_rate` is advisory, and its provenance is disclosed.** Metrics like success rate,
  cycle time, and intervention rate are scored from recorded traces / review inputs — they do
  **not** mean your policy *passed* or is certified. In the reference report success rate literally
  renders as `0.00 advisory`. Claim upgrades are **blocked** until owner-system proof exists
  (`public_claim_upgrade_allowed=false`, `rank_fidelity_result_proven=false`,
  `simulator_execution_proven=false`).
- **Generated video is labeled as model output, not ground truth.** Any generated/model-derived
  video carries `generated_video_is_model_output=true`, and success labels are **not** taken from
  generated video (`wam_success_label_from_generated_video=false`). Generated media is a support
  artifact — never read it as evidence your robot will succeed physically.
- **Safety and missing-evidence flags block promotion.** Unsafe-proximity flags and
  missing-actual-outcome records are marked `blocked` and gate any pilot recommendation until
  owner-system proof clears them.
- **Examples are labeled as examples.** Sample/demo material is disclosed as Blueprint demo
  material, not a customer result, and exports remain **request-scoped**.

If a result would let you claim your robot is deployment-ready, ranked in a generated world, or
guaranteed to hit a threshold — that claim is **out of scope** for this beta and requires
request-scoped owner-system proof.

---

## The flow: discover → request → run → receive → download

1. **Discover** — browse real-site coverage on the buyer surface, filtered by location type and
   task (industrial-first; factory/warehouse facets are still being rounded out).
2. **Request** — open a structured request for a Task Evaluation Run or a Post-Training Data
   Package. Provide the site/task scope, robot profile, and policy access method.
3. **Run** — Blueprint runs the sim/review-grade evaluation or assembles the package, keeping
   provenance and rights attached.
4. **Receive** — you're granted an **entitlement** to the resulting artifact once it's provisioned.
5. **Download** — access the package via a **signed, time-limited download URL**.

---

## What the package/run states mean

| State | Meaning |
|---|---|
| **Ready to evaluate** | The robot-eval package has all required artifacts and is publishable/usable. |
| **Needs review** | The package is incomplete or not yet cleared (e.g. `publication_blocked_missing_robot_eval_package`) — required artifacts or human review are outstanding. |
| **Review required** | A human-gated step is pending; advisory artifacts may be present but a claim upgrade is not authorized. |
| **Degraded / fallback** | A primary path (e.g. native runtime/preview) wasn't available and a fallback was used — treat the output as lower fidelity. |
| **Blocked** | A rights/privacy verdict (`rights_review_status: needs_review` or `blocked`), safety flag, or missing owner-system proof prevents progression. Rights review is a hard gate for anything buyer-facing. |

---

## Entitlement, access & download expectations

- Access is gated by an **entitlement** tied to your authenticated account. You can only download
  artifacts your entitlement covers.
- Downloads are served as **signed storage URLs that expire** — re-request access when a link
  lapses.
- A signed URL proves **only** that you have a provisioned entitlement for that artifact. Per the
  access contract: *"It is not proof of package semantic success."* Read the proof boundaries above
  for what the contents actually mean.
- Access can be **blocked** with a clear reason: `entitlement_revoked` (a consent takedown removed
  access — capture truth and consent win over a sale), `entitlement_not_provisioned` (your access
  isn't active yet), or `artifact_access_not_configured` (no signable artifact is attached yet).
- **Beta caveat (honest):** the end-to-end automated delivery loop is still being hardened. During
  the beta some packages are delivered with operator assistance. If you own an entitlement but a
  download is blocked or missing, contact support with your entitlement/request id — this is a
  known beta failure class we actively monitor.

---

## Get help / escalate

**One channel:** email **hello@tryblueprint.io** or use the in-app **Support** page.

Include:

- Your organization and buyer/account id
- The package, request, or entitlement id, and the exact page URL
- What you expected vs the actual blocker
- Urgency (active evaluation access blockers and package-access issues are routed first)

For interpreting a result, ask about the specific metric and its claim boundary — we would rather
tell you a number is advisory than let you over-read it.
