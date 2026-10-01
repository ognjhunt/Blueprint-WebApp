# Received daily spend evidence

The owner-requested spend visibility change preserves OpenAI's already received
daily cost buckets in `summary.daily_evidence`. The single existing request keeps
its exact start/end, `bucket_width=1d` and `limit=31`; it adds no grouping, pages,
calls, polling or credentials. This session does not run the live collector.

Rows retain source interval, currency, project/line item, collection time and
response-byte digest. Stable source keys and revision IDs support deduplication
and signed credit corrections. Invalid amounts/currencies, conflicting duplicate
rows, unknown/incomplete pagination and unproven requested-window coverage yield
unknown period amounts. Complete valid USD responses retain the compatible
summary fields. A net-zero response with positive charges offset by credits does
not prove the zero-API-spend guardrail.

UTC buckets remain UTC. They do not establish Chicago usage days. Provider data
freshness remains unknown when the response lacks a provider observation time;
collecting/reading the same data cannot refresh it. The existing Pipeline offline
observer and private before-dispatch billing journal are a separate source. This
WebApp change does not claim all-workflow request counters or a full company/day
spend total.

The existing authorized Notion publisher may consume these rows and the Pipeline
sanitized snapshot through existing read routes. It must upsert by Source key,
retain corrections/provenance, keep invoices/cash/prepaid/reservations separate,
and verify saved revision readback. No new service, route, schedule, provider read,
credential grant or parent-digest dependency is introduced here.

Focused offline tests verify unchanged request count/query, source rows/digests,
null/invalid currency, partial pages, stable identities, credit/conflict handling,
redaction and gross-positive zero-spend proof. Typecheck and the required Graphify
refresh run locally; exact-head CI and independent Sol review gate release.
Communications and research-learning source files are untouched. The actual ADP
backlog/day gate was not supplied; no program closeout is claimed.

Live source access in the delegated environment is blocked by the existing
operator door's proxy 403. Notion page/schema reads succeeded, but actual daily
evidence ingestion and saved data readback require the existing owner route.
Missing provider/day coverage is unknown, never zero.
