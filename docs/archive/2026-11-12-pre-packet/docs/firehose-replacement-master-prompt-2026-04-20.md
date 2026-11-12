# Firehose Replacement Master Prompt

Use this prompt at the start of the next session.

---

You are working in `/Users/nijelhunt_1/workspace/Blueprint-WebApp`.

This is an implementation session, not a brainstorm-only session. The target is to remove Firehose as a required research/outbound dependency in the WebApp runtime by replacing the direct Firehose usage in `server/utils/autonomous-growth.ts` with a provider abstraction and a deterministic web-search-backed adapter.

Read these files first, in this order:

1. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
2. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`
3. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md`
4. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/BLUEPRINT_AUTOMATION.md`
5. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/autonomous-org-cross-repo-operating-graph-2026-04-20.md`
6. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/founder-inbox-contract-2026-04-20.md`
7. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/company-metrics-contract-2026-04-20.md`
8. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/superpowers/plans/2026-04-20-autonomous-org-unification-program.md`

Then inspect these repo files before changing code:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/autonomous-growth.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/provider-status.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/launch-readiness.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/cityLaunchExecutionHarness.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/cityLaunchScorecard.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/cityLaunchCapabilityState.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation/src/marketing-integrations.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/tests/autonomous-growth.test.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/tests/city-launch-scorecard.test.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/tests/city-launch-autonomy-regression.test.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/config/env.ts`

## Current repo truth you must preserve

- Firehose is not core product truth.
- Firehose is currently only used as an external signal feed for research/growth/outbound enrichment.
- City-launch truth and scorecards must continue to work from first-party ledgers and artifacts even when Firehose is absent.
- The replacement should be deterministic enough for scheduled automation. Do not replace Firehose with a purely free-form, prose-only deep research step as the primary scheduled mechanism.
- If richer research is useful, it should happen after signal discovery, not instead of signal discovery.

## What was already established in the prior session

The prior session concluded:

- Firehose can be turned off for city-launch truth immediately.
- The correct replacement shape is a provider abstraction, not more hardcoded vendor usage.
- The first replacement should be a deterministic web-search-backed provider.
- A deep-research provider may exist later, but only as secondary enrichment.

The prior session also executed a broader autonomy foundation pass:

- Phase 0 docs were added:
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/autonomous-org-cross-repo-operating-graph-2026-04-20.md`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/founder-inbox-contract-2026-04-20.md`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/company-metrics-contract-2026-04-20.md`
- Existing org docs were updated:
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/BLUEPRINT_AUTOMATION.md`
- Operating graph primitives were added:
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraph.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraphProjectors.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/operatingGraphTypes.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/tests/operating-graph.test.ts`
- Founder inbox schema was expanded:
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/human-blocker-packet.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/human-blocker-dispatch.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/human-reply-store.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/internal-human-blockers.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/tests/universal-founder-inbox.test.ts`
- Gap closure and company metrics scaffolding were added:
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/gap-closure.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/internal-gap-intake.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/tests/gap-registry.test.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyMetrics.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/companyScoreboard.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/admin-company-metrics.ts`
  - `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/tests/company-metrics.test.ts`

You do not need to re-implement those foundations. Build on top of them.

## Your task

Implement a Firehose replacement program with these concrete goals:

1. Turn Firehose off as a required dependency for `autonomous-growth.ts`.
2. Introduce a provider abstraction for external market signals.
3. Add a deterministic web-search-backed provider as the default replacement.
4. Keep the Firehose provider only as an optional adapter if still present.
5. Ensure city-launch scorecards and autonomy certification continue to treat missing external signals as enrichment-only, not core truth.
6. If you add a deep-research provider, make it secondary enrichment only, never the primary scheduled discovery path.

## Recommended implementation shape

Create a new abstraction around external signal discovery. Something like:

- `server/utils/marketSignalProviders.ts`
- `server/utils/marketSignalProviderFirehose.ts`
- `server/utils/marketSignalProviderWebSearch.ts`

The exact filenames can differ if there is a better repo-local pattern, but the architecture should:

- separate the provider interface from provider implementations
- normalize all providers into one stable signal record
- support deterministic topic-based polling
- support dedupe and caching/persistence
- keep source provenance on every signal
- allow `provider-status.ts` and `launch-readiness.ts` to report readiness truthfully

The normalized signal record should preserve the minimum useful shape already implied by `autonomous-growth.ts`:

- stable id
- topic
- title
- summary
- url
- source
- publishedAt

It is acceptable to add extra normalized fields if they are useful, but do not make the downstream consumer depend on rich provider-specific output.

## Guardrails

- Do not make web search or deep research a source of product truth.
- Do not block city-launch scorecards, operating graph events, or company metrics on external signal availability.
- Do not invent external signals.
- Do not add a vague research pipeline that returns prose without structured normalized records.
- Do not reintroduce Firehose as a hidden hard dependency through provider-status or readiness gates.
- Keep first-party ledgers primary.

## Specific things to inspect and likely change

- `server/utils/autonomous-growth.ts`
  - replace direct Firehose config usage with a generic provider selection and normalized signal read path
- `server/utils/provider-status.ts`
  - stop treating Firehose as the special research outbound provider; instead report which signal provider is configured and whether it is optional
- `server/utils/launch-readiness.ts`
  - ensure autonomous research outbound does not imply Firehose specifically; it should depend on signal-provider availability if the lane is enabled
- `server/utils/cityLaunchExecutionHarness.ts`
  - verify Firehose stays warning-only in capability and certification paths
- `server/utils/cityLaunchScorecard.ts`
  - preserve the current first-party fallback behavior
- `server/config/env.ts`
  - add any new env vars needed for a web-search provider
- `ops/paperclip/plugins/blueprint-automation/src/marketing-integrations.ts`
  - inspect for reusable query-building or normalized search helpers before duplicating logic

## What “done” looks like

- `autonomous-growth.ts` no longer hardcodes Firehose as the only provider
- a deterministic web-search provider exists and can power signal discovery
- Firehose, if still supported, is optional and behind the same abstraction
- readiness/provider-status surfaces no longer imply Firehose is mandatory
- tests cover:
  - web-search provider normalization
  - provider selection
  - missing-provider fail-open behavior for non-core surfaces
  - autonomous-growth draft generation through the normalized provider interface
  - city-launch scorecard fallback remains first-party truthful

## Verification you should run

At minimum, run:

```bash
npx vitest run \
  server/tests/autonomous-growth.test.ts \
  server/tests/city-launch-scorecard.test.ts \
  server/tests/city-launch-autonomy-regression.test.ts \
  server/tests/company-metrics.test.ts
```

And:

```bash
npm run check
```

And because code files were changed:

```bash
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

## Important current-state note about env-sensitive tests

In the prior session, some repo tests were sensitive to a locally invalid `FIREHOSE_BASE_URL`. If needed during verification, sanitize that env explicitly rather than misdiagnosing the code:

```bash
FIREHOSE_BASE_URL=https://example.com npx vitest run server/tests/gap-registry.test.ts
FIREHOSE_BASE_URL=https://example.com npm run check
```

Use that only where needed to avoid local shell drift breaking otherwise-correct verification.

## Deliverable format

When you finish, answer with:

1. What provider abstraction you introduced
2. Whether Firehose is still supported, and if so in what optional role
3. Exactly which files changed
4. Which tests passed
5. Any remaining gaps or follow-up work

## Bias for this session

- Prefer a minimal, clean provider abstraction with a deterministic web-search adapter.
- Prefer using existing repo search/research utilities if they already fit.
- Prefer additive refactors over broad rewrites.
- Prefer truthful degradation over pretending external signals exist.

If you need a one-sentence goal to keep centered:

**“Make external signal discovery provider-agnostic, default to deterministic web search, and keep all core city-launch/product truth independent of Firehose.”**

