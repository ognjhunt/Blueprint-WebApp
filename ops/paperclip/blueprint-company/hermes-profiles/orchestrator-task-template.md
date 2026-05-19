# Hermes Kanban Orchestrator Task Template

Use this when Hermes Kanban/default-assignee routing becomes available. Until then, this is a repo-side runbook only.

## Start Gate

1. Confirm `hermes kanban --help` exists.
2. Confirm the local Hermes profile surface can store a profile `description`.
3. Confirm the task can run without live side effects, or cite the command-safety approval that allows them.
4. Confirm Paperclip remains the execution record.

If any item fails, stop and create/leave a blocked Paperclip issue instead of mutating Hermes live state.

## Decompose

For each incoming parent prompt:

- Select the parent profile from `profiles.yaml`.
- Create or identify the parent Paperclip issue before creating children.
- Create child tasks only when each child has one responsible profile, acceptance criteria, expected proof path, blocker id policy, and closeout owner.
- Use Hermes for planning, routing, research, and specialist text work.
- Route implementation, browser-heavy, image-heavy, and repo-patch work to the relevant Codex profile.
- Preserve DeepSeek/Hermes cheap/default lanes where `.paperclip.yaml` already uses them.

## Child Task Body

Every child task must include:

```markdown
Parent trace:
- Hermes parent id:
- Paperclip parent issue id:

Assigned profile:
- profileKey:
- paperclipAgentKey:

Acceptance criteria:
-

Proof path expectation:
-

Blocker id policy:
- Use `none` only when no human/external blocker exists.
- Use a durable blocker id for human-gated, provider-gated, credential-gated, rights/privacy, send, payment, payout, or hosted-runtime stops.

Side-effect gate:
- No live send/payment/provider/Notion/Paperclip/Render/Firebase/VPS mutation unless command-safety approval is explicit.

Closeout owner:
-

Residual risk:
-
```

## Stop Conditions

- Hermes lacks Kanban/profile-description commands locally.
- The only remaining action is `hermes update` or live Hermes/Paperclip mutation.
- A target file is already dirty and the change cannot be isolated.
- The task would invent live readiness, provider proof, rights clearance, payment state, payout state, city activation, or hosted-session fulfillment.
- The child task would be unowned.

## Closeout

Resolved, blocked, or awaiting-human child issues must preserve the existing Paperclip closeout contract in `server/agents/goal-closeout-contract.ts`. Adapter success is not task completion; closeout needs proof paths, issue/run id, stage reached, state claimed, next action, retry/resume condition, and residual risk.
