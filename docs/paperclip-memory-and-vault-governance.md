# Paperclip Memory And Vault Governance

Date: 2026-04-09

## Purpose

Define how Blueprint runtime memory and scoped vault grants should be used after runtime hardening.

## Memory Is Not Authority

Memory is supportive context.

Memory does not replace:

- repo doctrine
- Paperclip issue state
- Notion review outcomes
- provenance, rights, privacy, pricing, or buyer commitment truth

## Memory Scopes

### `doctrine_shared`

Repo-derived and read-only by default.

Used for:

- platform doctrine
- world-model strategy
- autonomous-org boundaries
- AI tooling and skills governance

### `project_shared`

Durable project context and reusable implementation knowledge.

Approved durable writes should include evidence or approval metadata.

### `agent_local`

Agent-specific reusable reminders and preferences.

### `session_scratch`

Ephemeral working memory for one run.

## Durable Write Rule

High-impact durable writes should not be created silently in sensitive lanes.

At minimum, `approved_durable` writes to `project_shared` require `approvalEvidence`.

## Vault Grants

Vault grants are scoped access records to existing Paperclip/company secrets.

They specify:

- who received access
- for which session or agent
- which refs were visible
- which tools were allowed
- when the grant expires or was revoked

## Default Policy

- prefer session-scoped grants
- keep allowed refs as narrow as possible
- log secret usage through runtime trace where available
- never write plaintext secrets into runtime memory
