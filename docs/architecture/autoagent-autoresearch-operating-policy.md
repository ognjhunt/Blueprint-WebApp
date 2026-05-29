# AutoAgent And AutoResearch Operating Policy

Date: 2026-05-29

Status: Active repo-authoritative policy for the recursive improvement system.

Scope: `server/agents/autoagent-promotion-policy.ts`, `scripts/autoagent/*`, and the Paperclip recursive-agent-improvement routine. This policy governs what AutoAgent and AutoResearch may do without a human, what requires deterministic proof, and what is outside autonomous authority.

## Core Rule

AutoAgent and AutoResearch may improve Blueprint only through repo-local, deterministic, reversible evidence paths by default. They must not turn local evals, generated summaries, public polish, or shadow outputs into production automation quality claims, operational launch readiness, hosted-session fulfillment, rights clearance, customer proof, payments, payouts, provider execution, live sends, Firestore exports, Notion writes, or live Paperclip/Hermes mutation.

The central enforcement point is `server/agents/autoagent-promotion-policy.ts`. Runner scripts and Paperclip routines must treat that file as the machine-readable policy and this document as the human-readable policy.

## Policy Tiers

### Fully Autonomous

Allowed without human review when the command is local and deterministic:

- read repo-local failure artifacts and generated output
- classify recurring failure families
- write deterministic fixtures under local AutoAgent task roots
- run offline AutoAgent evals with `exportLive=false`
- write AI patch-proposal reports without applying patches
- write local promotion packets, canary dry-run plans, rollback-monitor decisions, and recursive-improvement reports

This tier can prove local evidence generation only. It cannot prove production behavior.

### AI Patch Proposal Stage

After a fixture has been generated and included in offline evals, the recursive loop may ask Codex CLI or ChatGPT Pro for one repo-local patch proposal. The proposal is a report artifact only; the loop does not apply the patch.

Allowed AI proposal scope:

- AutoAgent prompt fixtures under `labs/autoagent/tasks/`
- local evaluator rules in `scripts/autoagent/local-evaluator.ts`
- recursive-loop routing metadata in the AutoAgent recursive-improvement scripts or task metadata
- docs for repo-local AutoAgent behavior

Blocked AI proposal scope:

- payment or payout code
- provider execution
- live Paperclip mutation
- city launch
- rights, privacy, legal, or consent
- hosted-session fulfillment
- customer claims
- production deployment config

Every proposal must include changed files, intended behavior, failure family addressed, expected eval improvement, and rollback plan. A proposal is rejected unless deterministic validation confirms the changed-file scope is allowlisted, offline AutoAgent sample evidence passed, negative controls remain blocked, and the prompt-policy promotion gate returned `canary` or `promote`. Accepted means "safe to review as a low-risk repo-local proposal"; it does not mean the patch was applied or that production automation quality was proven.

### Repo-Local Canary

Allowed only for `support_triage` when central policy, offline evals, negative controls, clean shadow evidence, rollback metadata, and side-effect checks all pass:

- write an observation-only support-triage canary plan
- write a repo-local active canary artifact
- keep primary output authoritative as `primary_result_only`
- keep canary output `compare_only_never_act`
- monitor and roll back repo-local canary artifacts

This tier remains local. It must not send messages, update live queues as the canary result, mutate Paperclip/Hermes runtime state, or claim production automation quality.

The recursive loop entrypoint for a bound approved apply issue is `npm run autoagent:recursive-improve -- --auto-apply-low-risk`. That flag may apply only the central-policy-approved low-risk lane and must immediately run the rollback monitor. If the monitor trips, rollback applies from the stored repo-local snapshot automatically.

### Shadow-Only

Allowed for lanes that can collect comparison evidence but cannot enter canary or apply mode:

- `preview_diagnosis`
- any waitlist or preview output collected for comparison before a policy change
- browser or runtime inspection that is read-only and writes only local artifacts

Shadow output is never authoritative. It can identify a candidate or blocker, but it cannot fulfill hosted sessions, clear provider/runtime proof, issue access, or change operational state.

### Human/Policy-Gated

Requires an explicit policy update and owner-system proof before canary or promotion:

- `waitlist_triage` invite, access, or movement recommendations
- any new lane beyond `support_triage`
- any widening of canary/apply authority
- any decision that would change buyer access, site access, queue authority, or policy posture

Human/policy-gated does not mean "safe once an AI says so." It means a deterministic policy change must name the allowed action, proof source, rollback path, and owner before automation can proceed.

### Permanently Blocked For This Loop

The recursive improvement loop must reject these actions, even if a candidate manifest, model output, or generated report recommends them:

- live sends, outreach, Slack/Gmail/SendGrid sends, or human-reply polling
- payments, payouts, refunds, checkout, invoices, Stripe mutation, or entitlement grants
- provider jobs, paid creative/video execution, live research jobs, or runtime fulfillment
- rights, privacy, legal, city-live, customer, traction, revenue, or support outcome claims
- hosted-session fulfillment or package access already-open claims
- operational launch readiness claims
- Firestore export, Notion writes, Render/VPS mutation, or live Paperclip/Hermes mutation

These may still be worked by other explicit issues with the owning systems, approvals, and proof. They are not autonomous recursive-improvement actions.

## Deterministic Proof Requirements

- Offline eval proof must include cases, zero failures for the requested lane, and all negative controls blocked.
- Shadow proof must include clean comparison evidence for the requested lane and must preserve human-review safeguards.
- Canary proof must include a rollback condition, rollback triggers, a previous-config snapshot, and repo-local mutation only.
- Hosted-session proof must come from entitlement, runtime/session artifacts, and request-specific availability in the owning system.
- Operational launch readiness must come from the relevant owner systems: Stripe, provider/runtime artifacts, capture/provenance records, rights/privacy records, Paperclip, Firestore, Render, Redis, and city-launch artifacts.
- Public Launch Ready copy is not operational proof.
- AI-generated summaries, generated fixtures, model judgments, and polished public pages are support evidence only. They cannot override deterministic policy or owner-system proof.

## Current Lane Decisions

| Lane or action | Tier | Current autonomous ceiling |
|---|---|---|
| local observer, fixture, eval, packet, report | fully_autonomous | local artifacts only |
| AI patch proposal report | fully_autonomous | report-only; no patch application |
| `support_triage` | repo_local_canary | observation-only repo-local canary |
| `waitlist_triage` | human_policy_gated | shadow only until explicit policy change |
| `preview_diagnosis` | shadow_only | shadow only |
| live sends, payments, payouts, rights/privacy/legal, providers, city launch, customer claims, hosted-session fulfillment, operational launch readiness, Firestore export, Notion writes, live Paperclip mutation | permanently_blocked | reject |

## Closeout Rule

Recursive-loop reports must include the policy tier that decided the run, the proof paths, command outputs, next autonomous action, retry condition, and residual risk. A green local loop is not a production automation quality claim.
