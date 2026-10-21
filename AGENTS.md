# Blueprint-WebApp Agent Guide

## Current owner direction — October 21, 2026

The owner approved the job-first automation buying journey and then clarified: “we cant continue on without a video” and “a description could even come from the video analysis - we've already built this.” The existing capture-to-simulation product remains the foundation. Do not interpret the job-first direction as permission to replace video with a mandatory written description or to skip the site simulation and evaluation.

The journey is: submit or record video of one recurring job; use the existing video analysis to draft the description and brief; prepare the capture-backed site simulation; compare supported robot/policy configurations; obtain comparable delivery proposals; let the customer choose; agree a physical pilot; record its outcome. A capture setup or saved draft may exist before upload, but assessment cannot continue without actual video. Blueprint should run accessible policies itself; a technology team supplies access or an integration when needed. Inviting every team to run its own test is not required.

Keep the existing example and how-it-works experience and modify it to explain this journey. Preserve the approved illustrations, working capture/analysis/simulation paths, and simple UI. Deployment partners and technology providers have separate reviewed intake paths. The beta stays free, with no new fees, payments, provider spend, automatic contract award, or change to existing privacy permissions.

Commercial proposal selection is not a signed pilot agreement. A customer-reported outcome is not a scientific Physical Outcome Join. Existing evaluation admission, compatibility, rights, provenance and scientific proof controls remain binding.

The cross-repo shared blocks and lock are generated from `BlueprintCapturePipeline/doctrine/` using its canonical synchronization process. They incorporate the later video-required correction and durable six-stage direction across all three repos. Do not hand-edit a generated block or its lock locally; change canonical fragments and synchronize the repos together. The owner's clarification preserves the capture-first foundation.

Implementation scope and verification: `docs/design/job-first-automation-marketplace/IMPLEMENTATION.md`.



## Mission

`Blueprint-WebApp` is the customer surface for the free beta's evaluated,
recommended pilot, and the partner-intake, authorization, workflow, evidence
review, and bounded case-study surface for Arm Decision Proof v1. Both are
active programs (founder decision 2026-10-14). The product remains one Task
Evaluation Run.

Its **public surface** helps a site show one recurring job on video, receive a
capture-backed robot/policy comparison, and choose a deliverable pilot from
comparable proposals. Existing video analysis drafts the description and brief;
the site corrects what is wrong instead of writing a mandatory description.
Blueprint runs supported accessible policies independently, and technology
teams supply access or integrations where needed. The beta remains completely
free for sites and robot teams, with no site fee, paid private evaluations,
balances, top-ups or checkout. The customer and deployment partner agree the
physical pilot directly, with no Blueprint cut. Read the current owner direction
above and the preamble in `PLATFORM_CONTEXT.md` before historical shared blocks.

This repo must reinforce the platform doctrine in:

- `PLATFORM_CONTEXT.md` — read its preamble first; never edit inside a shared block
- `WORLD_MODEL_STRATEGY_CONTEXT.md`

## Read First

Before making changes, read:

1. `README.md`
2. `PLATFORM_CONTEXT.md` — repo-authoritative mirror of Blueprint Knowledge for platform doctrine
3. `WORLD_MODEL_STRATEGY_CONTEXT.md` — repo-authoritative mirror of Blueprint Knowledge for world-model strategy
4. `AUTONOMOUS_ORG.md` — repo-authoritative mirror of Blueprint Knowledge for org structure
5. `DEPLOYMENT.md`
6. `package.json`
7. `docs/architecture/source-of-truth-map.md`
8. `docs/architecture/command-safety-matrix.md`
9. `docs/architecture/public-display-ready-claims-matrix.md`
10. `docs/architecture/ai-onboarding-map.md`
11. `docs/ai-tooling-adoption-implementation-2026-04-07.md`
12. `docs/ai-skills-governance-2026-04-07.md`

Agents also follow the nearest nested `AGENTS.md` when working under `client/`, `server/`, `scripts/`, or `ops/paperclip/`; nested guides add local constraints but do not weaken root doctrine.

## Product Rules

- Two programs are active: the free beta's evaluated, recommended pilot and
  Arm Decision Proof v1. WebApp work must directly unblock a beta journey step
  (site intake, consent, capture, job brief, robot-team application and
  invitation, evaluation request, results, recommendation, booking, or the
  messages around them) or an Arm Decision Proof need (partner admission,
  protocol/rights authorization, evidence review, physical-outcome joining, or
  the bounded case study). City-launch and growth campaigns, post-training,
  humanoid work, and polish unrelated to the beta journeys stay frozen.
- Explicit repo-owner instructions may authorize a bounded exception to this
  work-priority freeze, including public polish. Record the owner instruction,
  exact scope, and completion evidence in the issue or PR rather than inventing
  an ADP blocker. [PR #955](https://github.com/ognjhunt/Blueprint-WebApp/pull/955#discussion_r4221128434)
  records such authorization for cycling the illustrative robot scenes; the
  merged scene retains pause/play. This does not authorize adjacent work or unfreeze a
  product lane. Reliability, accessibility, security, rights/privacy, provenance,
  truthful claims, and existing spending, send, and release controls still apply;
  shared doctrine blocks and their lock remain unchanged.
- Preserve owner-approved embodiment examples and artwork. The fixed-arm
  engineering focus and Frozen Work list do not authorize removing or replacing
  humanoid, wheeled-humanoid, mobile-manipulator, or mobile-robot illustrations,
  or restricting team applications to fixed arms. The owner reaffirmed this on
  2026-10-16: restore the exact original Warehouse, Laundromat, Factory, and Hotel
  animations; preserve Café and Lab. Team setup supports a declared robot of any
  form (owner direction 2026-10-15, PR #1049); check the specific model, interface,
  scene, and task before admitting a run. Keep illustrative breadth separate
  from operational compatibility and physical-validation claims.
- For work without such an exception, require every issue to name its beta
  journey step or its ADP backlog item and day gate, plus the observed blocker
  and completion artifact.
  Existing captures/scenes remain `development_only`
  and must never appear as partner or physical proof.
- Keep Blueprint capture-first and real-site robot-evaluation/data-package first.
- Do not reframe the company as qualification-first or model-checkpoint-first.
- Do not reframe world models as the primary public offer; they are internal compatibility, generated/editing/augmentation, or advisory evidence methods inside Task Evaluation Runs.
- Do not overstate simulated or generated outputs as ground truth.
- Buyer, licensing, hosted-session, and ops flows should stay anchored to real capture provenance.
- Qualification and readiness surfaces are support layers, not the center of the product.

## Public Launch Ready Standard

Public Launch Ready and Operational Launch Ready are separate standards. Public Launch Ready is the default public posture for Blueprint routes.

- **Public Launch Ready** means public brand, product, buyer, pricing, proof, contact, capturer, operator, investor, and hiring surfaces may look complete, premium, confident, present-tense, and service-ready. Incomplete backend, ops, provider, city-launch, payment, payout, hosted-session, or support-loop proof is not by itself a blocker to polished website/app presentation.
- **Operational Launch Ready** means a specific live claim is backed by current proof from the system that owns it: Stripe for payment state, provider/runtime artifacts for execution, capture/provenance records for supply, rights/privacy records for clearance, Paperclip/Firestore/Render/Redis for the live operational loop, and city-launch artifacts for city activation.
- Before weakening public copy, ask: **does this sentence invent a specific unsupported fact?** Do not ask only whether Blueprint is operationally launched enough to sound polished.
- Allowed public display language includes product category, intended workflow, buyer value, request paths, sample/demo framing, launch-quality UI labels, and present-tense descriptions of what Blueprint sells or routes.
- Do not add broad apology, "not launched yet", "coming soon", "not ready", "we are still building", "future service", "placeholder", "demo only", or "operationally not ready" language just because operations remain request-specific.
- Block or qualify only the specific unsupported claim: real customers, real traction metrics, cleared rights, completed provider execution, completed payments, live payouts, active city coverage, hosted-session fulfillment, package access already open, or guaranteed support/launch outcomes.
- Put caveats where they help the buyer inspect proof, rights, access, or fulfillment detail. Do not lead public first screens with broad apology language just because operations still require request-specific proof.

## Repo Map

- `client/src/pages/`: product routes and marketing pages
- `client/src/components/`: reusable UI and workflow components
- `client/src/lib/`: API, client environment, and app helpers
- `server/`: backend routes and runtime integrations
- `scripts/`: smoke checks, sitemap/prerender, launch gates
- `docs/company/`: employee handbook and company policy drafts
- `docs/onboarding/`: human, manager, AI-agent, role-scorecard, and Notion IA onboarding
- `e2e/`: Playwright coverage

## Working Rules

- Account/service notices (including Terms updates) use the existing branded
  hello identity and durable outbox through `npm run email:account-notice`.
  Follow `docs/runbooks/account-notice-email.md`; preview by default and enqueue
  only with explicit approval for that notice and recipient list. Do not send
  account notices through ad hoc Gmail/API calls. Personal founder outreach
  retains its existing nijel sender and approvals.

- Agents own research strategy, authorized tools, depth and recovery. Use
  evidence-backed judgment rather than rigid outreach templates or arbitrary
  result quotas. Ordinary errors, harmless formatting/metadata/date-precision
  differences and expected pending usage must not prematurely stop useful work.
- Validation should explain the affected fields and how to repair them in the
  same context. Normalize losslessly when the evidence supports it, retain the
  original bytes/provenance/dates, and quarantine affected unsupported claims
  where possible rather than discarding the whole result. Missing data remains
  unknown; never fabricate facts, approvals or zero usage.
- Retain consequential controls: user spending authority, access/security and
  deletion approvals, idempotency/duplicate effects, opt-outs, and the current
  draft-only/no-send direction. This autonomy rule does not authorize new spend,
  broader access, external sends or another approval framework.
- Free intake and assessment require no customer-supplied budget or per-run spending
  approval. Provider cost limits are automatic internal Blueprint controls.
  Never turn an internal test spending limit into a step for sites.

- Preserve truthful product language around hosted sessions, captures, rights, and provenance.
- Prefer only edits that strengthen Arm Decision Proof partner intake,
  authorization, durable experiment state, inspectable evidence, or bounded
  delivery.
- Avoid inventing fake supply, fake providers, or fake readiness states in production paths.
- Keep changes aligned with the other Blueprint repos when contracts cross repo boundaries.
- Treat the current Firebase, Firestore, Stripe, Render, Redis, Notion, and Paperclip stack as the default operating stack for this repo.
- Do not use external boilerplates, skill packs, or AI-generated migration suggestions to introduce new primary services unless the founder explicitly approves the change.
- Anything that applies to Claude guidance in this repo also applies to Codex and Hermes-backed agents unless a narrower runtime rule explicitly overrides it.
- For autonomous-loop closeouts, use `docs/autonomous-loop-evidence-checklist-2026-05-03.md` before claiming `done`, `blocked`, or `awaiting_human_decision`.
- For onboarding or policy work, keep repo docs as canonical drafts, mirror into Notion only for human review/visibility, and mark legal/HR/payroll/benefits material as requiring counsel/PEO review when applicable.
- For repo work, start with `git status --short`; inspect dirty and untracked files before editing and preserve unrelated work.
- Keep one accountable engineering owner through the requested end-to-end outcome. Tests, PRs, merges, deployments, and release handoffs are intermediate evidence; completion requires the actual inspectable product result or an exact external action that prevents it. Coordination with a separate release owner does not transfer this accountability.
- Repair the existing supported journey with the smallest necessary changes. Do not substitute extra scaffolding, user-visible subthreads, or repeated handoff loops for completing the authorized work.
- Report observed progress and concrete blockers. Do not give completion estimates unsupported by evidence.

## Provider portability is a permanent engineering rule

- Business code, instructions, prompts/configuration, structured data, evidence,
  workflow state and required artifacts must have canonical company-controlled
  storage and portable formats. Use user-owned GitHub for code/instructions,
  Blueprint's existing database with documented portable exports for records,
  and existing authorized company object storage for standard-format artifacts.
- Replacement agents must be able to continue without dot, ChatGPT Library or
  one model vendor. Library IDs and provider/session IDs are provenance or
  optional delivery-copy references, never canonical business IDs or the only
  retained artifact. Preserve stable Blueprint-owned IDs and API contracts.
- Every handoff/release must identify accessible canonical artifact locations,
  content hashes, schema/format, source/check provenance, and an export/recovery
  route. Verify access with existing authorization; do not assume a provider
  session or a tool result will remain available to a replacement agent.
- Do not transfer private artifacts to an unapproved destination, introduce new
  credentials/services/spend, or delete existing copies to satisfy portability.
  Preserve local bytes and report the specific approval/access gap. Optional
  user-requested Library delivery copies and documentation examples are allowed
  when they do not become production dependencies or the sole retained copy.
- For production canonical-storage changes, run
  `npx tsx scripts/research-learning/check-portability.ts` and relevant tests.
  Its static audit catches explicit Library-only canonical references and
  required-Library flags; it does not prove that every existing artifact has
  already been migrated or that remote locations are accessible.

## Human Gates

- When a blocker is truly human-gated, use the standard packet in `ops/paperclip/programs/human-blocker-packet-standard.md`.
- Follow `ops/paperclip/programs/human-reply-handling-contract.md` for watcher ownership, correlation, and resume handoff after the human replies.
- Default fast path: Slack DM to `Nijel Hunt`.
- Default durable path: email to `ohstnhunt@gmail.com`.
- Disallowed org identity: `hlfabhunt@gmail.com` must never be used for org-facing drafts, sends, or escalation routing.
- Every blocker packet should carry a durable blocker id so reply correlation can survive email threads, Slack threads, and report handoffs.
- Resume execution immediately after the human reply is recorded in the owning issue, report, or run artifact.

## CI Issues

- Treat unresolved CI failures as active diagnosis work by default, not passive monitoring.
- A single fast "already green?" check is allowed first: inspect the referenced failing run and check for a newer successful run on the default branch.
- If no newer green default-branch run exists, switch into investigate mode in the same run: inspect failing jobs or logs, identify the failing step or error class, and leave evidence on the owning issue.
- Only treat a CI issue as monitor-only when the issue explicitly says it is recovery tracking only, a linked issue already owns root-cause remediation, or the failure is confirmed external to repo scope.
- Do not leave an unresolved CI failure open with only a status note that it is still failing; either investigate it or link the blocker that owns the diagnosis.

## Commands

Install:

```bash
npm install
```

Develop:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Typecheck:

```bash
npm run check
```

Unit/integration tests:

```bash
npm run test:coverage
```

E2E:

```bash
npm run test:e2e
```

Targeted smoke:

```bash
npm run smoke:agent
npm run smoke:launch
npm run smoke:launch:local
npm run alpha:check
```

Read `docs/architecture/command-safety-matrix.md` before running commands with live, provider, send, Notion, Stripe, Firebase, Render, Paperclip, payroll, or production-like side effects.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, prefer `derived/graphify/webapp-architecture/corpus/graphify-out/GRAPH_REPORT.md` for god nodes and community structure.
- If `graphify-out/GRAPH_REPORT.md` exists, you may use it; otherwise fall back to the derived graph workspace above.
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- After modifying code files in this session, run `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz` to refresh the staged architecture pilot and publish the canonical root `graphify-out/` outputs.
- That command automatically provisions and reuses the pinned repo-local Graphify environment. Do not treat a missing global `graphifyy` install as a blocker; follow `scripts/graphify/README.md` if setup fails. Explicit `BLUEPRINT_GRAPHIFY_PYTHON` interpreters are left unchanged; unusable overrides fall back to pinned setup.
