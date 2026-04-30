# Agentic Spend Control Plane ADR

Date: 2026-04-30

Status: implemented as sandbox/manual scaffold; live money disabled.

## Context

Stripe announced agent payment primitives at Sessions 2026, including the Link wallet for agents, Issuing cards for agents, machine payments, shared payment tokens, and a Stripe MCP surface. These are useful for Blueprint, but only as payment rails underneath Blueprint's existing city-launch truth layer.

Blueprint's target workflow is still: give the organization a city and a budget, then let the harness delegate reversible work until a real-world launch can happen. Spend is part of that loop, but spend cannot outrun capture provenance, lawful access, recipient evidence, launch proof, or founder-approved budget envelopes.

Existing repo surfaces already provide the policy base:

- `server/utils/cityLaunchPolicy.ts` defines city budget tiers and operator auto-approval caps.
- `server/utils/cityLaunchLedgers.ts` records city budget events.
- `server/routes/admin-growth.ts` exposes city-launch ledger records.
- `docs/founder-inbox-contract-2026-04-20.md` gates irreversible budget decisions outside the written envelope.

## Decision

Implement a Blueprint spend-control layer now, in test/manual mode only.

Agents may request spend through one governed surface. Deterministic code decides whether the request is inside the written envelope, requires founder approval, or is denied. Provider adapters may record manual/test/sandbox provider requests, but they never return raw card credentials to agents. Live Stripe Issuing remains fail-closed until explicit access, webhook reconciliation, sandbox tests, and kill switches are verified.

## Implemented Shape

The control plane has four layers:

1. `agentSpendPolicy`: pure deterministic policy checks.
2. `agentSpendLedger`: Firestore-backed request ledger in `agentSpendRequests`.
3. `agentSpendProviders`: disabled-by-default provider adapters.
4. `blueprint-request-spend`: Paperclip-facing tool for agent requests.

Spend request statuses:

`requested -> policy_approved -> provider_requested -> credential_issued -> paid -> reconciled`

Additional statuses:

`denied`, `expired`, `requires_founder_approval`

Provider adapters:

- `manual`: ledger-only; no credential request.
- `link_cli_test`: test placeholder; requires `AGENT_SPEND_LINK_CLI_TEST_ENABLED=1`.
- `stripe_issuing_sandbox`: sandbox placeholder; requires `AGENT_SPEND_STRIPE_ISSUING_SANDBOX_ENABLED=1`.
- `stripe_issuing_live`: always denied in this scaffold.

## Policy Rules

The deterministic policy checks:

- city budget envelope and existing committed spend
- per-transaction operator cap
- category allowlist
- vendor allowlist
- issue or run provenance
- evidence references for outbound, community, field-ops, and travel spend
- founder approval requirement for any out-of-envelope or unapproved-budget-envelope request

The policy does not use LLM judgment for approval.

## Non-Goals

This implementation does not:

- install Link or Stripe spend tools across all agents
- issue live cards
- expose raw card credentials to Hermes, Codex, Claude, shell sessions, or Paperclip agents
- let prompt text approve budget decisions
- bypass rights, lawful access, recipient evidence, launch proof, or founder gates
- treat a provider authorization as proof that a real buyer, capturer, or city-launch outcome exists

## Live-Money Preconditions

Before enabling live Stripe Issuing or Link-backed spend, Blueprint must have:

- confirmed Stripe Issuing or Link agent access for the intended account
- webhook reconciliation for authorization, capture, refund, dispute, and failure events
- sandbox tests covering approval, denial, expiration, reconciliation, duplicate events, and kill-switch behavior
- a founder-approved first budget envelope for a specific city
- an emergency live-spend disable switch
- proof that no raw credentials are logged, persisted in agent transcripts, or returned to tool callers

## References

- [Stripe: Giving agents the ability to pay](https://stripe.com/blog/giving-agents-the-ability-to-pay)
- [Link for agents](https://link.com/agents)
- [Stripe docs: Issuing cards for AI agents](https://docs.stripe.com/issuing/agents)
- [Stripe docs: Machine payments](https://docs.stripe.com/payments/machine)
- [Stripe docs: Shared payment tokens](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens)
