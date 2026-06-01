# Exact-Site Hosted Review Demand-Dossier Factory

Date: 2026-05-31
Status: local draft, no-send, no-Notion, no-live-system mutation
Owner lane: `growth-lead` with source inputs from `demand-intel-agent`, `robot-team-growth-agent`, `buyer-solutions-agent`, and `rights-provenance-agent`

## Purpose

Build a repo-local factory for turning Exact-Site Hosted Review demand intelligence into reusable buyer dossier drafts.

The factory is a support layer. It does not send outreach, approve first sends, write Notion, mutate Paperclip, query or mutate Stripe/Firebase production, run providers, clear rights, activate cities, or claim hosted-review fulfillment.

## Current Local Audit Snapshot

Commands run locally on 2026-05-31:

| Command | Side effect class | Result used here |
| --- | --- | --- |
| `git status --short` | local read | Worktree already had untracked `docs/research/` and `outputs/`; this artifact is the only new file from this run. |
| `npm run gtm:hosted-review:audit -- --allow-blocked` | local file-backed audit | `ready_with_warnings`; 30 targets, 3 proof-ready outreach rows, 27 demand-sourced capture rows, 30 recipient-backed rows, 30 approval-ready rows, 0 sent, 0 replies, 0 hosted-review starts, 0 qualified calls, 12 reply-durability blockers. |
| `npm run gtm:hosted-review:buyer-loop -- --allow-blocked --skip-durability` | local file-backed report, no write, durability skipped | `decision_due`; 30 target rows, 30 founder approvals needed, 100-touch gap, 0 touches, durability `unknown` because live durability audit was intentionally not run. |

Interpretation: the current ledger is draft/approval-ready, not send-ready and not proof of buyer traction. The pilot window has elapsed, so the dossier factory should help decide whether to change ICP, offer, proof artifact, CTA, or stop; it should not extend the same motion by narrative.

## Source Ledger

| Source id | Source path | Authority | What it contributes | What must not be inferred |
| --- | --- | --- | --- | --- |
| `doctrine.platform` | `PLATFORM_CONTEXT.md` | repo-authoritative doctrine | Capture-first, world-model-product-first center of gravity; rights, privacy, provenance, hosted access as long-lived contracts. | Does not prove any target has rights clearance, capture supply, hosted access, or buyer demand. |
| `doctrine.world_model_strategy` | `WORLD_MODEL_STRATEGY_CONTEXT.md` | repo-authoritative doctrine | Provider-swappable world-model posture; exact-site packages and hosted access as sellable outputs. | Does not prove any provider execution or model quality for a target. |
| `doctrine.autonomous_org` | `AUTONOMOUS_ORG.md` | repo-authoritative org doctrine | Exact-Site Hosted Review is the current wedge; demand work is judged by target/contact/approval/send/reply/call/hosted-review/capture-ask/blocker movement. | Does not authorize Paperclip mutation or live routine execution. |
| `claims.public_launch_ready` | `docs/architecture/public-display-ready-claims-matrix.md` | active public claim guardrail | Polished public copy is allowed; specific unsupported live facts must be blocked or qualified. | Does not make operational claims true. |
| `safety.command_matrix` | `docs/architecture/command-safety-matrix.md` | active command safety guide | `gtm:hosted-review:audit` is safe local file-backed; send, city activation, Notion sync, live smoke, and provider paths are side-effect capable. | Does not allow unsafe commands for this run. |
| `gtm.operating_contract` | `docs/exact-site-hosted-review-gtm-pilot-2026-04-26.md` | pilot contract | Two-track GTM model, ledger requirements, non-negotiables, success criteria, blocked states. | Does not prove the pilot succeeded or that any message was sent. |
| `gtm.program` | `ops/paperclip/programs/exact-site-hosted-review-gtm-pilot-program.md` | Paperclip program contract | Track definitions, required artifacts, daily done condition, enrichment adapter contract, quality bar, decision rule. | Does not authorize live sends, paid spend, public posts, pricing, or rights decisions. |
| `gtm.task` | `ops/paperclip/blueprint-company/tasks/exact-site-hosted-review-gtm-pilot/TASK.md` | task contract | Ledger maintenance rules, 30-50 account goal, recipient-backed requirement, buyer-loop generation expectation, guardrails. | Does not make targets send-ready without founder approval and durability proof. |
| `buyer_loop.task` | `ops/paperclip/blueprint-company/tasks/exact-site-hosted-review-buyer-loop/TASK.md` | task contract | One buyer loop, one ledger, founder approval gate, progress states that count. | Does not replace the ledger or owner-system proof. |
| `demand.program` | `ops/paperclip/programs/demand-intel-agent-program.md` | demand-intel steering | Buyer signals, channels, proof-pack expectations, procurement triggers, handoff shape. | Does not permit generic TAM, broad account lists, guessed recipients, or outreach. |
| `dossier.task` | `ops/paperclip/blueprint-company/tasks/buyer-dossier-refresh/TASK.md` | dossier refresh contract | Reuse `knowledge/compiled/buyer-dossiers/`; link to canonical request, Paperclip, package/runtime truth. | Does not let the dossier become canonical work state or package/runtime truth. |
| `dossier.template` | `knowledge/templates/buyer-dossier.template.md` | KB artifact template | Frontmatter, summary, current state, evidence, signals, implications, open questions, canonical links, authority boundary. | Does not authorize duplicate dossier pages for the same subject. |
| `gtm.audit_code` | `server/utils/exactSiteHostedReviewGtmPilot.ts` | current validation code | Required fields, target tracks, recipient evidence rules, blocker rules, audit summary counters. | Does not prove live systems; it validates the local ledger. |
| `gtm.buyer_loop_code` | `server/utils/exactSiteHostedReviewBuyerLoop.ts` | current report code | Founder approval queue, proof-artifact queue, blocker queue, inferred next actions, decision status. | Does not send, approve, or ingest replies. |
| `gtm.first_touch_code` | `server/utils/exactSiteHostedReviewFirstTouch.ts` | current draft-copy code | Draft angle, CTA, landing page, proof source, blocked claims per track. | Does not authorize dispatch or unsupported claims. |
| `gtm.ledger` | `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json` | canonical local GTM ledger snapshot | Current target rows, track, artifact/capture ask, recipient-evidence state, approval state, blockers, daily activity. | Does not prove live sends, buyer replies, hosted-review starts, qualified calls, city readiness, or paid scale. |
| `robot_team.playbook` | `ops/paperclip/playbooks/robot-team-demand-playbook.md` | reusable GTM playbook | ICP, proof-pack requirements, hosted review handoff standard, proof path, buyer follow-up standard. | Does not create buyer-specific proof without source artifacts. |
| `proof_motion.tags` | `docs/proof-motion-tags.md` | label vocabulary | Canonical tag names for buyer-target, touch, proof-path, hosted-review events. | Does not claim live volume. |

## Factory Schema

The factory should write draft dossiers as Markdown under `knowledge/compiled/buyer-dossiers/` only when the buyer context will matter across multiple runs. It should update an existing dossier when `subject_key` already exists.

```yaml
schema: blueprint/exact-site-hosted-review-demand-dossier-factory/v1
input:
  target_ref:
    ledger_path: ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json
    target_id: string
    organization_name: string
    track: proof_ready_outreach | demand_sourced_capture
  demand_signal:
    buyer_segment: string
    workflow_need: string
    intent_signals: string[]
    evidence_summary: string
    source_urls: string[]
    repo_artifacts: string[]
    confidence: low | medium | high
  lead_magnet:
    artifact_type: exact_site_hosted_review | city_site_opportunity_brief
    artifact_status: missing | draft | review_ready | delivered
    artifact_path: string
    site_world_id: string
    hosted_review_path: string
    capture_ask:
      requested_site_type: string
      requested_city: string
      buyer_question: string
      status: not_started | requested | capturer_routed | captured | packaged
  motion_state:
    outbound_status: not_ready | draft_ready | human_approved | sent | replied | hosted_review_started | closed
    approval_state: not_required | pending_first_send_approval | approved | blocked
    recipient_evidence_state: missing | candidate_only | recipient_backed
    send_state: not_sent | sent
    reply_state: none | durable_unknown | reply_recorded
    blockers:
      - id: string
        status: open | blocked | waiting_on_human | waiting_on_provider | resolved
        owner: string
        next_action: string
        paperclip_issue_identifier: string
output_dossier:
  frontmatter:
    authority: derived
    source_system: repo-ledger
    source_urls: string[]
    last_verified_at: YYYY-MM-DD
    owner: buyer-solutions-agent | growth-lead
    sensitivity: internal
    confidence: 0.00-1.00
    subject_key: string
    freshness_sla_days: number
    review_status: draft | active | blocked | stale
    canonical_refs:
      - system: paperclip | ledger | report | package | hosted_session | inbound_request
        ref: string
  body_sections:
    - summary
    - current_state
    - evidence
    - signals
    - exact_site_motion
    - proof_pack_shape
    - claim_guardrails
    - implications_for_blueprint
    - open_questions
    - canonical_links
    - authority_boundary
```

## Factory Steps

1. Load the current GTM ledger and audit it locally with `npm run gtm:hosted-review:audit -- --allow-blocked`.
2. Select only targets with enough reusable buyer context to matter across multiple runs.
3. Check `knowledge/compiled/buyer-dossiers/` for an existing `subject_key`; update instead of creating a duplicate.
4. Classify the row as `proof_ready_outreach` or `demand_sourced_capture`.
5. Copy only evidence-backed target fields into the dossier. Keep recipient data out of the dossier unless the active buyer journey requires it and the ledger already records explicit evidence.
6. Add a source ledger row for every claim-bearing source used by the dossier.
7. Add claim guardrails before the implications section so follow-on agents do not turn a draft into traction.
8. Mark open questions for missing package/runtime proof, rights/privacy clearance, exact-site capture status, founder approval, reply durability, or commercial review.
9. Leave the output local until a separate authorized run mirrors to Notion or updates Paperclip.

## Claim Guardrails

### Allowed In Draft Dossiers

- The target is a robot-team account in the local GTM ledger.
- The target has an evidence-backed workflow need when copied from the ledger or demand-intel source.
- The target is `proof_ready_outreach` only when the ledger has a review-ready or delivered `exact_site_hosted_review` artifact plus a site-world id or hosted-review path.
- The target is `demand_sourced_capture` when the dossier asks which site/workflow should be captured next.
- Public-facing Blueprint language may stay confident about product category, request path, sample proof shape, and hosted-review workflow.

### Must Be Qualified

- Sample or representative proof must be labeled as sample or representative proof, not the buyer's site.
- `recipient-backed` means the contact evidence exists in the ledger; it does not mean buyer intent, permission to send, founder approval, reply durability, or commercial readiness.
- `approval-ready` means founder approval is needed before any live send; it is not send-ready.
- `hosted review` means a review path exists only for rows whose ledger artifact supports it. For demand-sourced rows, say `capture ask` or `city/site opportunity brief`.
- Rights, privacy, access, commercialization, and procurement topics remain human-gated unless canonical owner-system proof is linked.

### Blocked Until Owning-System Proof Exists

- Customer, partner, active buyer conversation, traction, revenue, reply, qualified-call, hosted-review-start, or package-access claims.
- Live sends, sent receipts, reply-watch durability, or mailbox monitoring claims.
- Rights-cleared, unrestricted commercial use, public city coverage, active capture supply, payment success, payout success, provider execution, package delivery, or guaranteed support outcomes.
- Any claim that the pilot succeeded, scaled, or earned paid-spend authorization. The local audit still records 0 sent touches and 0 organic signals.

## Dossier Output Contract

Each produced dossier should include this authority boundary verbatim:

> This page is a derived Blueprint KB artifact. It does not replace GTM ledger state, Paperclip execution state, inbound request truth, capture provenance, rights/privacy review, pricing/legal commitments, payment or entitlement truth, provider artifacts, package manifests, or hosted-session runtime truth.

Each produced dossier should also include:

- `source_ledger`: one bullet per canonical source path and field used.
- `blocked_claims`: explicit claims the next agent must not make.
- `next_truth_move`: one of `founder_approval`, `reply_durability`, `capture_ask`, `proof_pack_creation`, `hosted_review_artifact`, `rights_review`, `commercial_handoff`, `stop_or_change_motion`.

## Ten Example Dossier Outlines

These outlines are drafts for future local dossier generation. They are not buyer-facing messages and do not authorize sends.

### 1. Simbe Robotics Retail Aisle Review

- `subject_key`: `simbe-retail-aisle-hosted-review`
- `ledger_target_id`: `gtm-001-simbe-retail-aisle-review`
- `track`: `proof_ready_outreach`
- `buyer workflow`: retail shelf-scanning or public aisle loop review
- `lead magnet`: labeled sample hosted-review path from the ledger
- `dossier sections`: retail workflow fit, sample proof limits, exact-site follow-up question, recipient/founder approval state, reply-durability blocker, public/general inbox routing risk
- `blocked claims`: customer status, buyer-specific site proof, sent outreach, reply, hosted-review start, rights clearance, deployment outcome
- `next_truth_move`: `founder_approval`, then `reply_durability` before any live-send or reply claim

### 2. Brain Corp Commercial Service Review

- `subject_key`: `brain-corp-commercial-service-hosted-review`
- `ledger_target_id`: `gtm-002-braincorp-retail-service-review`
- `track`: `proof_ready_outreach`
- `buyer workflow`: public-facing store route as a proxy for commercial-service robot perception and operations questions
- `lead magnet`: labeled sample hosted-review path from the ledger
- `dossier sections`: existing Brain Corp San Diego dossier cross-link, exact-site versus representative proof label, ROS/Gazebo-style technical prep only when supported by source artifact, open proof-pack questions
- `blocked claims`: Brain Corp customer/prospect status, accepted proof pack, buyer-specific hosted review, commercial readiness
- `next_truth_move`: reconcile with `knowledge/compiled/buyer-dossiers/brain-corp-san-diego-proof-pack.md` before creating any new dossier

### 3. Agility Robotics Warehouse Humanoid Review

- `subject_key`: `agility-warehouse-humanoid-hosted-review`
- `ledger_target_id`: `gtm-003-agility-warehouse-humanoid`
- `track`: `proof_ready_outreach`
- `buyer workflow`: warehouse aisle, tote movement, or staging workflow for humanoid deployment review
- `lead magnet`: warehouse AMR sample hosted-review path plus capture ask
- `dossier sections`: warehouse workflow fit, sample artifact boundaries, capture-ask refinement, stack/review questions, reply-durability blocker
- `blocked claims`: Agility-specific site capture, buyer-specific package, integration support, deployment readiness
- `next_truth_move`: founder approval decision, then capture-question refinement if the sample is not close enough

### 4. Boston Dynamics Case-Handling Capture Ask

- `subject_key`: `boston-dynamics-warehouse-case-handling-capture-ask`
- `ledger_target_id`: `gtm-004-boston-dynamics-stretch-warehouse`
- `track`: `demand_sourced_capture`
- `buyer workflow`: trailer, dock, pallet, or case-handling workflow
- `lead magnet`: city/site opportunity brief, not a hosted review
- `dossier sections`: Stretch-style warehouse handling context, requested site/workflow question, no-hosted-review guardrail, capture requirements, founder approval state
- `blocked claims`: ready hosted review, exact-site package, buyer-specific capture evidence, active relationship, sent outreach
- `next_truth_move`: capture-ask validation or stop/change CTA if the broad public inbox route is too weak

### 5. Locus Robotics Fulfillment AMR Capture Ask

- `subject_key`: `locus-fulfillment-amr-capture-ask`
- `ledger_target_id`: `gtm-005-locus-fulfillment-amr`
- `track`: `demand_sourced_capture`
- `buyer workflow`: pick aisle, induction, replenishment, or returns workflow
- `lead magnet`: city/site opportunity brief
- `dossier sections`: fulfillment workflow hypothesis, exact site type needed, proof-pack expectations, blocked hosted-review claims, founder approval state
- `blocked claims`: package readiness, Locus-specific proof, buyer reply, city supply, fulfillment claim
- `next_truth_move`: decide whether a fulfillment proof artifact should be created before any first touch

### 6. Seegrid Industrial Vehicle Route Capture Ask

- `subject_key`: `seegrid-industrial-vehicle-route-capture-ask`
- `ledger_target_id`: `gtm-006-seegrid-warehouse-amr`
- `track`: `demand_sourced_capture`
- `buyer workflow`: material-movement route, staging lane, or dock-to-line workflow
- `lead magnet`: city/site opportunity brief
- `dossier sections`: route-review use case, capture site requirements, proof-pack handoff shape, compatibility questions, reply-durability blocker
- `blocked claims`: exact route captured, hosted session live, buyer-specific review, deployment readiness
- `next_truth_move`: clarify whether a route-based proof pack should precede outbound

### 7. Diligent Robotics Healthcare Service Route Capture Ask

- `subject_key`: `diligent-healthcare-service-route-capture-ask`
- `ledger_target_id`: `gtm-009-diligent-healthcare-service-route`
- `track`: `demand_sourced_capture`
- `buyer workflow`: hospital supply, hallway, or nursing-unit support route
- `lead magnet`: city/site opportunity brief
- `dossier sections`: healthcare route use case, privacy-sensitive capture constraints, human review gates, proof-pack minimums, blocked claims
- `blocked claims`: privacy clearance, hospital access, rights permission, ready hosted review, healthcare deployment suitability
- `next_truth_move`: rights/privacy review threshold before any buyer-facing proof claim

### 8. Gecko Robotics Industrial Inspection Capture Ask

- `subject_key`: `gecko-industrial-inspection-capture-ask`
- `ledger_target_id`: `gtm-010-gecko-industrial-inspection`
- `track`: `demand_sourced_capture`
- `buyer workflow`: industrial inspection route or facility workflow
- `lead magnet`: city/site opportunity brief
- `dossier sections`: inspection workflow hypothesis, capture conditions, artifact handoff needs, safety/procurement questions, non-claim boundaries
- `blocked claims`: industrial site access, inspection validity, provider execution, package delivery, commercial permission
- `next_truth_move`: identify the inspection route type that would justify capture

### 9. Outrider Yard Automation Capture Ask

- `subject_key`: `outrider-yard-automation-capture-ask`
- `ledger_target_id`: `gtm-012-outrider-yard-automation`
- `track`: `demand_sourced_capture`
- `buyer workflow`: yard, dock, trailer, or staging route
- `lead magnet`: city/site opportunity brief
- `dossier sections`: yard-route workflow context, site/city constraints, capture ask, hosted-review blocked claims, decision-rule implication
- `blocked claims`: yard site captured, autonomous yard deployment proof, buyer reply, city launch readiness
- `next_truth_move`: decide whether to create a yard-route sample proof asset or change CTA

### 10. Skydio Industrial Inspection Route Capture Ask

- `subject_key`: `skydio-industrial-inspection-route-capture-ask`
- `ledger_target_id`: `gtm-skydio-identify-an-industrial-inspection-route-or-facility-workflow-worth-captu`
- `track`: `demand_sourced_capture`
- `buyer workflow`: industrial inspection route or facility workflow for autonomous inspection
- `lead magnet`: city/site opportunity brief
- `dossier sections`: aerial/inspection review fit, site constraints, safety/privacy review questions, sample proof requirements, blocked provider and deployment claims
- `blocked claims`: drone operation authorization, site access, hosted review ready, provider execution, deployment support
- `next_truth_move`: classify whether this should stay in robot-team GTM, move to a stricter procurement/security review path, or stop

## Local-Only Closeout Boundary

This artifact is a draft factory spec. It is useful for future local dossier generation, but it does not itself update the GTM ledger, Paperclip, Notion, Firestore, Stripe, providers, rights systems, city activation artifacts, or hosted-session runtime state.
