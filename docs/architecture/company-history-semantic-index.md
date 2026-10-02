# Company history semantic index

The canonical history sources remain existing company-controlled Firestore
records. `blueprintResearchLearning/default/historySearchIndex/<sha256 of source
ID>` contains a derived, portable JSON embedding cache. Each version-1 row binds
the exact canonical source ID, source SHA-256, projected-text SHA-256, embedding
model, dimensions, finite nonzero vector and timestamp. Source/text/model changes
invalidate reuse. The original history, access scope and source evidence still
authorize every result; vectors never replace evidence or grant access.

The shared history service passes an explicit trusted-host
`HistoryEmbeddingAuthority`. It defaults to disabled at integration. An API key
does not grant permission. The default adapter reuses `embedTexts`, with the
actual configured model checked before calls. The default is OpenAI
`text-embedding-3-small`; `OPENAI_EMBEDDING_MODEL` selects another model, and
approved settings must match its actual model and vector dimensions.
Input bounds apply to newly
embedded text in one request; oversized records receive diagnostics rather than
silent truncation. Keyword search, full-record fetch and continued paging remain
available when a record cannot be embedded.
No indexing, embedding calls, credentials or authority changes were performed
to verify this implementation. Activation requires existing explicit spending
authority; character bounds are not a dollar reservation or cost receipt.

The backend can read an existing approved settings document at
`blueprintResearchLearning/default/historySearchSettings/current` via
`loadHistoryEmbeddingAuthority`. Its exact JSON shape is `{schemaVersion: 1,
authorizationRef, expiresAt, authority: {enabled, model, dimensions,
maxInputCharacters}}`. The approval reference must be nonempty and the expiry
must be in the future. Missing, malformed, expired or unreadable settings never
activate calls; no settings writes or environment toggles are performed here.
Loaded approval provenance is retained in the authority and expiry is rechecked
immediately before provider work. Search-tool arguments cannot supply authority.
Successful vector-only calls explicitly emit
`history_embedding_paid_usage_unknown`; they do not fabricate zero usage or a
dollar ceiling. Query diagnostics must be retained by the shared search service.

Cached records are usable only after exact source/text/model/dimension checks.
Malformed cached siblings, stale sources, provider errors and persistence errors
produce structured diagnostics directing keyword search or history browsing.
Failed writes do not present new in-memory vectors as retained canonical data.
The index reader uses document-ID cursors and carries its cursor past malformed
records. A transport page is never a permanent limit on the searchable corpus.
Agents can broaden their query and page through authorized history; semantic
ranking is relevance, not factual support or a city eligibility filter.

Recovery/export uses the existing authenticated Admin Firestore binding and
`readHistoryIndexPage`, which yields plain JSON rows and cursor/diagnostics. No
provider session, Library ID, external vector database or new service is needed.
Rebuild vectors from authorized canonical records after a model or source
change. Provider/model replacement must use a compatible explicit authority and
regenerate incompatible vectors. Tests use deterministic concept vectors and
exercise actual cosine ranking for paraphrases and cross-city relevance; they
do not prove live provider semantic quality, Firestore access or deployed tool
availability.
