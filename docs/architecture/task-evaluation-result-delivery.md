# Private Task Evaluation Result delivery

The buyer app exposes sealed results inside **Task Evaluation Runs**. For ten or
more robot teams, the access model stays tenant-first:

- a run owner always sees its result;
- members of the same verified Firebase tenant see team results;
- owner-declared or user-scoped captures remain owner-only;
- Blueprint `admin`/`ops` users get a cross-team operations view;
- there is no public leaderboard or cross-team score comparison by default.

The Pipeline publishes `task_evaluation_run_publication.v2`. The WebApp verifies
the Evidence Plan, Decision Envelope, result-delivery digest, stage state,
episode/artifact joins, and absence of secret-like values before storage. Access
scope is derived from the authoritative capture session, never from the Pipeline
payload.

The result detail is designed for desktop and phone review. It shows the bounded
decision, evidence completeness, five delivery stages, per-episode outcome,
external and wrist views, a review-only overview, receipts/manifests, and review
or full-evidence ZIP downloads. Videos load on demand to avoid transferring every
episode to a phone automatically.

Media stays in Pipeline storage. After tenant authorization, the app issues a
15-minute HMAC ticket so the browser can stream, seek, and download without
placing a Firebase identity token in a URL or buffering a full ZIP in memory.
The Pipeline re-verifies the registry digest, artifact path, byte size, and
SHA-256 before serving. Email or Drive can carry a notification, but neither
is an evidence authority or canonical delivery location.
