# Contact proof from agent research and trusted retrieval evidence

Status: proposed design; no implementation or release authorization. Reviewed
source snapshot: 2026-10-04, 17:32 UTC (latest WebApp batch head checked at 17:30 UTC).

## Decision and program scope

Recommend **C: agent-owned navigation and contact selection, trusted rendered
retrieval evidence, and a thin deterministic contact gate**. Retire the bespoke
HTML/CSS contact parser from new-proof production only after a qualified receipt
producer and both repository consumers pass the migration gates below. A model
may suggest a contact; only a trusted tool observation plus the existing
business and permission checks may admit it for a draft.

This supports **ADP-010 partner discovery and admission, partner-phase day-7**:
identify a suitable partner with a bounded task, two runnable candidates,
holdout authority and rights. A contact proof removes one discovery obstacle;
it does not meet partner admission, establish rights or finish the day-7 gate.
See the [pinned ADP-010 backlog](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/aae6c5ad8d8b035682a1190eeedcebb7705cffcb/docs/arm_decision_proof_v1/IMPLEMENTATION_BACKLOG.md)
and [partner clock](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/aae6c5ad8d8b035682a1190eeedcebb7705cffcb/docs/arm_decision_proof_v1/README.md).

The observed blocker is architectural: contact recovery already uses the
research agent, but the terminal proof reconstructs static page visibility in
WebApp. Successive rules for hidden text, CSS, tree construction and shadow DOM
increase maintenance while retaining a non-rendered evidence ceiling. Existing
infrastructure supplies discovery, receipt retention, CRM publication, spend
and draft controls; it does not supply the rendered attestation specified here.
The smallest reversible change now is this single design note and draft PR.
A later completion artifact would be a versioned cross-repo contract, retained
synthetic adversarial results, a qualified producer pin and a rollback rehearsal.

Sending and automatic first contact remain off. The target posture is
**draft-only**, with current draft permission checks intact. This note authorizes
no parser rewrite, package rebuild, merge, deployment, model session, paid
retrieval or canary. Examples are synthetic; no private prospects, mailbox
contents, credentials or private run evidence belong in this document or PR.

## What was inspected: main, proposed branch and live are different

| Repository surface | Exact commit | Observed status |
| --- | --- | --- |
| WebApp remote `main`; design branch base | `353b0e3715ff59a9bdf7a984c861ece8302306f4` | Current main when inspected; includes #847. |
| WebApp [#848](https://github.com/ognjhunt/Blueprint-WebApp/pull/848) | `3b550ab512414e437d1ad58a46381b71959bba9d` | Open draft into main; contact recovery, static visibility and lead-verification batch. |
| WebApp [#846](https://github.com/ognjhunt/Blueprint-WebApp/pull/846) | `bd20c0b8db9e8b3e647c79d01cc729ed747fa2cf` | Open draft; recovery proposal referenced by the batch. |
| Pipeline remote `main` | `4474b9c18d464e376955d39dbc9ab73d016c74d2` | Current main when inspected. |
| Pipeline [#2549](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2549) | `aae6c5ad8d8b035682a1190eeedcebb7705cffcb` | Open into main. #2584 and #2585 merged into this integration branch, not main. |
| Pipeline [#2584](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2584) | Head `dd8b00e8f8d45c952b9b4abc2e73fca5f4f683a5`; merge `70d6f53735d965c768ea44f4aed0442fc4a3feb3` | Merged into the #2549 branch. |
| Pipeline [#2585](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2585) | Head `57eb292db66d07594a2085d872119c30978750f6`; merge `aae6c5ad8d8b035682a1190eeedcebb7705cffcb` | Merged into the #2549 branch. |
| Packaged Pipeline source in WebApp #848 | `aae6c5ad8d8b035682a1190eeedcebb7705cffcb` | `vendor/daily-research/receipt.json` records this source commit. Package provenance alone does not prove deployed bytes. |
| Live services | Unverified in this design task | Owner reports the existing live package is preserved. No runtime state, credentials or private execution evidence was inspected. No main/branch SHA is asserted to be live. |

All analysis below uses the #848 and #2549 pins, not dirty primary checkouts.
Active branches and releases stay with their current owners. The separate
managed-harness inventory owns broader Pipeline capability overlap; this note
owns contact proof only.

At 17:22 UTC the owner relayed additional parser-review findings: a 127-byte
nested CSS input amplifying selector length by approximately ten times per
`&` nesting level and crashing the worker; a trailing invisible format
character allowing a shorter email token to be extracted; CSS
`unicode-bidi:bidi-override` reversing painted order; a reported 3.6-second
250-rule case; and proposed 512-attribute/token-cache and selector-length
budgets. The latest pinned WebApp head adds the 512-attribute cap, 4,096-character
selector-length refusal, per-element token caching, trailing format/control
edge rejection and bidi-override exclusion. Those source changes were inspected
read-only; the reported crash/timing measurements were not reproduced. Per-axis
offset thresholds (-200px horizontal, -500px vertical, extreme 5000px), while
preserving ordinary centering and -100px margins, are **heuristics, not rendered
visibility proof**. They belong in the qualification corpus for all alternatives;
this design does not apply further parser repairs or adopt thresholds as truth.

Current contracts at those pins:

- WebApp [`communications-contact-resolution.ts`](https://github.com/ognjhunt/Blueprint-WebApp/blob/3b550ab512414e437d1ad58a46381b71959bba9d/server/agents/communications-contact-resolution.ts)
  uses outer `blueprint.contact-resolution.v1`, extractor
  `blueprint.public-contact-text.v2` and explicit
  `visibilityBasis=static_text_css_not_rendered`. It retains raw page bytes,
  URLs, redirects, timestamps, byte counts and digests, reconstructs eligible
  segments, excludes element-boundary address splicing, and reruns extraction
  and QA binding in `verifyContactResolution`.
- [`communications-contact-visibility.ts`](https://github.com/ognjhunt/Blueprint-WebApp/blob/3b550ab512414e437d1ad58a46381b71959bba9d/server/agents/communications-contact-visibility.ts)
  implements static CSS approximations and bounded selector matching. The
  resolution module uses parse5 tree construction, excludes non-rendered
  containers and suppresses declarative-shadow hosts whose composed content
  it cannot determine. Browser-equivalent tree construction is not rendering.
  These two files are 346 and 371 lines respectively at the pin; that is a
  bounded source-size observation, not a measured performance comparison.
- [`communications-contact-evidence.ts`](https://github.com/ognjhunt/Blueprint-WebApp/blob/3b550ab512414e437d1ad58a46381b71959bba9d/server/agents/communications-contact-evidence.ts)
  owns literal address matching, business-route labels, restricted inboxes,
  prohibitions, organization/site scope and unresolved permission checks.
  [`communications-contact-fetch.ts`](https://github.com/ognjhunt/Blueprint-WebApp/blob/3b550ab512414e437d1ad58a46381b71959bba9d/server/agents/communications-contact-fetch.ts)
  restricts HTTPS destinations, validates all resolved addresses and pins the
  selected public IP to the actual TLS request, with bounded redirects/time/bytes.
- Pipeline [`search.py`](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/aae6c5ad8d8b035682a1190eeedcebb7705cffcb/tools/daily_research/search.py)
  `source()` records requested/final URL, raw digest, extracted text, redirects,
  check time and `truncated=false`, but explicitly declares
  `complete_static_extracted_text_not_javascript_rendered`.
  [`contact_research.mjs`](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/aae6c5ad8d8b035682a1190eeedcebb7705cffcb/tools/daily_research/contact_research.mjs)
  admits only that scope from exact successful, acknowledged
  `blueprint_read_source` research-turn results, with retained result-byte,
  request, turn/call, timestamp, operator and publication bindings. It does
  **not** currently admit rendered receipts. Discovery yields verified source
  URLs, which WebApp fetches and parses again.
- [`communications-research.ts`](https://github.com/ognjhunt/Blueprint-WebApp/blob/3b550ab512414e437d1ad58a46381b71959bba9d/server/agents/communications-research.ts)
  and [`communications-first-contact.ts`](https://github.com/ognjhunt/Blueprint-WebApp/blob/3b550ab512414e437d1ad58a46381b71959bba9d/server/agents/communications-first-contact.ts)
  reverify publication/contact relationships at draft and send boundaries.
  Replay of retained bytes is not a fresh live-page check.

## Necessity check and alternatives

The parser is necessary for the **current static-v2 contract**, not an enduring
product requirement. Keep deterministic source integrity, business suitability
and permission gates. Delegate layout, CSS cascade, JavaScript and composed DOM
to a supported browser or qualified existing extraction tool. Do not recreate
those systems inside the contact gate.

| Dimension | A: existing static parser | B: supported headless browser inside communications worker | C: research agent plus trusted retrieval receipt and thin gate |
| --- | --- | --- | --- |
| Hidden/honeypot addresses | Conservative rules exclude known patterns; external styles, scripts, layout and composed DOM remain incompletely observed. | Browser computes the actual page state; plain `innerText`, ARIA snapshots or `isVisible()` still do not prove the address is readable or suitable. | Same browser evidence requirement as B, but navigation/alternatives stay with the research agent. Tool attests observation; gate checks suitability. |
| Draft/send reverification | Reparse identical raw bytes deterministically; separate freshness needed. | Browser rerun at every gate is costly and nondeterministic. Persisted snapshots still require digest and permission checks. | Replay authenticated retained content deterministically without browser/model calls; separately request a fresh receipt when action policy requires one. |
| Worker CPU/memory | No browser; bounded parse costs, source buffers and expanding rule budgets remain. | Browser binaries, renderer processes, fonts, shared memory and patching compete with existing worker duties. | Browser cost moves to an isolated retrieval boundary; it does not disappear. Thin WebApp gate verifies bounded bytes/ranges. Research/tool budget admission remains required. |
| Third-party JS/security | No page script execution; existing network controls are comparatively narrow. | Full hostile-page execution near operational credentials is unacceptable; requires process isolation and enforced egress. | Prefer existing isolated, credential-free tool infrastructure with qualified controls; reject unqualified hosted tools instead of trusting a model label. |
| Code and maintenance | Static browser emulation expands with each newly observed rendering edge. | Less CSS/parser emulation; more browser lifecycle, sandbox, dependencies and visibility adapter work in WebApp. | Keep portable receipt adapter, shared business rules and gate; isolate browser qualification in one reusable tool. No general browser engine in communications. |
| Operational fit | Available now, known evidence ceiling. | Supported technology, but current worker capacity/security are unqualified. | Best ownership fit for existing recovery; required rendered receipt capability is not yet present in the inspected seam. |

Choose C because the research agent already knows the task and can inspect real
contact/team pages, pursue alternatives and explain uncertainty. This avoids a
second autonomous research loop in communications. B remains a possible
**implementation of C's capture tool**, isolated from the communications process,
if no approved existing tool can produce the necessary receipt. It is not a
proposal to launch a browser in the current worker or introduce another service.

Fallback: preserve frozen static-v2 historical verification and existing
authorized behavior during migration. If C cannot obtain a qualified visible
observation, return `needs_visible_evidence` and let the agent seek another
operator page within its admitted budget, or use authenticated human review.
Never fall back from a failed v3 proof to a weaker v2 proof for the same new
draft. No visible supported route means no new draft.

## Current official capabilities and their limits

These primary sources were read on 2026-10-04; URLs are mutable documentation,
not runtime qualification pins.

- [Agents API web search](https://developers.openai.com/api/docs/guides/agents-api/tools/web-search)
  documents live/cached/disabled search and domain filters. This supports
  discovery; the documented contract does not supply the address-range
  visibility receipt below. Cached results cannot establish live freshness.
- [Agents API computer use](https://developers.openai.com/api/docs/guides/agents-api/tools/computer-use)
  documents hosted browser navigation, website-access handling, activity items
  and optional screenshots. Screenshots may be absent. Operation status and
  an agent answer do not establish exact visible-address/source binding.
- [Agents API functions](https://developers.openai.com/api/docs/guides/agents-api/tools/functions)
  documents application-owned handlers and `agent.session.input.tool_result`
  responses bound to pending `turn_id` and `call_id`. This is an available
  integration seam for a trusted capture tool, not a built-in attestation.
- [OpenAI Retrieval](https://developers.openai.com/api/docs/guides/retrieval)
  is semantic search over vector-store data. Retrieved chunks, even with a
  citation, do not establish what an operator page rendered at a check time.
- [Playwright actionability](https://playwright.dev/docs/actionability#visible)
  defines visibility using a non-empty box and computed visibility; opacity
  zero can still count as visible. [Locator APIs](https://playwright.dev/docs/api/class-locator)
  expose text and ARIA snapshots, not a complete proof of painted readability.
  Thus a supported browser removes CSS emulation, but needs a bounded capture
  policy and qualified observation adapter.
- [Playwright Docker guidance](https://playwright.dev/docs/docker)
  warns against treating its default testing image as a secure untrusted-site
  crawler: root disables the Chromium sandbox; crawling guidance uses a
  separate user and seccomp. [Agents sandbox security](https://developers.openai.com/api/docs/guides/agents-api/environments/security)
  likewise calls for isolated workloads, restricted outbound access and
  credential protection. A managed-browser name is not evidence these
  controls match Blueprint's source-read policy.

The design does not assume that the hosted browser exports DOM ranges, final
navigation URLs, browser binary versions or authenticated capture manifests.
If those properties are unavailable, it cannot mint automated v3 receipts.
Hosted screenshots can assist preliminary human inspection after their
source/state binding is verified. They cannot qualify a v3 human receipt unless
the mandatory acquisition pins and complete artifact contract also verify.
No native tool capability or zero-cost allocation is
inferred from documentation or the existence of a local desktop browser.

## C's trust boundary and workflow

1. WebApp supplies the existing digest-bound public research request. Pipeline
   keeps current task, source, publication, CRM, QA, spend, fencing, cancellation
   and attempt semantics. Existing agent sessions and tools remain the context;
   a contact gap grants no new session, tool access, disclosure or budget.
2. The research agent chooses actual pages and candidate contacts. Public page
   text is untrusted data, including instructions to change policy or submit
   secrets. The agent can submit a URL and a selection hint; it cannot supply
   the observed text, set receipt fields, impersonate the tool or write its ledger.
3. An application-controlled broker independently validates the request and
   captures the page using a qualified tool. It retains content and observation
   artifacts in existing authorized company storage and reserves an opaque
   capture ID before returning a result. It seals the admissible immutable
   receipt only after exact result bytes and authenticated acknowledgement are
   bound, as described below. Browser/page JS
   and model sandboxes have no registry credentials or write path.
4. The agent proposes one contact using a receipt ID and exact ranges. Its
   explanation/ranking remains a proposal. The broker associates the proposal
   with the originating request; a gate loads receipts independently from the
   registry, never from agent-supplied JSON alone.
5. Pipeline verifies original tool request/result bytes, successful execution,
   acknowledgement, call/turn identity and source/run bindings, then publishes
   the new proof sidecar. The WebApp gate independently verifies that chain and
   the deterministic business rules before producing a contact result.
6. Draft creation reruns the gate and existing publication/CRM/permission checks
   against the current protected source and selected evidence digest. No send
   permission is produced. A future authorized send would rerun its existing
   business/authority checks and the explicit live-freshness gate below.

A hash establishes byte identity, not who observed those bytes. Registry-origin
authentication is therefore mandatory. The trusted broker service account has
create-only receipt access; model-output ingestion and browser processes cannot
create or replace receipt records. Gate read access is independent of the agent.
Registry identity, generation and revocation checks must be atomic with the
draft admission record. Use existing identity/storage mechanisms; this note
does not provision accounts, signing keys, storage or credentials.

Compromised broker code or service identity remains a trust failure that this
gate cannot cryptographically repair. Pins, qualification, least privilege,
revocation and human inspection make that assumption explicit. Provider session
IDs are provenance, never the only canonical identity or retained content copy.

## Proposed exact versioned proof contract

This is a normative **design schema**, not a shipped validator. Every object
below is strict (`additionalProperties=false`); listed fields are required
unless explicitly nullable. Duplicate JSON keys, malformed UTF-8, unpaired
surrogates, non-finite numbers, unknown versions and unknown enum values fail
closed. IDs are opaque nonempty ASCII strings of at most 200 bytes; URLs are at
most 2,000 bytes. `Digest` is lowercase 64-hex SHA-256; `Commit` is a full
40-hex Git commit; timestamps are RFC 3339 UTC with milliseconds. Byte counts,
indices and offsets are nonnegative safe integers. Bounds are checked before
allocation. No inline base64 page body appears in the proof; bounded retained
blobs are fetched from the authenticated company store.

For new v3 objects, `H(object)` is SHA-256 of UTF-8 JSON canonicalized using
[RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785). Text/blob digests hash
the actual retained bytes, without re-encoding or Unicode normalization.
Existing publication/request/source digests retain their existing algorithm;
they are not recanonicalized under JCS. Cross-language test vectors must cover
non-ASCII strings, ordering and number serialization. Artifact references are
company-owned content IDs resolved by a fixed store adapter, never arbitrary
URLs supplied by the agent.

### Resolution envelope

| Field | Exact type and constraint |
| --- | --- |
| `schema_version` | Literal `blueprint.contact-resolution.v2`; outer version bumps because retained evidence and trust semantics change. |
| `extraction_version` | Literal `blueprint.public-contact-evidence.v3`; never reinterpret `blueprint.public-contact-text.v2`. |
| `proof_id` | `Digest = H(envelope without proof_id)`; gate conclusions are stored separately. |
| `request_id` | Existing contact-request digest, independently recomputed with its original versioned algorithm. |
| `publication` | Strict existing publication binding object defined below; source and QA bindings must independently verify. |
| `operator` | `{organization: string[1..200], organization_url: URL, allowed_hosts: Host[1..16], scope_digest: Digest}`; independently equal the protected operator-scope record. `Host` is a canonical ASCII hostname of 1..253 bytes, with valid DNS labels, not a wildcard/registrable-domain guess. |
| `contact` | `{email_literal: string[1..254], email_key: string[1..254], scope: "site"\|"organization_business_route", organization: string[1..200], site: string[1..300]\|null, purpose: "business_inquiries", status: "public_business_contact"}`. Site must equal protected source site for site scope, otherwise null. |
| `selection` | `{receipt_id: ID, receipt_digest: Digest, block_id: ID, quote: string, quote_range: Range, email_range: Range, label_range: Range, label_kind: "public_business_contact"\|"business_inquiries"\|"commercial_inquiries"\|"partnership_inquiries"\|"general_information_contact", relevance: Relevance}`. Ranges refer to the same retained block; quote is at most 1,200 Unicode scalars and 4,800 UTF-8 bytes. |
| `receipt` | Exact `RetrievalReceipt` below. Must match the protected registry entry and `selection.receipt_digest`. |
| `resolved_gaps` | Array of at most 16 original missing-contact strings, each at most 1,200 scalars; equals only the protected source's contact-identification gaps. Permissions, rights, history and consent are never resolved here. |
| `policy_pin` | `{gate_version: "blueprint.contact-gate.v3", gate_commit: Commit, gate_artifact_sha256: Digest, business_policy_version: "blueprint.contact-business-policy.v1", business_policy_sha256: Digest, freshness_policy_version: "blueprint.contact-freshness.v1", freshness_policy_sha256: Digest}`; supported pinned implementations/policies only. |

`publication` has exactly these existing fields: `date` (YYYY-MM-DD), `runKey`
and `candidateKey` (nonempty strings), `packetDigest`, `rawArtifactDigest`,
`sourceDigest`, `qaArtifactDigest` (`Digest`), `researchQaReference`, `sheetsId`,
`sheetsProspectId`, `prospectId` (nonempty strings). Apply existing strict
validation and publication provenance, with a 1,200-scalar bound per string.
Names are unchanged to avoid implicit migration of historical identities.

`Range = {start_utf8: integer, end_utf8: integer}` is half-open, with start < end
and UTF-8 character boundaries. Block `content_range` is bounded by the aggregate
retained-content blob byte length; selection quote/email/label, relevance,
restriction and source-run ranges are block-relative and bounded by that block's
byte length. Offsets use bytes, not
JavaScript UTF-16 indices or Python code-point indices. `email_range` and
`label_range` must be contained in `quote_range`.

`Relevance = {kind: "person_for_task"|"team_for_task"|"general_business_route",
ranges: RelevanceRange[]}`; at most eight ranges. `RelevanceRange` has exactly
`{block_id: ID, range: Range, kind: "name"|"role"|"remit"|"task"|"site"}`.
These ranges cite observed supporting text, never agent explanations.
Deterministic policy verifies the selected tier and required conjunctions.
General business scope never becomes a named decision-maker or site-authority
assertion. Ranked ties with different addresses require review.

### Trusted retrieval receipt

| Field | Exact type and constraint |
| --- | --- |
| `schema_version` | Literal `blueprint.contact-retrieval-receipt.v1`. |
| `receipt_id` | Broker-generated immutable ID; independent of agent output. |
| `origin` | `{kind: "application_tool", issuer_id: ID, registry_record_id: ID, registry_generation: integer, task_request_id: Digest, session_id: ID, turn_id: ID, call_id: ID, tool_name: "blueprint_capture_contact_evidence", request_sha256: Digest, result_sha256: Digest, success: true, acknowledged: true}`. Provider-specific IDs are provenance; task and receipt are canonical. |
| `request_artifact` / `result_artifact` | Each `BlobRef`; exact original request and tool-result bytes, with original digest algorithm recorded by their existing ledger contract. `result_sha256` hashes retained result bytes, not a reconstructed event. |
| `requested_url` / `final_url` | Independently observed absolute HTTPS URL; credentials and unsupported ports forbidden. Final URL is bound to the captured document, not copied from the initial request. |
| `navigation` | Ordered `NavigationStep[0..8]`; any overflow fails. Each `{from_url: URL, to_url: URL, kind: "http_redirect"\|"browser_navigation", status: integer\|null, observed_at: timestamp}`; status is a valid redirect code only for HTTP steps, otherwise null. Same-document fragment actions are recorded in observation actions. |
| `checked_at` | Broker clock timestamp at the coherent observation, not model time, HTTP Last-Modified or cached retrieval time. |
| `retrieval_mode` | Enum `rendered_browser_capture`, `human_reviewed_render`. Only rendered capture admits automated v3 proof. Static extraction/search excerpts keep their separate existing discovery schemas outside this receipt and resolution envelope; an agent cannot convert them by changing the mode. Human mode uses the separate trust/permission route below. |
| `tool_pin` | `{adapter_version: "blueprint.contact-capture.v1", adapter_commit: Commit, adapter_artifact_sha256: Digest, package_lock_sha256: Digest, browser_name: "chromium"\|"firefox"\|"webkit", browser_version: string[1..100], browser_binary_sha256: Digest, runtime_image_sha256: Digest, capture_policy_version: "blueprint.contact-visibility-policy.v1", capture_policy_sha256: Digest, network_policy_sha256: Digest}`. Missing/opaque/unqualified browser pins cannot mint automated v3 evidence. |
| `document` | `{capture_id: ID, final_url: URL, status: 200, content_type: "text/html"\|"text/plain", source_body: BlobRef, retained_content: BlobRef, block_manifest: BlobRef, restriction_manifest: BlobRef, render_state: BlobRef, screenshot: BlobRef, completeness: "complete", observation: Observation}`. All artifacts are from one captured navigation state; raw source is archival and never selected as visible evidence. Screenshot media type is `image/png`. |
| `limits` | `{policy_sha256: Digest, max_wall_ms: integer, max_requests: integer, max_network_bytes: integer, max_retained_bytes: integer, exceeded: false}`; must equal admitted job limits, not agent-chosen increases. |
| `human_review` | Null for automated rendered mode; `HumanReview` for human mode. Human review substitutes visual judgment only; all other acquisition pins, artifact completeness and provenance requirements remain mandatory. |

`receipt_digest = H(receipt)` is stored separately in the protected registry;
the digest is not embedded recursively in its own input. The registry entry
contains exactly `{receipt_id, receipt_digest, issuer_id, registry_generation,
state: "valid"|"revoked", created_at, task_request_id}`. Independently retrieve
it under existing authenticated read access. A model-created matching JSON
object is not a registry entry. A replay bundle without authenticated origin
can test a gate but cannot authorize a production draft.

Issuance avoids a result-hash cycle and premature acknowledgement: first retain
the capture under a reserved ID, then return an original tool-result event whose
output contains the opaque capture ID and broker-owned content/manifest
references or a bounded preview. It contains neither the final receipt nor its
own result/receipt digest. The broker retains those exact event bytes, verifies
the authenticated call/turn acknowledgement in the protected execution ledger,
then creates the immutable receipt with `acknowledged=true` and the result-byte
SHA-256. The tool result can be acknowledged before the receipt becomes
admissible. Pending, failed, unacknowledged or missing captures cannot enter the
gate; cancellation preserves evidence without granting eligibility. The
immutable registry entry is created only after sealing, not updated from an
agent-authored flag. A remote success/ack assertion without its authenticated
execution binding is insufficient.

`BlobRef = {artifact_id: ID, sha256: Digest, byte_count: integer,
media_type: string[1..100]}`. Reject zero bytes for all required blobs.
`source_body` and `retained_content` are each bounded to 512 KiB;
block/restriction/render-state manifests and original request/result each to 1 MiB;
screenshot to 4 MiB. These are proposed admission ceilings, not measured
worker capacity. An admitted deployment may set stricter limits. Any incomplete
coverage or overflow creates a failed observation; never truncate and mark
complete. No remote URLs, credentials, raw HTML or private artifacts are
returned in public error prose.

`Observation` has exactly `{observation_id: ID, viewport_width: integer[320..2560],
viewport_height: integer[320..2560], device_scale_factor: number[1..3], locale:
string[1..50], timezone: string[1..100], actions: ObservationAction[0..16],
document_state_sha256: Digest, stable: true, coverage: "complete_top_level_document",
unsupported_regions: []}`. An action is exactly `{kind: "navigate"|"scroll"|"expand",
target: string[1..500], observed_at: timestamp, before_state_sha256: Digest,
after_state_sha256: Digest}`. The render-state blob is the pinned adapter's
canonical browser-state manifest; `document_state_sha256` equals its actual
byte digest. Action before/after digests record the tool's independently sampled
state under that same versioned policy. Expands must be public
read-only controls with recorded before/after state; submission, sign-in,
downloads and account actions are forbidden. Stable is the qualified tool's
bounded observation assertion; it is not a claim that the live page never changes.
All selected content, complete coverage manifests and screenshot must describe
the single final state after these actions; earlier states cannot contribute
positive address/label fragments. If the tool cannot retain a coherent final
state, it refuses rather than combining scroll/expand results.

`retained_content` is UTF-8, LF-separated block text, with the tool's original
observed Unicode sequence preserved. Positive evidence is limited to readable
rendered blocks; excluded DOM text may be retained as explicitly tagged negative
restriction context, never as an address source. Attributes/raw markup/ARIA
names are not positive blocks. The manifest enumerates every captured
top-level rendered text block and every exclusion, in observation order. Each
block is exactly `{block_id: ID, content_range: Range, text_sha256: Digest,
source_kind: "dom_text", source_runs: SourceRun[],
region: "content"|"footer"|"navigation"|"restricted"|"unknown",
visibility: "readable"|"excluded"|"unknown", exclusion_codes: string[],
observation_id: ID, screenshot_region: Rect|null}`; at most 4,000 blocks.
`Rect={x: finite number, y: finite number, width: positive number, height:
positive number}` is within the retained screenshot coordinate system.
Readable selectable blocks require a non-null rectangle; hidden/non-rendered
exclusions may have null. Decoded screenshot dimensions bound every rectangle.
`SourceRun={run_id: ID, range: Range}`. Ordered, disjoint source-run ranges
partition literal DOM text runs in block-relative bytes (at most 4,096 runs);
an address cannot cross a run boundary. Generated CSS/ARIA/attribute/OCR text
is not a selectable block. Unknown regions, incomplete frame/shadow coverage
or inability to map selected text to the screenshot fail automated admission.

`restriction_manifest` is strict `{policy_sha256: Digest, coverage:
"complete_observed_document", blocks: ID[], restrictions: Restriction[],
unknown: false}`. Each restriction is `{block_id: ID, range: Range,
kind: "no_contact"|"no_unsolicited"|"opt_out"|"restricted_inbox"}`.
The gate re-scans retained text, including footer/navigation and excluded
observed blocks, with its pinned policy; a selected excerpt cannot suppress
negative context. This establishes bounded observed-page coverage, not proof
that every other page on the operator's site contains no restriction. Known
linked contact-use policies and CRM restrictions remain independently binding;
an unresolved relevant restriction is not permission to proceed.

## What counts as a visible observation

The receipt certifies the qualified tool's observation at a specific time,
browser, viewport, navigation state and policy. It does not certify honesty of
the operator, deliverability of an inbox or universal visibility on all devices.
The content digest alone cannot prove pixels; the trust is in the authenticated,
qualified producer and its retained inspection artifacts.

Capture is not presumed atomic because DOM text and screenshot calls succeed.
The tool must bracket text/manifest/screenshot acquisition with independent
document-state checks and fail on relevant mutation or navigation. Bind the
same observation ID, final URL and text state throughout; dynamic address swaps
between captures must refuse. Use tool-controlled isolated evaluation or
browser instrumentation whose trusted primitives page scripts cannot override.
If a page can spoof the text/layout APIs used by the adapter, it cannot produce
a qualified receipt. This is a producer qualification requirement, not an
invented guarantee from a Playwright call. The initial automated subset must fit
one coherent retained screenshot (full-page capture is permitted within byte
limits); multi-state scrolling captures require a later versioned frame-manifest
contract, not a stitched screenshot labeled as one observation. Human review
does not waive the current single-state acquisition contract.

The producer must use browser-computed rendering and a narrowly qualified
capture policy. Its qualification corpus must demonstrate that selected text:

- is literal DOM text rendered in the composed top-level document, rather than
  comments, script/style/template/raw HTML, attributes, `mailto` targets,
  `aria-label`, accessible-name substitutions or CSS-generated content;
- is present as one left-to-right literal address run, with no stitching of
  elements, blocks, pages, frames, label/address fragments or captures;
- is readable in the retained screenshot after any bounded scroll/expand,
  rather than opacity-zero, transparent/near-invisible, clipped, masked,
  transformed out of view, occluded, tiny, unexpanded, hidden, inert or ARIA-hidden
  honeypot text. Bounding boxes and `isVisible()` alone cannot attest this;
- appears with its literal business label in one eligible block, with relevant
  organization and any claimed site/role/remit support retained;
- comes from a content region, not footer/navigation boilerplate, hidden
  accessibility-only copy or a restricted form. A visibly painted footer
  address remains excluded by business policy, not declared invisible;
- has no unresolved foreign-frame, closed-shadow, canvas/OCR, animation,
  stylesheet failure or unstable-page dependency affecting the selected block
  or restriction coverage. Open/declarative shadow content may pass only if
  the qualified tool records composed rendered runs; no raw light-DOM fallback.

Do not claim a universal deterministic readability detector. Support a narrow
qualified set of ordinary text layouts; capture a screenshot and immutable
render-state manifest for inspection, and abstain on unsupported painting,
occlusion, contrast, custom elements or incomplete coverage. Adding browser
computed-style/layout calls to a small observation adapter is different from
emulating CSS syntax and cascade in the WebApp gate. If the adapter starts
accumulating arbitrary layout exceptions, stop and reconsider its qualification
boundary instead of moving the old parser into another repository.

Even a visibly painted, correctly labeled address can be a deliberate trap.
Known honeypot markers, inconsistent identity, contradictory restrictions or
uncertain recipient intent require review/abstention. Rendering proves an
observation, not the author's benign intent; that limitation applies to A, B
and C. Neither a model's assurance nor a provider's discovery flag removes it.

### Human receipt fallback

`HumanReview` is exactly `{review_id: ID, reviewer_id: ID, reviewed_at: timestamp,
task_request_id: Digest, capture_id: ID, capture_bundle_sha256: Digest,
selected_block_id: ID, quote_range: Range, email_range: Range, decision:
"visible_public_business_route", authority: "contact_review_only"}`. An
authenticated reviewer outside the proposing agent records it through the
existing protected review path; the tool stores a new immutable human-mode
receipt. A reviewer ID typed by a model or a bare screenshot upload does not
qualify. The capture bundle digest binds exact final URL, navigation, text,
manifests, render state, screenshot, tool result and timestamps; the reviewer must actually
inspect the rendered address, label and surrounding restrictions.

`capture_bundle_sha256 = H({origin, request_artifact, result_artifact,
requested_url, final_url, navigation, checked_at, tool_pin, document, limits})`
using those exact receipt fields. It excludes `human_review`, avoiding a
self-reference. The review decision is protected and recorded after the
capture/acknowledgement binding exists; it does not amend the original automated
receipt. A separate new human-mode receipt links the same capture artifacts.

The gate trusts that human observation as a separate evidence class and still
checks all byte/source/business bindings. It cannot independently reproduce
the human visual judgment, so human mode is manual-review draft-only. It never
upgrades raw/static/search evidence into a tool attestation and never grants
send, site, capture, data-sharing or rights authority. If there is no trusted
URL/state-bound rendered capture to review, obtain one first or keep the gap
unresolved. A contact-review decision is not an override of an opt-out.

## Deterministic gate: checks and resulting authority

`verifyContactEvidenceV3(proof, protectedSource, protectedRegistry, actionPolicy,
clock)` is a proposed contract, not an implementation in this PR. It performs
no browser navigation, model inference or provider calls. Blob/registry reads
are from the company-controlled evidence store. Evaluation is deterministic
for the same bytes, pins, registry/source state, action policy and supplied clock.

The ordered predicates are:

1. Validate versions, sizes and exact schema. Resolve supported policy/tool
   pins from a protected allowlist; reject revoked/unknown producers or receipt
   versions. Recompute proof, receipt and every artifact digest from actual
   bytes, not agent-supplied digest claims.
2. Reverify the existing publication, source digest, lead assessment and CRM
   bindings. Match request, prospect, task, source, receipt registry identity
   and generation; match successful acknowledged research call/turn and exact
   original request/result bytes. A QA model approval does not replace these.
3. Require the operator's own approved domain for requested URL, every redirect,
   document/navigation URL and final URL. Start from the protected operator
   identity. Only exact host plus conventional `www` and explicitly admitted
   owned subdomains may pass; no public-suffix inference, arbitrary sibling
   domains, lookalike hosts or third-party directories. An address may use a
   different email domain if the operator explicitly publishes it; source
   ownership and recipient-address ownership are separate checks.
   For shared hosting, hostname/DNS/CNAME alone does not establish operator
   ownership of all tenant paths; require an already-approved path binding or
   abstain. Do not infer it from model-entered organization text.
4. Verify a coherent capture: navigation steps link contiguously from request
   to final URL; document URL equals final URL; times fall within the admitted
   call/run; all artifacts share capture/observation identity. Any browser
   navigation after observation needs a new capture. Do not mix a permitted
   initial URL with text/screenshots from an off-domain redirect or another tab.
5. Require complete qualified rendered evidence, readable content block and
   supported observation coverage; or the explicit human-review route. Reject
   raw HTML, static extraction, cached/search snippets and a model-authored
   `rendered` flag. Recompute manifest text/range bindings. Screenshot/manifest
   validation proves retained artifact consistency; visual truth still rests
   on qualified tool or authenticated human provenance.
6. Slice the exact quote, label and address from the same retained block using
   UTF-8 boundaries. Verify block/proof digests, selected-slice equality, email run and no element/run
   splicing. The quote string must equal its retained slice byte-for-byte.
   Context elsewhere may identify the organization; it cannot contribute an
   email suffix or a missing business label to the selected block.
7. Enforce the existing literal address grammar and full Unicode boundaries.
   Extract exactly one supported address in the business block. Preserve its
   original spelling; derive the existing lowercase comparison key only after
   literal matching. No Unicode compatibility normalization, whitespace or
   zero-width removal, OCR correction, entity reconstruction, `mailto` inference,
   guessed role aliases, email-format generation, or concatenated fragments.
8. Apply the pinned business policy: supported label, organization identity,
   site support for site scope, eligible content region, all known restrictions
   and conflicting unknowns. Exclude support/technical assistance, careers/jobs,
   press/media, privacy/legal, personal/private, unsubscribe and opt-out routes.
   Preserve the currently supported general-information invitation as
   organization scope. A title/local part alone does not prove remit; prefer a
   named professional only with retained current task/site/remit support, then
   a relevant team, then a general business route. Different-address ties or
   stale/former-role contradictions require review.
   Load and evaluate all retained eligible blocks under the pinned selection
   policy, not only the agent's chosen block. A proposal cannot conceal an
   equal-priority competing recipient or an observed restriction. If explicit
   relevance cannot be established deterministically, retain supported general
   organization scope or abstain; never invent named-decision-maker authority.
9. Preserve downstream controls: versioned lead verification, factual operator/
   site/job support, geography, actual canonical CRM schema/receipts, QA,
   source publication, duplicate/idempotency handling, opt-outs, spending,
   draft permission, site/data-sharing unknowns and any existing first-contact
   authority. Resolving a missing contact does not erase missing history or
   imply zero prior contact. Contact proof supplies none of those authorities.
10. Apply action-specific freshness and commit the admission/effect using the
    existing transaction and idempotency key. Recheck protected source,
    registry validity/generation, restrictions and draft authorization at the
    effect boundary; record which immutable proof and policy passed.

Unicode tests must include letters/numbers/combining marks adjacent to either
edge, astral characters, soft hyphens, zero-width/format controls and bidi
controls. Reject a token cut out of a longer Unicode word and any ambiguous
control adjacent to/inside the address run. Fullwidth punctuation and homoglyphs
are not ASCII addresses; unsupported internationalized local parts require a
future explicitly versioned grammar. Decode HTML entities only as part of the
trusted browser's observed DOM text, preserving source mapping; the gate never
decodes raw markup to manufacture a missing address. Name matching may retain
the current NFC/case/whitespace policy; address matching may not inherit it.

A successful result is strictly `{schema_version: "blueprint.contact-gate-result.v1",
proof_id: Digest, receipt_id: ID, evidence_digest: Digest, email_key: string,
scope: "site"|"organization_business_route", source_url: URL, source_checked_at:
timestamp, evidence_kind: "trusted_rendered_contact"|"human_reviewed_contact",
gate_pin: policy_pin, evaluated_at: timestamp, action: "draft_review_only",
resolved_gaps: string[], sends_authorized: false}`. Failures return typed reasons
without sensitive values: `unsupported_version`, `untrusted_receipt`,
`evidence_changed`, `source_binding_changed`, `operator_scope_changed`,
`navigation_mismatch`, `visibility_unverified`, `incomplete_observation`,
`spliced_or_nonliteral_address`, `business_route_ambiguous`,
`recipient_restricted`, `source_stale`, `permission_missing`, `tool_budget_denied`.
Quarantine only the affected contact proof; retain unrelated valid research,
original evidence and the repairable gap. No automatic paid retry or send follows.

## Same-content replay and current-live freshness

Historical replay asks: **Did this retained observation satisfy its pinned
contract?** It uses retained bytes and historical policy/tool pins, no external
page or model calls, and records `historical_replay` outside action authority.
It can remain reproducible after a page changes. It does not mean the address
is still published or suitable today. Do not fetch live HTML and compare its
raw digest to a rendered-content digest.

Proposed `blueprint.contact-freshness.v1` action policy has exactly
`{version, draft_max_age_ms, future_send_max_age_ms, max_clock_skew_ms,
require_live_capture_for_new_effect: true}` with initial ceilings of 24 hours,
60 minutes and 60 seconds respectively. These are reviewable proposal values,
not measurements, existing policy claims or authorization for sending. The
strictest current source/lead/permission TTL always wins. A future send remains
denied by current send-off configuration even with a fresh receipt.

At every new draft, compare broker check time against the trusted supplied clock,
reject future times beyond skew and stale observations, and recheck source,
CRM and restrictions. A stale receipt can still be read historically; a new
effect needs a fresh trusted capture. Refresh occurs through the existing
admitted research/tool context before the effect transaction, not inside a
long-running draft/send transaction. Store `supersedes_proof_id` in a separate
append-only relationship record; never mutate the original proof.

For any separately authorized future send, require a new live rendered
observation within the send ceiling, source/permission rechecks and the same
literal address/business scope. Changed address, scope, quote, restrictions,
redirect target or producer policy requires a new proof and review; never
silently rewrite an already approved draft recipient. Unchanged source text
with different irrelevant page decoration can yield a new coherent receipt;
the old and new digests remain distinct. No finite TTL proves the page cannot
change between observation and effect; record that bounded temporal limitation.

## Worker resources, JavaScript and network admission

At the WebApp pin, `render.yaml` declares the existing dedicated worker plan,
but no measured browser peak RSS/CPU/shared-memory/headroom is established by
this task. Do not infer capacity from a plan name or install browsers into the
communications worker. B and C both need browser-resource qualification.

For a later non-paid local fixture rehearsal, start with one browser job, one
ephemeral context and one page, maximum 30 seconds observation wall time,
128 requests and 8 MiB aggregate decoded network bytes; enforce the retained
artifact limits above. Proposed browser-job ceilings are 1 GiB RSS and one CPU
core within an already approved environment; they are provisional admission
limits, not a claim the current worker can afford them. If qualification cannot
fit, report the gap rather than raise limits or provision paid capacity. Measure
cold/warm latency, peak browser-tree RSS, CPU time, disk/shared memory, cleanup,
queue delay and interference with existing work before any deployment proposal.
No unlimited `networkidle` waits or background tab/process leakage.

Treat pages as hostile code. Required controls for a later producer admission:

- An isolated non-root process/VM/container with a working browser sandbox,
  no `--no-sandbox`, no production secrets, filesystem mounts, reused profiles,
  cookies, account sessions, mailbox access or agent write credentials. A
  BrowserContext is browsing-state isolation, not an OS security boundary.
- Default-deny egress at the actual connection boundary. Preserve HTTPS/443,
  public-address validation, DNS/TLS pinning and redirect limits. Reject local,
  loopback, link-local, private, metadata, reserved and IP-literal destinations,
  including IPv6/IPv4-mapped forms, mixed DNS results and rebinding. Every
  redirect, subresource, iframe, fetch/XHR and browser navigation needs the
  same enforcement; a safe main URL is insufficient. Allow only bounded GET/HEAD
  acquisition, reject credential-bearing URL/query values, and disable browser
  authentication/cookie reuse. Page-initiated writes are not research authority.
- Disable service workers and forbid websockets, WebRTC, downloads, popups,
  file/device/clipboard permissions and form/account writes. Browser route hooks
  are defense in depth: [Playwright's context routing documentation](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)
  notes the service-worker interception gap. Network firewall/proxy enforcement
  must cover all browser subprocess traffic; do not rely on JS request hooks
  as an SSRF boundary.
- Default source policy permits only owned operator hosts. If essential public
  CDN CSS/fonts/scripts are needed, explicitly admit bounded read-only public
  dependencies in the network policy; they never become contact evidence
  origins. Denial or failed styles affecting observation/coverage yields
  `visibility_unverified`, not a raw-HTML fallback. Executing third-party scripts
  does not grant third-party network or data-disclosure authority.
- Pin browser/runtime/package versions and qualification corpus; patch through
  a new supported pin with focused regression results. Kill the full process
  tree and expire the context on timeout/cancel/failure. Cleanup failure blocks
  further jobs until reclaimed; successful retrieval does not prove cleanup.

Retain only authorized public observations in access-controlled company storage
with existing retention/deletion policy and portable exports. Keep live private
evidence, screenshots and operator records out of GitHub examples, model prompts
beyond existing approved disclosure, and public logs. Missing provider retention
or isolation information blocks producer admission; it does not authorize a new
paid service. No security qualification is claimed for current production here.

## Cross-repo migration, preservation and rollback

Implement only after separate approval of the chosen producer and concrete
implementation scope. Both repos must agree on the same strict schemas,
canonicalization vectors, producer allowlist and gate/policy versions before
enabling any v3 proof. No write or implementation in this PR performs these steps.

| Phase | Pipeline responsibility | WebApp responsibility | Exit evidence |
| --- | --- | --- | --- |
| 0: freeze | Preserve static source receipts and existing task/attempt/cancellation semantics. | Freeze current static-v2 production and historical verifier; no speculative parser expansion. | Exact pins and this design reviewed. |
| 1: contract | Define versioned retrieval/proposal/export contract and synthetic fixtures; tool-result bytes stay broker-owned. | Add separately dispatched v2-envelope/v3-evidence reader and gate, preserving legacy readers. | Cross-language schema/digest/negative tests pass offline; unsupported producer remains blocked. |
| 2: producer qualification | Qualify a supported rendered capture adapter with complete artifacts, origin authentication, network/resource/cleanup limits. | Verify receipts independently; parser remains available for legacy history, not v3 truth. | Fixture observation corpus and isolated resource/security rehearsal retained; no paid calls. |
| 3: non-paid shadow | Use recorded synthetic captures and fake broker/store adapters; no real prospects or external provider sessions. | Compare A/C decisions and exact refusal predicates with fake draft transport; no effect. | Positive/negative/adversarial parity review and rollback drill. |
| 4: separately authorized canary | Only an explicitly approved bounded public-source read in an existing admitted budget, with exact clean commit/package/tool/input pins. | Gate one approved synthetic/test contact and fake draft or a separately permitted draft-only target. | Owner-approved scope, budget/timeout, network/resource evidence and retained receipts. No send or automatic first contact. |
| 5: optional promotion | Release canonical receipt artifacts and contract pins with portable recovery. | Enable new v3 proofs only after producer/gate/permissions are qualified; retire parser from new-proof path. | Reviewed migration/release decision and tested rollback. This phase is not authorized here. |

Keep the user-owned canonical CRM and real headings/controlled values, stable
prospect IDs, versioned lead assessments and historical rows. Store the new proof
as a sidecar to the existing source/publication identity. Do not bulk-edit CRM
emails or QA flags, delete historical evidence, equate general business scope
with site authority, or turn a new contact into consent. Preserve private history
and unknowns without publishing them. Artifact content and portable IDs remain
company-controlled; provider IDs are supplemental provenance.

**Old extractor v2 never upgrades by relabeling.** Historical outer-v1/static-v2
proofs retain raw bytes, original version and their explicit non-rendered basis.
They remain readable under a frozen version-specific historical verifier. If
that exact verifier/policy is unavailable, the row is unverified and fails
closed. A new v3 draft requires newly captured trusted rendered evidence; there
is no hash translation from raw HTML/static text to rendered content. Existing
approved/history rows retain their original authority and are never silently
re-admitted under stronger claims. Unknown outer versions or incompatible
package/schema combinations fail closed with a recoverable contact gap.

Version selection is explicit at **all** consumers: intake/recovery, publication,
communications brief adaptation, protected source lookup, draft creation,
future send verification, CRM projections and historical replay. New extraction
cannot bypass `requireVerifiedLead`, QA/publication/source/CRM bindings,
geography, opt-outs, duplication/spend gates or permissions. New gate results
must bind the brief's `contactEvidenceDigest`; a bare CRM address is insufficient.

Rollback disables v3 new-proof admissions, cancels/cleans capture jobs, revokes
affected producer pins/receipts and quarantines pending v3 draft effects.
Retain the v3 reader for history and all original artifacts. Do not coerce v3
rows into v2 or fall back to static acceptance after a v3 integrity/visibility
failure. Freeze new drafts needing unsupported proof; retain the known-good
legacy path only for its explicit existing scope. Send-off remains enforced.
Restoring a previous package may require leaving an affected new-version row
blocked until a compatible reader returns. Re-enable only after an encoded fix,
focused qualification replay and independently reviewed pin update.

## Tests and non-paid readiness evidence required later

This PR adds design only. The following are acceptance tests for a later
implementation, not claims that the tests or tool already exist.

| Test class | Required cases and expected outcomes |
| --- | --- |
| Positive | Literal business label/address in one visible own-domain block; approved organization route; current named person with task/site/remit evidence; relevant team; coherent approved redirect; Unicode organization names; HTML entity decoded by the browser to a retained literal address; approved composed open-shadow text. Exact expected contact/scope and digest. |
| Visibility negative | Raw hidden/ARIA/attribute/mailto-only address; script/template/comment; external stylesheet hiding; opacity zero/near-zero; occlusion/clipping/masking/offscreen/tiny text; closed/collapsed content; canvas/OCR; pseudo-content; footer/nav; closed shadow/foreign frame; denied essential CSS; unstable or truncated capture. All abstain, never fall back. |
| Reported parser regressions | Tiny nested CSS selector amplification, selector-length refusal and bounded token/attribute work; large rule sets with bounded CPU/memory; distinct horizontal/vertical offscreen states plus visible centering/-100px margins; CSS bidi-override painted reversal; synthetic `sales@operator.example` followed by a zero-width character and a further letter. A's thresholds stay labeled heuristic; B/C must use qualified observed rendering and exact full-token matching, not inherit static guesses. |
| Business negative | Support/jobs/press/privacy/legal/personal route; no literal supported business label; unverified organization/site; former person; unrelated remit; conflicting addresses; no-contact/no-unsolicited anywhere in observed restriction scope; existing CRM opt-out; unresolved consent/recipient prohibition. Cannot draft. |
| Literal/Unicode adversarial | Split local part, `@` or domain across runs/blocks/pages; label on another block; zero-width insertion; bidi controls; soft hyphen; combining marks and astral/Unicode word edges; homoglyph/fullwidth punctuation; percent/entity reconstruction; substring of a longer address/word; unsupported internationalized local part. No guessed/repaired address. |
| Origin/tampering | Agent-fabricated rendered flag/receipt/reviewer; copied successful receipt from another task/session/turn/call; changed request/result/quote/blob/manifest/screenshot; hash recomputed on an unauthenticated fake; replaced registry generation; revoked producer; unknown/opaque runtime pin; forged QA. All fail origin or digest/source checks. |
| Capture adversarial | Page swaps address/label between text and screenshot calls, changes URL mid-capture or overrides DOM text/style functions. Mutation, untrusted measurement primitives or incoherent observation identity must refuse; separate successful calls are not atomic proof. |
| Navigation/network adversarial | Final/request URL swap; screenshots from another tab/time; off-domain HTTP/JS/meta redirect; suffix/lookalike/IDN scope confusion; private/metadata/mapped-IP subresource; mixed DNS/rebinding; service-worker/WS/WebRTC bypass; stale capture after navigation; credential query/URL or cached result. All blocked before effect; no secret disclosure. |
| Time/effect | Valid historical replay but stale new draft; future check time; changed address/label/restriction on refresh; source/CRM/registry changes between verification and effect; repeated idempotency key; budget refusal; cancel/timeout/browser crash. Original records stay immutable, no duplicate effect, full cleanup, typed gap. |
| Migration/rollback | Old v2 remains explicitly static; unknown versions fail; mixed WebApp/Pipeline package versions; no blind upgrade; historical rows readable; unsupported new rows blocked on downgrade; producer revocation halts pending drafts; send-off and automatic-first-contact-off still refuse with otherwise valid v3. |

Run schema/digest/property tests using synthetic retained artifacts in both
languages, then replay the same corpus through real gate entry points with fake
transport. Qualify the capture adapter against local hermetic fixture pages using
the supported browser, with external network denied. Independently inspect
selected screenshots and verify negative cases, including traps whose text
appears in raw HTML but not painted content. Fixtures remain synthetic and
cannot be copied into qualified live evidence.

Non-paid readiness requires: reviewed schema; authenticated receipt-store
write separation; artifact digest/offset/source parity; existing business and
permission sentinels; qualified visibility corpus; network-isolation and
bounded-resource/cleanup rehearsal; cross-repo version dispatch; and rollback.
Readiness does not authorize a provider session, spend, draft effect, release or
send. Any live/public-source canary has a separate concrete authorization with
target, exact commit/package/tool/input pins, cost ceiling, timeout and teardown.

## Review questions and completion boundary

The proposed contract deliberately leaves no silent substitution for these
implementation decisions: which already approved tool can attest the required
render-state/range artifacts; where isolated browser capacity fits the current
stack; whether its origin and network policy are independently verifiable; and
whether the proposed TTL/resource ceilings suit the measured workload. If a
native hosted browser cannot expose required pins/manifests, use a qualified
application tool or authenticated human route rather than inventing native API
capabilities. Qualified acquisition must precede either tool or authenticated
human visual review; human review cannot replace missing acquisition pins.
No new primary service is selected here.

This note supplies the A/B/C comparison, recommended boundary, exact proposed
versions/schema, visible-evidence trust model, deterministic checks, freshness,
cross-repo migration, adversarial acceptance corpus and rollback for review.
It is a public sanitized design artifact. Operational qualification, partner
admission, actual parser retirement and implementation remain future decisions.

For this design-only closeout: objective is the ADP-010 contact-proof design;
source work item is the delegated design request (no Paperclip issue supplied);
budget is no paid calls and design/document publication only; stage reached is
design review and draft PR; state may be `done` only when the one-file PR and
document checks are confirmed. Evidence is this file, the PR head and its check
outputs. No CRM, live operating graph or runtime update is part of the task.
The next action is review of the proposed receipt producer and contract; residual
risk is unqualified rendered observation and resource capacity. A separately
authorized implementation request is the resume condition for runtime work.
