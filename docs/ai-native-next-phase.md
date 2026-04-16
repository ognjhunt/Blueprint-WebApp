# Blueprint Next-Phase Loops

This document captures the repo-side implementation of Blueprint's next phase:

- one narrow commercial wedge: **Exact-Site Hosted Review**
- stronger growth telemetry and attribution
- proof-led creative generation
- voice concierge support with hard guardrails
- operator loops that convert customer signal into internal execution work
- approval-gated campaign sends and lifecycle emails through the existing action ledger

## Current Wedge

**Exact-Site Hosted Review** means:

- one real facility
- one workflow lane
- one package-plus-hosted-review path
- explicit human gates on pricing, legal, rights, privacy, security, and other irreversible commitments

The public landing route is `/exact-site-hosted-review`.

## Growth Loop

Implemented surfaces:

- client analytics now mirror page views and events into a first-party `/api/analytics/ingest` stream when `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1`
- experiment assignment is deterministic in `client/src/lib/experiments.ts`
- wedge-specific experiment exposure and conversion events are emitted through `client/src/lib/analytics.ts`
- top-level hosted-review CTAs now point at the narrow wedge route instead of the broad contact path

## Creative Loop

Implemented surfaces:

- protected campaign-kit builder at `/admin/growth-studio`
- `POST /api/admin/creative/campaign-kit` for proof-led landing/email/outbound/reel kits
- `POST /api/admin/creative/generate-image` is disabled by policy for server-side paid image generation
- `POST /api/admin/creative/generate-video` plus `GET /api/admin/creative/video-tasks/:taskId` for OpenRouter-backed video generation when `OPENROUTER_API_KEY` is configured
- `POST /api/admin/creative/render-proof-reel` for local Remotion proof-reel rendering

This creative loop now splits by medium:

- image-heavy execution routes to Codex lanes rather than server-side paid image APIs
- video remains on the server-side/provider-based path

The creative system is intentionally proof-led:

- use only real Blueprint evidence
- do not imply deployment success
- do not invent customer logos, quotes, or traction

## Revenue Loop

Existing checkout, entitlement, and onboarding flows remain the source of truth.

This phase adds:

- stronger growth attribution feeding into the buyer path
- SendGrid-compatible email delivery support in `server/utils/email.ts`

## Voice Loop

Implemented surfaces:

- `VoiceConcierge` component on the hosted-review wedge
- `POST /api/voice/support/respond` for guardrailed voice support responses
- `GET /api/voice/agent/signed-url` for future ElevenLabs agent usage when configured
- `POST /api/voice/webhook` for external event persistence

Guardrails:

- no pricing quotes
- no legal/privacy/rights/security commitments
- route sensitive topics to humans

## Operator Loop

The new repo surfaces are designed to feed Paperclip and the existing autonomous org:

- growth events can be mirrored into Firestore for analytics-agent and growth-lead work
- voice conversations are persisted for support/growth review
- campaign-kit outputs give growth/community/demand agents reusable assets and prompts
- OpenAI operator-thread sessions can now call growth and creative execution tools through the Responses adapter, with the previous OpenAI response ID persisted across session messages

## Outbound And Lifecycle

Implemented surfaces:

- `/api/admin/growth/campaigns` for local campaign draft storage
- `/api/admin/growth/campaigns/:id/queue-send` for approval-gated SendGrid-backed campaign sends
- `/api/admin/growth/lifecycle/run` for approval-gated buyer lifecycle check-ins
- `/api/growth/webhooks/sendgrid` for SendGrid event ingestion when webhook delivery is configured
- `/api/growth/webhooks/sendgrid` remains the active delivery-event path
- `/admin/growth-ops-scorecard` for wedge, campaign, experiment, and queue summaries

## Required Config

- `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1`
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`

Optional:

- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_WEBHOOK_SECRET`
- `BLUEPRINT_VOICE_BOOKING_URL`
- `BLUEPRINT_SUPPORT_EMAIL`

Image-generation note:

- final image execution is not wired through a server-side image API in this phase
- use Codex desktop OAuth image generation on `gpt-image-1.5` through the `webapp-codex` lane
- keep screenshots and code in the same Codex workflow when iterating on visuals
