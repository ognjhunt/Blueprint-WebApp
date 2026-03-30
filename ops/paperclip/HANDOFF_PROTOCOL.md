# Agent-to-Agent Handoff Protocol

> Informed by [Google A2A Protocol](https://github.com/a2aproject/A2A) concepts, implemented natively within Paperclip's issue system.

## Overview

When one agent needs another agent to do work, it creates a Paperclip issue with a structured handoff comment. The receiving agent processes the request and responds with a structured completion comment. This protocol ensures no work is lost, every handoff is traceable, and agents have the context they need.

## A2A Concept Mapping

| A2A Concept | Paperclip Implementation |
|-------------|------------------------|
| Agent Card (capability discovery) | Agent capability tags in `.paperclip.yaml` + skill file headers |
| Task lifecycle states | Paperclip issue states: `todo` → `in_progress` → `done` / `blocked` / `cancelled` |
| Message parts (structured content) | Structured JSON in issue comments (schemas below) |
| Artifacts | Notion entries + Slack posts + issue comments with proof links |
| Push notifications | Paperclip routine triggers + webhook events |

## Handoff Request

When an agent creates an issue to hand off work to another agent, the **first comment** on the issue must be a structured JSON block:

```json
{
  "handoff": {
    "version": "1.0",
    "from": "<requesting-agent-key>",
    "to": "<receiving-agent-key>",
    "type": "<handoff-type>",
    "priority": "critical | high | medium | low",
    "context": {
      "summary": "<one-line description of what is needed>",
      "sourceIssueId": "<parent issue ID if applicable>",
      "relatedArtifacts": [
        { "type": "firestore | gcs | notion | github", "path": "<resource path>" }
      ]
    },
    "expectedOutcome": "<what the receiving agent should produce>",
    "deadline": "<ISO 8601 datetime, optional>",
    "responseSchema": {
      "<field>": "<expected type or enum>"
    }
  }
}
```

## Handoff Types

| Type | When to Use | Example |
|------|------------|---------|
| `work-request` | Requesting agent asks receiving agent to do work | Ops Lead → Capture QA: "Review this capture submission" |
| `escalation` | Agent encounters a problem it cannot solve | Finance → CEO: "Stripe payout failure above threshold" |
| `information-request` | Agent needs data from another agent | Growth Lead → Analytics: "Pull conversion metrics for last 7 days" |
| `status-update` | Agent reports status back to requesting agent | Capture QA → Ops Lead: "QA complete, PASS with notes" |

## Handoff Response

When the receiving agent completes the handoff, it:

1. Patches the handoff issue to `done` or `blocked`
2. Adds a structured response comment:

```json
{
  "handoff_response": {
    "version": "1.0",
    "from": "<receiving-agent-key>",
    "to": "<requesting-agent-key>",
    "sourceHandoffIssueId": "<this issue ID>",
    "outcome": "done | blocked",
    "result": {},
    "proofLinks": ["<URL to Notion page, Slack message, or other artifact>"],
    "followUpNeeded": false,
    "followUpReason": "<if followUpNeeded is true>"
  }
}
```

## Routing Rules

Each agent can only route to agents within its span of control:

| Agent | Can Route To |
|-------|-------------|
| **CEO** | CTO, Ops Lead, Growth Lead |
| **CTO** | webapp-codex, webapp-claude, pipeline-codex, pipeline-claude, capture-codex, capture-claude |
| **Ops Lead** | intake-agent, capture-qa-agent, field-ops-agent, finance-support-agent |
| **Growth Lead** | conversion-agent, analytics-agent, market-intel-agent, supply-intel-agent, capturer-growth-agent, city-launch-agent, demand-intel-agent, robot-team-growth-agent, site-operator-partnership-agent, city-demand-agent |

**Escalation** (upward routing) is always allowed:
- Any agent → their lead
- Any lead → CEO
- Any agent → CEO (for urgent/critical issues only)

## Required Fields

Every handoff issue must have:
- **Title:** `[Handoff] <type>: <summary>` (e.g., `[Handoff] work-request: QA review for capture cap-abc123`)
- **Priority:** Inherited from the handoff JSON, or `medium` if not specified
- **Assignee:** The `to` agent from the handoff JSON
- **First comment:** The structured handoff JSON

## Lifecycle

1. Requesting agent creates issue with handoff comment → issue status: `todo`
2. Receiving agent picks up issue → patches to `in_progress`
3. Receiving agent completes work → patches to `done` with response comment
4. If blocked → patches to `blocked` with exact reason in response comment
5. If follow-up needed → receiving agent creates a new handoff issue

## Rules

- Never leave a handoff issue without a terminal state (`done` or `blocked`)
- Always include proof links in the response (Notion pages, Slack posts, file paths)
- If a handoff is blocked, the `handoff_response.result` must contain the exact reason and what is needed to unblock
- Do not chain more than 3 handoffs deep without escalating to a lead
- Handoffs must be completed within the receiving agent's next scheduled run, or escalated

## Future: External A2A Compliance

When Blueprint needs external agent interop, each Paperclip agent can be exposed as an A2A-compatible endpoint by:
1. Generating Agent Cards from `.paperclip.yaml` agent definitions
2. Mapping Paperclip issue lifecycle to A2A Task states (`todo` → `working`, `done` → `completed`, `blocked` → `input-required`)
3. Wrapping the handoff JSON schema as A2A Message parts
4. Exposing A2A JSON-RPC endpoints that create Paperclip issues internally

This is not needed now but the schema is designed to be forward-compatible.
