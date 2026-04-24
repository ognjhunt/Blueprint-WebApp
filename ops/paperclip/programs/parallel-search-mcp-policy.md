# Parallel Search MCP Policy

Status: active

Parallel Search MCP is Blueprint's governed read-only web search and fetch surface for research agents.

## Tool Configuration

The Blueprint automation plugin exposes:

- `web-search` for current web discovery
- `web-fetch` for token-efficient markdown excerpts from specific public URLs

Set the Paperclip runtime environment to use Parallel:

```bash
SEARCH_API_PROVIDER=parallel_mcp
```

No key is required for the free Parallel MCP endpoint. If Blueprint later needs higher rate limits or account attribution, set `PARALLEL_API_KEY`; the plugin will send it as a Bearer token for Parallel calls. Keep `SEARCH_API_KEY` reserved for non-Parallel providers such as Brave or Perplexity.

Deep Research harnesses can also attach Parallel directly:

```bash
export BLUEPRINT_DEEP_RESEARCH_MCP_SERVERS_JSON='[
  {
    "name": "parallel-search",
    "url": "https://search.parallel.ai/mcp",
    "allowed_tools": {
      "mode": "validated",
      "tools": ["web_search", "web_fetch"]
    }
  }
]'
```

Use `BLUEPRINT_CITY_LAUNCH_DEEP_RESEARCH_MCP_SERVERS_JSON` for city-launch-specific overrides.

## Use Order

1. Read the current Paperclip issue and local repo/KB context first.
2. Use `web-search` only for current external information, primary-source discovery, or source verification.
3. Use `web-fetch` after a URL is already identified, especially before drafting outbound, investor, community, procurement, or partnership claims.
4. Write durable findings back to the owning report, KB page, Notion artifact, or Paperclip issue.

## Truth Boundaries

- Web search is enrichment, not product truth.
- Web search must not invent capture provenance, rights state, recipient data, buyer readiness, hosted-session capability, commercial commitments, or deployment outcomes.
- Contact or recipient evidence must be explicit on a fetched page or already present in historical telemetry. Do not infer email addresses.
- Public-company, security, procurement, and investor claims must cite first-party/company/source documents where possible.
- City-launch scorecards and operating graph truth remain first-party ledgers and artifacts first; external search can add context but cannot close core proof gates.

## Agent Access

Default access:

- `market-intel-agent`: use every scheduled market brief after KB grounding.
- `demand-intel-agent`: use for robot-team buyer signals, proof requirements, communities, competitor/customer evidence, and procurement triggers.
- `city-demand-agent`: use during city planning and active launch windows.
- `city-launch-agent`: use for city activation evidence, local ecosystem discovery, and source verification.
- `supply-intel-agent`: use for capturer/source ecosystem research, not proof claims.
- `capturer-growth-agent`: use for public communities, capturer pools, and lawful-access candidate discovery.
- `site-operator-partnership-agent`: use for public operator/company context and partnership-surface research.

Conditional access:

- `robot-team-growth-agent`: only after demand intel names target accounts or patterns; verify live company/context claims before drafting.
- `outbound-sales-agent`: prefer `web-fetch` on known company/recipient URLs; no broad scraping or autonomous contact invention.
- `security-procurement-agent`: only for current vendor/security/docs verification; internal controls remain repo/runtime truth.
- `solutions-engineering-agent`: only for current vendor/docs/technical ecosystem verification; product capability remains live artifact truth.
- `investor-relations-agent`: fact-check external benchmark examples or outside events once per draft cycle.
- `community-updates-agent`: fact-check external references once per draft cycle.

## Cadence Caps

- Market intel: every scheduled brief, normally 5-10 searches and 3-5 fetches.
- Demand intel: 3x/week normally; daily during active city launch or active GTM push.
- City launch/city demand: initial planning and every 48-72 hours while active.
- Supply/capturer growth: weekly baseline plus per-city activation.
- Outbound/growth drafting: only when a source-backed validation step is needed.
- Investor/community/security/solutions: fact-check only; do not turn draft work into open-ended browsing.
