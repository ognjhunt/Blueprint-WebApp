# Communications evidence admission

Owner-authorized repair for the ADP partner-intake blocker: real official Contact
pages and US site addresses were being rejected by literal phrase matching, and
the existing Codex report could not truthfully supply an Agents API session.
Completion artifact: reviewed source admission, source-bound first-contact
regressions and a disabled staging path. This does not require shared-learning
migration or activate inference/sending.

`POST /api/admin/communications/research-admissions` uses existing Firebase
authentication, CSRF protection and server-revalidated admin custom claims.
The protected service records its authenticated actor and review time. It accepts
`reviewedResearchInputSchema`: the unchanged report bytes/hash and reference,
selected candidate/evidence, source assessment and the actual checked CRM rows.
It admits already reviewed Codex or hosted-research evidence without inventing a
session, turn, QA artifact or external publication receipt. This is a trusted
agent/operator assessment path; client `approved`, reviewer and session fields
are rejected. Firestore client writes remain denied.

Evidence preserves original source publication dates (including `null`), check
dates, visible excerpts and retrieval method. Rendered evidence stays rendered;
it does not become a static-extractor proof. The existing bounded static fetcher
continues to refuse pages it cannot verify. An authenticated source assessment
can judge a real visible Contact, quote or sales route, and bind a full US postal
address to the selected operating site. No literal country word or site-name
substring is needed for that assessment. The website and email domains need not
match. Private/hidden evidence, restricted-purpose routes, explicit no-outreach
notices, unresolved conflicts, recipient permission conflicts and stale/current
source gaps remain blocked. Site/data-sharing permission remains unknown.

Choose recipients by relevance: verified introduction when available, then a
current named professional who owns the task/question, has the relevant
department/remit or can credibly route it. A name or senior title alone does not
establish that ability. General inboxes are a last fallback after real searches.
The contact assessment records the route kind, role, question relevance,
operator-stated remit versus inferred routing, actual search summary, sources
and limits. There is no title whitelist or search quota. Public professional
addresses can be named or use consumer email providers. Never guess an address,
mutual connection or decision authority; never substitute private personal data.

Reviewed records live in `blueprintCommunications/default/reviewedResearch`.
Report/packet hashes bind immutable revisions; recipient, site/address and source
identity reservations prevent concurrent duplicate staging. The compatibility
`sheetsProspectId` is explicitly `reviewed:<identity digest>` for a staged record,
not an invented `BP-` row. A Firestore record receipt is actual persistence proof;
Sheets/Notion receipts remain `null`. The canonical CRM read and dedup rationale
are retained. Existing API publications still require real QA and Sheets
readback; optional Notion projection availability no longer blocks them.

New reviewed-source prospect IDs derive from Blueprint source identity,
independently of the CRM projection provider. Replacement agents can export
protected records as ordinary JSON from
`GET /api/admin/communications/research-admissions/:admissionId`.
Artifacts use SHA-256 as a stable Blueprint ID. Store exact source bytes and a
JSON manifest privately in the existing company bucket at
`research/artifacts/sha256/:artifactId/source` and `manifest.json`, accessible
through authenticated `GET /api/admin/communications/research-artifacts/:artifactId`
and `/:artifactId/manifest`. Library/session identifiers are import provenance,
not canonical URLs or runtime dependencies. Keep portable record exports in
authorized company storage; never publish private CRM or postal data.

The configured company bucket is `blueprint-8c1ca.appspot.com`. Create immutable
objects with generation-match-zero and private visibility, then verify download
hashes; reuse identical existing copies instead of overwriting them. The standard
manifest has `schema_version: blueprint.research-artifact.v1`, `artifactId`,
`sha256`, `byteLength`, file name/media type, a Blueprint API URL and import
provenance. The artifact ID and SHA must match the requested source. Portable
JSON inputs/readbacks can use `research/exports/communications/sha256/:digest/`.
Replacement agents use existing authorized Firebase Admin service authority or
the authenticated Blueprint APIs; no Library session or custom credential token
is required. Preserve previous Library copies as import history.

Admission creates the ordinary protected source, handoff and queued job. It does
not create a model session, Gmail draft or send. Worker/send readback selects the
immutable record using `researchOrigin.admissionId` and rechecks hashes,
assessment, source dates and receipt binding. Ordinary source refresh can create
an immutable revision against the same prospect identity; the existing queue
fences permit replacement only after a safe pre-inference research failure.
Active/unknown sessions, outputs, sends, opt-outs and acknowledgements are not
reset. Spending, the five-attempt America/Chicago cap, suppression, prior-contact
checks and private server postal configuration retain their separate authority.

Offline regressions use four genuine official routes: Suds City LA, DeBourgh,
P4Swiss/Lindel (different email domain), and Capacity Midwest. Their inboxes are
routing options, not proven decision makers or interest. A release rehearsal can
provide unchanged report bytes as `artifact.rawBase64` and their verified
SHA-256 while keeping production publication and send activation with the owner.

Validation: `npm run check`, focused communications/admission tests and the full
coverage suite; merge/deployment remains gated by the complete GitHub CI workflow.
