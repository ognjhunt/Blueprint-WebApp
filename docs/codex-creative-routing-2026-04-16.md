# Codex Creative Routing

Date: 2026-04-16

Status: Active

Scope: Routing policy for image-heavy brand, marketing, and frontend work across Codex, Hermes, and server-side autonomous workers in `Blueprint-WebApp`.

Source note:
- OpenAI, "Codex for (almost) everything," published April 16, 2026:
  Codex can use `gpt-image-2` to generate and iterate on images inside the same workflow as screenshots and code.

## Decision

Blueprint will treat Codex-native image generation via Codex desktop OAuth as the default image lane only for work that is actually executed inside Codex.

Blueprint will not assume that Hermes-backed agents or server-side autonomous workers inherit Codex image capability.

## Operating Rule

- Codex brand/marketing/frontend agents: use Codex-native image generation by default.
- Hermes agents: do not assume image generation capability.
- Server-side autonomous workers: do not call a separate paid image API for final image execution.
- Video generation remains on an explicit provider path. Current server-side default: OpenRouter video. Optional agent-side alternative: Higgsfield MCP for Seedance 2.0 when Higgsfield OAuth and credits are available.

## Why

- The new Codex image capability is attached to Codex execution, not to every Paperclip lane generically.
- Most Blueprint growth and research agents are Hermes-backed and should continue to own planning, copy, evidence gathering, and routing rather than final image execution.
- The current scheduled creative factory and admin creative routes are server-side workflows and should prepare proof-led prompt packs, then hand final image execution to Codex instead of calling a separate image API.

## Audited Agent Set

The following agents should follow the new Codex image-routing rule.

### Execute Image Work In Codex

These lanes should use Codex-native image generation by default when the assigned work needs generated imagery, mockups, design explorations, or asset iteration.

| Agent | Current runtime role | Policy |
|---|---|---|
| `webapp-codex` | Codex implementation lane for `Blueprint-WebApp` | Default execution lane for brand, marketing, and frontend image generation in Codex using OAuth-backed `gpt-image-2`. |

### Route Image Work To Codex

These lanes remain Hermes-backed. They should prepare the brief, the claims guardrails, the evidence pack, and the review criteria, then route the final image work to `webapp-codex`.

| Agent | Current runtime role | Policy |
|---|---|---|
| `growth-lead` | Hermes growth strategy and routing | Route image-heavy work to `webapp-codex`; keep planning and approvals in Hermes/human lanes. |
| `community-updates-agent` | Hermes community/update drafting | Route thumbnails, social cards, hero imagery, and campaign visuals to `webapp-codex`. |
| `robot-team-growth-agent` | Hermes buyer-demand playbook lane | Route buyer-facing imagery, campaign comps, and visual assets to `webapp-codex`. |
| `capturer-growth-agent` | Hermes capturer acquisition lane | Route capturer-facing imagery, promo comps, and visual assets to `webapp-codex`. |
| `conversion-agent` | Hermes CRO lane | Route image-heavy landing-page or hero visual iteration to `webapp-codex`; keep experiment design and measurement ownership in conversion. |

### Keep On Hermes Without Image Assumptions

These lanes are primarily research, analysis, routing, or text surfaces. They should not assume direct image generation capability.

| Agent | Reason |
|---|---|
| `market-intel-agent` | research and synthesis lane |
| `demand-intel-agent` | research and synthesis lane |
| `analytics-agent` | metrics and scorecard lane |
| `workspace-digest-publisher` | internal digest lane |
| `docs-agent` | documentation lane |
| `outbound-sales-agent` | sales execution and buyer thread lane |

## Current Server-Side Worker Rule

The following repo-native creative workers remain non-image-execution paths until a separate migration says otherwise:

- `POST /api/admin/creative/generate-image`
- `POST /api/admin/creative/generate-video`
- background creative factory runs through `server/utils/creative-factory.ts`

Current provider policy for those workers:

- images: disabled for direct server-side execution; prepare the brief and route final image generation to `webapp-codex`
- video: OpenRouter video by default; Higgsfield MCP is approved only as an authenticated agent-side alternative until a separate server-side migration exists

This is intentional. These workers run server-side and must not silently depend on Codex-local interactive capabilities, but they also must not bypass the Codex OAuth image lane with a separate paid image API.

## Execution Contract

When a Hermes lane needs imagery:

1. write the brief around real Blueprint evidence, allowed claims, blocked claims, aspect ratio, and channel
2. route execution to `webapp-codex`
3. review the returned asset against the proof and claims guardrails before any public use

When `webapp-codex` receives image-heavy work:

1. use Codex desktop's native image workflow with OAuth-backed `gpt-image-2`
2. combine screenshots, code context, and the proof pack when iterating on mockups, product concepts, frontend visuals, or game-like UI work
3. keep outputs truthful and wedge-specific
4. if Codex image generation is unavailable or rate-limited, keep the execution issue on the Codex lane and retry later rather than switching to a separate image API

When an issue needs video through Higgsfield:

1. use the `higgsfield-creative-video` skill
2. keep the approved first frame, motion prompt, allowed claims, and blocked claims attached to the Paperclip issue
3. prefer Seedance 2.0 only when the Higgsfield MCP connector is authenticated and has credits
4. record the model, prompt, source frame, and output URL or path before review or publication

## Non-Goals

- giving Hermes lanes implicit image-generation powers they do not actually have
- replacing the server-side creative factory with Codex-local execution without a separate migration
- introducing a separate image API fallback for final assets when the intended lane is Codex OAuth image generation
- silently changing server-side video generation away from its explicit provider path without a migration and verification pass
