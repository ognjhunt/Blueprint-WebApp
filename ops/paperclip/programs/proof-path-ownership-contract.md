# Proof-Path Ownership Contract

## Mission
Keep the production bridge truthful and explicit from inbound request to buyer-visible hosted review state.

This contract covers:
`inbound request -> request record -> pipeline attachment sync -> readiness evidence -> hosted review readiness -> buyer-visible state`

## Program Owner
`blueprint-cto`

CTO owns the contract, the cross-repo blocker map, and the rule that the bridge must fail closed instead of inventing proof readiness.

## Ownership By Step
- `Inbound request record`
  Owner: `webapp-codex`
  Truth source: Firestore request record and admin request surfaces
  Responsibility: request bootstrap, required identifiers, proof-path milestone fields, buyer-visible request state
- `Pipeline attachment sync`
  Owner: `pipeline-codex`
  Truth source: pipeline outputs attached through `/api/internal/pipeline/attachments`
  Responsibility: authoritative attachment payload shape, derived assets, readiness evidence, idempotent state-transition inputs
- `Proof-path state transition`
  Owner: `blueprint-cto` for contract; `webapp-codex` and `pipeline-codex` for implementation on their sides
  Truth source: `server/utils/pipelineAttachmentContract.ts`, `server/utils/pipelineStateMachine.ts`, and the Firestore request record
  Responsibility: no silent contract drift between repos
- `Hosted review readiness`
  Owner: `pipeline-codex` for evidence generation; `webapp-codex` for buyer-facing consumption
  Truth source: deployment readiness, derived assets, hosted readiness endpoints, site-world launch readiness
  Responsibility: readiness labels stay grounded in actual artifacts and runtime checks
- `Buyer-visible state`
  Owner: `webapp-codex`
  Truth source: WebApp admin and buyer-facing surfaces
  Responsibility: surface only what the request record, attachment state, and hosted readiness actually prove
- `Commercial journey state`
  Owner: `buyer-solutions-agent` plus the designated human commercial owner for standard commercial handling
  Truth source: Paperclip buyer journey issue plus Firestore request state
  Responsibility: translate technical truth into buyer-facing next step without inventing readiness, keep standard quotes and package progression inside approved commercial guardrails, and route only non-standard commercial asks upward
- `Technical proof plan inside the buyer thread`
  Owner: `solutions-engineering-agent`
  Truth source: live product, hosted-session surfaces, package/runtime artifacts
  Responsibility: convert proof-ready state into eval and integration guidance without taking over the commercial owner role

## Escalation Rules
- cross-repo contract ambiguity: `blueprint-cto`
- rights, privacy, provenance, or commercialization ambiguity: `rights-provenance-agent`
- buyer-facing wording that outruns evidence: `webapp-review` plus `buyer-solutions-agent`
- standard quote or package fit question inside approved bands: designated human commercial owner with `revenue-ops-pricing-agent` support
- missing request bootstrap or attachment identifiers: block the path instead of creating fake hosted-review readiness

## Non-Negotiables
- no buyer-visible readiness claim without request-record truth plus attachment evidence
- no commercial stage change based on memory or narrative only
- no shared “someone owns this” zone between WebApp and Pipeline
- no silent fallback that hides missing inbound bootstrap or missing hosted-review artifacts
