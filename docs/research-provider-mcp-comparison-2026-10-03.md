# MCP research providers: integration and comparison

The lead saved research agent remains GPT-6.1 Sol. It reads authorized company
history and the robot-team directory, forms hypotheses, chooses research tools,
checks primary sources, and decides which findings to retain and publish.
Delegated reports are evidence inputs, not automatically approved CRM leads.

## Verified provider capabilities

| Provider | Agent-facing MCP | Use | Important boundary |
| --- | --- | --- | --- |
| Gemini Deep Research Max | Blueprint Work `/api/blueprint-work/mcp`: `start_gemini_deep_research`, `get_gemini_deep_research` | Investigate difficult multi-source questions | Blueprint adapter uses Google's Interactions API internally; this is not an official Google research MCP server. |
| Exa Agent | Official `https://mcp.exa.ai/mcp`, `agent_run` | Deep research, criterion-based list building, verification and structured enrichment | OAuth or an existing authenticated credential is needed for Agent. `runId` observes an existing task; `previousRunId` creates a paid follow-up. |
| Parallel Task | Official `https://task-mcp.parallel.ai/mcp`: `createDeepResearch`, `getStatus`, `getResultMarkdown` | Asynchronous deep research | Verify authenticated tool schema before passing a processor. Retain original task ID and poll instead of creating again. |
| Parallel Search | Official `https://search.parallel.ai/mcp` (free anonymous tier) or authenticated `https://search.parallel.ai/mcp-oauth`, `web_search`, `web_fetch` | Fast discovery and source extraction | Free anonymous access is for light use with limits. Separate connection from Task MCP; it is not part of this paid-task profile. |
| Parallel Find All | No official Find All MCP tool verified in current documentation | Build matching entity datasets | The documented Task MCP exposes research and task-group enrichment, not Find All. Do not invent a tool or silently switch to direct API calls. |

Exa Websets is a similar dedicated entity-list product. Current Exa docs recommend
Agent for new list-building and enrichment workflows; its official MCP supports
those through `agent_run`. Gemini can identify companies within a cited research
report, but no dedicated Find All equivalent was verified.

## Discovery sequence

1. Browse the actual directory and previous research/outreach outcomes. Distinguish
   demonstrated capabilities from announcements, aspirations and unknowns.
2. Select several promising task families across the directory, rather than
   anchoring all discovery to the first promising sector.
3. Use quick search to discover concrete organizations and operating sites.
   Delegate deeper research where it can resolve task fit, workflow or economics.
4. Turn good examples into explicit matching criteria: recurring task, site type,
   operating conditions, geographic scope and observable workflow signals.
5. Use Exa Agent's structured list-building workflow through MCP to find further
   candidates meeting those criteria. Find All remains a prospective option until
   an actual MCP tool is available.
6. Inspect primary-source evidence for strong candidates. Retain uncertain
   candidates in the shortlist, separate from eligible CRM/outreach records.

An operating-task match does not establish interest, ownership, budget, consent,
pilot commitment or willingness to pay. Similar websites are discovery seeds,
not qualification proof. A target count is a search objective, not permission to
invent companies or weaken evidence requirements.

## Matched comparison

Use the same retained directory/history snapshot, date cutoff, geographic scope,
questions, supplied source URLs and output requirements for each provider. Do not
give one provider the other's findings before comparing their independent results.

Choose hypotheses supported by the actual directory; possible task families are
machine tending, warehouse handling and commercial textile handling. These are
examples, not claims that the current directory demonstrates all three.

Run two distinct comparisons:

- **Deep investigation:** Gemini Max, Exa Ultra, and Parallel Task Ultra/Ultra8x
  answer the same questions about task/site categories, likely operating
  constraints and evidence-backed examples.
- **Entity discovery:** Exa Agent returns unique organizations/sites meeting
  explicit criteria. Compare Parallel Find All only after a real MCP tool is
  verified. Deep-report length is not a proxy for entity-list coverage.

Each result should retain provider task identity, request identity, raw output,
citations, timestamps, actual usage/cost receipts when present, and unknown
accounting when absent. Score verified unique candidates, coverage across task
families, primary-source support, false positives, stale/duplicate entities,
useful unknowns, latency and actual cost. Provider confidence and vendor benchmark
claims are not independent evidence that a candidate meets our criteria.

GPT-6.1 Sol can synthesize the retained results afterward. Its judgments should
cite the underlying source records and identify disagreements rather than treating
multiple providers repeating the same source as independent corroboration.

## Published pricing and execution limits

Prices below are documentation snapshots from October 3, 2026, not verified
invoice totals or permission to spend.

- Google estimates Gemini Max research at $3–$7 per task; maximum execution is
  60 minutes. The managed agent identifier is
  `deep-research-max-preview-04-2026`; the lead model cannot substitute itself as
  Max's internal model.
- Exa Ultra is usage-metered with a documented default $20 ceiling. Its API has
  budget controls; authenticated MCP schema must confirm what `agent_run`
  exposes before we claim an enforced MCP spending cap.
- Parallel documents Task Ultra at $0.30/run and Ultra8x at $2.40/run. Ultra8x
  can take up to two hours plus queue time. Processor selection through MCP must
  be verified against its actual authenticated schema.
- Parallel Find All is fixed-plus-per-match: preview $0.10; base $0.25 + $0.03
  per match; core $2 + $0.15 per match; pro $10 + $1 per match. Enrichment adds
  further cost. For example, 100 base matches cost $3.25 before enrichment.

Do not start all high-cost providers by default on each daily run. The lead can
choose tools within actual retained authority and allocation. A comparison must
account for the existing unknown usage holds; the robot-team budget is separate
from the existing combined research/communications budget.

Provider jobs may outlive the current agent turn. A pending job remains pending;
retain its identity and continue GET/status observation under supported runtime
authority. Do not extend frozen deadlines, create a replacement task, or report
completion because an observer stopped waiting.

## Local-owner acceptance gates

Cloud source work does not provision connections or prove live authentication.
The sole local release owner reviews and releases the paired source/package, then
uses existing runtime credentials and owner-controlled connections to verify:

1. The exact MCP server, tool catalog and accepted input schemas are accessible.
2. Saved connection credentials resolve to their existing vaults and are frozen
   in the new prospective run binding. Historical charged profiles remain intact.
3. The Gemini adapter has an actual owner-compatible OAuth/token connection;
   existing ChatGPT-only redirect registration does not establish Agents-service
   connectivity. Existing Google runtime key presence must be checked privately.
4. Actual company research control, allocation, expiry and request reservations
   admit the intended task. No API key or token appears in a PR, prompt or report.
5. An authorized matched comparison retains task IDs, full provider records,
   citations and available usage into company storage, with readback proof.

Cloud unauthenticated catalog probes on October 3 were refused with Cloudflare
1010/403. No paid tools or authentication were attempted. Official documentation
establishes catalog intent; authenticated live readback is still needed.

## Sources

- <https://ai.google.dev/gemini-api/docs/deep-research>
- <https://ai.google.dev/gemini-api/docs/interactions>
- <https://exa.ai/docs/get-started/exa-mcp>
- <https://exa.ai/docs/reference/agent-api-guide>
- <https://exa.ai/docs/reference/pricing>
- <https://exa.ai/docs/websets/api/overview>
- <https://docs.parallel.ai/integrations/mcp/task-mcp>
- <https://docs.parallel.ai/integrations/mcp/search-mcp>
- <https://docs.parallel.ai/getting-started/pricing>
- <https://docs.parallel.ai/findall-api/core-concepts/findall-generator-pricing>
