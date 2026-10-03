# Gemini Deep Research Max through Blueprint MCP

The lead agent remains 6.1 Sol. It chooses hypotheses, quick Perplexity searches,
substantial Gemini investigations, source verification and publication. Gemini
reports are cited research inputs, never buying-interest proof or authority to
publish, change access, or send mail.

Google's managed Deep Research supports MCP as a **client**. We have not verified
an official Google Deep Research MCP server. These two tools reuse Blueprint's
existing stateless HTTP MCP server at `/api/blueprint-work/mcp`. The adapter
**internally calls Google's Interactions API** with the existing
`GOOGLE_GENAI_API_KEY` / `GEMINI_API_KEY` configuration. It does not transfer keys
or MCP credentials to the lead agent, and does not replace the lead model.
The exact delegated engine is `deep-research-max-preview-04-2026`.

## Prospective admission (off until the local release owner activates it)

The existing `BLUEPRINT_WORK_ENABLED` transport flag is required. Research also
requires a separately retained `blueprintResearchMcp/control` document:

```json
{
  "enabled": false,
  "actorUid": "<verified operator uid>",
  "tenantId": null,
  "scopeRef": "<retained owner research scope>",
  "budgetRef": "<retained spending allocation for delegated research>",
  "expiresAt": "<actual authorized expiry in ISO UTC>",
  "dailySoftTargetMicros": 0,
  "reservationMicros": 0
}
```

This is a template, not an activation command: replace placeholders and zeroes
with the actual reviewed positive allocation before enabling. Neither a GPU
launch grant nor the existing named robot or research/comms budget automatically
admits these new paid delegations. The local owner must establish the actual
allocation and connection before a bounded comparison.

OAuth requires `blueprint:research:start` for delegation and
`blueprint:research:read` for observation. Existing grants are not upgraded.
The existing OAuth redirect allowlist remains ChatGPT-only. For saved Agents
service use, a trusted offline owner command now mints an app-owned research-only
grant directly in the same hashed OAuth store, without a callback or public mint
route. Actual saved authentication and tool use still require live owner receipts.

### Existing-vault owner onboarding

The local release owner uses existing runtime credentials and a dedicated existing
empty vault. Preview first (these are source examples, not executed commands):

```sh
npx tsx scripts/agents/setup-gemini-research-mcp.ts \
  --setup-key OWNER_REVIEWED_SETUP_KEY --vault-id EXISTING_VAULT_ID \
  --operator-uid VERIFIED_OWNER_UID --expires-at ACTUAL_OWNER_EXPIRY_UTC
```

Only add `--apply` after reviewing that concrete preview. Actual server-managed
operator role, current control actor/tenant/scope/budget, full dedicated-vault
inventory and explicit expiry are required. Expiry is clamped to the requested
expiry, actual control expiry and the existing 30-day OAuth grant bound, never
silently extended. Access tokens rotate through the existing 900-second path;
refresh remains research-only and is refused if the exact control changes or the
operator role is revoked. GPU scopes are never included.

A durable company setup claim precedes one credential registration. The original
setup key, vault, expiry and authority digest cannot change. On unknown response,
repeat observation of that original setup key performs GET-only exact singleton
metadata reconciliation; no repeated registration, new vault or remint occurs.
Plaintext OAuth tokens remain only in process memory and go directly to the
existing SDK's `mcp_oauth` registration. They are never printed, stored in public
metadata or written to secret files. SDK automatic retries/debug body logging are
disabled. Resource and refresh endpoint are server-owned; the exact OAuth resource
is also included in the vault refresh configuration.

The resulting safe credential/vault/grant metadata receipt is privately retained
and hash/readback verified. It proves configuration readback, **not authenticated
tool use**. The owner must then verify `tools/list`, appropriate scope refusal and
the intended saved-agent/vault attachment before a paid comparison. This command
never modifies existing saved agents, charged definitions or worker schedules.

## Agent use and recovery

Call `start_gemini_deep_research` with a Blueprint-owned `request_key` and the
research question. The durable actor-bound question hash and reservation are
claimed transactionally before exactly one background create. The control is
checked again before submission. Subsequent calls with the same key/question
observe that task. Changing its question is refused with repair feedback.

An HTTP error retains its actual status, parsed provider body and provider request
ID privately, bound to the original claim/question hash. Non-JSON error bodies
retain at most 64 KiB with exact retained bytes/base64 and an explicit truncation
flag. Missing configured Gemini key is refused before a new claim/reservation. Normal tool responses
expose only safe status/code and the private diagnostic receipt. Read the complete
diagnostic through the existing `provider_record` view; it does not reset a
claim, infer zero cost, or submit a correction automatically.

A lost create acknowledgement is observe-only; it never releases the original
reservation or submits another POST. If no provider ID was acknowledged, retain
the uncertainty and ask the owner to reconcile that original request. An archive
failure after an accepted provider ID can recover through GET without creating
another task. Reading an already-bound task remains available with the explicit
read scope when new-work controls stop or expire.

Call `get_gemini_deep_research` with that same key. `view: "report"` pages report
text, and `view: "provider_record"` pages the full retained provider JSON,
including grounding/citations and raw usage. Follow `next_cursor` until null.
Current `steps[].content` model-output text and legacy `outputs[].text` are
supported. Ordinary field errors return field names and repair descriptions.
Full source records stay intact regardless of tool-page length.

Claims, provider bindings, budget reservations and evidence receipts are private
company Firestore documents in `blueprintResearchMcp`. Complete decoded provider
responses are portable JSON at
`gs://blueprint-8c1ca.appspot.com/operations/research/gemini/<sha256>.json`.
Create-only object writes are generation-pinned, downloaded and hash-verified;
receipts contain SHA-256, bytes and generation. They are not signed public links.
Terminal observations can page those company copies without provider calls.

The admission ledger reserves exposure per America/Chicago calendar day. A
reservation is conservative exposure, **not a measured hard provider cap or an
invoice**. Raw token/search receipts are retained; unknown monetary totals stay
null and reserved. This implementation does not invent a Gemini pricing model,
refund unknown attempts, or claim complete billing. No deletion, mail sending,
Gmail copying, publication or recurring schedule activation is performed here.

## Verification performed

Focused offline cases cover one-create concurrency, uncertain acknowledgements,
actor/scope/expiry/default-off boundaries, reserve exhaustion, lost archive
recovery, complete report/citation paging and old/current response formats.
The existing HTTP MCP/OAuth boundary also verifies that GPU-only credentials
cannot submit research. No provider, storage, configuration or credential
operation was executed during source verification. Live quality, actual model
authentication and comparison against Exa remain separate evidence gates.
