# Hermès + Free OpenRouter Fallback Design

**Date:** 2026-04-01
**Status:** Approved, refreshed 2026-04-24 for the current OpenRouter free-model catalogue

## Problem

When Claude Code and Codex quotas are exhausted, agents fall back directly to OpenCode (minimax-m2.5-free). There is no intermediate tier that uses the Hermès harness with a free model before dropping to the fully-free OpenCode runner. This means quota exhaustion on paid models immediately loses the Hermès harness capabilities.

## Goal

Insert Hermès running a free OpenRouter model as an intermediate tier between the paid adapters (claude/codex) and the terminal free fallback (opencode). This applies to both:

1. **Runtime fallback** — when an agent task hits quota mid-run (quota-fallback.ts)
2. **Static probe chain** — when reconcile assigns adapters at startup (reconcile script)

## New Fallback Chains

### Runtime (quota-fallback.ts)
```
claude_local ──quota exhausted──→ hermes_local (free OpenRouter model) ──quota exhausted──→ opencode_local
codex_local  ──quota exhausted──→ hermes_local (free OpenRouter model) ──quota exhausted──→ opencode_local
hermes_local ──quota exhausted──→ opencode_local  (unchanged)
```

### Static probe (reconcile auto mode)
```
Tier 1: desired adapter (claude_local or codex_local)
Tier 2: the other one (codex_local or claude_local, via fallbackAdapterFor)
Tier 3: hermes_local with free OpenRouter model  ← NEW
Tier 4: opencode_local
```

## Affected Files

| File | Change |
|------|--------|
| `ops/paperclip/plugins/blueprint-automation/src/quota-fallback.ts` | Change `buildHermesFallbackAdapterConfig` default model to free OpenRouter model |
| `scripts/paperclip/reconcile-blueprint-paperclip-company.sh` | Add hermes free tier; add `hermesFreeFallbackFor`; add hermes probe for all cwds |
| `ops/paperclip/blueprint-paperclip.env.example` | Add `BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL` |
| `/Users/nijelhunt_1/workspace/.paperclip-blueprint.env` | Add `BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL` |

## Implementation Detail

### quota-fallback.ts

`buildHermesFallbackAdapterConfig` default model changes from `gpt-5.4-mini` to the env-driven free model:

```ts
model: options?.model ?? process.env.BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free"
```

`modelReasoningEffort` stays at `xhigh` — harmless for non-reasoning models, avoids removing a field that hermes may inspect.

### reconcile-blueprint-paperclip-company.sh

**New env var (shell section):**
```bash
BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL="${BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL:-nvidia/nemotron-3-super-120b-a12b:free}"
```

**New JS variable:**
```js
const hermesFallbackModel =
  process.env.BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";
```

**New `hermesFreeFallbackFor` function:**
```js
function hermesFreeFallbackFor(desired) {
  const adapterConfig = desired.adapterConfig ?? {};
  const cwd = typeof adapterConfig.cwd === "string" ? adapterConfig.cwd : "";
  if (!cwd) return null;
  return {
    adapterType: "hermes_local",
    adapterConfig: {
      cwd,
      model: hermesFallbackModel,
      timeoutSec: typeof adapterConfig.timeoutSec === "number" ? adapterConfig.timeoutSec : 1800,
    },
  };
}
```

**`buildWorkspaceProbeMatrix` addition:**
For every cwd entry that does not already have a `hermes_local` probe (i.e., cwds with only claude/codex agents), add a default hermes probe so it appears in availability:

```js
if (!entry.hermes_local) {
  entry.hermes_local = { cwd };  // minimal probe — checks harness is functional
}
```

**`chooseAdapterForAgent` auto-mode update** (claude_local / codex_local path):
```js
// Tier 3: hermes_local with free model (before opencode)
const hermesFree = hermesFreeFallbackFor(desired);
if (hermesFree && workspaceAvailability?.hermes_local?.status === "pass") return hermesFree;

// Tier 4: opencode_local
const opencode = tertiaryOpencodeFallbackFor(desired);
if (opencode && workspaceAvailability?.opencode_local?.status === "pass") return opencode;
```

### Probe key decision

Re-uses the existing `hermes_local` probe result. The probe verifies the harness is functional (binary present, Paperclip connectivity). The model is a runtime argument — if the harness works, the free model will be attempted. If the free model then hits issues at runtime, the existing runtime quota-fallback logic escalates to opencode.

### Environment variable

**Default:** `nvidia/nemotron-3-super-120b-a12b:free`
**Env var:** `BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL`

The full free tier chain is therefore:
```
hermes (nvidia/nemotron-3-super-120b-a12b:free)
  → hermes next free model (for example tencent/hy3-preview:free, minimax/minimax-m2.5:free, google/gemma-4-31b-it:free)
  → opencode primary (minimax-m2.5-free via BLUEPRINT_PAPERCLIP_OPENCODE_PRIMARY_MODEL)
    → opencode fallback (qwen3-coder-480b:free via BLUEPRINT_PAPERCLIP_OPENCODE_FALLBACK_MODEL)
```

Other viable free models (can swap via env without code change):
- `tencent/hy3-preview:free`
- `minimax/minimax-m2.5:free`
- `google/gemma-4-31b-it:free`
- `google/gemma-4-26b-a4b-it:free`
- `qwen/qwen3-next-80b-a3b-instruct:free`
- `openai/gpt-oss-120b:free`
- `z-ai/glm-4.5-air:free`
- `qwen/qwen3-coder:free`

Deprecated or near-expiry ids are filtered from live Hermes routing:
`openrouter/free`, `arcee-ai/trinity-large-preview:free`,
`qwen/qwen3.6-plus:free`, `stepfun/step-3.5-flash:free`, and
the short `nvidia/nemotron-3-super:free` slug.

## What Does Not Change

- `hermes_local` agents' own fallback path: hermes → opencode (no change)
- OpenCode adapter configuration
- Any paid model assignments for primary adapters
- The `BLUEPRINT_PAPERCLIP_OPENCODE_PRIMARY_MODEL` / `BLUEPRINT_PAPERCLIP_OPENCODE_FALLBACK_MODEL` vars

## Testing

After deploying:
1. Re-run `reconcile-blueprint-paperclip-company.sh` and verify log line shows `hermes=pass` for all cwds
2. Confirm a claude/codex agent that would normally fall to opencode now shows `hermes_local` as its adapter when claude/codex probes fail
3. Verify `buildHermesFallbackAdapterConfig` unit tests still pass with new default model
