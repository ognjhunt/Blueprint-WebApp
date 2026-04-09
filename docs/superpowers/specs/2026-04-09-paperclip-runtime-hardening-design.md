# Paperclip Runtime Hardening Design

**Date:** 2026-04-09
**Status:** Proposed
**Owner:** `blueprint-cto`
**Execution owner:** `webapp-codex`
**Scope:** Add four missing runtime primitives under Blueprint's existing Paperclip/Hermes/Codex autonomous-org model:

1. session runtime + tracing
2. memory stores + scoped vaults
3. runtime subagents + environment profiles
4. file-backed agent version promotion

---

## Goal

Make Blueprint's autonomous organization feel more like a production agent platform without replacing Paperclip, Notion, repo truth, or the current employee-kit pattern.

The intent is not to import a new hosted control plane.

The intent is to strengthen the runtime layer that sits underneath the current Blueprint agents, so the organization can support:

- long-running work with explicit lifecycle state
- inspectable traces instead of only final comments and issue movement
- scoped, auditable memory and secret access
- bounded parallel sub-work inside one parent run
- reproducible promotion of agent behavior through repo-reviewed files

## Decision

Blueprint should keep the current architecture:

- Paperclip remains the execution and ownership record
- repo files remain the definitional source of truth
- Notion remains the workspace, review, and visibility surface
- Hermes remains the low-cost persistent manager/research lane
- Codex remains the implementation lane
- Claude remains the executive/review lane where configured

Blueprint should add a runtime substrate beneath that architecture.

This substrate should not replace the current agent employee kit.

It should formalize how existing agents run.

## Why This Fits Repo Doctrine

This design follows the current repo rules in:

- [PLATFORM_CONTEXT.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md)
- [WORLD_MODEL_STRATEGY_CONTEXT.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md)
- [AUTONOMOUS_ORG.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md)
- [ai-tooling-adoption-implementation-2026-04-07.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/ai-tooling-adoption-implementation-2026-04-07.md)
- [ai-skills-governance-2026-04-07.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/ai-skills-governance-2026-04-07.md)

Specifically:

- no new primary service is required
- no source-of-truth system is replaced
- runtime improvements stay a support layer on top of the current stack
- business truth, provenance, rights, privacy, pricing, and approval boundaries remain explicit

## Current State

Blueprint already has strong org-level behavior:

- named agents with `Soul`, `Tools`, `Skills`, and task/routine definitions
- Paperclip issue ownership, routing, and handoff monitoring
- manager-loop visibility and routine health tracking
- Claude/Codex/Hermes lane failover
- Slack and Notion mirrors for operator visibility
- repo doctrine files that bound what agents may claim or do

What is still weaker than it should be is the runtime layer:

- a run is visible mostly through issue state, comments, and scattered artifacts
- long-running work lacks a first-class session model
- memory is split across repo files, Notion mirrors, and ad hoc state
- secret access is company-scoped more often than run-scoped
- delegation exists mainly as issue handoff, not as bounded runtime sub-work
- agent prompt/config promotion is only partially file-backed and not treated as a formal release path

## Non-Goals

- Do not replace Paperclip issues with sessions.
- Do not move canonical prompts or instructions into provider-hosted consoles.
- Do not make Hermes memory authoritative for pricing, approvals, provenance, or rights.
- Do not create a second general-purpose control plane outside Paperclip.
- Do not allow runtime memory to silently override repo doctrine, Notion review outcomes, or system evidence.
- Do not give subagents open-ended access to tools, secrets, or external systems by default.

---

## Design Overview

Blueprint should add four runtime primitives:

1. `Runtime Session`
2. `Memory Store`
3. `Vault Grant`
4. `Environment Profile`

These primitives sit under the existing employee kit:

```text
Agent employee kit
  Soul
  Skills
  Tools
  AGENTS.md / TASK.md / Heartbeat.md
        |
        v
Runtime layer
  Session Runtime
  Session Trace
  Memory Stores
  Vault Grants
  Environment Profiles
  Runtime Subagents
  Version Promotion
        |
        v
Execution surfaces
  Paperclip issues/routines
  Repo files
  Notion mirrors
  Slack visibility
```

The employee kit says who the agent is and what it is allowed to do.

The runtime layer says how a specific run is executed, observed, delegated, resumed, and promoted.

---

## 1. Session Runtime + Tracing

### Problem

Blueprint currently has good issue-centric execution control, but it does not have a clean run/session object for:

- long-running work
- temporary pauses
- resumable execution
- trace inspection
- artifact lineage
- per-run environment and secret scoping

### Design

Add a first-class `runtime_session` record for every meaningful agent run.

The session is not a replacement for a Paperclip issue.

The Paperclip issue remains the ownership and routing object.

The session becomes the execution object attached to the issue.

### Session Model

```ts
interface RuntimeSession {
  id: string;
  issueId: string | null;
  parentSessionId: string | null;
  rootSessionId: string;
  agentKey: string;
  agentVersionRef: string;
  environmentProfileKey: string;
  status:
    | "queued"
    | "starting"
    | "running"
    | "waiting_for_tool"
    | "waiting_for_human"
    | "idle"
    | "blocked"
    | "completed"
    | "failed"
    | "cancelled"
    | "archived";
  startedAt: string | null;
  endedAt: string | null;
  wakeReason: string | null;
  summary: string | null;
  lastTraceEventAt: string | null;
  latestCheckpointId: string | null;
  outputArtifactPaths: string[];
  proofLinks: string[];
}
```

### Session Rules

- Every routine-backed run gets a `runtime_session`.
- Every issue-assigned run gets a `runtime_session`.
- Parent/child relationships are allowed for subagent execution.
- A session may outlive a single terminal/webhook connection.
- A session may move to `idle` when it has no next action but remains resumable.
- A session may move to `waiting_for_human` only when a known human gate exists.
- Closing an issue does not delete a session trace.

### Trace Model

Each session writes ordered trace events.

```ts
interface RuntimeTraceEvent {
  id: string;
  sessionId: string;
  sequence: number;
  at: string;
  type:
    | "session.started"
    | "session.resumed"
    | "session.status_changed"
    | "model.turn_started"
    | "model.turn_completed"
    | "tool.requested"
    | "tool.approved"
    | "tool.denied"
    | "tool.started"
    | "tool.completed"
    | "tool.failed"
    | "memory.read"
    | "memory.write"
    | "vault.granted"
    | "vault.used"
    | "artifact.created"
    | "artifact.promoted"
    | "subagent.spawned"
    | "subagent.completed"
    | "handoff.created"
    | "human_gate.required"
    | "human_gate.cleared"
    | "session.checkpointed"
    | "session.failed";
  actor: "agent" | "runtime" | "human" | "tool" | "subagent";
  summary: string;
  detail: Record<string, unknown> | null;
}
```

### Trace Output Rules

- Traces must be operator-readable without opening raw logs.
- High-signal summaries should be mirrored into Paperclip comments only when useful.
- Notion should never become the full trace store.
- Slack should receive summarized events, not the whole trace.
- Artifacts created during a trace must include the `sessionId`.

### Checkpointing

Blueprint should add lightweight checkpoints for long runs.

A checkpoint is:

- a compact runtime state snapshot
- a pointer to current artifacts
- a pointer to current memory writes
- enough metadata to resume or audit

Checkpoints are not full VM snapshots.

They are workflow checkpoints.

### Initial Storage

Use Firestore or Paperclip plugin state for runtime session metadata first.

Recommended first location:

```text
ops_runtime_sessions/{sessionId}
ops_runtime_sessions/{sessionId}/trace/{eventId}
ops_runtime_checkpoints/{checkpointId}
```

### Acceptance Criteria

- an operator can inspect one session and understand what happened without reading the whole issue thread
- a long-running run can be resumed after disconnect or manager wakeup
- all high-risk tool attempts appear in the trace
- all durable artifacts created by a run are attributable to a session

---

## 2. Memory Stores + Scoped Vaults

### Problem

Blueprint has useful knowledge surfaces, but they are not cleanly separated by:

- authority
- scope
- mutability
- retention
- auditability

This makes it too easy to blur:

- durable doctrine
- reusable playbook knowledge
- temporary run scratch state
- secret access

### Design

Add explicit `memory_store` and `vault_grant` runtime primitives.

Memory and vault access must be attached to sessions and environment profiles, not implied globally.

### Memory Principles

- Memory is a support layer, not the authority for work state or business truth.
- Repo doctrine stays authoritative for mission, contracts, and hard rules.
- Paperclip issues stay authoritative for execution ownership and status.
- Notion stays the operator-facing workspace mirror.
- Memory stores are for reusable runtime context, learned patterns, and structured recall.

### Memory Scopes

Blueprint should support four scopes:

1. `doctrine_shared`
2. `project_shared`
3. `agent_local`
4. `session_scratch`

#### `doctrine_shared`

Read-only by default.

Contents:

- platform doctrine excerpts
- world-model strategy excerpts
- approved policy summaries
- stable operating playbooks
- canonical capability boundaries

Authority:

- repo-derived only
- cannot be edited by runtime sessions directly

#### `project_shared`

Read/write under controlled rules.

Contents:

- durable project conventions
- accumulated implementation notes
- recurring failure patterns
- approved operating heuristics

Authority:

- may be written only by approved agents or deterministic post-run compaction
- should require review for high-impact writes

#### `agent_local`

Owned by one agent key.

Contents:

- preferences that improve that agent's future runs
- safe reusable summaries
- lane-specific reminders

Authority:

- writable by that agent's runs
- not visible org-wide by default

#### `session_scratch`

Ephemeral and per-run.

Contents:

- temporary notes
- intermediate plans
- open questions
- partial summaries

Authority:

- writable freely inside one session
- archived or compacted on completion

### Memory Write Policy

Memory writes should be classified:

- `ephemeral`
- `candidate_durable`
- `approved_durable`

Agents should not silently write durable memory in sensitive lanes.

Durable writes in pricing, rights, privacy, legal, provenance, or buyer-commitment lanes should either:

- stay blocked until review, or
- be written by a deterministic compaction/promote step after review

### Memory Record Shape

```ts
interface MemoryRecord {
  id: string;
  storeKey: string;
  path: string;
  scope: "doctrine_shared" | "project_shared" | "agent_local" | "session_scratch";
  title: string;
  content: string;
  labels: string[];
  sourceSessionId: string | null;
  sourceIssueId: string | null;
  authority:
    | "repo"
    | "paperclip"
    | "notion_reviewed"
    | "agent_candidate"
    | "human_authored";
  version: number;
  redacted: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Vault Principles

Vaults are not memory.

Vaults are scoped secret-access grants.

Blueprint already has Paperclip company secrets. This design adds grant boundaries around them.

### Vault Scopes

Blueprint should support:

1. `company`
2. `workspace`
3. `agent`
4. `session`

Each grant should specify:

- which secret refs are visible
- for which session or agent
- for how long
- for which tool classes

### Vault Grant Shape

```ts
interface VaultGrant {
  id: string;
  scope: "company" | "workspace" | "agent" | "session";
  scopeRef: string;
  sessionId: string | null;
  agentKey: string | null;
  secretRefs: string[];
  allowedTools: string[];
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
}
```

### Vault Rules

- Secret refs remain in Paperclip/company secret storage.
- Runtime sessions receive grants, not raw permanent entitlement.
- Session-scoped grants should be the default for high-risk lanes.
- Every secret resolution in a run should emit a trace event.
- No secret should be copied into runtime memory.

### Acceptance Criteria

- agents can read durable doctrine/context without treating it as mutable scratch space
- sensitive memory writes are reviewable and auditable
- secret access can be limited to a session instead of an entire host-wide agent posture
- operators can answer who had access to what, when, and why

---

## 3. Runtime Subagents + Environment Profiles

### Problem

Blueprint already has delegation and handoffs, but current delegation is mostly org-level:

- issue rerouting
- handoff issues
- manager follow-up

What is missing is a runtime-native way for one session to spin up bounded helper work without:

- turning the whole task into a new top-level issue
- giving helpers broad access by default
- losing observability

### Design

Add `runtime_subagent` execution under a parent session.

This is for bounded, parallel, or specialist sub-work.

It is not a replacement for org-level delegation.

### Subagent Use Cases

Approved first-wave use cases:

- implementation agent spins up a read-only repo explorer
- review agent spins up a test/verification helper
- market-intel or demand-intel agent parallelizes bounded research lookups
- chief-of-staff or ops lead requests structured evidence collection from a specialist helper

Not approved first-wave use cases:

- rights, pricing, privacy, legal, or contract commitments
- direct external messaging without the existing human gates
- autonomous escalation to unlimited tool access

### Subagent Rules

- every subagent must have a parent session
- every subagent must inherit an explicit environment profile
- every subagent must inherit a reduced or equal permission set
- every subagent must write its result back to the parent session trace
- every subagent must have a bounded goal and termination rule

### Subagent Record

```ts
interface RuntimeSubagent {
  id: string;
  parentSessionId: string;
  childSessionId: string;
  requestedByAgentKey: string;
  assignedAgentKey: string;
  purpose: string;
  expectedOutput: string;
  status: "queued" | "running" | "completed" | "blocked" | "failed" | "cancelled";
  environmentProfileKey: string;
  memoryBindings: string[];
  vaultGrantIds: string[];
  createdAt: string;
  completedAt: string | null;
}
```

### Environment Profiles

An environment profile defines the execution boundary for a session or subagent.

It should be file-backed and reusable.

### Profile Contents

An environment profile should declare:

- runtime lane
- default model family or adapter preference
- tool allowlist
- browser/network policy
- repo/workspace mounts
- memory bindings
- vault scope defaults
- artifact policy
- review/human-gate posture

### Profile Examples

- `engineering_impl_default`
- `engineering_review_readonly`
- `research_web_readonly`
- `ops_internal_mutation_limited`
- `notion_reconcile_controlled`
- `preview_diagnosis_isolated`

### Example Shape

```yaml
key: engineering_review_readonly
description: Review-oriented profile with repo read access, test execution, and no direct external writes.
runtime_lane: review
adapter_policy:
  preferred:
    - claude_local
    - codex_local
tools:
  allow:
    - repo_read
    - rg_search
    - build
    - test
    - diff_review
  deny:
    - slack_post
    - notion_write
    - finance_mutation
network_policy:
  mode: restricted
repo_mounts:
  - /Users/nijelhunt_1/workspace/Blueprint-WebApp
memory:
  bind:
    - doctrine_shared
    - project_shared:blueprint-webapp
vault:
  default_scope: session
  allowed_refs:
    - BLUEPRINT_PAPERCLIP_GITHUB_TOKEN
artifacts:
  require_trace_link: true
  publish_to_issue: true
```

### Relationship To Existing Employee Kits

The employee kit remains canonical for:

- role
- mission
- doctrine
- task behavior
- high-level tools and skills

The environment profile becomes canonical for:

- execution boundary
- default mounts and runtime policy
- which of those tools/skills are active in a specific run shape

### Acceptance Criteria

- parent sessions can parallelize bounded helper work without creating org-level chaos
- subagents are traceable and cannot silently exceed parent permissions
- common execution contexts can be reused safely across runs and agents
- operators can tell which runtime boundary a given run used

---

## 4. File-Backed Agent Version Promotion

### Problem

Blueprint's current agent identity is distributed across:

- `AGENTS.md`
- `Soul.md`
- `Tools.md`
- `Heartbeat.md`
- task files
- plugin/runtime code

This is good for human readability, but weak as a formal promotion path for runtime behavior.

Blueprint needs a versioned release shape for agent runtime config that is:

- file-backed
- reviewable in PRs
- promotable by environment
- pinned per session

### Design

Add a file-backed runtime manifest and promotion channel system.

The employee kit remains the design source.

The runtime manifest becomes the execution release artifact derived from that source.

### Repo Shape

Recommended structure:

```text
ops/paperclip/runtime/
  agents/
    blueprint-chief-of-staff/
      manifest.yaml
      versions/
        2026-04-09.1.yaml
      channels/
        draft.yaml
        staging.yaml
        production.yaml
    webapp-codex/
      manifest.yaml
      versions/
        2026-04-09.1.yaml
      channels/
        draft.yaml
        staging.yaml
        production.yaml
  environments/
    engineering_impl_default.yaml
    engineering_review_readonly.yaml
    research_web_readonly.yaml
```

### Manifest Responsibilities

`manifest.yaml` should point to the current employee kit sources:

- `Soul.md`
- `Tools.md`
- `Heartbeat.md`
- task paths
- default environment profile
- memory bindings
- promotion policy

### Version File Responsibilities

Each version file should freeze:

- resolved system/runtime prompt inputs
- active tools
- active skills
- environment profile
- memory bindings
- vault policy
- model/adapter policy
- review policy

### Channel Files

Channels should map stable names to a version:

```yaml
channel: production
agent_key: webapp-codex
version: 2026-04-09.1
approved_by: blueprint-cto
approved_at: 2026-04-09T17:00:00Z
notes: Promote after verification on repo-drift and CI-fix issue classes.
```

### Promotion Rules

- `draft` may be created freely in repo branches
- `staging` requires review plus verification evidence
- `production` requires explicit owner approval
- sessions should record the exact agent version and channel used
- rollback is changing a channel pin, not rewriting history

### Required Review Evidence

Promotion to `staging` or `production` should reference:

- evaluation notes or shadow-run evidence where relevant
- affected issue classes or lanes
- runtime/tool policy changes
- any new memory/vault access

### Session Pinning

Every runtime session should capture:

- `agentKey`
- `agentVersionRef`
- `channelRef`

This makes every run reproducible after the fact.

### Relationship To Existing Docs

This promotion system does not replace:

- `AUTONOMOUS_ORG.md`
- agent employee kits
- repo doctrine docs

It formalizes how a specific runtime release is cut from them.

### Acceptance Criteria

- an operator can identify exactly which runtime config version produced a session
- rollback does not require reconstructing prompt/tool state from scattered edits
- promotions happen through repo review, not only through mutable host state
- skills/tools/soul remain human-readable while execution config becomes machine-reproducible

---

## Suggested Delivery Phases

### Phase 0. Policy Lock

Deliverable:

- this spec committed in repo
- explicit decision that runtime hardening is additive to Paperclip, not a replacement

### Phase 1. Session Runtime + Trace Foundation

First implementation targets:

- `runtime_session` persistence
- trace event schema
- session status transitions
- artifact/session linkage

Initial lanes:

- `webapp-codex`
- `webapp-review`
- `blueprint-chief-of-staff`

### Phase 2. Memory + Vault Scoping

First implementation targets:

- `doctrine_shared`
- `project_shared`
- `session_scratch`
- session-scoped vault grants with trace logging

### Phase 3. Environment Profiles + Runtime Subagents

First implementation targets:

- read-only explorer subagent
- test/verification helper subagent
- research helper subagent
- 3 to 5 reusable environment profiles

### Phase 4. File-Backed Version Promotion

First implementation targets:

- runtime manifest schema
- version files for 3 core agents
- channel pin files
- session pin capture

---

## Initial Candidate Files And Surfaces

Likely implementation surfaces:

- `ops/paperclip/plugins/blueprint-automation/src/worker.ts`
- `ops/paperclip/plugins/blueprint-automation/src/manager-loop.ts`
- `ops/paperclip/plugins/blueprint-automation/src/handoffs.ts`
- `ops/paperclip/plugins/blueprint-automation/src/execution-governor.ts`
- new runtime helpers under:

```text
ops/paperclip/plugins/blueprint-automation/src/runtime/
  sessions.ts
  tracing.ts
  memory.ts
  vault.ts
  subagents.ts
  environment-profiles.ts
  versioning.ts
```

Potential operator docs:

- `docs/paperclip-runtime-session-runbook.md`
- `docs/paperclip-memory-and-vault-governance.md`

---

## Open Questions

1. Should session state live in Firestore first, Paperclip plugin state first, or a hybrid split?
2. Which exact lanes are allowed to write `project_shared` memory without review?
3. Should subagent execution be limited to one level deep in the first release?
4. Which owner is required to approve `production` channel promotion per department?
5. Should environment profiles be agent-owned, lane-owned, or centrally curated by CTO?

---

## Recommended Decision Rule

When choosing between:

- adding another ad hoc agent-specific runtime hack
- adding one of the four shared primitives in this spec

default toward the shared primitive.

Blueprint already has the org.

What it needs now is a cleaner runtime under that org.
