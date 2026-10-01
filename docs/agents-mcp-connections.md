# Agents API connections: prepared setup and secure consent

Owner-directed preparation, 2026-10-01. Default project
`proj_F2tFJuxLaovJru8RrtXRaqNj`; research stays on GPT-6.1 Sol and communications
on GPT-6 Luna. The verified disabled worker release is
`614780173940f9a35cbdbca5f683b2b1f531f5e0`. No grants, vault credentials, saved-agent
changes, paid sessions, sends or activation are part of this preparation.

Use official HTTP MCP from the Agents service with reusable vault OAuth. Service
origin does not need to enable network in the research sandbox. Attach the actual
vault through session `vault_ids`, select the exact `credential_id`, use explicit
`allowed_tools`, and require initialization. Never put OAuth tokens in agent
definitions, prompts, archives, CLI arguments, logs, or connection receipts.
ChatGPT app OAuth does not establish an Agents API connection.

## Exact tool coverage and boundaries

| Connection | Official endpoint | Prepared access | Remaining operation |
| --- | --- | --- | --- |
| Notion | `https://mcp.notion.com/mcp` | `notion-get-tool-access`, `notion-search`, `notion-fetch` | Native `notion-create-pages`/`notion-update-page` exist, but are excluded because direct calls do not enforce Blueprint's QA packet/target/digest guards. |
| Gmail | `https://gmailmcp.googleapis.com/mcp/v1` | `get_message`, `get_thread`, `search_threads`; draft profile adds `create_draft`, `list_drafts` | No native MCP send tool. Keep the existing outreach review, approval and send boundary; never attach a direct send MCP. |
| Drive (optional) | `https://drivemcp.googleapis.com/mcp/v1` | `get_file_metadata`, `read_file_content`, `search_files` | No Sheets range read/update tool. Drive connection alone cannot certify complete Prospects deduplication or update CRM cells. |

Do not connect Drive just to fix Sheets. Canonical CRM uses the existing exact
Prospects read with the worker's service account. On October 1 at 01:19:46 UTC,
after the owner's explicit Viewer-only grant on the canonical Sheet, the existing
Render identity returned HTTP 200, valid headers, 16 total rows and 11 data rows,
with a complete read. The principal is
`firebase-adminsdk-yu1gh@blueprint-8c1ca.iam.gserviceaccount.com`.
The owner and Restricted sharing remain unchanged. No Editor grant exists;
publication writes are still unverified. Preserve this working reader and identity.
Sheets updates remain behind a Blueprint target/column and duplicate-check
boundary. An authenticated Google grant may be reused only after its account,
scope and target access are verified; broader privilege is not inferred.

Notion's native write tools do not by themselves solve guarded publication.
Agents vault GETs never return secrets, so a vault-only grant also does not make
the worker's existing Notion API publisher authenticated. No worker Notion binding
is currently verified. Reuse an existing Blueprint-authorized publication binding
if found; otherwise obtain explicit approval for the smallest secure binding to
the existing publication boundary. Do not copy chat OAuth or claim readiness.

## Observed UI and the smallest owner steps

The authenticated Platform UI was inspected in Blueprint Default on 2026-10-01:
research had only web search, vault said "No secrets yet", saved Notion/Drive
selectors were empty. Setup > Hosted tools > View all exposes these official
endpoints and token/saved-connection/advanced-OAuth fields. No automatic consent
redirect was verified. These observations are not permission to save a token.

1. Verify an approved OAuth client/secure callback path before consent. The
   supported Agents API path stores a resulting `mcp_oauth` grant with refresh
   configuration in a project vault. The application handles provider consent;
   Platform fields alone do not prove a working login flow. Prefer an existing
   supported client flow; do not create a second OAuth implementation by default.
2. For Notion, the workspace owner chooses the Blueprint workspace and intended
   accessible knowledge/result pages in the official consent flow. Verify the
   connection's actual tools/access map and complete canonical page reads.
   Notion rotates refresh tokens; verify the supported refresh configuration
   persists each new token before relying on unattended use.
3. Google Drive/Gmail remote MCPs require Workspace Developer Preview membership,
   the corresponding existing Google Cloud project/APIs and OAuth configuration.
   Verify these prerequisites read-only before requesting access changes. Gmail
   read profile requests `gmail.readonly`; the documented draft profile requests
   `gmail.readonly` plus `gmail.compose`. Compose grants API send authority as well
   as drafts, so the owner must review that scope even though this MCP has no send
   tool. Communications owner handles the approved mailbox and secure grant;
   never replace personal operations Gmail. Optional Drive requests only
   `drive.readonly`; do not add Drive writes for Sheets.
4. Only after explicit owner approval, complete secure consent and save the grant
   through the supported project-vault route. No keys/tokens go into chat. Record
   only project/vault/credential IDs, account hash, reviewed scope names, exact
   endpoint, consent receipt and authenticated tool inventory.

### Verified Google prerequisites and supported API route

The owner inspected existing project `blueprint-8c1ca` (display `blueprint-dev`,
number `744608654760`). Standard Drive/Gmail APIs are enabled; their MCP APIs are
disabled, and preview enrollment is unverified. The preview application rejects
the signed-in personal Gmail account: use the founder's Workspace account and
register the existing project only after approval. No API enablement or enrollment
was performed. This blocks immediate Google MCP setup, not the standard APIs.

The existing OAuth app is External/Testing with only `gmail.readonly`; the intended
founder account is absent from test users. Two web clients have no redirects; a
third has only OAuth Playground's redirect. None is a verified production callback
for this workflow. Do not create another client or treat Playground as the runtime.

External Testing refresh grants with Gmail scopes expire after seven days. For
durable communications, the owner must approve either an appropriate production
OAuth app (and required scope verification) or a valid Internal Workspace app in
an organization-owned project. Internal eligibility for this project is unverified.
The communications owner prepares the exact mailbox, callback, scopes and existing
send-gate boundary before requesting secure consent. This document requests no
additional scopes, clients, grants or API enablement.

The supported first path is the already-enabled standard APIs: retain the now
verified service-account Sheets reader; keep agent-owned QA and digest-bound
publication behind Blueprint's existing delivery boundary; use the communications
owner's standard Gmail adapter behind the live approval gates. Native MCP remains
prepared for later enrollment. A Viewer reader cannot publish; separate scoped
publication authority and a Notion worker binding still need owner approval and
read-only verification before any write. No runtime step requires dot.

## Reusable configuration preparation

`server/agents/mcp-connections.ts` exports `prepareMcpConnections`. Roles are
`researcher`, `communications_reader`, `communications_drafter`, and optional
`drive_reader`. It validates nonsecret connection observations, rejects extra
fields, stale/future receipts, endpoint/project drift, missing tools and excessive
Google scopes. It emits additive MCP entries and session vault attachments.
It never calls an SDK/network, saves an agent, grants access or activates anything.
`status=prepared_only` and readiness/activation/send/publication remain false:
operator observations are attestations, not independently verified live proof.

Offline use, after actual read-only verification has produced a private receipt:

```bash
npx tsx scripts/agents/prepare-mcp-connections.ts researcher /PRIVATE/connection-observations.json
```

Each array entry has `schema_version=blueprint.mcp-connection-observation.v1`,
`project_id`, `server` (notion/drive/gmail), `vault_id`, `credential_id`,
`auth_type=mcp_oauth`, `credential_server_url`, `refresh_configured=true`,
`provider_account_sha256`, opaque `consent_reference`, UTC `observed_at`,
actual `verified_tools` and reviewed `granted_scopes`. The tool emits no secret or
raw rejected input. Receipts must be at most one day old. These are preparation
inputs, never runtime permission certificates.

Append the prepared entries only after reviewing the current saved definition;
preserve its native web search, instructions, hosted template and skills. The
pinned daily runner currently permits only web-search tools and has no
`vault_ids` session attachment. It intentionally still refuses MCP-modified
researchers. A reviewed exact-profile guard/payload change and a new instruction
pin are required before applying the setup. This preparation does not weaken that
guard or replace the reviewed portable package. Communications owns its runtime
adapter and must consume this contract without overwriting research worker code.

Research QA/publication consumes the existing durable snapshot/work-item and
digest-bound delivery/receipt contract in `docs/daily-research-render-integration.md`.
Agents own QA, duplicate checks and publication; dot only observes. Before canary,
resolve the file-discovery preflight correction, guarded publication bindings and exact cleanup history. The previously unclassified
smoke session was verified idle with one completed root turn and no environment;
retain its exact receipt rather than deleting it or treating other unknown sessions
as clear. The matching portable package now executes automatic same-session QA
and fixed-target standard-API publication; MCP enhancements are deferred. Empty dated ledger
does not prove that cleanup is clear. Writes, paid canary, old-trigger cutover and
activation each require their existing authority; keep both research controls off.

Sources: [Agents MCP](https://developers.openai.com/api/docs/guides/agents-api/tools/mcp),
[vault OAuth](https://developers.openai.com/api/docs/guides/agents-api/tools/vaults),
[Notion tools](https://developers.notion.com/guides/mcp/mcp-supported-tools),
[Notion client OAuth](https://developers.notion.com/guides/mcp/build-mcp-client),
[Drive tools](https://developers.google.com/workspace/drive/api/reference/mcp),
[Drive setup](https://developers.google.com/workspace/drive/api/guides/configure-mcp-server),
[Gmail tools](https://developers.google.com/workspace/gmail/api/reference/mcp),
[Gmail setup/scopes](https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server).
OAuth durability: [Testing expiry](https://developers.google.com/identity/protocols/oauth2),
[Internal and production verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).
