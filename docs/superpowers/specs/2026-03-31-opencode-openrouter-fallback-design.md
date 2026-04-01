# OpenCode + OpenRouter Fallback Adapter Design

**Date:** 2026-03-31
**Status:** Approved
**Scope:** All 25+ Paperclip agents — tertiary fallback for when both Codex and Claude Code (and by extension Hermes) are exhausted

---

## Problem

Blueprint's autonomous org runs 25+ agents across three Paperclip adapter types:

| Adapter | Agents | Token pool |
|---|---|---|
| `claude_local` | 13 agents (CEO, CTO, ops, engineering Claude agents) | Anthropic / Claude Code |
| `codex_local` | 3 agents (webapp-codex, pipeline-codex, capture-codex) | OpenAI / Codex CLI |
| `hermes_local` | ~12 agents (chief-of-staff, ops-lead, growth-lead, analytics, intel, etc.) | OpenAI `gpt-5.4-mini` — same OpenAI quota as Codex |

**Current fallback:** `auto` mode does a bilateral swap:
- `claude_local` probe fails → `codex_local`
- `codex_local` probe fails → `claude_local`
- `hermes_local` → **no fallback at all**

**The gap:** When both Anthropic (Claude Code) AND OpenAI (Codex + Hermes) budgets are exhausted, all 25+ agents fail with no tertiary fallback. The Hermes binary may tolerate OAuth-only mode but still hits the same OpenAI model quota as Codex — so Hermes going down is effectively equivalent to Codex going down.

---

## Solution

Add `opencode_local` as a **tertiary fallback adapter** for every agent. When both primary and secondary adapters fail their probes, the reconcile script automatically switches the agent to `opencode_local`, backed by:

- **Primary model:** MiniMax M2.5 (free via OpenCode Zen)
- **Fallback model:** `qwen/qwen3-coder-480b:free` on OpenRouter (best free coding model, 262K context, Tools tag)

This requires zero ongoing cost. The fallback activates automatically in `auto` lane mode and can also be forced via a new `openrouter` lane mode.

---

## Architecture

### Three-Tier Fallback Chain

```
Tier 1 (Primary):    claude_local     codex_local    hermes_local
                          ↓                ↓               ↓
Tier 2 (Existing):   codex_local      claude_local     [no tier 2]
                          ↓                ↓               ↓
Tier 3 (NEW):      opencode_local   opencode_local   opencode_local
```

- **Tier 1 → 2:** Existing bilateral claude↔codex swap (no change)
- **Tier 2 → 3:** NEW — if secondary also fails, fall to `opencode_local`
- **hermes_local → Tier 3:** NEW — hermes has no tier 2 today; add direct `opencode_local` fallback

### Lane Modes (updated)

| Mode | Behavior |
|---|---|
| `auto` | Probe all three tiers; use first passing one |
| `claude` | Force claude as primary; existing codex secondary; opencode tertiary |
| `codex` | Force codex as primary; existing claude secondary; opencode tertiary |
| `openrouter` | **NEW** — Force all agents to `opencode_local` immediately (no probing) |

---

## OpenCode Configuration

### CLI installation

```bash
# Via bun (works on both Mac and Ubuntu VPS):
bun add -g opencode-ai@latest

# Via npm:
npm install -g opencode-ai@latest

# Via brew (Mac only):
brew install opencode-ai/tap/opencode
```

OpenCode 1.3.12+ is required. The adapter uses `opencode run --format json --model provider/model` with prompt via stdin.

### Models

| Model | Source | Context | Cost |
|---|---|---|---|
| `opencode/minimax-m2.5-free` | OpenCode Zen (built-in free) | Large | $0 |
| `openrouter/qwen/qwen3-coder` | OpenRouter free tier | 128K | $0 |

OpenCode model selection priority:
1. Try `opencode/minimax-m2.5-free` (Zen free tier — no API key needed)
2. Fall to `openrouter/qwen/qwen3-coder` when Zen is unavailable (uses `OPENROUTER_API_KEY`)

### OpenRouter API key config

```bash
# In ~/.paperclip-blueprint.env:
OPENROUTER_API_KEY=sk-or-v1-...
BLUEPRINT_PAPERCLIP_OPENCODE_PRIMARY_MODEL=opencode/minimax-m2.5-free
BLUEPRINT_PAPERCLIP_OPENCODE_FALLBACK_MODEL=openrouter/qwen/qwen3-coder
```

OpenCode resolves models via its built-in provider config. The `opencode/` prefix routes to OpenCode Zen, `openrouter/` prefix routes to OpenRouter.

---

## Files Changed

### 1. `scripts/paperclip/ensure-opencode-install.sh` (NEW)

Idempotent install script for OpenCode CLI. Called by bootstrap.
- Checks if `opencode` binary exists and is recent enough
- Installs via curl or brew
- Verifies it can respond to `opencode --version`
- Sets up gstack symlink at `$HOME/.opencode/skills/gstack` (mirrors the Codex gstack setup in `ensure-codex-gstack.sh`)

### 2. `scripts/paperclip/bootstrap-blueprint-paperclip.sh`

Add call to `ensure-opencode-install.sh` alongside existing `ensure-codex-gstack.sh`.

### 3. `scripts/paperclip/reconcile-blueprint-paperclip-company.sh`

**Three additions inside the inline Node.js block:**

**a) `buildOpencodeProbeConfigs(yamlAgents)`** — mirrors `buildCodexProbeConfigs`, extracts distinct `(cwd, model)` pairs from `opencode_local` adapter entries (none exist in YAML today; this is used when we dynamically synthesize the fallback config).

**b) `buildWorkspaceProbeMatrix()`** — extend to also probe `opencode_local` per-cwd using the configured primary opencode model.

**c) `fallbackAdapterFor(desired)` — extend to 3-tier:**

```
claude_local → codex_local (existing)
codex_local  → claude_local (existing)
hermes_local → opencode_local (NEW tertiary)

When secondary probe also fails:
claude_local (secondary=codex_local fails) → opencode_local
codex_local  (secondary=claude_local fails) → opencode_local
```

**d) `chooseAdapterForAgent()` — add tertiary tier:**

```javascript
// After existing 2-tier logic, if both desired and fallback probes fail:
const tertiary = tertiaryOpencodeFallback(desired);
if (tertiary) return tertiary;
return desired; // last resort
```

**e) `openrouter` lane mode** — when `requestedMode === "openrouter"`, bypass probing entirely and return `opencode_local` config for all claude/codex/hermes agents.

**f) Workspace availability logging** — add `opencode` status to the per-cwd log line.

### 4. `scripts/paperclip/switch-blueprint-paperclip-lanes.sh`

Add `openrouter` as a valid mode:
```bash
case "$mode" in
  openrouter)
    write_env_value "BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE" "openrouter"
    write_env_value "BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES" "0"
    ;;
```

### 5. `ops/paperclip/blueprint-paperclip.env.example`

Add:
```bash
# OpenRouter + OpenCode fallback (Tier 3 — free, auto-activates when Codex + Claude both fail)
OPENROUTER_API_KEY=sk-or-v1-...
BLUEPRINT_PAPERCLIP_OPENCODE_PRIMARY_MODEL=minimax/minimax-m2.5
BLUEPRINT_PAPERCLIP_OPENCODE_FALLBACK_MODEL=openrouter/qwen/qwen3-coder-480b:free
# Set to 'openrouter' to force all agents to OpenCode+OpenRouter immediately
BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE=auto
```

### 6. `scripts/paperclip/verify-blueprint-paperclip.sh`

Add opencode probe verification (opt-in, `BLUEPRINT_PAPERCLIP_VERIFY_OPENCODE=auto`):
- `auto`: verify if `opencode` binary is present
- Probe `opencode_local` adapter via Paperclip's test-environment endpoint
- Tolerate `opencode_no_zen_key` warn (falls through to OpenRouter)

---

## Key Behavioral Rules

### Auto mode (default)
```
probe claude_local → pass? use claude
              ↓ fail
probe codex_local  → pass? use codex
              ↓ fail
probe opencode_local → pass? use opencode (MiniMax M2.5 free)
              ↓ fail (rare: OpenCode not installed)
use desired anyway (agent will fail when triggered, but reconcile completes)
```

### openrouter lane mode
```
All agents → opencode_local immediately (no probing)
Used when: budget exhausted and you want to immediately reroute the whole org
```

### Hermes agents specifically
Hermes agents are designed for continuous-loop / persistent memory. OpenCode is session-based. In fallback mode they lose Hermes memory continuity but remain operationally functional — they can still read Paperclip state, write issues, and produce outputs. This is acceptable for a cost-exhaustion fallback.

### No change to .paperclip.yaml static configs
The YAML continues to declare the desired (primary) adapter for each agent. The reconcile script handles all dynamic adapter selection at runtime. No new YAML entries needed.

---

## Gstack for OpenCode

OpenCode needs gstack available to support the `/browse`, `/qa`, `/investigate` skills that engineering agents rely on. The `ensure-opencode-install.sh` script will:
1. Install OpenCode CLI
2. Set up `$HOME/.opencode/skills/gstack` symlink (same target as `$HOME/.codex/skills/gstack`)
3. Symlink into all 3 repo `.agents/skills/gstack` dirs (already done by ensure-codex-gstack.sh — verify idempotent)

---

## Not In Scope

- Changing the model used by any primary/secondary adapter
- Changing Hermes memory architecture or session handling
- Adding OpenCode to `.paperclip.yaml` as static entries
- Modifying any agent AGENTS.md or skill files
- Any changes to the webapp server or frontend

---

## Success Criteria

1. `./scripts/paperclip/switch-blueprint-paperclip-lanes.sh openrouter` runs without error and reconcile logs show `opencode_local` for all agents
2. In `auto` mode, if claude and codex probes both fail, agents are reconciled to `opencode_local`
3. `opencode --version` is available after bootstrap
4. `OPENROUTER_API_KEY` is documented in `.env.example` and loaded by the env bootstrap
5. `verify-blueprint-paperclip.sh` reports opencode probe pass/warn (not fail) when OpenCode is installed
